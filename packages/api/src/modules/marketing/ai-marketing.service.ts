import { Product } from '../../models/Product.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { AiCampaignLog } from '../../models/AiCampaignLog.model.js';
import { sendNotification } from '../superadmin/superadmin.service.js';
import { sendBroadcastCampaign } from '../whatsapp/whatsapp.service.js';

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}

async function callGemini(body: any): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  let lastError = '';
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
        lastError = `${model} returned empty text`;
        continue;
      }

      lastError = `${model} returned HTTP ${response.status}`;
    } catch (err: any) {
      lastError = `${model} failed: ${err.message}`;
    }
  }

  throw new Error(`Gemini service unavailable: ${lastError}`);
}

/**
 * Derives current agricultural season & crop stage in Central/North India (Chhattisgarh)
 */
export function getSeasonalContext() {
  const date = new Date();
  const month = date.toLocaleString('en-US', { month: 'long' });
  const monthIndex = date.getMonth(); // 0-indexed

  let season = 'Kharif';
  let primaryCrops = 'धान (Paddy), मक्का (Maize), सोयाबीन (Soybean), सब्जियां (Vegetables)';
  let majorRisks = 'तना छेदक (Stem borer), पत्ती लपेटक (Leaf folder), शीथ ब्लास्ट (Sheath blast), माहू (BPH/Aphids)';

  if (monthIndex >= 5 && monthIndex <= 9) {
    // June - October: Kharif
    season = 'Kharif (खरीफ मौसम)';
    primaryCrops = 'धान (Paddy), मक्का (Maize), सोयाबीन (Soybean), कपास, अरहर, सब्जियां';
    majorRisks =
      monthIndex >= 8
        ? 'धान में बाली निकलते समय तना छेदक, शीथ रॉट, नेक ब्लास्ट और माहू (BPH) का भारी प्रकोप'
        : 'शुरुआती खरपतवार, इल्ली, फफूंद व पत्ती खाने वाले कीड़े';
  } else if (monthIndex >= 10 || monthIndex <= 2) {
    // Nov - March: Rabi
    season = 'Rabi (रबी मौसम)';
    primaryCrops = 'गेहूं (Wheat), चना (Gram), सरसों (Mustard), मटर, आलू, सब्जियां';
    majorRisks = 'उकठा रोग (Wilt), रतुआ/गेरुआ (Rust), चूर्णिल आसिता (Powdery Mildew), माहू/एफिड्स';
  } else {
    // April - May: Zaid
    season = 'Zaid (जायद मौसम)';
    primaryCrops = 'मूंग, उड़द, तरबूज, खीरा, ककड़ी, ग्रीष्मकालीन सब्जियां';
    majorRisks = 'सफेद मक्खी (Whitefly), थ्रिप्स, माइट्स, फल छेदक इल्ली';
  }

  return {
    month,
    season,
    primaryCrops,
    majorRisks,
    formattedDate: date.toISOString().split('T')[0],
  };
}

export interface GeneratedAdvisory {
  targetCrop: string;
  targetIssue: string;
  productId: string;
  productTitle: string;
  productImage: string;
  productLink: string;
  pushTitle: string;
  pushBody: string;
  whatsappMessage: string;
  seasonContext: string;
}

/**
 * Asks Gemini to inspect the real Vaniki catalog & generate seasonal advisory + push + WhatsApp copy
 */
