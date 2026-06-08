import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../src/components/Screen';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { staffApi } from '../src/lib/staffApi';
import { useStaffAuthStore } from '../src/store/useStaffAuthStore';

export default function DeliveryLoginScreen() {
  const isStaffApp = Constants.expoConfig?.extra?.appVariant === 'staff';
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  
  // Login State
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot Password State
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const hydrated = useStaffAuthStore((state) => state.hydrated);
  const token = useStaffAuthStore((state) => state.token);
  const setSession = useStaffAuthStore((state) => state.setSession);
  const minContentHeight = Math.max(0, height - insets.top - insets.bottom - 72);

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (token) {
    return <Redirect href="/" />;
  }

  const handleLogin = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile) || password.length < 6) {
      Alert.alert('Missing details', 'Enter staff mobile number and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await staffApi.login({ mobile, password });
      setSession({ staff: response.staff, token: response.accessToken });
      router.replace('/' as never);
    } catch (error) {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendForgotOtp = async () => {
    if (!forgotMobile || !/^[6-9]\d{9}$/.test(forgotMobile)) {
      Alert.alert('Invalid', 'Enter a valid 10-digit registered mobile number.');
      return;
    }
    setIsSendingOtp(true);
    try {
      const res = await staffApi.forgotPassword({ mobile: forgotMobile });
      if (res.verificationId) {
        setVerificationId(res.verificationId);
      }
      setMode('reset');
      Alert.alert('OTP Sent', 'Enter the 4-digit OTP to verify your identity.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send OTP');
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
      await staffApi.resetPassword({ mobile: forgotMobile, otp: forgotOtp, newPassword, verificationId });
      Alert.alert('Success', 'Password reset successfully. Please login.');
      setMode('login');
      setForgotOtp('');
      setNewPassword('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View className="justify-center py-8" style={{ minHeight: minContentHeight }}>
        <View className="rounded-[32px] bg-white p-8">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary-500">
            <Feather name="truck" size={24} color="#ffffff" />
          </View>
          <Text className="mt-5 text-[11px] font-black uppercase tracking-[2px] text-primary-500">Dealers Staff</Text>
          <Text className="mt-3 text-3xl font-black text-primary-900">
            {mode === 'login' ? 'Vaniki dealers staff app.' : mode === 'forgot' ? 'Forgot Password?' : 'Reset Password'}
          </Text>
          <Text className="mt-3 text-sm leading-6 text-primary-900/65">
            {mode === 'login' 
              ? 'Login to view active store pickup orders and verify customer OTP.' 
              : mode === 'forgot'
                ? 'Enter your registered mobile number to receive a 4-digit OTP.'
                : 'Enter the 4-digit OTP sent to your phone and choose a new password.'}
          </Text>

          {/* ==================== LOGIN MODE ==================== */}
          {mode === 'login' && (
            <View>
              <View className="mt-7">
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Mobile Number</Text>
                <TextInput
                  value={mobile}
                  onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  keyboardType="number-pad"
                  maxLength={10}
                  className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                  placeholderTextColor="#7a978b"
                />
              </View>

              <View className="mt-5">
                <View className="flex-row justify-between items-center mb-2 px-1">
                  <Text className="text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Password</Text>
                  <Pressable onPress={() => setMode('forgot')}>
                    <Text className="text-[11px] font-black uppercase tracking-[1px] text-primary-500">Forgot?</Text>
                  </Pressable>
                </View>
                <View className="relative">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
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
                onPress={handleLogin}
                className="mt-7 rounded-full bg-primary-900 px-5 py-4 disabled:opacity-60"
              >
                <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                  {loading ? 'Signing In...' : 'Login'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ==================== FORGOT MODE ==================== */}
          {mode === 'forgot' && (
            <View>
              <View className="mt-7">
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Registered Mobile</Text>
                <TextInput
                  value={forgotMobile}
                  onChangeText={(value) => setForgotMobile(value.replace(/\D/g, '').slice(0, 10))}
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
                className="mt-7 rounded-full bg-primary-900 px-5 py-4 disabled:opacity-60"
              >
                <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                  {isSendingOtp ? 'Sending OTP...' : 'Send OTP'}
                </Text>
              </Pressable>

              <Pressable onPress={() => setMode('login')} className="mt-6 py-2">
                <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">Back to Login</Text>
              </Pressable>
            </View>
          )}

          {/* ==================== RESET MODE ==================== */}
          {mode === 'reset' && (
            <View>
              <View className="mt-7">
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">4-Digit OTP</Text>
                <TextInput
                  value={forgotOtp}
                  onChangeText={(value) => setForgotOtp(value.replace(/\D/g, '').slice(0, 4))}
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
                className="mt-7 rounded-full bg-primary-900 px-5 py-4 disabled:opacity-60"
              >
                <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Text>
              </Pressable>

              <Pressable onPress={() => handleSendForgotOtp()} className="mt-6 py-2">
                <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">Resend OTP</Text>
              </Pressable>
            </View>
          )}

        </View>
      </View>
    </Screen>
  );
}
