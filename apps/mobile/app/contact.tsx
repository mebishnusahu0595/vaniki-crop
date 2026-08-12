import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import { storefrontApi } from '../src/lib/api';
import { siteConfig } from '../src/constants/site';

const SUBJECT_OPTIONS = ['General Inquiry', 'Product Query', 'Order Issue', 'Dealer Inquiry', 'Other'] as const;
type ContactSubject = (typeof SUBJECT_OPTIONS)[number];

export default function ContactScreen() {
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
      notifyUser('Required Field', 'Please enter your Full Name.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      notifyUser('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!form.message.trim() || form.message.trim().length < 3) {
      notifyUser('Message Needed', 'Please write a brief message or query.');
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
      notifyUser('Message Sent! ✉️', 'Thank you for reaching out! Our team at vaniki.crop@gmail.com will get back to you shortly.');
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
      <View className="rounded-[28px] bg-primary-900 p-6">
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-200">Contact Us</Text>
        <Text className="mt-3 text-3xl font-black text-white">Talk to the Vaniki team</Text>
        <Text className="mt-4 text-sm leading-7 text-white/75">
          Need product guidance, bulk order support, or dealer inquiry? Send us a note and we will get back to you at <Text className="font-bold text-emerald-300">vaniki.crop@gmail.com</Text>.
        </Text>
      </View>

      <View className="mt-5 gap-4 rounded-[28px] bg-white p-5 shadow-xs">
        <TextInput
          value={form.name}
          onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
          placeholder="Full Name"
          className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
          placeholderTextColor="#7a978b"
        />
        <TextInput
          value={form.email}
          onChangeText={(value) => setForm((current) => ({ ...current, email: value }))}
          placeholder="Email Address"
          keyboardType="email-address"
          autoCapitalize="none"
          className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
          placeholderTextColor="#7a978b"
        />
        <TextInput
          value={form.mobile}
          onChangeText={(value) => setForm((current) => ({ ...current, mobile: value }))}
          placeholder="Mobile Number (Optional)"
          keyboardType="number-pad"
          className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
          placeholderTextColor="#7a978b"
        />
        <View className="flex-row flex-wrap gap-2">
          {SUBJECT_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setForm((current) => ({ ...current, subject: option }))}
              className={`rounded-full px-4 py-3 active:scale-95 ${form.subject === option ? 'bg-primary-500' : 'bg-primary-50'}`}
            >
              <Text className={`text-[10px] font-black uppercase tracking-[1.4px] ${form.subject === option ? 'text-white' : 'text-primary-900'}`}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={form.message}
          onChangeText={(value) => setForm((current) => ({ ...current, message: value }))}
          placeholder="How can we help you?"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          className="min-h-[140px] rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
          placeholderTextColor="#7a978b"
        />
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={{ backgroundColor: loading ? '#94A3B8' : '#166534' }}
          className="rounded-full px-5 py-4 active:scale-95 shadow-xs"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
            {loading ? 'Sending Message...' : 'Send Message'}
          </Text>
        </Pressable>
      </View>

      <View className="mt-5 gap-3 rounded-[28px] bg-white p-5 mb-8 shadow-xs">
        <Text className="text-2xl font-black text-primary-900">Contact Information</Text>
        <Text className="text-sm font-semibold text-primary-900/75">Phone: {siteConfig.supportPhone}</Text>
        <Text className="text-sm font-semibold text-primary-900/75">Email: vaniki.crop@gmail.com</Text>
        <Text className="text-sm font-semibold text-primary-900/75">Address: {siteConfig.contactAddress}</Text>
        <Text className="text-sm font-semibold text-primary-900/75">Hours: {siteConfig.workingHours}</Text>
        <Pressable
          onPress={() => {
            void Linking.openURL(`tel:${siteConfig.supportPhone.replace(/\s+/g, '')}`);
          }}
          className="mt-2 rounded-full border border-primary-100 bg-primary-50 px-4 py-3 active:scale-95"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[1.6px] text-primary-900">Call Support</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
