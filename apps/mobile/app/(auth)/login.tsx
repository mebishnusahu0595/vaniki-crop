import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useServiceModeStore } from '../../src/store/useServiceModeStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { useFocusAwareScroll } from '../../src/hooks/useFocusAwareScroll';
import type { AuthUser } from '../../src/types/storefront';

export default function LoginScreen() {
  const [mode, setModeState] = useState<'login' | 'forgot' | 'reset'>('login');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [actualForgotIdentifier, setActualForgotIdentifier] = useState<{ mobile?: string; email?: string }>({});

  const { setSession, setUser } = useAuthStore();
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);
  const setStore = useStoreStore((state) => state.setStore);
  const { scrollRef, onInputFocus } = useFocusAwareScroll(110);

  const applySessionPreferences = (session: AuthUser) => {
    setMode(session.serviceMode);
    setAddress(session.savedAddress || null);
    if (session.serviceMode === 'pickup' && session.selectedStore && typeof session.selectedStore !== 'string') {
      setStore(session.selectedStore);
      return;
    }
    if (session.serviceMode === 'delivery' || !session.selectedStore) {
      setStore(null);
    }
  };

  const handleForgotSubmit = async () => {
    if (!forgotIdentifier) {
      Alert.alert('Required', 'Please enter your mobile or email.');
      return;
    }
    setLoading(true);
    try {
      const isEmail = forgotIdentifier.includes('@');
      const payload = isEmail ? { email: forgotIdentifier } : { mobile: forgotIdentifier };
      await storefrontApi.forgotPassword(payload);
      setActualForgotIdentifier(payload);
      setModeState('reset');
      Alert.alert('OTP Sent', 'Please check your mobile/email for the 4-digit OTP.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    if (!otp || !newPassword) {
      Alert.alert('Required', 'Please enter OTP and new password.');
      return;
    }
    if (otp.length !== 4) {
      Alert.alert('Invalid OTP', 'OTP must be 4 digits.');
      return;
    }
    setLoading(true);
    try {
      await storefrontApi.resetPassword({
        ...actualForgotIdentifier,
        otp,
        newPassword,
      });
      Alert.alert('Success', 'Password reset successfully. Please login.');
      setModeState('login');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen withServiceBar={false} scroll={false} keyboardAware={false}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 300 }}
        >
          <View className="mt-10 rounded-[32px] bg-white p-8">
            <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-400">
              {mode === 'login' ? 'Mobile Login' : 'Security'}
            </Text>
            <Text className="mt-3 text-3xl font-black text-primary-900">
              {mode === 'login' ? 'Welcome back to Vaniki Crop.' : mode === 'forgot' ? 'Forgot Password?' : 'Reset Password'}
            </Text>
            <Text className="mt-4 text-sm leading-7 text-primary-900/70">
              {mode === 'login' 
                ? 'Login with your mobile number and password.' 
                : mode === 'forgot' 
                  ? 'Enter your registered mobile or email to receive a 4-digit OTP.' 
                  : 'Enter the OTP and your new password.'}
            </Text>

            {mode === 'login' && (
              <View className="mt-6">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Mobile Number</Text>
                  <TextInput
                    value={mobile}
                    onChangeText={setMobile}
                    onFocus={onInputFocus}
                    placeholder="9876543210"
                    keyboardType="number-pad"
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                <View className="mt-5">
                  <View className="mb-2 flex-row items-center justify-between px-1">
                    <Text className="text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Password</Text>
                    <Pressable onPress={() => setModeState('forgot')}>
                      <Text className="text-[11px] font-black uppercase tracking-[1px] text-primary-500">Forgot?</Text>
                    </Pressable>
                  </View>
                  <View className="relative">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      onFocus={onInputFocus}
                      secureTextEntry={!showPassword}
                      placeholder="Password"
                      className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 pr-12 text-base text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                    <Pressable
                      onPress={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -mt-3 h-6 w-6 items-center justify-center"
                      hitSlop={8}
                    >
                      <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#527164" />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  disabled={loading}
                  onPress={async () => {
                    if (!mobile || !password) {
                      Alert.alert('Missing details', 'Enter mobile number and password to continue.');
                      return;
                    }
                    setLoading(true);
                    try {
                      const response = await storefrontApi.login({ mobile, password });
                      setSession({ user: response.user, token: response.accessToken });
                      applySessionPreferences(response.user);
                      void storefrontApi
                        .me()
                        .then((session) => {
                          setUser(session);
                          applySessionPreferences(session);
                        })
                        .catch(() => undefined);
                      router.replace('/(tabs)');
                    } catch (caughtError) {
                      Alert.alert('Login failed', caughtError instanceof Error ? caughtError.message : 'Try again.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="mt-6 rounded-full bg-primary-900 px-5 py-4"
                >
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                    {loading ? 'Signing In...' : 'Login'}
                  </Text>
                </Pressable>
              </View>
            )}

            {mode === 'forgot' && (
              <View className="mt-6">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Mobile or Email</Text>
                  <TextInput
                    value={forgotIdentifier}
                    onChangeText={setForgotIdentifier}
                    onFocus={onInputFocus}
                    placeholder="Enter mobile or email"
                    autoCapitalize="none"
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                <Pressable
                  disabled={loading}
                  onPress={handleForgotSubmit}
                  className="mt-6 rounded-full bg-primary-900 px-5 py-4"
                >
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                  </Text>
                </Pressable>

                <Pressable onPress={() => setModeState('login')} className="mt-6 py-2">
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
                    Back to Login
                  </Text>
                </Pressable>
              </View>
            )}

            {mode === 'reset' && (
              <View className="mt-6">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">4-Digit OTP</Text>
                  <TextInput
                    value={otp}
                    onChangeText={(val) => setOtp(val.replace(/\D/g, ''))}
                    onFocus={onInputFocus}
                    placeholder="0000"
                    keyboardType="number-pad"
                    maxLength={4}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-center text-2xl font-black tracking-[10px] text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                <View className="mt-5">
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">New Password</Text>
                  <View className="relative">
                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onFocus={onInputFocus}
                      secureTextEntry={!showPassword}
                      placeholder="New Password"
                      className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 pr-12 text-base text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                    <Pressable
                      onPress={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -mt-3 h-6 w-6 items-center justify-center"
                      hitSlop={8}
                    >
                      <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#527164" />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  disabled={loading}
                  onPress={handleResetSubmit}
                  className="mt-6 rounded-full bg-primary-900 px-5 py-4"
                >
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </Text>
                </Pressable>

                <Pressable onPress={() => setModeState('forgot')} className="mt-6 py-2">
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
                    Resend OTP
                  </Text>
                </Pressable>
              </View>
            )}

            {mode === 'login' && (
              <Pressable onPress={() => router.push('/(auth)/signup')} className="mt-6 py-2">
                <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
                  Create Account
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