export async function generateDailyAdvisory(options?: {
  productId?: string;
  targetAudience?: 'customers' | 'dealers' | 'all';
}): Promise<GeneratedAdvisory> {
  const season = getSeasonalContext();
  const audience = options?.targetAudience || 'customers';

  // Fetch active products from DB
  const products = await Product.find({ isActive: true })
    .select('name slug category description targetCrops diseases variants images')
    .lean();

  if (!products || products.length === 0) {
    throw new Error('No active products found in catalog to generate advisory from');
  }

  // Format concise catalog summary for Gemini
  const catalogSummary = products.map((p: any) => ({
    id: String(p._id),
    title: p.name || p.title,
    category: p.category,
    targetCrops: p.targetCrops || [],
    diseases: p.diseases || [],
    image: p.images?.[0]?.url || 'https://vanikicrop.com/uploads/vaniki/products/1776492631768-c5024e5b-f13a-44fb-b1fd-af9985b93241.png',
    slug: p.slug,
    price: p.variants?.[0]?.price || '',
  }));

  const audiencePrompt =
    audience === 'dealers'
      ? `TARGET AUDIENCE: Vaniki Retail Dealers and Agro Store Owners. Emphasize dealer profit margins, timely seasonal stock availability for their farmer customers, carton packaging, and fast booking before peak season.`
      : `TARGET AUDIENCE: Farmers and Crop Growers. Emphasize crop disease diagnosis, pest attack prevention, dosage instructions, and healthy harvest yields.`;

  const specificProductPrompt = options?.productId
    ? `MANDATORY PRODUCT: You MUST select the product with id: "${options.productId}". Generate the best advisory specifically for this product.`
    : `Select exactly ONE product from the catalog that directly solves a critical disease or pest active in ${season.month}.`;

  const prompt = `You are the Head Agricultural Scientist and Chief Marketing Strategist for "Vaniki Crop Science Pvt. Ltd." (Chhattisgarh, India).
Your task is to analyze the current Indian agricultural season, select the most critical Vaniki product that growers or dealers urgently need THIS WEEK, and generate high-converting advisory content for App Push Notifications and WhatsApp.

${audiencePrompt}

CURRENT REAL-WORLD CONTEXT:
- Month: ${season.month}
- Agricultural Season: ${season.season}
- Dominant Crops in Region: ${season.primaryCrops}
- Active Pest/Disease Threats: ${season.majorRisks}

ACTIVE REAL PRODUCTS CATALOG FROM VANIKI DATABASE:
${JSON.stringify(catalogSummary, null, 2)}

STRICT RULES:
1. ${specificProductPrompt}
2. Output MUST be valid strict JSON only (no markdown code blocks, no backticks, no extra text).
3. "pushTitle": Engaging, bold, max 45 characters with 1-2 relevant emojis (e.g. "🌾 धान में तना छेदक का खतरा!").
4. "pushBody": Direct solution and call to action, max 95 characters (e.g. "Vaniki की प्रमाणित दवा से फसल को सुरक्षित रखें। आज ही ऑर्डर करें!").
5. "whatsappMessage": Pure, respectful farmer Hindi. Explain the symptoms, why this product is the best solution, dose recommendation, and invite the farmer to send crop photos on this WhatsApp for free diagnosis.
6. "productLink": Must be "/products" or "/product/" followed by the selected product's slug.

REQUIRED JSON FORMAT:
{
  "selectedProductId": "...",
  "targetCrop": "...",
  "targetIssue": "...",
  "pushTitle": "...",
  "pushBody": "...",
  "whatsappMessage": "..."
}`;

  const responseText = await callGemini({
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  });

  let parsed: any;
  try {
    const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    throw new Error(`Failed to parse Gemini response: ${err.message}. Raw text: ${responseText}`);
  }

  // Match selected product in DB
  const selectedProduct =
    products.find((p: any) => String(p._id) === (options?.productId || parsed.selectedProductId)) || products[0];

  const productImage =
    selectedProduct.images?.[0]?.url ||
    'https://vanikicrop.com/uploads/vaniki/products/1776492631768-c5024e5b-f13a-44fb-b1fd-af9985b93241.png';

  const productLink = selectedProduct.slug
    ? `https://vanikicrop.com/product/${selectedProduct.slug}`
    : 'https://vanikicrop.com/products';

  const prodTitle = (selectedProduct as any).name || (selectedProduct as any).title || 'Vaniki Agro Care';

  return {
    targetCrop: parsed.targetCrop || 'धान (Paddy)',
    targetIssue: parsed.targetIssue || 'कीट व फफूंद सुरक्षा',
    productId: String(selectedProduct._id),
    productTitle: prodTitle,
    productImage,
    productLink,
    pushTitle: parsed.pushTitle || `🌾 ${prodTitle} - फसल सुरक्षा ऑफर`,
    pushBody: parsed.pushBody || `फसल को कीटों से बचाएं। Vaniki Crop पर असली दवाएं उपलब्ध हैं।`,
    whatsappMessage: parsed.whatsappMessage || '',
    seasonContext: `${season.season} - ${season.month}`,
  };
}

/**
 * Executes the AI Campaign across Mobile Push Notifications and WhatsApp Broadcast
 */
