import { User } from '../../models/User.model.js';
import { Order } from '../../models/Order.model.js';
import { Product } from '../../models/Product.model.js';

const WHATSAPP_API_URL = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';

/**
 * Sends a WhatsApp message using Meta Cloud API
 */
async function sendWhatsAppMessage(to: string, payload: any) {
  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
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
      console.error('Meta API Error:', data);
    }
    return data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}

/**
 * Sends a text message
 */
async function sendTextMessage(to: string, text: string) {
  return sendWhatsAppMessage(to, {
    type: 'text',
    text: { body: text },
  });
}

/**
 * Sends a language selection menu
 */
async function sendLanguageSelection(to: string) {
  return sendWhatsAppMessage(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: 'नमस्ते! Vaniki Crop में आपका स्वागत है। कृपया अपनी भाषा चुनें।\n\nWelcome! Please select your language.' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'lang_hi', title: 'Hindi / हिंदी' } },
          { type: 'reply', reply: { id: 'lang_en', title: 'English' } },
        ],
      },
    },
  });
}

/**
 * Processes incoming message
 */
export async function processIncomingMessage(message: any, contact: any) {
  const from = message.from; // Phone number
  const messageType = message.type;
  
  // Normalize phone number (strip +91 etc if needed, but Meta usually gives clean numbers)
  const mobile = from.replace(/^91/, ''); // Standardize to 10 digits for DB lookup

  let user = await User.findOne({ mobile });

  // 1. Language Selection Handling
  if (messageType === 'interactive' && message.interactive.type === 'button_reply') {
    const replyId = message.interactive.button_reply.id;
    if (replyId === 'lang_hi' || replyId === 'lang_en') {
      const lang = replyId === 'lang_hi' ? 'hi' : 'en';
      if (user) {
        user.preferredLanguage = lang;
        await user.save();
      }
      const welcome = lang === 'hi' 
        ? 'धन्यवाद! अब आप मुझसे हिंदी में बात कर सकते हैं। मैं आपकी क्या मदद कर सकता हूँ?' 
        : 'Thank you! You can now chat with me in English. How can I help you today?';
      await sendTextMessage(from, welcome);
      return;
    }
  }

  // 2. If user is new or hasn't selected language
  if (!user || !user.preferredLanguage) {
    await sendLanguageSelection(from);
    return;
  }

  const lang = user.preferredLanguage;
  const text = message.text?.body?.toLowerCase() || '';

  // 3. Intent Handling
  if (text.includes('order') || text.includes('आर्डर') || text.includes('ऑर्डर')) {
    await handleOrderQuery(from, user, lang);
  } else if (text.includes('product') || text.includes('उत्पाद')) {
    await handleProductQuery(from, text, lang);
  } else {
    // 4. AI Chat fallback
    await handleAiChat(from, text, user, lang);
  }
}

/**
 * Handles order related queries
 */
async function handleOrderQuery(to: string, user: any, lang: string) {
  const lastOrder = await Order.findOne({ userId: user._id }).sort({ createdAt: -1 });
  
  if (!lastOrder) {
    const msg = lang === 'hi' 
      ? 'हमें आपका कोई पिछला आर्डर नहीं मिला।' 
      : 'We could not find any recent orders for you.';
    return sendTextMessage(to, msg);
  }

  let statusMsg = lang === 'hi'
    ? `आपका आर्डर #${lastOrder.orderNumber}\nस्टेटस: ${translateStatus(lastOrder.status, 'hi')}\nकुल राशि: ₹${lastOrder.totalAmount}`
    : `Your Order #${lastOrder.orderNumber}\nStatus: ${lastOrder.status}\nTotal: ₹${lastOrder.totalAmount}`;

  if (lastOrder.deliveryOtp && (lastOrder.status === 'processing' || lastOrder.status === 'shipped')) {
    statusMsg += lang === 'hi' 
      ? `\n\nडिलीवरी OTP: ${lastOrder.deliveryOtp}` 
      : `\n\nDelivery OTP: ${lastOrder.deliveryOtp}`;
  }

  await sendTextMessage(to, statusMsg);
}

