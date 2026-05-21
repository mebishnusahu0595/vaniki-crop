import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';
import { adminApi } from '../../utils/api';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot Password State
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  
  const { setSession } = useAdminAuthStore();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both mobile/email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await adminApi.login({ mobile: email, password });
      setSession(data.user, data.accessToken);
      router.replace('/(drawer)/');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
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
    setError('');
    try {
      await adminApi.forgotPassword({ mobile: forgotMobile });
      setMode('reset');
      Alert.alert('OTP Sent', 'Enter the 4-digit OTP to verify your identity.');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
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
    setError('');
    try {
      await adminApi.resetPassword({ mobile: forgotMobile, otp: forgotOtp, newPassword });
      Alert.alert('Success', 'Password reset successfully. Please login.');
      setMode('login');
      setForgotOtp('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-offwhite justify-center px-6"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
        <View className="bg-white p-8 rounded-2xl shadow-soft space-y-6 my-10">
          <View className="items-center mb-6">
            <Text className="text-3xl font-bold text-gray-900">Dealer Portal</Text>
            <Text className="text-gray-500 mt-2">
              {mode === 'login' ? 'Sign in to manage your operations' : mode === 'forgot' ? 'Reset your portal password' : 'Enter the verification OTP'}
            </Text>
          </View>

          {error ? (
            <View className="bg-red-50 p-3 rounded-lg mb-4">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          ) : null}

          {/* ==================== LOGIN MODE ==================== */}
          {mode === 'login' && (
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1">Email or Mobile</Text>
                <TextInput
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
                  placeholder="Enter your email or mobile"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View>
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-sm font-medium text-gray-700">Password</Text>
                  <TouchableOpacity onPress={() => { setMode('forgot'); setError(''); }}>
                    <Text className="text-xs font-bold text-[#1b4d3a]">Forgot Password?</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-4">
                  <TextInput
                    className="flex-1 py-3 text-gray-900"
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(p => !p)} className="p-1">
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                className="w-full bg-[#1b4d3a] rounded-xl py-3.5 items-center mt-2"
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-black text-base">Sign In</Text>
                )}
              </TouchableOpacity>

              <View className="flex-row justify-center items-center mt-4">
                <Text className="text-sm text-slate-500 font-semibold">New Dealer? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                  <Text className="text-sm text-emerald-800 font-black">Register Here</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ==================== FORGOT MODE ==================== */}
          {mode === 'forgot' && (
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1">Registered Mobile Number</Text>
                <TextInput
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
                  placeholder="9876543210"
                  value={forgotMobile}
                  onChangeText={(val) => setForgotMobile(val.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>

              <TouchableOpacity 
                className="w-full bg-[#1b4d3a] rounded-xl py-3.5 items-center mt-2"
                onPress={handleSendForgotOtp}
                disabled={isSendingOtp}
              >
                {isSendingOtp ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-black text-base">Send OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setMode('login'); setError(''); }} className="align-center py-2">
                <Text className="text-center text-sm font-bold text-slate-500">Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ==================== RESET MODE ==================== */}
          {mode === 'reset' && (
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1">Enter 4-Digit OTP</Text>
                <TextInput
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-center text-lg font-bold tracking-[6px] text-gray-900"
                  placeholder="0000"
                  value={forgotOtp}
                  onChangeText={(val) => setForgotOtp(val.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1">New Password</Text>
                <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-4">
                  <TextInput
                    className="flex-1 py-3 text-gray-900"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(p => !p)} className="p-1">
                    <Icon name={showNewPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                className="w-full bg-[#1b4d3a] rounded-xl py-3.5 items-center mt-2"
                onPress={handleResetSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-black text-base">Reset Password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setMode('forgot'); setError(''); }} className="align-center py-2">
                <Text className="text-center text-sm font-bold text-slate-500">Resend OTP</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