export async function executeAiCampaign(params: {
  triggerType: 'scheduled' | 'manual';
  advisory?: GeneratedAdvisory;
  targetAudience?: 'customers' | 'dealers' | 'all';
  testNumbers?: string[];
  useTemplate?: boolean;
  sendPush?: boolean;
  sendWhatsApp?: boolean;
  adminUserId?: string;
}) {
  const {
    triggerType,
    advisory: providedAdvisory,
    targetAudience = 'customers',
    testNumbers,
    useTemplate = true,
    sendPush = true,
    sendWhatsApp = true,
    adminUserId,
  } = params;

  const advisory = providedAdvisory || (await generateDailyAdvisory({ targetAudience }));
  const dateStr = new Date().toISOString().split('T')[0];

  let pushSentCount = 0;
  let waSentCount = 0;
  let errorDetails = '';

  // 1. Mobile App Push Notification (FCM + Expo)
  if (sendPush) {
    try {
      const pushAudience =
        targetAudience === 'all' ? 'both' : targetAudience === 'dealers' ? 'dealers' : 'customers';

      const pushRes = await sendNotification(
        {
          title: advisory.pushTitle,
          body: advisory.pushBody,
          link: advisory.productLink,
          targetAudience: pushAudience,
        },
        adminUserId || '000000000000000000000000',
      );
      pushSentCount = pushRes.sentCount || 0;
    } catch (err: any) {
      console.error('[AI Engine] Push notification error:', err.message);
      errorDetails += `Push error: ${err.message}; `;
    }
  }

  // 2. WhatsApp Broadcast (using Approved 'vaniki' Template OR Direct Custom Message)
  if (sendWhatsApp) {
    try {
      const isCustomTest = Array.isArray(testNumbers) && testNumbers.length > 0;
      const waAudience = isCustomTest ? 'custom' : targetAudience;

      const waRes = await sendBroadcastCampaign({
        templateName: useTemplate ? 'vaniki' : undefined,
        imageUrl: advisory.productImage,
        message: advisory.whatsappMessage,
        link: advisory.productLink,
        targetAudience: waAudience,
        numbers: isCustomTest ? testNumbers : undefined,
        languageCode: 'en',
      });
      waSentCount = waRes.sent || 0;
    } catch (err: any) {
      console.error('[AI Engine] WhatsApp broadcast error:', err.message);
      errorDetails += `WhatsApp error: ${err.message}; `;
    }
  }

  const status =
    pushSentCount > 0 && waSentCount > 0
      ? 'completed'
      : pushSentCount > 0 || waSentCount > 0
        ? 'partial'
        : 'failed';

  // Record in Database
  const log = await AiCampaignLog.create({
    date: dateStr,
    seasonContext: advisory.seasonContext,
    targetCrop: advisory.targetCrop,
    targetIssue: advisory.targetIssue,
    productId: advisory.productId,
    productTitle: advisory.productTitle,
    productImage: advisory.productImage,
    productLink: advisory.productLink,
    pushTitle: advisory.pushTitle,
    pushBody: advisory.pushBody,
    whatsappMessage: advisory.whatsappMessage,
    pushSentCount,
    waSentCount,
    triggerType,
    status,
    errorDetails,
  });

  return {
    success: true,
    log,
    advisory,
    stats: {
      pushSent: pushSentCount,
      whatsappSent: waSentCount,
      status,
    },
  };
}

/**
 * Gets historical AI campaigns
 */
