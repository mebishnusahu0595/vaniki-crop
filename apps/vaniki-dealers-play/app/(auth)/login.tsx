import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { dealerApi } from '../../src/lib/api';

type LoginMode = 'phone' | 'otp';

export default function DealerLoginScreen() {
  const [mode, setMode] = useState<LoginMode>('phone');
  const [phone, setPhone] = useState('');
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
      setVerificationId(res.verificationId || '');
      setMode('otp');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send OTP. Try again.');
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
          'Access Denied',
          'This app is only for Vaniki Crop registered dealers. Contact support to register as a dealer.',
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
          {/* Hero */}
          <View className="bg-primary-700 px-6 pt-14 pb-10 items-center">
            <View className="w-20 h-20 rounded-[28px] bg-white/10 items-center justify-center mb-4 border border-white/20">
              <Feather name="package" size={36} color="#FFFFFF" />
            </View>
            <Text className="text-2xl font-black text-white tracking-tight">Vaniki Dealers</Text>
            <Text className="text-sm font-semibold text-white/70 mt-1 text-center">
              B2B Procurement Platform for Agri-Input Dealers
            </Text>
          </View>

          <View className="flex-1 px-6 pt-8 pb-12">

            {mode === 'phone' ? (
              <View>
                <Text className="text-xs font-black uppercase tracking-[2px] text-primary-400 mb-1">
                  Step 1 of 2
                </Text>
                <Text className="text-2xl font-black text-primary-900 leading-tight mb-2">
                  Enter Your{'\n'}Mobile Number
                </Text>
                <Text className="text-sm font-semibold text-primary-900/60 mb-8">
                  Registered dealer accounts only. We'll send an OTP to verify.
                </Text>

                {/* Phone Input */}
                <View className="flex-row items-center rounded-2xl border-2 border-primary-200 bg-white px-4 py-0 mb-5 shadow-xs">
                  <View className="flex-row items-center gap-2 border-r border-primary-100 pr-3 py-4 mr-3">
                    <Text className="text-base">🇮🇳</Text>
                    <Text className="text-sm font-black text-primary-900">+91</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholderTextColor="#9BB5A8"
                    className="flex-1 text-base font-bold text-primary-900 py-4"
                  />
                </View>

                <Pressable
                  onPress={handleSendOtp}
                  disabled={loading || phone.length < 10}
                  style={{
                    backgroundColor: phone.length === 10 ? '#143D2E' : '#B8D5C8',
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: 'center',
                    shadowColor: '#143D2E',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-sm font-black uppercase tracking-[2px] text-white">
                      Send OTP →
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View>
                <Pressable
                  onPress={() => { setMode('phone'); setOtp(''); }}
                  className="flex-row items-center gap-2 mb-6"
                >
                  <Feather name="arrow-left" size={20} color="#143D2E" />
                  <Text className="text-sm font-bold text-primary-700">Back</Text>
                </Pressable>

                <Text className="text-xs font-black uppercase tracking-[2px] text-primary-400 mb-1">
                  Step 2 of 2
                </Text>
                <Text className="text-2xl font-black text-primary-900 leading-tight mb-2">
                  Enter OTP
                </Text>
                <Text className="text-sm font-semibold text-primary-900/60 mb-8">
                  OTP sent to{' '}
                  <Text className="font-black text-primary-800">+91 {phone}</Text>
                </Text>

                {/* OTP Input */}
                <View className="rounded-2xl border-2 border-primary-200 bg-white px-4 mb-5 shadow-xs">
                  <TextInput
                    value={otp}
                    onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 4–6 digit OTP"
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholderTextColor="#9BB5A8"
                    className="text-2xl font-black text-primary-900 text-center py-4 tracking-widest"
                  />
                </View>

                <Pressable
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.length < 4}
                  style={{
                    backgroundColor: otp.length >= 4 ? '#143D2E' : '#B8D5C8',
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: 'center',
                    shadowColor: '#143D2E',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-sm font-black uppercase tracking-[2px] text-white">
                      Verify & Login →
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={handleSendOtp}
                  disabled={loading}
                  className="mt-4 items-center py-3"
                >
                  <Text className="text-sm font-bold text-primary-600 underline">
                    Resend OTP
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Footer */}
            <View className="mt-10 pt-6 border-t border-primary-100 items-center gap-1">
              <Text className="text-xs font-semibold text-primary-900/40 text-center">
                Only registered Vaniki Crop dealers can access this app.
              </Text>
              <Text className="text-xs font-semibold text-primary-900/40 text-center">
                Contact us at{' '}
                <Text className="text-primary-600 font-bold">support@vanikicrop.com</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
