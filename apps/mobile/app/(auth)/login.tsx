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
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useServiceModeStore } from '../../src/store/useServiceModeStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { useFocusAwareScroll } from '../../src/hooks/useFocusAwareScroll';
import type { AuthUser } from '../../src/types/storefront';

type LoginMode = 'login' | 'otp-send' | 'otp-verify' | 'forgot' | 'reset';

export default function LoginScreen() {
  const [mode, setModeState] = useState<LoginMode>('login');

  // Password login
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP login
  const [otpMobile, setOtpMobile] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [isSendingLoginOtp, setIsSendingLoginOtp] = useState(false);
  const [loginVerificationId, setLoginVerificationId] = useState('');

  // Forgot Password state
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [verificationId, setVerificationId] = useState('');

  const [loading, setLoading] = useState(false);

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

  const onLoginSuccess = (user: AuthUser, token: string) => {
    setSession({ user, token });
    applySessionPreferences(user);
    void storefrontApi
      .me()
      .then((session) => {
        setUser(session);
        applySessionPreferences(session);
      })
      .catch(() => undefined);
    router.replace('/(tabs)');
  };

  // --- Password Login ---
  const handlePasswordLogin = async () => {
    if (!mobile || !password) {
      Alert.alert('Missing details', 'Enter mobile number and password to continue.');
      return;
    }
    setLoading(true);
    try {
      const response = await storefrontApi.login({ mobile, password });
      onLoginSuccess(response.user, response.accessToken);
    } catch (caughtError) {
      Alert.alert('Login failed', caughtError instanceof Error ? caughtError.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- OTP Login ---
  const handleSendLoginOtp = async () => {
    if (!otpMobile || !/^[6-9]\d{9}$/.test(otpMobile)) {
      Alert.alert('Invalid', 'Enter a valid 10-digit mobile number.');
      return;
    }
    setIsSendingLoginOtp(true);
    try {
      const res = await storefrontApi.sendLoginOtp({ mobile: otpMobile });
      if (res.verificationId) {
        setLoginVerificationId(res.verificationId);
      }
      setModeState('otp-verify');
      if (res.message) {
        Alert.alert('Notice', res.message);
      }
    } catch (caughtError) {
      Alert.alert('Error', caughtError instanceof Error ? caughtError.message : 'Failed to send OTP.');
    } finally {
      setIsSendingLoginOtp(false);
    }
  };

  const handleOtpLogin = async () => {
    if (!loginOtp || loginOtp.length !== 4) {
      Alert.alert('Invalid OTP', 'Enter the 4-digit OTP sent to your mobile.');
      return;
    }
    setLoading(true);
    try {
      const response = await storefrontApi.loginWithOtp({
        mobile: otpMobile,
        otp: loginOtp,
        verificationId: loginVerificationId,
      });
      onLoginSuccess(response.user, response.accessToken);
    } catch (caughtError) {
      Alert.alert('OTP Login failed', caughtError instanceof Error ? caughtError.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Forgot Password ---
  const handleSendForgotOtp = async () => {
    if (!forgotMobile || !/^[6-9]\d{9}$/.test(forgotMobile)) {
      Alert.alert('Invalid', 'Enter a valid 10-digit registered mobile number.');
      return;
    }
    setIsSendingOtp(true);
    try {
      const res = await storefrontApi.forgotPassword({ mobile: forgotMobile });
      if (res.verificationId) {
        setVerificationId(res.verificationId);
      }
      setModeState('reset');
      Alert.alert(res.message ? 'Notice' : 'OTP Sent', res.message || 'Enter the 4-digit OTP to verify your identity.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResetSubmit = async () => {
    if (!forgotOtp || forgotOtp.length !== 4) {
      Alert.alert('Invalid OTP', 'Enter the 4-digit OTP.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await storefrontApi.resetPassword({ mobile: forgotMobile, otp: forgotOtp, newPassword, verificationId });
      Alert.alert('Success', 'Password reset successfully. Please login.');
      setModeState('login');
      setForgotOtp('');
      setNewPassword('');
      setVerificationId('');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome back to Vaniki Crop.';
      case 'otp-send': return 'Login with OTP';
      case 'otp-verify': return 'Enter OTP';
      case 'forgot': return 'Forgot Password?';
      case 'reset': return 'Reset Password';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login': return 'Login with your mobile number and password.';
      case 'otp-send': return `Enter your mobile number and we'll send a one-time password.`;
      case 'otp-verify': return `Enter the 4-digit OTP sent to ${otpMobile}.`;
      case 'forgot': return 'Enter your registered mobile to receive a 4-digit OTP.';
      case 'reset': return 'Enter the 4-digit OTP and your new password.';
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
              {['login', 'otp-send', 'otp-verify'].includes(mode) ? 'Sign In' : 'Security'}
            </Text>
            <Text className="mt-3 text-3xl font-black text-primary-900">{getTitle()}</Text>
            <Text className="mt-4 text-sm leading-7 text-primary-900/70">{getSubtitle()}</Text>

            {/* ==================== PASSWORD LOGIN ==================== */}
            {mode === 'login' && (
              <View className="mt-6">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Mobile Number</Text>
                  <TextInput
                    value={mobile}
                    onChangeText={(val) => setMobile(val.replace(/\D/g, '').slice(0, 10))}
                    onFocus={onInputFocus}
                    placeholder="9876543210"
                    keyboardType="number-pad"
                    maxLength={10}
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
                      onPress={() => setShowPassword((c) => !c)}
                      className="absolute right-4 top-1/2 -mt-3 h-6 w-6 items-center justify-center"
                      hitSlop={8}
                    >
                      <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#527164" />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  disabled={loading}
                  onPress={handlePasswordLogin}
                  className="mt-6 rounded-full bg-primary-900 px-5 py-4 active:scale-[0.97] active:opacity-90 justify-center h-[52px]"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                      Login
                    </Text>
                  )}
                </Pressable>

                {/* Divider */}
                <View className="my-5 flex-row items-center gap-3">
                  <View className="flex-1 h-px bg-primary-100" />
                  <Text className="text-[11px] font-black uppercase tracking-[1px] text-primary-900/30">or</Text>
                  <View className="flex-1 h-px bg-primary-100" />
                </View>

                {/* OTP Login Toggle */}
                <Pressable
                  onPress={() => { setOtpMobile(''); setLoginOtp(''); setModeState('otp-send'); }}
                  className="rounded-full border-2 border-primary-200 px-5 py-4 active:scale-[0.97] active:opacity-90"
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <Feather name="smartphone" size={14} color="#2D6A4F" />
                    <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-800">
                      Login with OTP
                    </Text>
                  </View>
                </Pressable>

                <Pressable onPress={() => router.push('/(auth)/signup')} className="mt-6 py-2">
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
                    Create Account
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ==================== OTP SEND ==================== */}
            {mode === 'otp-send' && (
              <View className="mt-6">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Mobile Number</Text>
                  <TextInput
                    value={otpMobile}
                    onChangeText={(val) => setOtpMobile(val.replace(/\D/g, '').slice(0, 10))}
                    onFocus={onInputFocus}
                    placeholder="9876543210"
                    keyboardType="number-pad"
                    maxLength={10}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                <Pressable
                  disabled={isSendingLoginOtp}
                  onPress={handleSendLoginOtp}
                  className="mt-6 rounded-full bg-primary-900 px-5 py-4 active:scale-[0.97] active:opacity-90 justify-center h-[52px]"
                >
                  {isSendingLoginOtp ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                      Send OTP
                    </Text>
                  )}
                </Pressable>

                <Pressable onPress={() => setModeState('login')} className="mt-6 py-2">
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">Back to Password Login</Text>
                </Pressable>
              </View>
            )}

            {/* ==================== OTP VERIFY ==================== */}
            {mode === 'otp-verify' && (
              <View className="mt-6">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">4-Digit OTP</Text>
                  <TextInput
                    value={loginOtp}
                    onChangeText={(val) => setLoginOtp(val.replace(/\D/g, '').slice(0, 4))}
                    onFocus={onInputFocus}
                    placeholder="0000"
                    keyboardType="number-pad"
                    maxLength={4}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-center text-2xl font-black tracking-[10px] text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                <Pressable
                  disabled={loading}
                  onPress={handleOtpLogin}
                  className="mt-6 rounded-full bg-primary-900 px-5 py-4 active:scale-[0.97] active:opacity-90 justify-center h-[52px]"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                      Verify & Login
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => { setLoginOtp(''); void handleSendLoginOtp(); }}
                  className="mt-4 py-2"
                >
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">Resend OTP</Text>
                </Pressable>

                <Pressable onPress={() => setModeState('otp-send')} className="mt-2 py-2">
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-900/40">Change Number</Text>
                </Pressable>
              </View>
            )}

            {/* ==================== FORGOT MODE ==================== */}
            {mode === 'forgot' && (
              <View className="mt-6">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Registered Mobile</Text>
                  <TextInput
                    value={forgotMobile}
                    onChangeText={(val) => setForgotMobile(val.replace(/\D/g, '').slice(0, 10))}
                    onFocus={onInputFocus}
                    placeholder="9876543210"
                    keyboardType="number-pad"
                    maxLength={10}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                <Pressable
                  disabled={isSendingOtp}
                  onPress={handleSendForgotOtp}
                  className="mt-6 rounded-full bg-primary-900 px-5 py-4 active:scale-[0.97] active:opacity-90 justify-center h-[52px]"
                >
                  {isSendingOtp ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                      Send OTP
                    </Text>
                  )}
                </Pressable>

                <Pressable onPress={() => setModeState('login')} className="mt-6 py-2">
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">Back to Login</Text>
                </Pressable>
              </View>
            )}

            {/* ==================== RESET MODE ==================== */}
            {mode === 'reset' && (
              <View className="mt-6">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">4-Digit OTP</Text>
                  <TextInput
                    value={forgotOtp}
                    onChangeText={(val) => setForgotOtp(val.replace(/\D/g, '').slice(0, 4))}
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
                      secureTextEntry={!showNewPassword}
                      placeholder="Min 6 characters"
                      className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 pr-12 text-base text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                    <Pressable
                      onPress={() => setShowNewPassword((c) => !c)}
                      className="absolute right-4 top-1/2 -mt-3 h-6 w-6 items-center justify-center"
                      hitSlop={8}
                    >
                      <Feather name={showNewPassword ? 'eye-off' : 'eye'} size={18} color="#527164" />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  disabled={loading}
                  onPress={handleResetSubmit}
                  className="mt-6 rounded-full bg-primary-900 px-5 py-4 active:scale-[0.97] active:opacity-90 justify-center h-[52px]"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                      Reset Password
                    </Text>
                  )}
                </Pressable>

                <Pressable onPress={() => setModeState('forgot')} className="mt-6 py-2">
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">Resend OTP</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
