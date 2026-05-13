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
  const isOrderHistoryIntent = (text.includes('my order') || text.includes('order status') || text.includes('status') || text === 'order' || text === 'आर्डर') 
                               && !text.includes('buy') && !text.includes('want to');

  if (text === '/commands' || text === 'help' || text === 'menu' || text === 'मदद') {
    await handleHelpCommand(from, lang);
  } else if (isOrderHistoryIntent) {
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
    // Default to AI Chat for everything else (Products, Diseases, Buying)
    await handleAiChat(from, text, user, lang);
  }
}

/**
 * Shows all available commands
 */
async function handleHelpCommand(to: string, lang: string) {
  const msg = lang === 'hi'
    ? `🛠️ *Vaniki WhatsApp कमांड्स:*

1. 📋 *My Order* - अपने ऑर्डर्स ट्रैक करने के लिए।
2. 👨‍🌾 *Kheti Sawal* - खेती की समस्या पूछें (जैसे: "धान का इलाज")।
3. ⚙️ *नाम [Naya Name]* - अपना नाम बदलें (e.g., "नाम राम")।
4. 🏠 *पता [Naya Address]* - अपना पता बदलें।
5. 🛒 *Pickup* / *Delivery* - आर्डर का तरीका बदलें।
6. ❓ */commands* - यह मेनू फिर से देखने के लिए।

आप कुछ भी सामान्य सवाल भी पूछ सकते हैं, हमारा AI आपकी मदद करेगा! ✨`
    : `🛠️ *Vaniki WhatsApp Commands:*

1. 📋 *My Order* - To track your orders.
2. 👨‍🌾 *Farming Query* - Ask any farming issue (e.g., "Rice pests").
3. ⚙️ *name [New Name]* - Change your name.
4. 🏠 *address [New Address]* - Change your address.
5. 🛒 *Pickup* / *Delivery* - Change service mode.
6. ❓ */commands* - To see this menu again.

You can also ask anything else, our AI is here to help! ✨`;

  await sendTextMessage(to, msg);
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

    const systemPrompt = `You are "Ask Vaniki", the Senior Agriculture Expert and Shopping Assistant for Vaniki Crop.
    Current Language: ${lang === 'hi' ? 'Hindi' : 'English'}.
    
    CRITICAL RULES:
    1. If the user asks for a specific category (like "Pesticides"), ONLY show products from that category. 
    2. If a specific product (like "Rudra 505") is mentioned, find and provide info for ONLY that product.
    3. If you cannot find a matching product in the list below, say: "क्षमा करें, यह अभी उपलब्ध नहीं है।" (Sorry, this is not available right now).
    4. NEVER invent products or suggest products from outside the provided list.
    5. Always provide the full link: ${APP_URL}/product/[slug]
    6. Use emojis (🚜, 💊, 📦) and bold text to keep it professional and premium.
    7. If the user wants to buy/order, give them the product link and tell them they can pay via Cash on Delivery (COD).
    8. For order history/status, tell them to type "My Order".
    
    AVAILABLE PRODUCTS DATA:
    ${productContext}
    
    USER PROFILE:
    Name: ${user.name}
    Preferred Language: ${lang}`;

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


/**
 * Sends a welcome message with instructions to new users
 */
export async function sendWelcomeMessage(user: any) {
  const lang = user.preferredLanguage || 'hi';
  const welcomeMsg = lang === 'hi'
    ? `🎉 *बधाई हो, ${user.name}!* आप Vaniki Crop परिवार का हिस्सा बन गए हैं। 🙏

अब आप WhatsApp पर ये सब कर सकते हैं:
1. 📋 *ऑर्डर ट्रैक करें:* "My Order" लिखें।
2. 👨‍🌾 *खेती की सलाह:* अपनी समस्या लिखें (जैसे: "धान में कीड़ा लगा है")।
3. 📦 *प्रोडक्ट्स खोजें:* दवाई या बीज के बारे में पूछें।
4. ⚙️ *प्रोफाइल बदलें:* "नाम [नया नाम]" या "पता [नया पता]" लिखें।
5. 🛒 *मोड बदलें:* "pickup" या "delivery" लिखें।

हमें खुशी है कि आप हमारे साथ हैं! 🌾✨`
    : `🎉 *Congratulations, ${user.name}!* You are now part of the Vaniki Crop family. 🙏

You can now use these features on WhatsApp:
1. 📋 *Track Orders:* Type "My Order".
2. 👨‍🌾 *Farming Advice:* Describe your problem (e.g., "Pests in my rice crop").
3. 📦 *Search Products:* Ask about pesticides or seeds.
4. ⚙️ *Update Profile:* Type "name [new name]" or "address [new address]".
5. 🛒 *Change Mode:* Type "pickup" or "delivery".

We are happy to have you with us! 🌾✨`;

  await sendTextMessage(`91${user.mobile}`, welcomeMsg);
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
