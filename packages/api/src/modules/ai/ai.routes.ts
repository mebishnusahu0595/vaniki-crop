import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Product } from '../../models/Product.model.js';
import { AgriAdvisorQuestion } from '../../models/AgriAdvisorQuestion.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { AppError } from '../../utils/AppError.js';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';

const router: Router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

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

const CATALOG_LIMIT = 80;
const MAX_HISTORY_TURNS = 12;
const MAX_PROMPT_CHARS = 2000;
const MAX_IMAGE_CHARS = 4_000_000;

const advisorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 60),
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
  dosage?: string;
  images?: Array<{ url: string; publicId?: string; isPrimary?: boolean }>;
  variants?: Array<{ price?: number; mrp?: number }>;
  category?: { name?: string; slug?: string };
}

function buildSystemInstruction(
  catalog: CatalogProduct[],
  isEnglish: boolean,
  customRules?: string,
): string {
  const catalogContext = catalog
    .map(
      (p) =>
        `• PRODUCT NAME: "${p.name}" (Slug: "${p.slug}")
  Category: "${p.category?.name || 'Crop Care'}"
  Price: ₹${p.variants?.[0]?.price || 0} (MRP: ₹${p.variants?.[0]?.mrp || p.variants?.[0]?.price || 0})
  Official Dosage: "${p.dosage || 'Follow label guidelines / recommended dosage'}"
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
4. When recommending spray dosage, ALWAYS adhere to the Official Dosage from the catalog above. Never invent, exaggerate, or guess incorrect dosages!
5. Always answer in ${isEnglish ? 'ENGLISH' : 'HINDI'} politely.${
    customRules
      ? `\n\nSUPERADMIN SPECIAL ADVISORY RULES & GUIDELINES (MANDATORY):\n${customRules}`
      : ''
  }`;
}

/** Picks the catalog products the model actually named in its answer. */
function matchRecommendedProducts(answer: string, catalog: CatalogProduct[]): CatalogProduct[] {
  const lowerText = answer.toLowerCase();
  const matched = catalog.filter(
    (p) => lowerText.includes(p.name.toLowerCase()) || lowerText.includes(p.slug.toLowerCase()),
  );

  if (matched.length > 0) return matched.slice(0, 3);

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

// ─────────────────────────────────────────────────────────────────────────────
// Public Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/ai/agri-advisor/questions
 * Returns active suggested questions along with populated recommended products
 */
router.get('/agri-advisor/questions', async (_req, res, next) => {
  try {
    const questions = await AgriAdvisorQuestion.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .populate({
        path: 'recommendedProductIds',
        select: 'name slug images variants category dosage',
        populate: { path: 'category', select: 'name slug' },
      })
      .lean();

    res.status(200).json({
      success: true,
      data: questions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/agri-advisor
 * Body: { prompt, history?: [{ sender: 'user'|'ai', text }], imageBase64?, language? }
 */
router.post('/agri-advisor', advisorLimiter, async (req, res, next) => {
  try {
    const { prompt, history, imageBase64, language } = req.body || {};
    const isEnglish = !String(language || 'en').startsWith('hi');
    const cleanPrompt = String(prompt || '').trim().slice(0, MAX_PROMPT_CHARS);

    if (!cleanPrompt && !imageBase64) {
      throw new AppError('Send a question or a crop photo.', 400);
    }
    if (typeof imageBase64 === 'string' && imageBase64.length > MAX_IMAGE_CHARS) {
      throw new AppError('Photo is too large. Please send a smaller image.', 413);
    }

    // 1. Check if the user's question matches any Superadmin Curated Question
    if (cleanPrompt && !imageBase64) {
      const normalizedQuery = cleanPrompt
        .toLowerCase()
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // strip emojis
        .replace(/[^\w\s\u0900-\u097F]/gi, '') // keep letters, numbers, devanagari
        .trim();

      const curatedQuestions = await AgriAdvisorQuestion.find({ isActive: true })
        .populate({
          path: 'recommendedProductIds',
          select: 'name slug images variants category dosage',
          populate: { path: 'category', select: 'name slug' },
        })
        .lean();

      for (const q of curatedQuestions) {
        const normEn = q.questionEn
          .toLowerCase()
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
          .replace(/[^\w\s]/gi, '')
          .trim();
        const normHi = q.questionHi
          .toLowerCase()
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
          .replace(/[^\w\s\u0900-\u097F]/gi, '')
          .trim();

        if (
          (normEn && (normalizedQuery === normEn || normalizedQuery.includes(normEn) || normEn.includes(normalizedQuery))) ||
          (normHi && (normalizedQuery === normHi || normalizedQuery.includes(normHi) || normHi.includes(normalizedQuery)))
        ) {
          // Direct verified answer from Superadmin!
          const answerText = isEnglish ? q.answerEn : q.answerHi;
          return res.status(200).json({
            success: true,
            data: {
              text: answerText,
              recommendedProducts: q.recommendedProductIds || [],
              isCurated: true,
            },
          });
        }
      }
    }

    // 2. Freeform query to Gemini
    if (!GEMINI_API_KEY) {
      throw new AppError('Agri Advisor is not configured on this server.', 503);
    }

    // Load site settings for custom advisor rules
    const settings = await SiteSetting.findOne().select('advisorRules').lean();
    const customRules = settings?.advisorRules || '';

    const catalog = (await Product.find({ isActive: true })
      .select('name slug shortDescription description dosage images variants category')
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
      system_instruction: { parts: [{ text: buildSystemInstruction(catalog, isEnglish, customRules) }] },
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

// ─────────────────────────────────────────────────────────────────────────────
// Superadmin Management Endpoints (CRUD)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin/questions', requireAuth, requireSuperAdmin, async (_req, res, next) => {
  try {
    const questions = await AgriAdvisorQuestion.find()
      .sort({ sortOrder: 1, createdAt: -1 })
      .populate({
        path: 'recommendedProductIds',
        select: 'name slug images variants category dosage',
      })
      .lean();

    res.status(200).json({
      success: true,
      data: questions,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/questions', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { questionEn, questionHi, answerEn, answerHi, recommendedProductIds, isActive, sortOrder } = req.body;

    if (!questionEn || !questionHi || !answerEn || !answerHi) {
      throw new AppError('Question and Answer in both English and Hindi are required.', 400);
    }

    const created = await AgriAdvisorQuestion.create({
      questionEn: String(questionEn).trim(),
      questionHi: String(questionHi).trim(),
      answerEn: String(answerEn).trim(),
      answerHi: String(answerHi).trim(),
      recommendedProductIds: Array.isArray(recommendedProductIds) ? recommendedProductIds : [],
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      sortOrder: Number(sortOrder) || 0,
    });

    const populated = await AgriAdvisorQuestion.findById(created._id).populate({
      path: 'recommendedProductIds',
      select: 'name slug images variants category dosage',
    });

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Suggested Question created successfully',
    });
  } catch (error) {
    next(error);
  }
});

router.put('/admin/questions/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionEn, questionHi, answerEn, answerHi, recommendedProductIds, isActive, sortOrder } = req.body;

    const question = await AgriAdvisorQuestion.findById(id);
    if (!question) {
      throw new AppError('Question not found', 404);
    }

    if (questionEn !== undefined) question.questionEn = String(questionEn).trim();
    if (questionHi !== undefined) question.questionHi = String(questionHi).trim();
    if (answerEn !== undefined) question.answerEn = String(answerEn).trim();
    if (answerHi !== undefined) question.answerHi = String(answerHi).trim();
    if (recommendedProductIds !== undefined) {
      question.recommendedProductIds = Array.isArray(recommendedProductIds) ? (recommendedProductIds as any) : [];
    }
    if (isActive !== undefined) question.isActive = Boolean(isActive);
    if (sortOrder !== undefined) question.sortOrder = Number(sortOrder);

    await question.save();

    const populated = await AgriAdvisorQuestion.findById(question._id).populate({
      path: 'recommendedProductIds',
      select: 'name slug images variants category dosage',
    });

    res.status(200).json({
      success: true,
      data: populated,
      message: 'Suggested Question updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/admin/questions/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await AgriAdvisorQuestion.findByIdAndDelete(id);
    if (!deleted) {
      throw new AppError('Question not found', 404);
    }

    res.status(200).json({
      success: true,
      message: 'Suggested Question deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/rules', requireAuth, requireSuperAdmin, async (_req, res, next) => {
  try {
    const setting = await SiteSetting.findOne().select('advisorRules').lean();
    res.status(200).json({
      success: true,
      data: { advisorRules: setting?.advisorRules || '' },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/admin/rules', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { advisorRules } = req.body;
    let setting = await SiteSetting.findOne();
    if (!setting) {
      setting = await SiteSetting.create({ advisorRules: String(advisorRules || '').trim() });
    } else {
      setting.advisorRules = String(advisorRules || '').trim();
      await setting.save();
    }

    res.status(200).json({
      success: true,
      data: { advisorRules: setting.advisorRules },
      message: 'Advisor Rules updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
