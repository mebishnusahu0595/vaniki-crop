import { User } from '../../models/User.model.js';
import { Order } from '../../models/Order.model.js';
import { Product } from '../../models/Product.model.js';

const WHATSAPP_API_URL = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
const APP_URL = 'https://vanikicrop.com';

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
    text: { body: text, preview_url: true },
  });
}

/**
 * Processes incoming message
 */
export async function processIncomingMessage(message: any, contact: any) {
  console.log('--- Incoming WhatsApp Message ---');
  console.log('From:', message.from);
  console.log('Type:', message.type);
  console.log('Text:', message.text?.body);

  const from = message.from; 
  const messageType = message.type;
  const mobile = from.replace(/^91/, ''); 

  console.log('Normalized Mobile:', mobile);

  // 1. Check if user is registered
  let user = await User.findOne({ mobile });
  console.log('User found:', user ? user.name : 'No');

  if (!user) {
    const signupMsg = `नमस्ते! Vaniki Crop में आपका स्वागत है। 🙏

हमें आपका यह नंबर हमारे रिकॉर्ड में नहीं मिला। WhatsApp सुविधाओं का लाभ उठाने के लिए कृपया पहले रजिस्टर करें।

🔗 रजिस्टर करने के लिए यहाँ क्लिक करें: ${APP_URL}/signup?ref=whatsapp

पंजीकरण के बाद आप अपने ऑर्डर्स और खेती से जुड़ी सलाह पा सकेंगे।`;
    console.log('Sending Signup Link...');
    await sendTextMessage(from, signupMsg);
    return;
  }

  // 2. Handle Language Selection (One-time or default)
  if (messageType === 'interactive' && message.interactive.type === 'button_reply') {
    const replyId = message.interactive.button_reply.id;
    if (replyId === 'lang_hi' || replyId === 'lang_en') {
      user.preferredLanguage = replyId === 'lang_hi' ? 'hi' : 'en';
      await user.save();
      const msg = user.preferredLanguage === 'hi' 
        ? 'धन्यवाद! आपकी भाषा हिंदी सेट कर दी गई है। अब आप मुझसे कुछ भी पूछ सकते हैं।' 
        : 'Thank you! Your language is set to English. How can I help you?';
      await sendTextMessage(from, msg);
      return;
    }
  }

  // Default to Hindi if not set
  const lang = user.preferredLanguage || 'hi';
  const text = (message.text?.body || message.interactive?.button_reply?.title || '').toLowerCase();

  // 3. Command & Profile Handling
  if (text.includes('order') || text.includes('आर्डर') || text.includes('ऑर्डर') || text.includes('status')) {
    await handleOrderQuery(from, user, lang);
  } else if (text.startsWith('name ') || text.startsWith('नाम ')) {
    await handleProfileUpdate(from, user, 'name', text.split(' ').slice(1).join(' '));
  } else if (text.startsWith('address ') || text.startsWith('पता ')) {
    await handleProfileUpdate(from, user, 'address', text.split(' ').slice(1).join(' '));
  } else if (text.includes('pickup') || text.includes('पिकअप')) {
    await handleProfileUpdate(from, user, 'serviceMode', 'pickup');
  } else if (text.includes('delivery') || text.includes('डिलीवरी')) {
    await handleProfileUpdate(from, user, 'serviceMode', 'delivery');
  } else {
    // Default to AI Chat for everything else
    await handleAiChat(from, text, user, lang);
  }
}

/**
 * Handles profile updates (Name, Address, Service Mode)
 */
async function handleProfileUpdate(to: string, user: any, field: string, value: string) {
  try {
    const lang = user.preferredLanguage || 'hi';
    
    if (field === 'name') {
      user.name = value;
      await user.save();
      const msg = lang === 'hi' ? `✅ आपका नाम बदलकर *${value}* कर दिया गया है।` : `✅ Your name has been updated to *${value}*.`;
      await sendTextMessage(to, msg);
    } 
    else if (field === 'address') {
      // Basic address update (storing in street for now, or parsing)
      if (!user.savedAddress) user.savedAddress = {};
      user.savedAddress.street = value;
      await user.save();
      const msg = lang === 'hi' ? `✅ आपका पता अपडेट कर दिया गया है: *${value}*` : `✅ Your address has been updated to: *${value}*`;
      await sendTextMessage(to, msg);
    }
    else if (field === 'serviceMode') {
      user.serviceMode = value;
      await user.save();
      const msg = value === 'pickup' 
        ? (lang === 'hi' ? '🛒 आपने *Store Pickup* चुना है। कृपया दुकान पर आते समय पैसे साथ लाएं।' : '🛒 You have selected *Store Pickup*. Please bring cash when you visit the store.')
        : (lang === 'hi' ? '🚚 आपने *Home Delivery* चुनी है। आपका सामान आपके पते पर भेज दिया जाएगा।' : '🚚 You have selected *Home Delivery*. Your items will be delivered to your address.');
      await sendTextMessage(to, msg);
    }
  } catch (error) {
    console.error('Profile Update Error:', error);
    await sendTextMessage(to, '❌ Update failed. Please try again later.');
  }
}

