import { User } from '../../models/User.model.js';
import { Order } from '../../models/Order.model.js';
import { Product } from '../../models/Product.model.js';
import { generateInvoicePdf } from '../orders/invoice.service.js';

const APP_URL = 'https://vanikicrop.com';
const DEALER_PORTAL_URL = 'https://vanikicrop.com/dealers';

const getPhoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID || '807659789103296';
const getWhatsAppToken = () => process.env.WHATSAPP_ACCESS_TOKEN || '';
const getGeminiApiKey = () => process.env.GEMINI_API_KEY || '';

// Gemini candidate models in order of preference
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

/**
 * Sends a WhatsApp message using Meta Cloud API
 */
export async function sendWhatsAppMessage(to: string, payload: any) {
  const token = getWhatsAppToken();
  const phoneId = getPhoneNumberId();
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        ...payload,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meta API Error:', JSON.stringify(data));
    }
    return data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return null;
  }
}

/**
 * Sends a simple text message (converts **markdown bold** to *whatsapp bold*)
 */
export async function sendTextMessage(to: string, text: string) {
  const formattedText = text.replace(/\*\*(.*?)\*\*/g, '*$1*');
  return sendWhatsAppMessage(to, {
    type: 'text',
    text: { body: formattedText, preview_url: true },
  });
}

/**
 * Sends an image message with optional caption on WhatsApp
 */
export async function sendImageMessage(to: string, imageUrl: string, caption?: string) {
  const formattedCaption = caption ? caption.replace(/\*\*(.*?)\*\*/g, '*$1*') : undefined;

  if (formattedCaption && formattedCaption.length > 1020) {
    // If caption is too long for Meta image caption limit (1024 chars), send image and text separately
    await sendWhatsAppMessage(to, {
      type: 'image',
      image: {
        link: imageUrl,
      },
    });
    return sendTextMessage(to, formattedCaption);
  }

  return sendWhatsAppMessage(to, {
    type: 'image',
    image: {
      link: imageUrl,
      ...(formattedCaption ? { caption: formattedCaption } : {}),
    },
  });
}

/**
 * Sends a pre-approved WhatsApp Marketing/Utility Template
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  components?: any[],
) {
  return sendWhatsAppMessage(to, {
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components || [],
    },
  });
}

/**
 * Uploads media (PDF/images) to Meta WhatsApp servers
 */
export async function uploadMedia(buffer: Buffer, filename: string, mimeType: string) {
  const token = getWhatsAppToken();
  const phoneId = getPhoneNumberId();
  const url = `https://graph.facebook.com/v20.0/${phoneId}/media`;

  try {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }), filename);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType.includes('pdf') ? 'document' : 'image');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = (await response.json()) as any;
    if (!response.ok) {
      console.error('Meta Media Upload Error:', data);
      return null;
    }
    return data.id;
  } catch (error) {
    console.error('Error uploading WhatsApp media:', error);
    return null;
  }
}

/**
 * Downloads incoming media (photos sent by farmers) from Meta servers
 */
export async function downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const token = getWhatsAppToken();

  try {
    const metaResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaResponse.ok) {
      console.error('Failed to get media URL from Meta:', await metaResponse.text());
      return null;
    }
    const metaData = (await metaResponse.json()) as any;
    const downloadUrl = metaData.url;
    const mimeType = metaData.mime_type || 'image/jpeg';

    if (!downloadUrl) return null;

    const binaryResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!binaryResponse.ok) {
      console.error('Failed to download media binary:', binaryResponse.statusText);
      return null;
    }

    const arrayBuffer = await binaryResponse.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType,
    };
  } catch (error) {
    console.error('Error downloading WhatsApp media:', error);
    return null;
  }
}

/**
 * Sends order invoice PDF via WhatsApp
 */
export async function sendOrderInvoice(orderId: string) {
  try {
    const order = await Order.findById(orderId)
      .populate('userId')
      .populate('storeId')
      .populate('items.productId');

    if (!order || !order.userId) return;

    const user = order.userId as any;
    const to = `91${user.mobile}`;

    const pdfBuffer = await generateInvoicePdf(order);
    const mediaId = await uploadMedia(pdfBuffer, `invoice-${order.orderNumber}.pdf`, 'application/pdf');

    if (!mediaId) {
      await sendTextMessage(
        to,
        `आपका आर्डर #${order.orderNumber} कन्फर्म हो गया है! आप यहाँ से इनवॉइस देख सकते हैं: ${APP_URL}/account/orders`,
      );
      return;
    }

    await sendWhatsAppMessage(to, {
      type: 'document',
      document: {
        id: mediaId,
        filename: `Invoice-${order.orderNumber}.pdf`,
        caption: `आपका आर्डर #${order.orderNumber} के लिए इनवॉइस। Vaniki Crop चुनने के लिए धन्यवाद! 🌾`,
      },
    });
  } catch (error) {
    console.error('Error in sendOrderInvoice:', error);
  }
}

