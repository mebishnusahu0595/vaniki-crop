import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';
import { storefrontApi } from '../src/lib/api';

const SUBJECT_OPTIONS = ['General Inquiry', 'Product Query', 'Order Issue', 'Dealer Inquiry', 'Other'] as const;
type ContactSubject = (typeof SUBJECT_OPTIONS)[number];

export default function ContactScreen() {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    email: string;
    mobile: string;
    subject: ContactSubject;
    message: string;
  }>({
    name: '',
    email: '',
    mobile: '',
    subject: SUBJECT_OPTIONS[0],
    message: '',
  });

  const notifyUser = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      notifyUser(isHindi ? 'नाम आवश्यक है' : 'Required Field', isHindi ? 'कृपया अपना पूरा नाम दर्ज करें।' : 'Please enter your Full Name.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      notifyUser(isHindi ? 'अमान्य ईमेल' : 'Invalid Email', isHindi ? 'कृपया मान्य ईमेल दर्ज करें।' : 'Please enter a valid email address.');
      return;
    }
    if (!form.message.trim() || form.message.trim().length < 3) {
      notifyUser(isHindi ? 'संदेश आवश्यक है' : 'Message Needed', isHindi ? 'कृपया अपना संदेश या समस्या लिखें।' : 'Please write a brief message or query.');
      return;
    }

    setLoading(true);
    try {
      await storefrontApi.contact({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim() || undefined,
        subject: form.subject,
        message: form.message.trim(),
      });
      notifyUser(
        isHindi ? 'संदेश भेज दिया गया! ✉️' : 'Message Sent! ✉️',
        isHindi ? 'हमसे संपर्क करने के लिए धन्यवाद! हमारी टीम जल्द ही आपसे संपर्क करेगी।' : 'Thank you for reaching out! Our team will get back to you shortly.',
      );
      setForm({
        name: '',
        email: '',
        mobile: '',
        subject: SUBJECT_OPTIONS[0],
        message: '',
      });
    } catch (caughtError) {
      notifyUser('Send failed', caughtError instanceof Error ? caughtError.message : 'Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View className="rounded-[28px] bg-primary-900 p-6 shadow-md">
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-200">
          {t('mobile.sidebar.contactUs')}
        </Text>
        <Text className="mt-3 text-2xl font-black text-white">
          {isHindi ? 'Vaniki सहायता टीम से संपर्क करें' : 'Talk to the Vaniki team'}
        </Text>
        <Text className="mt-4 text-xs leading-6 text-white/80">
          {isHindi
            ? 'दवाइयों की सलाह, थोक ऑर्डर या डीलरशिप के लिए हमें संदेश भेजें या हेल्पलाइन पर संपर्क करें:'
            : 'Need product guidance, bulk order support, or dealer inquiry? Send us a note and we will get back to you at '}
          <Text className="font-bold text-emerald-300">vaniki.crop@gmail.com</Text>
        </Text>

        <Pressable
          onPress={() => Linking.openURL('tel:+919406160185')}
          className="mt-4 flex-row items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-3.5 py-2.5 self-start active:scale-95"
        >
          <Feather name="phone" size={14} color="#52B788" />
          <Text className="text-xs font-black text-emerald-200">+91 9406160185</Text>
        </Pressable>
      </View>

      <View className="mt-5 rounded-[28px] bg-white p-5 border border-primary-100 shadow-2xs gap-4">
        <View>
          <Text className="text-xs font-bold text-primary-900 mb-1.5">
            {isHindi ? 'पूरा नाम *' : 'Full Name *'}
          </Text>
          <TextInput
            value={form.name}
            onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
            placeholder={isHindi ? 'अपना नाम दर्ज करें' : 'Your name'}
            className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3.5 text-sm font-bold text-primary-900"
            placeholderTextColor="#7a978b"
          />
        </View>

        <View>
          <Text className="text-xs font-bold text-primary-900 mb-1.5">
            {isHindi ? 'ईमेल *' : 'Email Address *'}
          </Text>
          <TextInput
            value={form.email}
            onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
            placeholder="example@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3.5 text-sm font-bold text-primary-900"
            placeholderTextColor="#7a978b"
          />
        </View>

        <View>
          <Text className="text-xs font-bold text-primary-900 mb-1.5">
            {isHindi ? 'मोबाइल नंबर' : 'Mobile Number'}
          </Text>
          <TextInput
            value={form.mobile}
            onChangeText={(text) => setForm((prev) => ({ ...prev, mobile: text }))}
            placeholder="+91 9876543210"
            keyboardType="phone-pad"
            className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3.5 text-sm font-bold text-primary-900"
            placeholderTextColor="#7a978b"
          />
        </View>

        <View>
          <Text className="text-xs font-bold text-primary-900 mb-1.5">
            {isHindi ? 'संदेश या समस्या *' : 'Message *'}
          </Text>
          <TextInput
            value={form.message}
            onChangeText={(text) => setForm((prev) => ({ ...prev, message: text }))}
            placeholder={isHindi ? 'अपनी समस्या या सवाल यहां लिखें...' : 'How can we help you?'}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-bold text-primary-900 min-h-[90px]"
            placeholderTextColor="#7a978b"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="mt-2 rounded-full bg-primary-500 py-4 items-center active:scale-95 shadow-md"
        >
          <Text className="text-xs font-black uppercase tracking-[2px] text-white">
            {loading ? t('common.loading') : isHindi ? 'संदेश भेजें' : 'Send Message'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