export async function getAiCampaignHistory(page = 1, limit = 15) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 15));
  const skip = (safePage - 1) * safeLimit;

  const [logs, total] = await Promise.all([
    AiCampaignLog.find().sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    AiCampaignLog.countDocuments(),
  ]);

  return {
    logs,
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

/**
 * Gets or sets the Auto-Pilot configuration in SiteSettings
 */
export async function getAiAutoPilotSettings() {
  const setting = await SiteSetting.findOne({ singletonKey: 'default' }).lean();
  const raw = (setting as any)?.aiMarketingConfig || {};

  return {
    enabled: raw.enabled !== undefined ? raw.enabled : true,
    dailyTime: raw.dailyTime || '09:00',
    channels: {
      whatsapp: raw.channels?.whatsapp !== undefined ? raw.channels.whatsapp : true,
      push: raw.channels?.push !== undefined ? raw.channels.push : true,
    },
    whatsappIntervalDays: raw.whatsappIntervalDays !== undefined ? raw.whatsappIntervalDays : 2,
    lastRunDate: raw.lastRunDate || '',
    lastWhatsAppRunDate: raw.lastWhatsAppRunDate || '',
  };
}

export async function updateAiAutoPilotSettings(update: {
  enabled?: boolean;
  dailyTime?: string;
  channels?: { whatsapp?: boolean; push?: boolean };
  whatsappIntervalDays?: number;
}) {
  const setting = await SiteSetting.findOne({ singletonKey: 'default' });
  if (!setting) throw new Error('SiteSetting not found');

  const current = (setting as any).aiMarketingConfig || {};
  (setting as any).aiMarketingConfig = {
    ...current,
    ...update,
    whatsappIntervalDays:
      update.whatsappIntervalDays !== undefined
        ? Number(update.whatsappIntervalDays)
        : current.whatsappIntervalDays !== undefined
          ? current.whatsappIntervalDays
          : 2,
    channels: {
      ...current.channels,
      ...update.channels,
    },
  };

  setting.markModified('aiMarketingConfig');
  await setting.save();

  return getAiAutoPilotSettings();
}

/**
 * Scheduled background checker: Runs every 10 minutes to verify if daily campaign should trigger
 */
export async function checkAndRunScheduledCampaign() {
  try {
    const config = await getAiAutoPilotSettings();
    if (!config.enabled) return;

    // Time check in IST (UTC+5:30)
    const now = new Date();
    const utcOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + utcOffset);
    const todayStr = istTime.toISOString().split('T')[0];

    // Already ran today?
    if (config.lastRunDate === todayStr) return;

    const currentHours = istTime.getUTCHours();
    const currentMinutes = istTime.getUTCMinutes();
    const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

    const [targetHour, targetMinute] = (config.dailyTime || '09:00').split(':').map(Number);
    const isPastTargetTime =
      currentHours > targetHour || (currentHours === targetHour && currentMinutes >= targetMinute);

    if (isPastTargetTime) {
      console.log(`[AI Marketing Engine] Triggering automated daily campaign for date: ${todayStr} at ${currentTimeStr} IST`);

      // Determine if WhatsApp broadcast should run today based on interval (e.g. 2 days)
      let shouldSendWhatsApp = Boolean(config.channels.whatsapp);
      const interval = config.whatsappIntervalDays !== undefined ? config.whatsappIntervalDays : 2;

      if (shouldSendWhatsApp && config.lastWhatsAppRunDate) {
        const lastMs = new Date(config.lastWhatsAppRunDate).getTime();
        const todayMs = new Date(todayStr).getTime();
        const daysPassed = Math.floor((todayMs - lastMs) / (1000 * 60 * 60 * 24));

        if (daysPassed < interval) {
          console.log(
            `⏭️ [AI Marketing] Skipping WhatsApp broadcast today. WhatsApp interval is set to every ${interval} days. Last sent: ${config.lastWhatsAppRunDate} (${daysPassed} day(s) ago). Next due in ${interval - daysPassed} day(s).`,
          );
          shouldSendWhatsApp = false;
        }
      }

      // Mark run dates in SiteSetting
      const updateFields: any = {
        'aiMarketingConfig.lastRunDate': todayStr,
      };
      if (shouldSendWhatsApp) {
        updateFields['aiMarketingConfig.lastWhatsAppRunDate'] = todayStr;
      }

      await SiteSetting.updateOne(
        { singletonKey: 'default' },
        { $set: updateFields },
      );

      const result = await executeAiCampaign({
        triggerType: 'scheduled',
        sendPush: Boolean(config.channels.push),
        sendWhatsApp: shouldSendWhatsApp,
      });

      console.log('[AI Marketing Engine] Daily campaign completed:', result.stats);
    }
  } catch (err: any) {
    console.error('[AI Marketing Engine] Scheduler error:', err.message);
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function initAiMarketingScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);

  // Check every 10 minutes
  schedulerTimer = setInterval(
    () => {
      checkAndRunScheduledCampaign().catch(() => undefined);
    },
    10 * 60 * 1000,
  );

  console.log('🤖 [AI Marketing Engine] Automated daily scheduler initialized (Runs daily at 09:00 AM IST)');
}
