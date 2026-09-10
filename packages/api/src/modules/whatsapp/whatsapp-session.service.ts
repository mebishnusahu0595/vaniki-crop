import { WhatsAppChatSession, type IWhatsAppChatSession } from '../../models/WhatsAppChatSession.model.js';

/**
 * Normalizes phone numbers (ensures standard format like '916266838334')
 */
export function normalizeWhatsAppNumber(phone: string): string {
  const cleaned = (phone || '').replace(/[^\d]/g, '');
  if (cleaned.length === 10) return `91${cleaned}`;
  if (cleaned.startsWith('0')) return `91${cleaned.slice(1)}`;
  return cleaned;
}

/**
 * Gets or creates a WhatsApp chat session for tracking context and history
 */
export async function getOrCreateChatSession(
  mobile: string,
  user?: any,
  isDealer: boolean = false,
  contactName?: string,
): Promise<IWhatsAppChatSession> {
  const normalizedMobile = normalizeWhatsAppNumber(mobile);
  let session = await WhatsAppChatSession.findOne({ mobile: normalizedMobile });

  if (!session) {
    session = new WhatsAppChatSession({
      mobile: normalizedMobile,
      userId: user?._id || null,
      userName: user?.name || contactName || '',
      isDealer,
      messages: [],
      activeContext: {},
      lastActivity: new Date(),
    });
    await session.save();
  } else {
    let changed = false;
    if (user && !session.userId) {
      session.userId = user._id;
      if (user.name) session.userName = user.name;
      changed = true;
    }
    if (session.isDealer !== isDealer) {
      session.isDealer = isDealer;
      changed = true;
    }
    if (changed) await session.save();
  }
  return session;
}

/**
 * Records an incoming user message into the session
 */
export async function recordUserMessage(
  mobile: string,
  text: string,
  isImage: boolean = false,
  imageCaption: string = '',
) {
  const normalizedMobile = normalizeWhatsAppNumber(mobile);
  const displayText = isImage
    ? (imageCaption ? `[📸 फोटो]: ${imageCaption}` : `[📸 फसल/कीट/उत्पाद की फोटो भेजी गई]`)
    : text;

  await WhatsAppChatSession.updateOne(
    { mobile: normalizedMobile },
    {
      $push: {
        messages: {
          $each: [
            {
              role: 'user',
              text: displayText,
              timestamp: new Date(),
              isImage,
              imageCaption,
            },
          ],
          $slice: -24, // Keep last 24 messages for robust context memory
        },
      },
      $set: { lastActivity: new Date() },
    },
    { upsert: true },
  );
}

/**
 * Records the bot's response and updates the actively discussed product context
 */
export async function recordBotMessage(
  mobile: string,
  text: string,
  matchedProducts: any[] = [],
  imageDiagnosis?: string,
) {
  const normalizedMobile = normalizeWhatsAppNumber(mobile);
  const matchedProd = matchedProducts?.[0];

  const updateSet: Record<string, any> = {
    lastActivity: new Date(),
  };

  if (matchedProd) {
    const variantsList = (matchedProd.variants || [])
      .map((v: any) => `${v.label || 'Pack'}: ₹${v.price}`)
      .join(', ');

    updateSet['activeContext.lastProductName'] = matchedProd.name;
    updateSet['activeContext.lastProductSlug'] = matchedProd.slug;
    updateSet['activeContext.lastVariantsSummary'] = variantsList;
    updateSet['activeContext.updatedAt'] = new Date();
  }

  if (imageDiagnosis) {
    updateSet['activeContext.lastImageDiagnosis'] = imageDiagnosis;
    updateSet['activeContext.updatedAt'] = new Date();
  }

  await WhatsAppChatSession.updateOne(
    { mobile: normalizedMobile },
    {
      $push: {
        messages: {
          $each: [
            {
              role: 'model',
              text,
              timestamp: new Date(),
              matchedProductSlug: matchedProd?.slug || '',
              matchedProductName: matchedProd?.name || '',
            },
          ],
          $slice: -24,
        },
      },
      $set: updateSet,
    },
    { upsert: true },
  );
}

/**
 * Sets broadcast campaign product context so user follow-up questions resolve to it
 */
export async function setBroadcastContext(
  mobile: string,
  productTitle: string,
  productLink: string,
  targetCrop?: string,
  targetIssue?: string,
) {
  const normalizedMobile = normalizeWhatsAppNumber(mobile);
  const slug = (productLink || '').split('/product/')[1] || '';

  await WhatsAppChatSession.updateOne(
    { mobile: normalizedMobile },
    {
      $set: {
        'activeContext.lastProductName': productTitle,
        'activeContext.lastProductSlug': slug,
        'activeContext.lastCropIssue': `${targetCrop || ''} - ${targetIssue || ''}`.trim(),
        'activeContext.updatedAt': new Date(),
        lastActivity: new Date(),
      },
      $push: {
        messages: {
          $each: [
            {
              role: 'model',
              text: `[कृषि सलाह/प्रचार]: ${productTitle} (${targetCrop || ''} ${targetIssue || ''})`,
              timestamp: new Date(),
              matchedProductName: productTitle,
              matchedProductSlug: slug,
            },
          ],
          $slice: -24,
        },
      },
    },
    { upsert: true },
  );
}

/**
 * Builds Gemini-compliant multi-turn contents array with conversation history
 *
 * Strict Gemini API constraints:
 * 1. Strict alternation: user -> model -> user -> model -> ... -> user
 * 2. Starts with role 'user'
 * 3. Ends with current 'user' turn (including image if provided)
 * 4. Consecutive messages with same role are concatenated
 */
export function buildGeminiMultiTurnContents(
  session: IWhatsAppChatSession | null,
  currentPrompt: string,
  imagePart?: { mimeType: string; data: string },
  maxHistoryTurns: number = 8,
): any[] {
  const turns: any[] = [];
  const rawMessages = session?.messages || [];

  // Take recent messages for history
  const recent = rawMessages.slice(-maxHistoryTurns);

  for (const m of recent) {
    const textContent = (m.text || '').trim();
    if (!textContent) continue;

    const role = m.role === 'model' ? 'model' : 'user';

    // Gemini requires starting with 'user'
    if (turns.length === 0 && role === 'model') {
      continue;
    }

    // Merge consecutive identical roles
    if (turns.length > 0 && turns[turns.length - 1].role === role) {
      turns[turns.length - 1].parts[0].text += `\n${textContent}`;
    } else {
      turns.push({
        role,
        parts: [{ text: textContent }],
      });
    }
  }

  // The last history turn must be 'model' so current turn can be 'user'
  if (turns.length > 0 && turns[turns.length - 1].role === 'user') {
    turns.pop();
  }

  // Append current user turn
  const currentParts: any[] = [];
  if (imagePart) {
    currentParts.push({
      inlineData: {
        mimeType: imagePart.mimeType,
        data: imagePart.data,
      },
    });
  }
  currentParts.push({ text: currentPrompt });

  turns.push({
    role: 'user',
    parts: currentParts,
  });

  return turns;
}