/**
 * Executes a Gemini prompt with multi-model fallback
 */
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
 * Clean HTML tags from strings
 */
function cleanDescription(val: string): string {
  return (val || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
}

/**
 * Builds STRICT Product Catalog Context for FARMERS (Customers / Guests)
 * STRICT SECURITY: NEVER includes dealer/admin wholesale prices!
 */
function buildFarmerCatalogContext(products: any[]): string {
  return products
    .map((p: any) => {
      const v = p.variants?.[0] || {};
      const price = v.price || 0;
      const mrp = v.mrp || price;
      return `• उत्पाद: "${p.name}" (Slug: "${p.slug}")
  कैटेगरी: ${p.category?.name || 'Crop Protection'}
  कीमत: ₹${price} (MRP: ₹${mrp})
  उपयोग व इलाज: ${cleanDescription(p.description || p.shortDescription || p.name)}
  लिंक: ${APP_URL}/product/${p.slug}`;
    })
    .join('\n\n');
}

/**
 * Builds STRICT Product Catalog Context for DEALERS / STORE ADMINS
 * Shows Dealer Procurement Wholesale Price (adminPrice), Retail Price, MRP, Margin, and Peti Size
 */
function buildDealerCatalogContext(products: any[]): string {
  return products
    .map((p: any) => {
      const v = p.variants?.[0] || {};
      const dealerPrice = v.adminPrice !== undefined ? v.adminPrice : v.price;
      const retailPrice = v.price || dealerPrice;
      const mrp = v.mrp || retailPrice;
      const margin = mrp - dealerPrice;
      const peti = `${p.petiSize || 1} ${p.petiUnit || 'पीस'}`;
      const moq = p.moq || 1;

      return `• उत्पाद: "${p.name}" (Slug: "${p.slug}")
  कैटेगरी: ${p.category?.name || 'Crop Protection'}
  डीलर खरीद मूल्य (Dealer Wholesale Price): ₹${dealerPrice}
  किसान विक्रय मूल्य (Retail Price): ₹${retailPrice} (MRP: ₹${mrp})
  डीलर मुनाफा (Margin): ₹${margin} प्रति पीस
  पेटी/कार्टन पैकिंग: ${peti} (MOQ: ${moq})
  विवरण: ${cleanDescription(p.shortDescription || p.description || p.name)}
  डीलर आर्डर लिंक: ${DEALER_PORTAL_URL}`;
    })
    .join('\n\n');
}

/**
 * Matches recommended products in Gemini's response so we can send their photo cards
 */
function matchRecommendedProducts(text: string, catalog: any[]): any[] {
  const lower = text.toLowerCase();
  const matched = catalog.filter((p) => {
    const nameMatch = p.name && lower.includes(p.name.toLowerCase());
    const slugMatch = p.slug && lower.includes(p.slug.toLowerCase());
    return nameMatch || slugMatch;
  });

  if (matched.length > 0) return matched.slice(0, 2);

  // Category fallback if no exact product name matched
  const categoryHints: Array<[string[], string[]]> = [
    [['insecticide', 'pesticide'], ['pesticide', 'insect', 'pest', 'कीट', 'कीड़ा', 'इल्ली', 'माहो', 'सुंडी', 'माहू']],
    [['herbicide'], ['herbicide', 'weed', 'खरपतवार', 'घास', 'निराई']],
    [['fungicide'], ['fungicide', 'fungus', 'फफूंद', 'झुलसा', 'ब्लाइट', 'धब्बा', 'सड़न', 'शीथ']],
    [['bio', 'growth'], ['growth', 'tonic', 'seaweed', 'बढ़वार', 'टॉनिक', 'फुटाव', 'खाद']],
  ];

  for (const [categorySlugs, keywords] of categoryHints) {
    if (keywords.some((word) => lower.includes(word))) {
      const hit = catalog.find((p) =>
        categorySlugs.some((slug) => (p.category?.slug || '').toLowerCase().includes(slug)),
      );
      if (hit) return [hit];
    }
  }

  return [];
}

/**
 * Gemini AI Chat & Diagnosis Engine with STRICT Persona Separation (Farmer vs Dealer)
 */
async function handleGeminiAiChat(
  to: string,
  userPrompt: string,
  user: any | null,
  lang: string,
  imagePart?: { mimeType: string; data: string },
) {
  try {
    // 1. STRICT CATEGORIZATION: Check if user is an authorized Dealer
    const isDealer = Boolean(
      user && (user.role === 'storeAdmin' || user.role === 'superAdmin' || user.dealerProfile),
    );

    // Fetch live active database products
    const rawProducts = await Product.find({ isActive: true })
      .select('name slug shortDescription description images variants category petiSize petiUnit moq')
      .populate('category', 'name slug')
      .sort({ totalSold: -1 })
      .limit(60)
      .lean();

    let systemInstruction = '';
    let catalogContext = '';

    if (isDealer) {
      // ================= DEALER PERSONA =================
      catalogContext = buildDealerCatalogContext(rawProducts);

      systemInstruction = `You are the "Vaniki B2B Dealer Support Specialist" (वानिकी डीलर पार्टनर डेस्क) representing Vaniki Crop (vanikicrop.com).
The person messaging you is an AUTHORIZED AGRICULTURAL DEALER / RETAIL STORE OWNER.

CRITICAL DEALER RULES:
1. STRICT PRODUCT SOURCE: ONLY quote or recommend products from the OFFICIAL VANIKI B2B CATALOG below. NEVER mention external brands!
2. PRICING TRANSPARENCY: Always provide the DEALER PROCUREMENT PRICE (डीलर थोक रेट / adminPrice) and highlight their PROFIT MARGIN (मुनाफा) vs MRP/Retail.
3. PACKAGING & MOQ: Mention carton/peti size and MOQ for bulk ordering.
4. ORDERING LINK: Always direct the dealer to the DEALER PORTAL: ${DEALER_PORTAL_URL}
5. TONE: Professional B2B wholesale partner support. Respond in ${lang === 'hi' ? 'HINDI' : 'ENGLISH'}.
6. WHATSAPP FORMAT: Use single asterisks *like this* for bold, emoji bullets (🏪, 💰, 📦, 📈, 🛒).

ACTIONS FOR REGISTERED DEALERS:
If the dealer asks to check order status:
- [DEALER_ORDERS] : To check B2B stock & orders

OFFICIAL VANIKI B2B CATALOG:
${catalogContext}

DEALER PROFILE:
Store Name: ${user.dealerProfile?.storeName || user.name}, Mobile: ${user.mobile}`;
    } else {
      // ================= FARMER PERSONA =================
      catalogContext = buildFarmerCatalogContext(rawProducts);

      systemInstruction = `You are "Vaniki Crop Doctor" (वानिकी फसल डॉक्टर), an expert Agricultural AI Doctor for Indian Farmers representing Vaniki Crop (vanikicrop.com).
The person messaging you is a FARMER (किसान भाई).

CRITICAL STRICT RULES FOR FARMERS:
1. STRICT PRODUCT SOURCE: You are ABSOLUTELY FORBIDDEN from recommending any product outside the OFFICIAL VANIKI STORE CATALOG below! Only prescribe medicines available in this catalog.
2. STRICT PRICING PRIVACY: ONLY quote retail price (₹price) and MRP. ABSOLUTELY NEVER mention dealer price, wholesale price, or trade margins!
3. DOCTOR ADVICE: Explain the crop problem, symptoms, and exact spray dosage (e.g. *250ml प्रति एकड़ 150-200 लीटर पानी में*).
4. ORDERING LINK: Always provide the direct product buy link: ${APP_URL}/product/[slug]
5. TONE: Respectful, helpful, farmer-friendly. Respond in ${lang === 'hi' ? 'HINDI' : 'ENGLISH'}.
6. WHATSAPP FORMAT: Use single asterisks *like this* for bold, emoji bullets (🌿, 🐛, 💊, 💧, 🛒).

ACTIONS FOR REGISTERED FARMERS:
- [ORDER_HISTORY] : User wants to track recent orders
- [UPDATE_NAME:New Name] : Change profile name
- [UPDATE_ADDRESS:New Address] : Change delivery address
- [SET_PICKUP] : Switch to Store Pickup
- [SET_DELIVERY] : Switch to Home Delivery

OFFICIAL VANIKI STORE CATALOG:
${catalogContext}

USER INFO:
${user ? `Name: ${user.name}, Mobile: ${user.mobile}, Mode: ${user.serviceMode || 'delivery'}` : 'Guest Farmer (New visitor)'}`;
    }

    const parts: any[] = [];
    if (imagePart) {
      parts.push({
        inlineData: {
          mimeType: imagePart.mimeType,
          data: imagePart.data,
        },
      });
    }

    const queryText = userPrompt
      ? userPrompt
      : imagePart
        ? isDealer
          ? 'कृपया इस प्रोडक्ट या फसल की फोटो देखकर इसका डीलर थोक रेट और डिटेल्स बताएं।'
          : 'कृपया इस फसल की फोटो देखकर बताएं कि इसमें कौन सी बीमारी या कीड़ा है, और वानिकी स्टोर से कौन सी सही दवा व कितनी मात्रा का छिड़काव करना चाहिए?'
        : 'नमस्ते, कृपया जानकारी दें।';

    parts.push({ text: queryText });

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 950,
      },
    };

    let aiContent = await callGemini(requestBody);

    // Parse Actions
    if (isDealer && aiContent.includes('[DEALER_ORDERS]')) {
      aiContent = aiContent.replace('[DEALER_ORDERS]', '').trim();
      if (aiContent) await sendTextMessage(to, aiContent);
      await handleDealerOrderQuery(to, user, lang);
      return;
    }

    if (!isDealer && user && aiContent.includes('[ORDER_HISTORY]')) {
      aiContent = aiContent.replace('[ORDER_HISTORY]', '').trim();
      if (aiContent) await sendTextMessage(to, aiContent);
      await handleOrderQuery(to, user, lang);
      return;
    }
    if (!isDealer && user && aiContent.includes('[UPDATE_NAME:')) {
      const match = aiContent.match(/\[UPDATE_NAME:(.*?)\]/);
      const newName = match ? match[1].trim() : '';
      aiContent = aiContent.replace(/\[UPDATE_NAME:.*?\]/, '').trim();
      await handleProfileUpdate(to, user, 'name', newName);
      if (aiContent) await sendTextMessage(to, aiContent);
      return;
    }
    if (!isDealer && user && aiContent.includes('[UPDATE_ADDRESS:')) {
      const match = aiContent.match(/\[UPDATE_ADDRESS:(.*?)\]/);
      const newAddr = match ? match[1].trim() : '';
      aiContent = aiContent.replace(/\[UPDATE_ADDRESS:.*?\]/, '').trim();
      await handleProfileUpdate(to, user, 'address', newAddr);
      if (aiContent) await sendTextMessage(to, aiContent);
      return;
    }
    if (!isDealer && user && aiContent.includes('[SET_PICKUP]')) {
      aiContent = aiContent.replace('[SET_PICKUP]', '').trim();
      await handleProfileUpdate(to, user, 'serviceMode', 'pickup');
      if (aiContent) await sendTextMessage(to, aiContent);
      return;
    }
    if (!isDealer && user && aiContent.includes('[SET_DELIVERY]')) {
      aiContent = aiContent.replace('[SET_DELIVERY]', '').trim();
      await handleProfileUpdate(to, user, 'serviceMode', 'delivery');
      if (aiContent) await sendTextMessage(to, aiContent);
      return;
    }

    // Append footer invite
    if (isDealer) {
      aiContent += `\n\n🏪 *Vaniki B2B Dealer Portal:*\n👉 ${DEALER_PORTAL_URL}`;
    } else if (!user) {
      aiContent +=
        lang === 'hi'
          ? `\n\n🌾 *असली कृषि दवाएं घर बैठे मंगाने के लिए Vaniki Crop पर आर्डर करें:*\n👉 ${APP_URL}/signup?ref=whatsapp`
          : `\n\n🌾 *Buy genuine crop protection delivered to your farm:*\n👉 ${APP_URL}/signup?ref=whatsapp`;
    }

    // 1. Send the advice/pricing text
    await sendTextMessage(to, aiContent);

    // 2. Find recommended products from DB and send their Photo Cards with persona-specific pricing!
    const matchedProducts = matchRecommendedProducts(aiContent, rawProducts);
    for (const prod of matchedProducts) {
      const primaryImg =
        prod.images?.find((img: any) => img.isPrimary)?.url || prod.images?.[0]?.url;

      if (primaryImg && typeof primaryImg === 'string' && primaryImg.startsWith('http')) {
        const v = prod.variants?.[0] || {};

        if (isDealer) {
          // DEALER PHOTO CARD: Dealer Price, MRP, Margin & Dealer Portal Link
          const dealerPrice = v.adminPrice !== undefined ? v.adminPrice : v.price;
          const retailPrice = v.price || dealerPrice;
          const mrp = v.mrp || retailPrice;
          const margin = mrp - dealerPrice;
          const peti = `${prod.petiSize || 1} ${prod.petiUnit || 'पीस'}`;

          const caption = `🏪 *${prod.name}* (डीलर थोक रेट)
💰 *थोक खरीद मूल्य (Dealer Price):* ₹${dealerPrice}
🏷️ *MRP / किसान रेट:* ₹${retailPrice} (MRP: ₹${mrp})
📈 *आपका मुनाफा (Margin):* ₹${margin} प्रति पीस
📦 *पैकिंग:* ${peti} ${prod.moq ? `(MOQ: ${prod.moq})` : ''}

👉 *डीलर पैनल से बल्क आर्डर करें:* ${DEALER_PORTAL_URL}`;

          await sendImageMessage(to, primaryImg, caption);
        } else {
          // FARMER PHOTO CARD: Retail Price, Dosage, and Direct Buy Link
          const price = v.price ? `₹${v.price}` : '';
          const caption = `🌾 *${prod.name}* ${price ? `(${price})` : ''}
${prod.shortDescription || 'फसल सुरक्षा के लिए उत्तम दवा'}

👉 *यहाँ से ऑर्डर करें:* ${APP_URL}/product/${prod.slug}`;

          await sendImageMessage(to, primaryImg, caption);
        }
      }
    }
  } catch (error) {
    console.error('Gemini WhatsApp AI Error:', error);
    const fallbackMsg =
      lang === 'hi'
        ? 'क्षमा करें, तकनीकी कारण से जानकारी तैयार नहीं हो पाई। कृपया थोड़ी देर बाद फिर से मैसेज करें या 📞 हेल्पलाइन: 9407963966'
        : 'Sorry, unable to process your request at the moment. Please try again or contact support: 9407963966';
    await sendTextMessage(to, fallbackMsg);
  }
}

