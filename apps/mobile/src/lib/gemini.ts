import type { Product } from '../types/storefront';
import { storefrontApi } from './api';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  imageUri?: string;
  recommendedProducts?: Product[];
  timestamp: string;
}

/**
 * Agri Advisor now runs on the API (POST /api/ai/agri-advisor). The prompt, the product
 * catalog and the Gemini key all live server-side, so nothing sensitive ships in the APK
 * and the client no longer uploads the catalog with every message.
 */
export async function askGeminiAgriAdvisor(
  prompt: string,
  historyMessages: ChatMessage[] = [],
  imageBase64?: string,
  userLanguage: string = 'en',
): Promise<{ text: string; recommendedProducts: Product[] }> {
  const history = historyMessages
    .filter((message) => message.id !== 'welcome-1')
    .map((message) => ({ sender: message.sender, text: message.text }));

  return storefrontApi.agriAdvisor({
    prompt,
    history,
    imageBase64,
    language: userLanguage,
  });
}
