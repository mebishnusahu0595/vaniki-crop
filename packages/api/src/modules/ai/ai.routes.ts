import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Product } from '../../models/Product.model.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Agri Advisor lives here rather than in the mobile app so GEMINI_API_KEY never ships
 * inside the APK. The catalog is read straight from Mongo, so the client no longer
 * uploads 60 products with every message either.
 */
const router: Router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Ordered by preference — default is gemini-3.5-flash-lite, followed by fallbacks.
const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
];

const CATALOG_LIMIT = 60;
const MAX_HISTORY_TURNS = 12;
const MAX_PROMPT_CHARS = 2000;
// ~4MB of base64 ≈ a 3MB photo; anything larger is a client bug, not a real crop photo.
const MAX_IMAGE_CHARS = 4_000_000;

// Gemini calls cost money per request, so this endpoint gets a much tighter budget
// than the global limiter (1200 / 15 min).
const advisorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many advisor requests. Please wait a few minutes.' },
});

function stripHtml(value?: string): string {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  images?: Array<{ url: string; publicId?: string; isPrimary?: boolean }>;
  variants?: Array<{ price?: number; mrp?: number }>;
  category?: { name?: string; slug?: string };
}

function buildSystemInstruction(catalog: CatalogProduct[], isEnglish: boolean): string {
  const catalogContext = catalog
    .map(
      (p) =>
        `• PRODUCT NAME: "${p.name}" (Slug: "${p.slug}")
  Category: "${p.category?.name || 'Crop Care'}"
  Price: ₹${p.variants?.[0]?.price || 0} (MRP: ₹${p.variants?.[0]?.mrp || p.variants?.[0]?.price || 0})
  Full Details & Usage: "${stripHtml(p.description || p.shortDescription || p.name).slice(0, 350)}"`,
    )
    .join('\n\n');

  return `You are Vaniki Crop AI Assistant ("Vaniki Crop Doctor / वनिकी फसल डॉक्टर"), an expert Agricultural Advisory Specialist for Indian Farmers.
Your goal is to diagnose crop diseases, pest infestations, weed issues, soil health, and offer precise solutions.

FORMATTING INSTRUCTION:
Do NOT output triple asterisks (***) or headers like ### or horizontal dividers like ---. Use standard bold text like **Product Name** or **Key Benefit** and numbered points (1., 2., 3.).

CONVERSATION MEMORY & REASONING RULE:
You MUST maintain full conversation memory with the farmer. Remember previous messages, photos shared, and questions asked in the chat thread. Never ask the farmer to repeat information they already gave you in previous messages!

OFFICIAL VANIKI CROP STORE DATABASE ACCESS:
You have complete access to the official Vaniki Crop store product database below:

${catalogContext}

CRITICAL RULES FOR RECOMMENDATIONS:
1. Always analyze the full chat history, crop type, symptoms, or photo context before replying.
2. EXCLUSIVELY recommend matching products from the Vaniki Crop catalog above. Mention exact product names in quotes.
3. Explain WHY the recommended product cures the specific crop disease/pest based on its store database description.
4. Give clear spray dosage and application instructions (e.g. 250ml per acre mixed with 150-200L water).
5. Always answer in ${isEnglish ? 'ENGLISH' : 'HINDI'} politely.`;
}

/** Picks the catalog products the model actually named in its answer. */
function matchRecommendedProducts(answer: string, catalog: CatalogProduct[]): CatalogProduct[] {
  const lowerText = answer.toLowerCase();
  const matched = catalog.filter(
    (p) => lowerText.includes(p.name.toLowerCase()) || lowerText.includes(p.slug.toLowerCase()),
  );

  if (matched.length > 0) return matched.slice(0, 3);

  // The model sometimes describes a remedy without naming a SKU — fall back to the
  // category it clearly talked about so the farmer still gets something to tap.
  const categoryHints: Array<[string[], string[]]> = [
    [['insecticide', 'pesticide'], ['pesticide', 'insect', 'pest', 'कीट', 'कीड़ा']],
    [['herbicide'], ['herbicide', 'weed', 'खरपतवार']],
    [['fungicide'], ['fungicide', 'fungus', 'फफूंद']],
    [['bio', 'growth'], ['growth', 'tonic', 'seaweed', 'बढ़वार']],
  ];

  for (const [categorySlugs, keywords] of categoryHints) {
    if (!keywords.some((word) => lowerText.includes(word))) continue;
    const hit = catalog.find((p) =>
      categorySlugs.some((slug) => (p.category?.slug || '').includes(slug)),
    );
    if (hit) return [hit];
  }

  return [];
}

async function callGemini(body: unknown): Promise<string> {
  let lastError = '';

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (response.ok) {
        const data = (await response.json()) as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        lastError = `${model} returned no text`;
        continue;
      }

      lastError = `${model} returned ${response.status}`;
    } catch (error) {
      lastError = `${model} fetch failed: ${(error as Error).message}`;
    }
  }

  throw new AppError(`Agri Advisor is temporarily unavailable (${lastError})`, 503);
}

/**
 * POST /api/ai/agri-advisor
 * Body: { prompt, history?: [{ sender: 'user'|'ai', text }], imageBase64?, language? }
 */
router.post('/agri-advisor', advisorLimiter, async (req, res, next) => {
  try {
    if (!GEMINI_API_KEY) {
      throw new AppError('Agri Advisor is not configured on this server.', 503);
    }

    const { prompt, history, imageBase64, language } = req.body || {};
    const isEnglish = !String(language || 'en').startsWith('hi');
    const cleanPrompt = String(prompt || '').trim().slice(0, MAX_PROMPT_CHARS);

    if (!cleanPrompt && !imageBase64) {
      throw new AppError('Send a question or a crop photo.', 400);
    }
    if (typeof imageBase64 === 'string' && imageBase64.length > MAX_IMAGE_CHARS) {
      throw new AppError('Photo is too large. Please send a smaller image.', 413);
    }

    const catalog = (await Product.find({ isActive: true })
      .select('name slug shortDescription description images variants category')
      .populate('category', 'name slug')
      .sort({ totalSold: -1 })
      .limit(CATALOG_LIMIT)
      .lean()) as unknown as CatalogProduct[];

    const contents: any[] = [];

    for (const message of (Array.isArray(history) ? history : []).slice(-MAX_HISTORY_TURNS)) {
      const text = String(message?.text || '').trim();
      if (!text) continue;
      contents.push({
        role: message?.sender === 'ai' ? 'model' : 'user',
        parts: [{ text: text.slice(0, MAX_PROMPT_CHARS) }],
      });
    }

    const currentParts: any[] = [
      {
        text:
          cleanPrompt ||
          (isEnglish
            ? 'Please inspect my crop photo and advise the right product.'
            : 'कृपया मेरी फसल की जांच करें और सही दवा बताएं।'),
      },
    ];

    if (imageBase64) {
      currentParts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: String(imageBase64).replace(/^data:image\/\w+;base64,/, ''),
        },
      });
    }

    contents.push({ role: 'user', parts: currentParts });

    const text = await callGemini({
      system_instruction: { parts: [{ text: buildSystemInstruction(catalog, isEnglish) }] },
      contents,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1000 },
    });

    res.status(200).json({
      success: true,
      data: {
        text,
        recommendedProducts: matchRecommendedProducts(text, catalog),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
