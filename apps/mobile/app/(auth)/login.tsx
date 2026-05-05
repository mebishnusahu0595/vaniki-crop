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
import { auth } from '../../src/config/firebase';
import type { AuthUser } from '../../src/types/storefront';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

export default function LoginScreen() {
  const [mode, setModeState] = useState<'login' | 'forgot' | 'reset'>('login');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP Login state
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [confirmationResult, setConfirmationResult] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Forgot Password (Firebase OTP) state
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotConfirmation, setForgotConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  // --- OTP Login Handlers ---

  const handleSendLoginOtp = async () => {
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      Alert.alert('Invalid', 'Enter a valid 10-digit mobile number.');
      return;
    }
    setIsSendingOtp(true);
    try {
      const result = await auth().signInWithPhoneNumber(`+91${mobile}`);
      setConfirmationResult(result);
      Alert.alert('OTP Sent', 'A 6-digit OTP has been sent to your mobile.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyLoginOtp = async () => {
    if (!confirmationResult) {
      Alert.alert('Error', 'Please send OTP first.');
      return;
    }
    if (otpCode.length !== 6) {
      Alert.alert('Invalid', 'Enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await confirmationResult.confirm(otpCode);
      if (!userCredential?.user) throw new Error('Verification failed.');
      const idToken = await userCredential.user.getIdToken();
      const response = await storefrontApi.firebaseLogin(idToken);
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
    } catch (error) {
      Alert.alert('Login Failed', error instanceof Error ? error.message : 'Invalid OTP or session expired.');
    } finally {
      setLoading(false);
    }
  };

  // --- Forgot Password Handlers (Firebase OTP) ---

  const handleSendForgotOtp = async () => {
    if (!forgotMobile || !/^[6-9]\d{9}$/.test(forgotMobile)) {
      Alert.alert('Invalid', 'Enter a valid 10-digit registered mobile number.');
      return;
    }
    setIsSendingOtp(true);
    try {
      const result = await auth().signInWithPhoneNumber(`+91${forgotMobile}`);
      setForgotConfirmation(result);
      setModeState('reset');
      Alert.alert('OTP Sent', 'Enter the 6-digit OTP to verify your identity.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResetSubmit = async () => {
    if (!forgotOtp || forgotOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Enter the 6-digit OTP.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }
    if (!forgotConfirmation) {
      Alert.alert('Error', 'Session expired. Please request OTP again.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await forgotConfirmation.confirm(forgotOtp);
      if (!userCredential?.user) throw new Error('Verification failed.');
      const idToken = await userCredential.user.getIdToken();
      await storefrontApi.firebaseResetPassword({ idToken, newPassword });
      Alert.alert('Success', 'Password reset successfully. Please login.');
      setModeState('login');
      setForgotConfirmation(null);
      setForgotOtp('');
      setNewPassword('');
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
                ? loginMethod === 'password'
                  ? 'Login with your mobile number and password.'
                  : confirmationResult
                    ? 'Enter the 6-digit OTP sent to your mobile.'
                    : 'Enter your mobile number to receive an OTP.'
                : mode === 'forgot'
                  ? 'Enter your registered mobile to receive a 6-digit OTP.'
                  : 'Enter the OTP and your new password.'}
            </Text>

            {/* ==================== LOGIN MODE ==================== */}
            {mode === 'login' && (
              <View className="mt-6">
                {/* Mobile Number Input */}
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Mobile Number</Text>
                  <TextInput
                    value={mobile}
                    onChangeText={(val) => setMobile(val.replace(/\D/g, '').slice(0, 10))}
                    onFocus={onInputFocus}
                    placeholder="9876543210"
                    keyboardType="number-pad"
                    maxLength={10}
                    editable={!confirmationResult}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>

                {/* Password Input (password mode) */}
                {loginMethod === 'password' && (
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
                )}

                {/* OTP Input (otp mode, after OTP sent) */}
                {loginMethod === 'otp' && confirmationResult && (
                  <View className="mt-5">
                    <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">6-Digit OTP</Text>
                    <TextInput
                      value={otpCode}
                      onChangeText={(val) => setOtpCode(val.replace(/\D/g, '').slice(0, 6))}
                      onFocus={onInputFocus}
                      placeholder="000000"
                      keyboardType="number-pad"
                      maxLength={6}
                      className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-center text-2xl font-black tracking-[10px] text-primary-900"
                      placeholderTextColor="#7a978b"
                    />
                  </View>
                )}

                {/* Send OTP Button (otp mode, before OTP sent) */}
                {loginMethod === 'otp' && !confirmationResult && (
                  <Pressable
                    disabled={isSendingOtp}
                    onPress={handleSendLoginOtp}
                    className="mt-6 rounded-full bg-primary-500 px-5 py-4"
                  >
                    <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                      {isSendingOtp ? 'Sending OTP...' : 'Send OTP'}
                    </Text>
                  </Pressable>
                )}

                {/* Login / Verify OTP Button */}
                {(loginMethod === 'password' || (loginMethod === 'otp' && confirmationResult)) && (
                  <Pressable
                    disabled={loading}
                    onPress={async () => {
                      if (loginMethod === 'otp') {
                        handleVerifyLoginOtp();
                      } else {
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
                      }
                    }}
                    className="mt-6 rounded-full bg-primary-900 px-5 py-4"
                  >
                    <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                      {loading
                        ? 'Signing In...'
                        : loginMethod === 'otp'
                          ? 'Verify & Login'
                          : 'Login'}
                    </Text>
                  </Pressable>
                )}

                {/* Toggle Login Method */}
                <Pressable
                  onPress={() => {
                    setLoginMethod((prev) => (prev === 'password' ? 'otp' : 'password'));
                    setConfirmationResult(null);
                    setOtpCode('');
                  }}
                  className="mt-4 py-2"
                >
                  <Text className="text-center text-[11px] font-black uppercase tracking-[2px] text-primary-500">
                    {loginMethod === 'password' ? 'Login with OTP Instead' : 'Login with Password Instead'}
                  </Text>
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
                  className="mt-6 rounded-full bg-primary-900 px-5 py-4"
                >
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                    {isSendingOtp ? 'Sending OTP...' : 'Send OTP'}
                  </Text>
                </Pressable>

                <Pressable onPress={() => setModeState('login')} className="mt-6 py-2">
                  <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
                    Back to Login
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ==================== RESET MODE ==================== */}
            {mode === 'reset' && (
              <View className="mt-6">
                <View>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">6-Digit OTP</Text>
                  <TextInput
                    value={forgotOtp}
                    onChangeText={(val) => setForgotOtp(val.replace(/\D/g, '').slice(0, 6))}
                    onFocus={onInputFocus}
                    placeholder="000000"
                    keyboardType="number-pad"
                    maxLength={6}
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
                      onPress={() => setShowNewPassword((current) => !current)}
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
            {mode === 'login' && (
              <Pressable onPress={() => router.push('/delivery/login' as never)} className="mt-2 py-2">
                <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-900">
                  Delivery Staff Login
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
