import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { askGeminiAgriAdvisor, type ChatMessage } from '../../src/lib/gemini';
import { asyncStorage } from '../../src/lib/storage';
import type { Product } from '../../src/types/storefront';
import { currencyFormatter, getPrimaryImage } from '../../src/utils/format';

const CHAT_HISTORY_STORAGE_KEY = 'vaniki_agri_advisor_chat_history_v4';

const WELCOME_EN = 'Hello Farmer! 🙏 I am your Vaniki AI Crop Doctor. Ask any question about your crop, disease, pests, or upload a photo of your crop. I will recommend the right Vaniki Crop products and spray dosage!';
const WELCOME_HI = 'नमस्ते किसान भाई! 🙏 मैं आपका वनिकी AI फसल डॉक्टर हूँ। अपनी फसल में लग रहे रोग, कीट या खरपतवार के बारे में लिखकर पूछें या फसल की फोटो खींचकर भेजें। मैं आपको तुरंत सही वनिकी उत्पाद और छिड़काव की सही मात्रा बताऊंगा!';

const QUICK_SUGGESTIONS_EN = [
  '🌾 Leaf folder & caterpillar in Paddy',
  '🌿 Herbicides for Soybean & Chilli',
  '🐛 Pest & Fungus control medicines',
  '🧪 Crop Growth & Yield Booster',
];

const QUICK_SUGGESTIONS_HI = [
  '🌾 धान में पत्ती लपेटक और इल्ली का इलाज',
  '🌿 सोयाबीन / मिर्च में खरपतवारनाशक दवा',
  '🐛 फसल में कीट और फफूंद नियंत्रक',
  '🧪 फसल की पैदावार बढ़ाने के लिए टॉनिक',
];

/**
 * Component to render AI & User text with clean bold text, headers, and zero raw markdown symbols (** or *** or ###)
 */