/**
 * Handles incoming WhatsApp webhook message
 */
export async function processIncomingMessage(message: any, contact: any) {
  const from = message.from;
  const messageType = message.type;
  const mobile = from.replace(/^91/, '');

  console.log(`[WhatsApp Incoming] From: ${from} (type: ${messageType})`);

  let user = await User.findOne({ mobile });
  const isDealer = Boolean(
    user && (user.role === 'storeAdmin' || user.role === 'superAdmin' || user.dealerProfile),
  );
  const lang = user?.preferredLanguage || 'hi';

  // Handle Quick Command / Help
  if (messageType === 'text') {
    const text = (message.text?.body || '').trim().toLowerCase();
    if (['/commands', 'help', 'menu', 'मदद', 'commands'].includes(text)) {
      await handleHelpCommand(from, lang, isDealer);
      return;
    }
  }

  // Case 1: Photo sent
  if (messageType === 'image') {
    await sendTextMessage(
      from,
      isDealer
        ? '📸 फोटो प्राप्त हुई! वानिकी डीलर सपोर्ट आपकी फोटो और प्रोडक्ट की डिटेल्स चेक कर रहे हैं... 🏪'
        : '📸 आपकी फोटो प्राप्त हुई! वानिकी फसल डॉक्टर आपकी फोटो की जांच कर रहे हैं, कृपया 5-10 सेकंड प्रतीक्षा करें... 🌾',
    );

    const mediaId = message.image?.id;
    const caption = message.image?.caption || '';

    if (mediaId) {
      const media = await downloadMedia(mediaId);
      if (media && media.buffer) {
        const base64Data = media.buffer.toString('base64');
        await handleGeminiAiChat(from, caption, user, lang, {
          mimeType: media.mimeType,
          data: base64Data,
        });
        return;
      }
    }

    // Fallback if media download failed
    await handleGeminiAiChat(from, caption || 'कृपया समस्या का समाधान बताएं।', user, lang);
    return;
  }

  // Case 2: Text sent
  if (messageType === 'text') {
    const userText = (message.text?.body || '').trim();
    await handleGeminiAiChat(from, userText, user, lang);
    return;
  }

  // Case 3: Interactive button replies
  if (messageType === 'interactive' && message.interactive?.type === 'button_reply') {
    const replyId = message.interactive.button_reply.id;
    if (replyId === 'lang_hi' || replyId === 'lang_en') {
      if (user) {
        user.preferredLanguage = replyId === 'lang_hi' ? 'hi' : 'en';
        await user.save();
      }
      await sendTextMessage(
        from,
        replyId === 'lang_hi'
          ? 'धन्यवाद! आपकी भाषा हिंदी सेट कर दी गई है।'
          : 'Thank you! Language set to English.',
      );
      return;
    }
  }
}

