import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { dealerApi } from '../../src/lib/api';

const Icon = Feather as any;

type LoginMode = 'phone' | 'otp' | 'password';

export default function DealerLoginScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<LoginMode>('phone');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);

  const { setSession } = useAuthStore();

  const handleSendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await dealerApi.sendOtp(phone);
      const vid = res?.verificationId || (res as any)?.data?.verificationId || '';
      setVerificationId(vid);
      setMode('otp');
    } catch (err: any) {
      // If user doesn't exist, invite them to register KYC
      if (err?.message?.includes('not found') || err?.message?.includes('register')) {
        Alert.alert(
          'New Dealer?',
          'This mobile number is not registered. Would you like to complete Dealer KYC & register your store now?',
          [
            {
              text: 'Register Store / KYC',
              onPress: () => router.push({ pathname: '/kyc', params: { phone } } as any),
            },
            { text: 'Cancel' },
          ],
        );
      } else {
        Alert.alert('Notice', err?.message || 'Failed to send OTP. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP received on your phone.');
      return;
    }
    setLoading(true);
    try {
      const res = await dealerApi.verifyOtp(phone, otp, verificationId);
      if (!res.user || (res.user.role !== 'storeAdmin' && res.user.role !== 'superAdmin')) {
        Alert.alert(
          'Complete Store KYC',
          'This account does not have an active dealer profile. Please complete your Store KYC to access dealer wholesale pricing.',
          [
            {
              text: 'Register Store / KYC',
              onPress: () => router.push({ pathname: '/kyc', params: { phone } } as any),
            },
            { text: 'Cancel' },
          ],
        );
        return;
      }
      setSession({ user: res.user, token: res.token });
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('OTP Failed', err?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Fields Required', 'Please enter your registered mobile number and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await dealerApi.loginPassword(phone, password);
      if (!res.user || (res.user.role !== 'storeAdmin' && res.user.role !== 'superAdmin')) {
        Alert.alert(
          'Complete Store KYC',
          'This account does not have an active dealer profile. Please complete your Store KYC to register as a Vaniki dealer.',
          [
            {
              text: 'Register Store / KYC',
              onPress: () => router.push({ pathname: '/kyc', params: { phone } } as any),
            },
            { text: 'Cancel' },
          ],
        );
        return;
      }
      setSession({ user: res.user, token: res.token });
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', err?.message || 'Invalid mobile number or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-offwhite">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cartoon Dealer With Shop Hero Section */}
          <View className="bg-white px-6 pt-3 pb-6 items-center border-b border-primary-100 shadow-xs">
            {/* Top Left Logo Header */}
            <View className="w-full flex-row items-center justify-between mb-3">
              <Image
                source={require('../../assets/logo.png')}
                style={{ width: 115, height: 40 }}
                resizeMode="contain"
              />
              <View className="rounded-full bg-emerald-50 px-3 py-1 border border-emerald-200">
                <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  B2B Portal
                </Text>
              </View>
            </View>

            <View className="w-44 h-44 rounded-3xl overflow-hidden shadow-lg border-2 border-emerald-500/30 mb-3.5 bg-primary-50">
              <Image
                source={require('../../assets/dealer_welcome.jpg')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </View>

            <View className="items-center">
              <View className="flex-row items-center gap-1.5 mb-0.5">
                <Icon name="check-circle" size={14} color="#2D6A4F" />
                <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-700">
                  Vaniki Partner
                </Text>
              </View>
              <Text className="text-2xl font-black text-slate-900 tracking-tight">
                Authorized Dealer Portal
              </Text>
              <Text className="text-xs font-semibold text-slate-500 mt-1 text-center max-w-xs">
                Direct B2B Procurement, Factory Rates &amp; Tally Tax Invoicing for Agri Retailers
              </Text>
            </View>
          </View>

          <View className="flex-1 px-6 pt-6 pb-12">
            {/* Mode: Phone for OTP */}
            {mode === 'phone' && (
              <View>
                <Text className="text-xs font-black uppercase tracking-[2px] text-primary-500 mb-1">
                  Dealer Login
                </Text>
                <Text className="text-xl font-black text-slate-900 leading-tight mb-1.5">
                  Enter Mobile Number
                </Text>
                <Text className="text-xs font-semibold text-slate-500 mb-5">
                  We'll send a 4-digit OTP to verify your dealer account.
                </Text>

                {/* Phone Input */}
                <View className="flex-row items-center rounded-2xl border-2 border-primary-200 bg-white px-3.5 py-0 mb-4 shadow-xs">
                  <View className="flex-row items-center border-r border-primary-100 pr-2.5 py-3.5 mr-2.5 shrink-0" style={{ minWidth: 62 }}>
                    <Text className="text-base mr-1">🇮🇳</Text>
                    <Text className="text-sm font-black text-primary-900" numberOfLines={1}>+91</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholderTextColor="#9BB5A8"
                    className="flex-1 text-base font-bold text-slate-900 py-3.5"
                  />
                </View>

                <Pressable
                  onPress={handleSendOtp}
                  disabled={loading || phone.length < 10}
                  className="rounded-2xl py-4 items-center mb-3 shadow-md active:scale-95"
                  style={{
                    backgroundColor: phone.length === 10 ? '#143D2E' : '#B8D5C8',
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-xs font-black uppercase tracking-[2px] text-white">
                      Get Login OTP
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setMode('password')}
                  className="py-2 items-center"
                >
                  <Text className="text-xs font-bold text-primary-700">
                    Use Password Login instead
                  </Text>
                </Pressable>

                {/* New Dealer KYC Registration CTA */}
                <View className="mt-6 pt-5 border-t border-slate-200">
                  <View className="rounded-2xl bg-primary-50 p-4 border border-primary-200/80 items-center">
                    <Text className="text-xs font-black text-primary-900 mb-1">
                      Are you a New Agri-Input Retailer?
                    </Text>
                    <Text className="text-[11px] font-semibold text-primary-700 text-center mb-3">
                      Register your store with GSTIN &amp; GPS location to get wholesale B2B pricing.
                    </Text>
                    <Pressable
                      onPress={() => router.push({ pathname: '/kyc', params: { phone } } as any)}
                      className="w-full rounded-xl bg-emerald-600 py-3 items-center shadow-xs active:scale-95"
                    >
                      <Text className="text-xs font-black uppercase tracking-wider text-white">
                        + Register Store / Submit KYC
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* Mode: Password Login */}
            {mode === 'password' && (
              <View>
                <Text className="text-xs font-black uppercase tracking-[2px] text-primary-500 mb-1">
                  Dealer Authentication
                </Text>
                <Text className="text-xl font-black text-slate-900 leading-tight mb-1.5">
                  Login with Password
                </Text>
                <Text className="text-xs font-semibold text-slate-500 mb-5">
                  Enter your registered mobile number and dealer password.
                </Text>

                {/* Phone Input */}
                <View className="flex-row items-center rounded-2xl border-2 border-primary-200 bg-white px-3.5 py-0 mb-3 shadow-xs">
                  <View className="flex-row items-center border-r border-primary-100 pr-2.5 py-3.5 mr-2.5 shrink-0" style={{ minWidth: 62 }}>
                    <Text className="text-base mr-1">🇮🇳</Text>
                    <Text className="text-sm font-black text-primary-900" numberOfLines={1}>+91</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholderTextColor="#9BB5A8"
                    className="flex-1 text-base font-bold text-slate-900 py-3.5"
                  />
                </View>

                {/* Password Input */}
                <View className="flex-row items-center rounded-2xl border-2 border-primary-200 bg-white px-4 py-0 mb-5 shadow-xs">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password"
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#9BB5A8"
                    className="flex-1 text-base font-bold text-slate-900 py-3.5"
                  />
                  <Pressable onPress={() => setShowPassword((p) => !p)} className="p-2">
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color="#94A3B8" />
                  </Pressable>
                </View>

                <Pressable
                  onPress={handlePasswordLogin}
                  disabled={loading || phone.length < 10 || !password}
                  className="rounded-2xl py-4 items-center mb-3 shadow-md active:scale-95"
                  style={{
                    backgroundColor: phone.length === 10 && password ? '#143D2E' : '#B8D5C8',
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-xs font-black uppercase tracking-[2px] text-white">
                      Login to Dashboard
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setMode('phone')}
                  className="py-2 items-center"
                >
                  <Text className="text-xs font-bold text-primary-700">
                    Use OTP Login instead
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Mode: OTP Verification */}
            {mode === 'otp' && (
              <View>
                <Text className="text-xs font-black uppercase tracking-[2px] text-primary-500 mb-1">
                  Step 2 of 2
                </Text>
                <Text className="text-xl font-black text-slate-900 leading-tight mb-1.5">
                  Verify OTP
                </Text>
                <Text className="text-xs font-semibold text-slate-500 mb-5">
                  Verification code sent to +91 {phone}
                </Text>

                {/* OTP Input */}
                <View className="rounded-2xl border-2 border-primary-200 bg-white px-4 py-0 mb-5 shadow-xs">
                  <TextInput
                    value={otp}
                    onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                    placeholder="4-digit OTP"
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholderTextColor="#9BB5A8"
                    className="text-2xl font-black text-center tracking-[8px] text-primary-900 py-3.5"
                  />
                </View>

                <Pressable
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.length < 4}
                  className="rounded-2xl py-4 items-center mb-3 shadow-md active:scale-95"
                  style={{
                    backgroundColor: otp.length >= 4 ? '#143D2E' : '#B8D5C8',
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-xs font-black uppercase tracking-[2px] text-white">
                      Verify &amp; Continue
                    </Text>
                  )}
                </Pressable>

                <View className="flex-row justify-between items-center mt-2">
                  <Pressable onPress={() => setMode('phone')}>
                    <Text className="text-xs font-bold text-primary-700 underline">
                      Change Mobile
                    </Text>
                  </Pressable>
                  <Pressable onPress={handleSendOtp} disabled={loading}>
                    <Text className="text-xs font-bold text-slate-500">Resend OTP</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