/**
 * Handles product queries
 */
async function handleProductQuery(to: string, query: string, lang: string) {
  const searchTerm = query.replace('product', '').replace('उत्पाद', '').trim();
  if (!searchTerm) {
    const msg = lang === 'hi' 
      ? 'आप किस उत्पाद के बारे में जानना चाहते हैं? उदाहरण: "Imidacloprid के बारे में बताएं"' 
      : 'Which product would you like to know about? Example: "Tell me about Imidacloprid"';
    return sendTextMessage(to, msg);
  }

  const products = await Product.find({ 
    $text: { $search: searchTerm },
    isActive: true 
  }).limit(3);

  if (products.length === 0) {
    const msg = lang === 'hi'
      ? 'क्षमा करें, हमें इस नाम का कोई उत्पाद नहीं मिला।'
      : 'Sorry, we could not find any products matching that name.';
    return sendTextMessage(to, msg);
  }

  let response = lang === 'hi' ? 'यहाँ कुछ उत्पाद हैं जो आपकी खोज से मेल खाते हैं:\n' : 'Here are some products matching your search:\n';
  products.forEach(p => {
    response += `\n📦 *${p.name}*\n${p.shortDescription}\nPrice: ₹${p.variants[0]?.price || '-'}\n`;
  });

  await sendTextMessage(to, response);
}

/**
 * AI Chat using DeepSeek
 */
async function handleAiChat(to: string, text: string, user: any, lang: string) {
  try {
    // Fetch top products for general context
    const topProducts = await Product.find({ isActive: true, isFeatured: true }).limit(10).select('name shortDescription variants');
    const productContext = topProducts.map(p => `- ${p.name}: ${p.shortDescription} (Price: ₹${p.variants[0]?.price || '-'})`).join('\n');

    const systemPrompt = `You are "Ask Vaniki", a premium AI assistant for Vaniki Crop, India's leading agriculture e-commerce platform.
    Language: ${lang === 'hi' ? 'Hindi (हिंदी)' : 'English'}.
    Tone: Professional, helpful, and empathetic towards farmers.
    
    About Vaniki Crop:
    - We provide genuine crop protection (pesticides, insecticides, fungicides, herbicides).
    - We offer local store fulfillment (pickup or delivery).
    - We have a loyalty program for farmers.
    
    Products in our catalog:
    ${productContext}
    
    User Context:
    Name: ${user?.name || 'Farmer'}
    Mobile: ${user?.mobile || 'Unknown'}
    
    Instructions:
    1. If the user asks about products we have, refer to the catalog above.
    2. If the user asks about an order, tell them to type "My Order".
    3. Always encourage modern farming practices.
    4. Keep answers concise (max 3-4 sentences).`;

    const response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        max_tokens: 500,
        temperature: 0.7
      }),
    });

    const aiData = await response.json();
    const aiResponse = aiData.choices?.[0]?.message?.content || (lang === 'hi' ? 'क्षमा करें, मैं अभी उत्तर देने में असमर्थ हूँ।' : 'I am sorry, I am unable to respond right now.');
    
    await sendTextMessage(to, aiResponse);
  } catch (error) {
    console.error('DeepSeek Error:', error);
    const msg = lang === 'hi' ? 'तकनीकी समस्या के कारण मैं अभी जवाब नहीं दे पा रहा हूँ।' : 'I am facing technical issues and cannot respond right now.';
    await sendTextMessage(to, msg);
  }
}

function translateStatus(status: string, lang: string) {
  const map: any = {
    'placed': { hi: 'आर्डर मिल गया', en: 'Placed' },
    'confirmed': { hi: 'कन्फर्म हो गया', en: 'Confirmed' },
    'processing': { hi: 'तैयार हो रहा है', en: 'Processing' },
    'shipped': { hi: 'भेज दिया गया है', en: 'Shipped' },
    'delivered': { hi: 'डिलीवर हो गया', en: 'Delivered' },
    'cancelled': { hi: 'निरस्त कर दिया गया', en: 'Cancelled' },
  };
  return map[status]?.[lang] || status;
}