/**
 * Handles profile updates
 */
async function handleProfileUpdate(to: string, user: any, field: string, value: string) {
  try {
    const lang = user.preferredLanguage || 'hi';
    if (field === 'name') {
      user.name = value;
      await user.save();
      await sendTextMessage(
        to,
        lang === 'hi' ? `✅ आपका नाम बदलकर *${value}* कर दिया गया है।` : `✅ Your name is now *${value}*.`,
      );
    } else if (field === 'address') {
      if (!user.savedAddress) user.savedAddress = {};
      user.savedAddress.street = value;
      await user.save();
      await sendTextMessage(
        to,
        lang === 'hi' ? `✅ आपका पता अपडेट हो गया: *${value}*` : `✅ Address updated: *${value}*`,
      );
    } else if (field === 'serviceMode') {
      user.serviceMode = value;
      await user.save();
      const msg =
        value === 'pickup'
          ? lang === 'hi'
            ? '🛒 आपने *Store Pickup* चुना है। दुकान से सामान लेते समय भुगतान कर सकते हैं।'
            : '🛒 You selected *Store Pickup*.'
          : lang === 'hi'
            ? '🚚 आपने *Home Delivery* चुनी है।'
            : '🚚 You selected *Home Delivery*.';
      await sendTextMessage(to, msg);
    }
  } catch (error) {
    console.error('Profile update error:', error);
  }
}

