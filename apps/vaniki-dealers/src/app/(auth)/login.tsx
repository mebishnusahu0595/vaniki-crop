import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';
import { adminApi } from '../../utils/api';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
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
      // Connects to the real backend server via API_BASE_URL (https://vanikicrop.com/api)
      const data = await adminApi.login({ mobile: email, password });
      
      setSession(data.user, data.accessToken);
      router.replace('/(drawer)/');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-offwhite justify-center px-6"
    >
      <View className="bg-white p-8 rounded-2xl shadow-soft space-y-6">
        <View className="items-center mb-6">
          <Text className="text-3xl font-bold text-gray-900">Dealer Portal</Text>
          <Text className="text-gray-500 mt-2">Sign in to manage your operations</Text>
        </View>

        {error ? (
          <View className="bg-red-50 p-3 rounded-lg mb-4">
            <Text className="text-red-600 text-sm">{error}</Text>
          </View>
        ) : null}

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
            <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
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
      </View>
    </KeyboardAvoidingView>
  );
}