/**
 * Handles detailed order tracking
 */
async function handleOrderQuery(to: string, user: any, lang: string) {
  const orders = await Order.find({ userId: user._id }).sort({ createdAt: -1 }).limit(3);
  
  if (orders.length === 0) {
    const msg = lang === 'hi' 
      ? 'हमें आपका कोई पिछला आर्डर नहीं मिला। आप हमारी वेबसाइट पर आर्डर कर सकते हैं: ' + APP_URL 
      : 'We could not find any recent orders. You can shop at: ' + APP_URL;
    return sendTextMessage(to, msg);
  }

  let response = lang === 'hi' 
    ? `📋 *आपके पिछले ऑर्डers:*\n` 
    : `📋 *Your Recent Orders:*\n`;

  orders.forEach((order, index) => {
    const date = new Date(order.createdAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN');
    const items = order.items.map(i => `${i.productName} (${i.qty})`).join(', ');
    const status = translateStatus(order.status, lang);
    const mode = order.serviceMode === 'pickup' ? (lang === 'hi' ? 'पिकअप (Store Pickup)' : 'Store Pickup') : (lang === 'hi' ? 'डिलीवरी (Home Delivery)' : 'Home Delivery');
    
    response += `\n${index + 1}. *ID:* #${order.orderNumber}\n📅 *तारीख:* ${date}\n📦 *सामान:* ${items}\n💰 *कुल:* ₹${order.totalAmount}\n🚦 *स्टेटस:* ${status}\n🏠 *मोड:* ${mode}\n`;
    
    if (order.serviceMode === 'pickup' && order.status !== 'delivered') {
      response += lang === 'hi' ? `⚠️ *याद दिलाएं:* कृपया दुकान से सामान लेते समय पैसे (Cash) साथ लाएं।\n` : `⚠️ *Reminder:* Please bring cash for payment at the store.\n`;
    }

    if (order.deliveryOtp && (order.status === 'processing' || order.status === 'shipped')) {
      response += `🔑 *OTP:* ${order.deliveryOtp}\n`;
    }
  });

  response += `\nअधिक जानकारी के लिए यहाँ देखें: ${APP_URL}/account/orders`;
  await sendTextMessage(to, response);
}

/**
 * AI Expert Chat with Product Context
 */
async function handleAiChat(to: string, text: string, user: any, lang: string) {
  try {
    // Fetch relevant products based on query or featured ones
    const products = await Product.find({ isActive: true }).limit(20).select('name slug shortDescription variants');
    const productContext = products.map(p => `- ${p.name}: ${p.shortDescription} (Price: ₹${p.variants[0]?.price || '-'}). Link: ${APP_URL}/product/${p.slug}`).join('\n');

    const systemPrompt = `You are "Ask Vaniki", the official Senior Agriculture Expert for Vaniki Crop.
    Current Language: ${lang === 'hi' ? 'Hindi' : 'English'}.
    
    CRITICAL INSTRUCTIONS:
    1. Respond strictly in ${lang === 'hi' ? 'Hindi' : 'English'}.
    2. Only suggest products from the list below. Do not invent products.
    3. Always provide the full product link if you suggest a product.
    4. If the user describes a crop problem (pest, disease, nutrition), act as a doctor and prescribe the best matching product from our list.
    5. If you don't find a matching product, tell them to visit our store or contact support.
    6. For order status, tell them to type "My Order".
    7. Use bolding and emojis to make the response premium and readable.
    8. You have READ-ONLY access to the data provided below.
    
    AVAILABLE PRODUCTS:
    ${productContext}
    
    USER PROFILE:
    Name: ${user.name}
    Language: ${lang}`;

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
        max_tokens: 800,
        temperature: 0.5
      }),
    });

    const aiData: any = await response.json();
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
    'placed': { hi: 'आर्डर मिल गया (Placed)', en: 'Placed' },
    'confirmed': { hi: 'कन्फर्म हो गया (Confirmed)', en: 'Confirmed' },
    'processing': { hi: 'तैयार हो रहा है (Processing)', en: 'Processing' },
    'shipped': { hi: 'रास्ते में है (Shipped)', en: 'Shipped' },
    'delivered': { hi: 'डिलीवर हो गया (Delivered)', en: 'Delivered' },
    'cancelled': { hi: 'निरस्त (Cancelled)', en: 'Cancelled' },
  };
  return map[status]?.[lang] || status;
}