/**
 * Handles recent order lookup for Farmers
 */
async function handleOrderQuery(to: string, user: any, lang: string) {
  const orders = await Order.find({ userId: user._id }).sort({ createdAt: -1 }).limit(3);

  if (orders.length === 0) {
    const msg =
      lang === 'hi'
        ? `हमें आपका कोई पिछला आर्डर नहीं मिला। आप यहाँ से आर्डर कर सकते हैं: ${APP_URL}`
        : `No recent orders found. You can shop at: ${APP_URL}`;
    return sendTextMessage(to, msg);
  }

  let response = lang === 'hi' ? `📋 *आपके पिछले ऑर्डर्स:*\n` : `📋 *Your Recent Orders:*\n`;

  orders.forEach((order, index) => {
    const date = new Date(order.createdAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN');
    const items = order.items.map((i) => `${i.productName} (${i.qty})`).join(', ');
    const status = translateStatus(order.status, lang);
    const mode = order.serviceMode === 'pickup' ? (lang === 'hi' ? 'पिकअप' : 'Pickup') : (lang === 'hi' ? 'डिलीवरी' : 'Delivery');

    response += `\n${index + 1}. *ID:* #${order.orderNumber}\n📅 *तारीख:* ${date}\n📦 *सामान:* ${items}\n💰 *कुल:* ₹${order.totalAmount}\n🚦 *स्टेटस:* ${status}\n🏠 *मोड:* ${mode}\n`;
  });

  response += `\nअधिक जानकारी: ${APP_URL}/account/orders`;
  await sendTextMessage(to, response);
}

/**
 * Handles order lookup for Dealers
 */
async function handleDealerOrderQuery(to: string, user: any, lang: string) {
  const storeId = user.selectedStore || user._id;
  const orders = await Order.find({
    $or: [{ storeId }, { userId: user._id }],
  })
    .sort({ createdAt: -1 })
    .limit(3);

  if (orders.length === 0) {
    const msg =
      lang === 'hi'
        ? `🏪 आपकी दुकान का कोई हालिया आर्डर नहीं मिला। नया बल्क आर्डर करने के लिए डीलर पैनल खोलें: ${DEALER_PORTAL_URL}`
        : `No recent store orders found. Place B2B orders at: ${DEALER_PORTAL_URL}`;
    return sendTextMessage(to, msg);
  }

  let response =
    lang === 'hi' ? `🏪 *आपकी दुकान के हालिया ऑर्डर्स:*\n` : `🏪 *Your Store Recent Orders:*\n`;

  orders.forEach((order, index) => {
    const date = new Date(order.createdAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN');
    const items = order.items.map((i) => `${i.productName} (${i.qty})`).join(', ');
    const status = translateStatus(order.status, lang);

    response += `\n${index + 1}. *आर्डर #:* ${order.orderNumber}\n📅 *तारीख:* ${date}\n📦 *सामान:* ${items}\n💰 *राशि:* ₹${order.totalAmount}\n🚦 *स्टेटस:* ${status}\n`;
  });

  response += `\n👉 पूरा लेजर व आर्डर हिस्ट्री देखें: ${DEALER_PORTAL_URL}`;
  await sendTextMessage(to, response);
}

/**
 * Commands list tailored for Dealer or Farmer
 */
async function handleHelpCommand(to: string, lang: string, isDealer: boolean) {
  let msg = '';
  if (isDealer) {
    msg =
      lang === 'hi'
        ? `🛠️ *Vaniki Crop डीलर पार्टनर सहायता:*

1. 💰 *थोक रेट पूछें* - किसी भी दवा का नाम लिखें (जैसे: "Conika का डीलर रेट")।
2. 📦 *कार्टन व पेटी पैकिंग* - दवाओं की पेटी साइज व मार्जिन जानें।
3. 📋 *My Order* - हालिया स्टोर आर्डर व डिलीवरी स्टेटस देखें।
4. 🏪 *डीलर पैनल* - थोक खरीद के लिए विजिट करें: ${DEALER_PORTAL_URL}

हमारे साथ जुड़े रहने के लिए धन्यवाद! 🌾🤝`
        : `🛠️ *Vaniki Crop Dealer Partner Services:*

1. 💰 *Ask Dealer Rates* - Type product name to get wholesale pricing & margins.
2. 📦 *Carton & MOQ Info* - Ask about packaging and bulk dispatch.
3. 📋 *My Order* - Check recent store orders.
4. 🏪 *Dealer Panel* - Visit B2B portal: ${DEALER_PORTAL_URL}`;
  } else {
    msg =
      lang === 'hi'
        ? `🛠️ *Vaniki Crop WhatsApp किसान सेवा:*

1. 📸 *फसल की फोटो भेजें* - कीड़े या बीमारी की फोटो भेजकर तुरंत इलाज व दवा पाएं!
2. 👨‍🌾 *खेती सवाल पूछें* - जैसे: "धान में तना छेदक का क्या इलाज है?"
3. 📋 *My Order* - अपने ऑर्डर का स्टेटस जानें।
4. ⚙️ *नाम [नया नाम]* - अपना नाम बदलें।
5. 🏠 *पता [नया पता]* - अपना पता बदलें।

आप सीधे अपनी समस्या लिख सकते हैं, हमारा AI डॉक्टर आपकी पूरी मदद करेगा! 🌾`
        : `🛠️ *Vaniki Crop Farmer Services:*

1. 📸 *Send Crop Photo* - Instant disease diagnosis & medicine!
2. 👨‍🌾 *Ask Farming Query* - e.g., "Paddy pest control?"
3. 📋 *My Order* - Track recent orders.
4. ⚙️ *name [New Name]* - Change profile name.
5. 🏠 *address [New Address]* - Change delivery address.`;
  }

  await sendTextMessage(to, msg);
}

/**
 * Welcome message for newly registered farmers
 */
export async function sendWelcomeMessage(user: any) {
  const isDealer = Boolean(user.role === 'storeAdmin' || user.dealerProfile);
  const lang = user.preferredLanguage || 'hi';

  if (isDealer) {
    const msg =
      lang === 'hi'
        ? `🎉 *बधाई हो, ${user.dealerProfile?.storeName || user.name}!* आप Vaniki Crop अधिकृत डीलर पार्टनर बन चुके हैं। 🏪🤝\n\nअब आप WhatsApp पर:\n• 💰 किसी भी दवा का नाम लिखकर उसका *डीलर थोक रेट व मार्जिन* पूछ सकते हैं।\n• 📦 पेटी पैकिंग व MOQ की जानकारी ले सकते हैं।\n• 📋 अपने स्टोर के ऑर्डर्स ट्रैक कर सकते हैं।\n\n👉 *डीलर पैनल:* ${DEALER_PORTAL_URL}`
        : `🎉 *Welcome, ${user.name}!* You are now an Authorized Vaniki Crop Dealer. 🏪\n\nGet wholesale pricing, carton packaging, and margins anytime right here on WhatsApp!\n👉 Dealer Portal: ${DEALER_PORTAL_URL}`;
    await sendTextMessage(`91${user.mobile}`, msg);
    return;
  }

  const welcomeMsg =
    lang === 'hi'
      ? `🎉 *बधाई हो, ${user.name}!* आप Vaniki Crop परिवार से जुड़ चुके हैं। 🙏\n\nअब आप WhatsApp पर:\n• 📸 फसल/कीड़े की फोटो भेजकर बीमारी का इलाज व दवा पूछ सकते हैं।\n• 📋 "My Order" लिखकर ऑर्डर ट्रैक कर सकते हैं।\n• 🌾 खेती से जुड़ा कोई भी सवाल कभी भी पूछ सकते हैं!\n\nखेती की खुशहाली में Vaniki Crop आपके साथ है! 🌾✨`
      : `🎉 *Welcome to Vaniki Crop, ${user.name}!* 🙏\n\nNow on WhatsApp you can:\n• 📸 Send crop disease photos for AI diagnosis.\n• 📋 Type "My Order" to track orders.\n• 🌾 Ask any farming query 24/7!`;

  await sendTextMessage(`91${user.mobile}`, welcomeMsg);
}

export interface BroadcastCampaignParams {
  title?: string;
  message: string;
  imageUrl?: string;
  link?: string;
  targetAudience?: 'all' | 'customers' | 'dealers' | 'custom';
  numbers?: string[];
  templateName?: string;
  languageCode?: string;
  components?: any[];
}

/**
 * Sends a bulk promotional campaign with optional Image, Text, and Destination Link
 */
export async function sendBroadcastCampaign(params: BroadcastCampaignParams) {
  const {
    title,
    message,
    imageUrl,
    link,
    targetAudience = 'custom',
    numbers: inputNumbers,
    templateName,
    languageCode = 'en',
    components,
  } = params;

  let targetNumbers: string[] = [];

  if (Array.isArray(inputNumbers) && inputNumbers.length > 0) {
    targetNumbers = inputNumbers;
  } else if (targetAudience === 'customers' || targetAudience === 'all') {
    const users = await User.find({
      isActive: true,
      mobile: { $exists: true, $ne: '' },
      ...(targetAudience === 'customers' ? { role: 'customer' } : {}),
    })
      .select('mobile')
      .lean();

    targetNumbers = [...new Set(users.map((u: any) => u.mobile).filter(Boolean))];
  } else if (targetAudience === 'dealers') {
    const dealers = await User.find({
      role: 'storeAdmin',
      isActive: true,
      mobile: { $exists: true, $ne: '' },
    })
      .select('mobile')
      .lean();

    targetNumbers = [...new Set(dealers.map((d: any) => d.mobile).filter(Boolean))];
  }

  const results = { total: targetNumbers.length, sent: 0, failed: 0, errors: [] as any[] };

  let fullText = '';
  if (title) fullText += `*${title}*\n\n`;
  fullText += message;
  if (link) {
    const fullLink = link.startsWith('http') ? link : `${APP_URL}${link.startsWith('/') ? '' : '/'}${link}`;
    fullText += `\n\n🔗 *यहाँ क्लिक करके ऑफर देखें:*\n👉 ${fullLink}`;
  }

  for (const rawNumber of targetNumbers) {
    const cleanNumber = String(rawNumber).replace(/\D/g, '');
    const to = cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`;

    try {
      if (templateName) {
        let comp = components;
        if (templateName === 'vaniki' && (!comp || comp.length === 0)) {
          const headerImg =
            imageUrl && imageUrl.startsWith('http')
              ? imageUrl
              : 'https://vanikicrop.com/uploads/vaniki/products/1776492631768-c5024e5b-f13a-44fb-b1fd-af9985b93241.png';
          comp = [
            {
              type: 'header',
              parameters: [
                {
                  type: 'image',
                  image: { link: headerImg },
                },
              ],
            },
          ];
        }
        await sendTemplateMessage(to, templateName, languageCode || 'en', comp);
      } else if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
        await sendImageMessage(to, imageUrl, fullText);
      } else {
        await sendTextMessage(to, fullText);
      }
      results.sent++;
      await new Promise((r) => setTimeout(r, 60));
    } catch (err: any) {
      results.failed++;
      results.errors.push({ number: to, error: err.message });
    }
  }

  return results;
}

function translateStatus(status: string, lang: string) {
  const map: any = {
    placed: { hi: 'आर्डर मिल गया (Placed)', en: 'Placed' },
    confirmed: { hi: 'कन्फर्म हो गया (Confirmed)', en: 'Confirmed' },
    processing: { hi: 'तैयार हो रहा है (Processing)', en: 'Processing' },
    shipped: { hi: 'रास्ते में है (Shipped)', en: 'Shipped' },
    delivered: { hi: 'डिलीवर हो गया (Delivered)', en: 'Delivered' },
    cancelled: { hi: 'निरस्त (Cancelled)', en: 'Cancelled' },
  };
  return map[status]?.[lang] || status;
}