function FormattedMarkdownText({ content, isUser }: { content: string; isUser: boolean }) {
  // Strip raw dividers and markdown headers
  const cleanedText = content
    .replace(/^---\s*$/gm, '')
    .replace(/^(#{1,6})\s*/gm, '')
    .trim();

  // Split into paragraphs
  const paragraphs = cleanedText.split(/\n+/);

  return (
    <View className="gap-2">
      {paragraphs.map((paragraph, pIdx) => {
        // Match bold markers like ***text*** or **text** or *text*
        const parts = paragraph.split(/(\*{1,3}[^*]+\*{1,3})/g);

        return (
          <Text
            key={pIdx}
            style={{ color: isUser ? '#FFFFFF' : '#0F172A' }}
            className="text-xs leading-6"
          >
            {parts.map((part, partIdx) => {
              if (/^\*{1,3}[^*]+\*{1,3}$/.test(part)) {
                // Remove asterisks around the text
                const boldText = part.replace(/^\*{1,3}|\*{1,3}$/g, '');
                return (
                  <Text
                    key={partIdx}
                    style={{
                      fontWeight: '900',
                      color: isUser ? '#FFFFFF' : '#092B1E',
                    }}
                    className="font-black"
                  >
                    {boldText}
                  </Text>
                );
              }
              return <Text key={partIdx}>{part}</Text>;
            })}
          </Text>
        );
      })}
    </View>
  );
}

export default function AgriAdvisorScreen() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'en';
  const isHindi = currentLang.startsWith('hi');

  const defaultWelcomeText = isHindi ? WELCOME_HI : WELCOME_EN;
  const quickSuggestions = isHindi ? QUICK_SUGGESTIONS_HI : QUICK_SUGGESTIONS_EN;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: defaultWelcomeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadedFromStorage, setIsLoadedFromStorage] = useState(false);
  const chatScrollViewRef = useRef<ScrollView>(null);

  // Fetch full store catalog for Gemini context & recommendation matching
  const productsQuery = useQuery({
    queryKey: ['mobile-agri-advisor-catalog'],
    queryFn: () => storefrontApi.products({ limit: 60 }),
  });

  const catalogProducts = productsQuery.data?.data || [];

  // Load chat history from AsyncStorage on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const savedHistory = await asyncStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
        if (savedHistory) {
          const parsed: ChatMessage[] = JSON.parse(savedHistory);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setIsLoadedFromStorage(true);
      }
    }
    void loadHistory();
  }, []);

  // Save chat history to AsyncStorage whenever messages change
  useEffect(() => {
    if (!isLoadedFromStorage) return;
    async function saveHistory() {
      try {
        await asyncStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages));
      } catch (err) {
        console.error('Failed to save chat history:', err);
      }
    }
    void saveHistory();

    // Scroll chat to bottom on new messages
    setTimeout(() => {
      chatScrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, [messages, isLoading, isLoadedFromStorage]);

  const handleClearHistory = () => {
    const executeClear = async () => {
      await asyncStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          sender: 'ai',
          text: defaultWelcomeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(isHindi ? 'क्या आप चैट इतिहास मिटाना चाहते हैं?' : 'Delete all chat history?')) {
        void executeClear();
      }
    } else {
      Alert.alert(
        isHindi ? 'इतिहास मिटाएं?' : 'Clear Chat History?',
        isHindi
          ? 'क्या आप वनिकी AI क्रॉप डॉक्टर की सभी पुरानी चैट बातचीत मिटाना चाहते हैं?'
          : 'Are you sure you want to delete all past conversation messages with Vaniki AI Crop Doctor?',
        [
          { text: isHindi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
          {
            text: isHindi ? 'मिटाएं' : 'Delete History',
            style: 'destructive',
            onPress: executeClear,
          },
        ]
      );
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll permissions are required to upload crop photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImageUri(result.assets[0].uri);
      if (result.assets[0].base64) {
        setSelectedImageBase64(result.assets[0].base64);
      }
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permissions are required to take crop photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImageUri(result.assets[0].uri);
      if (result.assets[0].base64) {
        setSelectedImageBase64(result.assets[0].base64);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = textToSend || inputText;
    if (!prompt.trim() && !selectedImageUri) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: prompt.trim() || (isHindi ? 'कृपया इस फसल की जांच करें' : 'Please inspect this crop photo'),
      imageUri: selectedImageUri || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    const currentImgBase64 = selectedImageBase64;
    setSelectedImageUri(null);
    setSelectedImageBase64(null);
    setIsLoading(true);

    try {
      const response = await askGeminiAgriAdvisor(prompt, messages, currentImgBase64 || undefined, catalogProducts, currentLang);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.text,
        recommendedProducts: response.recommendedProducts,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const callExpert = () => {
    Linking.openURL('tel:+919406160185').catch(() => undefined);
  };

  const openWhatsApp = () => {
    Linking.openURL('https://wa.me/919406160185?text=Hello%20Vaniki%20Agri%20Advisor,%20I%20need%20help%20with%20my%20crop').catch(() => undefined);
  };

  return (
    <Screen scroll={false} withWhatsAppFab={false} withServiceBar={false}>
      <View className="flex-1 w-full overflow-hidden">
        {/* Header Section (Vaniki AI Crop Doctor on 1 single line!) */}
        <View className="bg-white border-b border-slate-200 p-3 shadow-2xs">
          <View className="flex-row items-center gap-2.5 mb-2">
            <View className="relative">
              <View className="h-9 w-9 items-center justify-center rounded-2xl bg-emerald-800 shadow-2xs">
                <Feather name="activity" size={18} color="#FFFFFF" />
              </View>
              <View className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-black text-slate-900 leading-tight" numberOfLines={1}>
                Vaniki AI Crop Doctor
              </Text>
              <Text className="text-[10px] font-bold text-emerald-700">
                🟢 Online 24x7 • AI Expert
              </Text>
            </View>
          </View>

          {/* Action Buttons Row (Clear History, Call, WhatsApp) */}
          <View className="flex-row items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <Pressable
              onPress={handleClearHistory}
              className="h-8 px-3 flex-row items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 active:scale-95 flex-1 justify-center"
            >
              <Feather name="trash-2" size={13} color="#E11D48" />
              <Text className="text-[11px] font-black text-rose-700">
                {isHindi ? 'इतिहास मिटाएं' : 'Clear Chat'}
              </Text>
            </Pressable>

            <Pressable
              onPress={callExpert}
              className="h-8 px-3 flex-row items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 active:scale-95 flex-1 justify-center"
            >
              <Feather name="phone-call" size={13} color="#0F172A" />
              <Text className="text-[11px] font-black text-slate-800">Call</Text>
            </Pressable>

            <Pressable
              onPress={openWhatsApp}
              style={{ backgroundColor: '#25D366' }}
              className="h-8 px-3 flex-row items-center gap-1.5 rounded-xl active:scale-95 shadow-2xs flex-1 justify-center"
            >
              <Feather name="message-square" size={13} color="#FFFFFF" />
              <Text className="text-[11px] font-black text-white">WhatsApp</Text>
            </Pressable>
          </View>
        </View>

        {/* Quick Suggestion Chips */}
        <View className="bg-slate-50 border-b border-slate-200 py-2 px-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {quickSuggestions.map((chip, idx) => (
              <Pressable
                key={idx}
                disabled={isLoading}
                onPress={() => handleSendMessage(chip)}
                className="rounded-full bg-white border border-emerald-200 px-3 py-1.5 active:scale-95 shadow-2xs"
              >
                <Text className="text-[11px] font-bold text-emerald-900">{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Chat Feed */}
        <ScrollView
          ref={chatScrollViewRef}
          showsVerticalScrollIndicator={false}
          className="flex-1 px-3 py-3"
          contentContainerStyle={{ gap: 14, paddingBottom: 16 }}
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <View
                key={msg.id}
                className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser ? (
                  <View className="h-8 w-8 items-center justify-center rounded-xl bg-emerald-800 mr-2 mt-0.5 shadow-2xs">
                    <Feather name="cpu" size={15} color="#FFFFFF" />
                  </View>
                ) : null}

                <View className={`max-w-[88%] ${isUser ? 'items-end' : 'items-start'}`}>
                  <View
                    style={{
                      backgroundColor: isUser ? '#166534' : '#FFFFFF',
                      borderColor: isUser ? '#166534' : '#CBD5E1',
                    }}
                    className={`p-3.5 border shadow-2xs ${
                      isUser
                        ? 'rounded-2xl rounded-tr-none'
                        : 'rounded-2xl rounded-tl-none border-slate-300 bg-white'
                    }`}
                  >
                    {/* User attached photo preview */}
                    {msg.imageUri ? (
                      <View className="mb-2.5 rounded-xl overflow-hidden border border-white/20">
                        <Image
                          source={{ uri: msg.imageUri }}
                          style={{ width: 220, height: 160 }}
                          contentFit="cover"
                        />
                      </View>
                    ) : null}

                    {/* Formatted Markdown Text (Strips ** and *** and renders Bold text!) */}
                    <FormattedMarkdownText content={msg.text} isUser={isUser} />

                    {/* Recommended Product Cards inside AI Chat Bubble */}
                    {msg.recommendedProducts && msg.recommendedProducts.length > 0 ? (
                      <View className="mt-3 pt-3 border-t border-slate-200 w-full gap-2">
                        <Text className="text-[10px] font-black uppercase tracking-[1px] text-emerald-800">
                          {isHindi ? 'अनुशंसित वनिकी उत्पाद:' : 'RECOMMENDED VANIKI CROP PRODUCTS:'}
                        </Text>
                        {msg.recommendedProducts.map((prod) => {
                          const primaryImg = getPrimaryImage(prod);
                          const variant = prod.variants[0];

                          return (
                            <Pressable
                              key={prod.id}
                              onPress={() =>
                                router.push({
                                  pathname: '/product/[slug]',
                                  params: { slug: prod.slug, image: primaryImg },
                                })
                              }
                              className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-2.5 flex-row items-center gap-3 active:scale-98 shadow-2xs"
                            >
                              <Image
                                source={{ uri: primaryImg }}
                                style={{ width: 48, height: 48, borderRadius: 10 }}
                                contentFit="contain"
                                className="bg-white border border-slate-200"
                              />
                              <View className="flex-1">
                                <Text className="text-[9px] font-black uppercase text-emerald-700">
                                  {prod.category?.name || 'Crop Care'}
                                </Text>
                                <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                                  {prod.name}
                                </Text>
                                <View className="flex-row items-center gap-2 mt-0.5">
                                  {variant ? (
                                    <Text className="text-xs font-black text-emerald-800">
                                      {currencyFormatter.format(variant.price)}
                                    </Text>
                                  ) : null}
                                  <Text className="text-[10px] font-bold text-emerald-700">
                                    View Details →
                                  </Text>
                                </View>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>

                  <Text className="text-[9px] font-bold text-slate-400 mt-1 px-1">
                    {msg.timestamp}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* AI Thinking Indicator */}
          {isLoading ? (
            <View className="flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-emerald-200 self-start shadow-2xs">
              <ActivityIndicator size="small" color="#166534" />
              <Text className="text-xs font-bold text-slate-700">
                {isHindi ? 'वनिकी AI फसल की जांच कर रहा है...' : 'Vaniki AI is analyzing your crop...'}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Selected Image Preview Attachment Bar */}
        {selectedImageUri ? (
          <View className="bg-slate-100 border-t border-slate-200 px-4 py-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Image
                source={{ uri: selectedImageUri }}
                style={{ width: 36, height: 36, borderRadius: 8 }}
                contentFit="cover"
              />
              <Text className="text-xs font-bold text-slate-800">Crop Photo Attached</Text>
            </View>
            <Pressable
              onPress={() => {
                setSelectedImageUri(null);
                setSelectedImageBase64(null);
              }}
              className="p-1"
            >
              <Feather name="x" size={18} color="#64748B" />
            </Pressable>
          </View>
        ) : null}

        {/* Bottom Input Action Bar (Attached directly to tab bar) */}
        <View className="bg-white border-t border-slate-200 px-3 py-2 flex-row items-center gap-2 mb-0">
          {/* Camera / Gallery Picker Buttons */}
          <Pressable
            onPress={handleTakePhoto}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200 active:scale-90"
          >
            <Feather name="camera" size={18} color="#0F172A" />
          </Pressable>

          <Pressable
            onPress={handlePickImage}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200 active:scale-90"
          >
            <Feather name="image" size={18} color="#0F172A" />
          </Pressable>

          {/* Text Input */}
          <View className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-1 flex-row items-center">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={isHindi ? 'अपनी फसल या बीमारी के बारे में लिखें...' : 'Ask about crop disease or dosage...'}
              className="flex-1 text-xs font-semibold text-slate-900 py-1"
              style={{ outlineStyle: 'none', outlineWidth: 0 } as any}
              placeholderTextColor="#94A3B8"
              underlineColorAndroid="transparent"
              onSubmitEditing={() => handleSendMessage()}
            />
          </View>

          {/* Send Button */}
          <Pressable
            disabled={(!inputText.trim() && !selectedImageUri) || isLoading}
            onPress={() => handleSendMessage()}
            style={{ backgroundColor: (!inputText.trim() && !selectedImageUri) || isLoading ? '#CBD5E1' : '#166534' }}
            className="h-10 w-10 items-center justify-center rounded-2xl active:scale-90 shadow-xs"
          >
            <Feather name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
