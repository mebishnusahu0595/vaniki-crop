import type { Product } from '../types/storefront';
import { stripHtml } from '../utils/html';

const GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  '';

// Gemini Flash Model Candidates (Primary: gemini-3.5-flash / gemini-2.5-flash / gemini-2.0-flash)
const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
];

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  imageUri?: string;
  recommendedProducts?: Product[];
  timestamp: string;
}

export async function askGeminiAgriAdvisor(
  prompt: string,
  historyMessages: ChatMessage[] = [],
  imageBase64?: string,
  catalogProducts: Product[] = [],
  userLanguage: string = 'en'
): Promise<{ text: string; recommendedProducts: Product[] }> {
  // Format detailed store database product entries for Gemini AI
  const catalogContext = catalogProducts
    .map(
      (p) =>
        `• PRODUCT NAME: "${p.name}" (Slug: "${p.slug}")
  Category: "${p.category?.name || 'Crop Care'}"
  Price: ₹${p.variants[0]?.price || 0} (MRP: ₹${p.variants[0]?.mrp || p.variants[0]?.price || 0})
  Full Details & Usage: "${stripHtml(p.description || p.shortDescription || p.name).slice(0, 350)}"`
    )
    .join('\n\n');

  const isEnglish = userLanguage.startsWith('en');

  const systemInstruction = `You are Vaniki Crop AI Assistant ("Vaniki Crop Doctor / वनिकी फसल डॉक्टर"), an expert Agricultural Advisory Specialist for Indian Farmers.
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
2. EXCLUSIVELY recommend matching products from the Vaniki Crop catalog above. Mention exact product names in quotes like "HIGH POWER" or "505-RUDRA" or "PAROLI" or "NEXON" or "KASOL" or "VEER" or "PAYTHEN".
3. Explain WHY the recommended product cures the specific crop disease/pest based on its store database description.
4. Give clear spray dosage and application instructions (e.g. 250ml per acre mixed with 150-200L water).
5. Always answer in ${isEnglish ? 'ENGLISH' : 'HINDI'} politely.`;

  // Build multi-turn chat contents for Gemini API
  const contents: any[] = [];

  // 1. Append past conversation history turns (skipping initial welcome)
  const historyTurns = historyMessages.filter((msg) => msg.id !== 'welcome-1');
  for (const msg of historyTurns) {
    if (msg.sender === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: msg.text || 'User query' }],
      });
    } else if (msg.sender === 'ai') {
      contents.push({
        role: 'model',
        parts: [{ text: msg.text || 'AI response' }],
      });
    }
  }

  // 2. Append current user turn with prompt & image (if attached)
  const currentParts: any[] = [{ text: prompt || (isEnglish ? 'Please inspect my crop photo and advise the right product.' : 'कृपया मेरी फसल की जांच करें और सही दवा बताएं।') }];

  if (imageBase64) {
    currentParts.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      },
    });
  }

  contents.push({
    role: 'user',
    parts: currentParts,
  });

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1000,
    },
  };

  let lastErrorMsg = '';

  // Try candidate Gemini Flash model endpoints starting with gemini-3.5-flash / gemini-2.5-flash
  for (const modelName of CANDIDATE_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const aiText: string =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          (isEnglish
            ? 'Sorry, I encountered an issue processing your crop query. Please try again or contact our helpline.'
            : 'क्षमा करें, मुझे आपकी फसल की जानकारी संसाधित करने में समस्या आई। कृपया फिर से प्रयास करें या हमारे कृषि विशेषज्ञ से संपर्क करें।');

        // Extract recommended products mentioned in the AI response
        const recommendedProducts: Product[] = [];
        const lowerText = aiText.toLowerCase();

        for (const prod of catalogProducts) {
          const nameMatch = lowerText.includes(prod.name.toLowerCase());
          const slugMatch = lowerText.includes(prod.slug.toLowerCase());
          if ((nameMatch || slugMatch) && !recommendedProducts.some((p) => p.id === prod.id)) {
            recommendedProducts.push(prod);
          }
        }

        // Fallback: If AI didn't explicitly match, pick top 2 matching category products
        if (recommendedProducts.length === 0 && catalogProducts.length > 0) {
          if (lowerText.includes('pesticide') || lowerText.includes('insect') || lowerText.includes('pest') || lowerText.includes('कीट') || lowerText.includes('कीड़ा')) {
            const pestProd = catalogProducts.find((p) => p.category?.slug.includes('insecticide') || p.category?.slug.includes('pesticide'));
            if (pestProd) recommendedProducts.push(pestProd);
          } else if (lowerText.includes('herbicide') || lowerText.includes('weed') || lowerText.includes('खरपतवार')) {
            const herbProd = catalogProducts.find((p) => p.category?.slug.includes('herbicide'));
            if (herbProd) recommendedProducts.push(herbProd);
          } else if (lowerText.includes('fungicide') || lowerText.includes('fungus') || lowerText.includes('फफूंद')) {
            const fungProd = catalogProducts.find((p) => p.category?.slug.includes('fungicide'));
            if (fungProd) recommendedProducts.push(fungProd);
          } else if (lowerText.includes('growth') || lowerText.includes('tonic') || lowerText.includes('seaweed') || lowerText.includes('bean')) {
            const bioProd = catalogProducts.find((p) => p.category?.slug.includes('bio') || p.slug.includes('high-power') || p.slug.includes('kasol'));
            if (bioProd) recommendedProducts.push(bioProd);
          }
        }

        return {
          text: aiText,
          recommendedProducts: recommendedProducts.slice(0, 3),
        };
      } else {
        const errTxt = await response.text();
        lastErrorMsg = `Endpoint ${modelName} returned ${response.status}: ${errTxt}`;
        console.warn(`Gemini model ${modelName} returned status ${response.status}`);
      }
    } catch (err) {
      console.warn(`Fetch error for model ${modelName}:`, err);
    }
  }

  console.error('All Gemini AI model candidates failed:', lastErrorMsg);
  const fallbackProducts = catalogProducts.slice(0, 2);
  return {
    text: isEnglish
      ? 'Hello Farmer! For best crop growth and pest protection, use certified Vaniki Crop products. Check our recommended products below or chat with our experts on WhatsApp.'
      : 'नमस्कार किसान भाई! आपकी फसल के उत्तम विकास और सुरक्षा के लिए वनिकी क्रॉप के उत्पाद उपयोग करें। अधिक सहायता के लिए नीचे दिए गए उत्पादों को देखें या हमारे व्हाट्सएप नंबर पर संपर्क करें।',
    recommendedProducts: fallbackProducts,
  };
}
