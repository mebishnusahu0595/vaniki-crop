import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';

const sections = [
  {
    title: '1. Introduction',
    body: 'Welcome to Vaniki Crop ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website vanikicrop.com and use our mobile application (collectively, the "Platform").',
  },
  {
    title: '2. Information We Collect',
    body: 'We collect your full name, mobile phone number, email address (optional), delivery address, and payment information (processed securely by Razorpay — we do not store card details). We also automatically collect device type, operating system, IP address, app usage data, and push notification tokens.',
  },
  {
    title: '3. How We Use Your Information',
    body: 'We use your information to process and fulfill orders, send order confirmations and delivery updates via email and push notifications, provide customer support, improve our Platform, prevent fraudulent transactions, and comply with legal obligations.',
  },
  {
    title: '4. Payment Security',
    body: 'All payment transactions are processed through Razorpay, a PCI-DSS compliant payment gateway. We do not store, process, or have access to your credit/debit card numbers or UPI PINs.',
  },
  {
    title: '5. Data Sharing',
    body: 'We do not sell your personal information. We may share your data with: Store Partners (name, mobile, and delivery address to fulfill orders), Payment Processors (Razorpay), Communication Providers (MSG91 for OTP), and Law Enforcement (if required by law).',
  },
  {
    title: '6. Data Retention',
    body: 'We retain your personal information for as long as your account is active. Order history is kept for accounting and legal compliance. You can request account deletion by contacting support@vanikicrop.com.',
  },
  {
    title: '7. Your Rights',
    body: 'You have the right to access, correct, and delete your personal data. You can also withdraw consent for marketing communications at any time.',
  },
  {
    title: '8. Children\'s Privacy',
    body: 'Our Platform is not intended for children under 18. We do not knowingly collect personal information from minors.',
  },
  {
    title: '9. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date.',
  },
  {
    title: '10. Contact Us',
    body: 'Email: support@vanikicrop.com\nPhone: +91 94061 02621\nAddress: Main Road, Bagsewania, Bhopal, Madhya Pradesh 462043',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <Screen scroll={false} withServiceBar={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="mb-4 mt-6 flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white">
            <Feather name="arrow-left" size={20} color="#082018" />
          </Pressable>
          <Text className="text-3xl font-black text-primary-900">Privacy Policy</Text>
        </View>

        <View className="rounded-[28px] bg-primary-900 p-6">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-200">Legal</Text>
          <Text className="mt-3 text-2xl font-black leading-9 text-white">Privacy Policy</Text>
          <Text className="mt-2 text-sm text-white/60">Last updated: April 25, 2026</Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} className="mt-4 rounded-[24px] bg-white p-5">
            <Text className="text-lg font-black text-primary-900">{section.title}</Text>
            <Text className="mt-3 text-sm leading-6 text-primary-900/70">{section.body}</Text>
          </View>
        ))}

        <View className="mt-4 rounded-[24px] bg-white p-5">
          <Text className="text-sm leading-6 text-primary-900/70">
            For the full version of this policy, visit:
          </Text>
          <Pressable onPress={() => Linking.openURL('https://vanikicrop.com/privacy-policy')}>
            <Text className="mt-2 text-sm font-bold text-primary-500">vanikicrop.com/privacy-policy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
