import { useEffect, useState } from 'react';
import { asyncStorage } from '../lib/storage';
import { getAppLanguage } from '../i18n';

const MEMORY_CACHE = new Map<string, string>();
const STORAGE_PREFIX = 'trans_hi_';

/** Category translations dictionary */
export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  insecticides: 'कीटनाशक व कीट नियंत्रण',
  insecticide: 'कीटनाशक',
  herbicides: 'खरपतवार नाशक (घास की दवा)',
  herbicide: 'खरपतवार नाशक',
  weedicides: 'खरपतवार नाशक',
  fungicides: 'फफूंदनाशक व रोग निवारक',
  fungicide: 'फफूंदनाशक',
  'bio-pesticides': 'जैविक कीटनाशक व टॉनिक',
  biopesticides: 'जैविक कीटनाशक',
  'plant-growth-promoters': 'पौध वृद्धि टॉनिक',
  pgp: 'पौध वृद्धि टॉनिक',
  tonics: 'फसल टॉनिक',
  seeds: 'उन्नत बीज',
  fertilizers: 'खाद एवं पोषण',
  'crop care': 'फसल सुरक्षा',
  'crop-care': 'फसल सुरक्षा',
};

export function translateCategory(nameOrSlug?: string): string {
  if (!nameOrSlug) return 'फसल सुरक्षा';
  if (getAppLanguage() !== 'hi') return nameOrSlug;

  const key = nameOrSlug.trim().toLowerCase();
  if (CATEGORY_TRANSLATIONS[key]) return CATEGORY_TRANSLATIONS[key];

  for (const [dictKey, dictVal] of Object.entries(CATEGORY_TRANSLATIONS)) {
    if (key.includes(dictKey)) return dictVal;
  }

  return nameOrSlug;
}

/** Common agricultural terms mapper for instant offline translations */
export const AGRI_TERMS_REPLACEMENTS: [RegExp, string][] = [
  [/broad-spectrum/gi, 'व्यापक प्रभाव (ब्रॉड-स्पेक्ट्रम)'],
  [/dual-action/gi, 'दोहरा असर (डुअल एक्शन)'],
  [/systemic insecticide/gi, 'प्रणालीगत कीटनाशक'],
  [/contact insecticide/gi, 'स्पर्श कीटनाशक'],
  [/insecticide/gi, 'कीटनाशक'],
  [/fungicide/gi, 'फफूंदनाशक'],
  [/herbicide/gi, 'खरपतवारनाशक'],
  [/caterpillar/gi, 'इल्ली'],
  [/caterpillars/gi, 'इल्लियां'],
  [/bollworm/gi, 'गुलाबी/अमेरिकन सुंडी'],
  [/bollworms/gi, 'सूंडियां'],
  [/stem borer/gi, 'तना छेदक'],
  [/borers/gi, 'छेदक कीट'],
  [/leaf folder/gi, 'पत्ती लपेटक'],
  [/sucking insects/gi, 'रस चूसक कीट'],
  [/aphids/gi, 'माहू/चेपा'],
  [/jassids/gi, 'तेला/फुदका'],
  [/whitefly/gi, 'सफेद मक्खी'],
  [/thrips/gi, 'थ्रिप्स'],
  [/blight/gi, 'झुलसा रोग'],
  [/leaf spot/gi, 'पत्ती धब्बा रोग'],
  [/powdery mildew/gi, 'छाछिया/सफेद चूर्ण रोग'],
  [/rust/gi, 'रतुआ रोग'],
  [/root rot/gi, 'जड़ सड़न'],
  [/weed control/gi, 'खरपतवार नियंत्रण'],
  [/dosage/gi, 'मात्रा (Dosage)'],
  [/application/gi, 'छिड़काव विधि'],
  [/per acre/gi, 'प्रति एकड़'],
  [/water/gi, 'पानी'],
  [/spray/gi, 'स्प्रे/छिड़काव'],
];

/** Clean and fast online translation with local caching */
export async function translateToHindi(text: string): Promise<string> {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // 1. Check in-memory cache
  if (MEMORY_CACHE.has(trimmed)) {
    return MEMORY_CACHE.get(trimmed)!;
  }

  // 2. Check AsyncStorage
  const storageKey = STORAGE_PREFIX + trimmed.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_');
  try {
    const cached = await asyncStorage.getItem(storageKey);
    if (cached) {
      MEMORY_CACHE.set(trimmed, cached);
      return cached;
    }
  } catch {
    // ignore
  }

  // 3. Perform Google Translate API call
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((chunk: any) => chunk[0]).filter(Boolean).join('');
        if (translated && translated.trim().length > 0) {
          MEMORY_CACHE.set(trimmed, translated);
          void asyncStorage.setItem(storageKey, translated).catch(() => undefined);
          return translated;
        }
      }
    }
  } catch (error) {
    console.warn('Translate API fetch error:', error);
  }

  // 4. Fallback: Term replacement
  let fallback = trimmed;
  for (const [regex, replacement] of AGRI_TERMS_REPLACEMENTS) {
    fallback = fallback.replace(regex, replacement);
  }
  MEMORY_CACHE.set(trimmed, fallback);
  return fallback;
}

/**
 * React Hook to dynamically provide translated text for DB content
 */
export function useTranslatedContent(originalText?: string): string {
  const isHindi = getAppLanguage() === 'hi';
  const [translatedText, setTranslatedText] = useState(originalText || '');

  useEffect(() => {
    if (!originalText) {
      setTranslatedText('');
      return;
    }

    if (!isHindi) {
      setTranslatedText(originalText);
      return;
    }

    let isMounted = true;
    void translateToHindi(originalText).then((res) => {
      if (isMounted) {
        setTranslatedText(res);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [originalText, isHindi]);

  return isHindi ? translatedText : originalText || '';
}
