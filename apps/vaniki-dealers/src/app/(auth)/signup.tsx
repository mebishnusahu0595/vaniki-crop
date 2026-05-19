import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { adminApi } from '../../utils/api';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const Icon = Feather as any;

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export default function SignupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [sgstNumber, setSgstNumber] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = async () => {
    // Validations
    if (!name || !mobile || !storeName || !storeLocation || !gstNumber || !sgstNumber || !password) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    const gstUpper = gstNumber.toUpperCase().trim();
    const sgstUpper = sgstNumber.toUpperCase().trim();

    if (!GSTIN_PATTERN.test(gstUpper)) {
      setError('Enter a valid GSTIN (example: 27ABCDE1234F1Z5).');
      return;
    }

    if (!GSTIN_PATTERN.test(sgstUpper)) {
      setError('Enter a valid SGSTIN (example: 27ABCDE1234F1Z5).');
      return;
    }

    if (gstUpper.slice(0, 2) !== sgstUpper.slice(0, 2)) {
      setError('SGST state code prefix must match GST state code prefix.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = new FormData();
      payload.append('name', name.trim());
      payload.append('mobile', mobile.trim());
      if (email.trim()) {
        payload.append('email', email.trim().toLowerCase());
      }
      payload.append('storeName', storeName.trim());
      payload.append('storeLocation', storeLocation.trim());
      payload.append('longitude', '78.9629'); // Default Indian coordinates
      payload.append('latitude', '20.5937');
      payload.append('gstNumber', gstUpper);
      payload.append('sgstNumber', sgstUpper);
      payload.append('password', password);

      // Multi-part photo payload using external URI mapping (avoids native plugin requirements)
      const mockPhoto = {
        uri: 'https://vanikicrop.com/assets/images/logo.png',
        type: 'image/png',
        name: 'dealer-photo.png',
      };
      payload.append('profileImage', mockPhoto as any);

      await adminApi.dealerSignup(payload);
      setSuccessMsg('Registration request submitted! Please wait for Super Admin approval before logging in.');
    } catch (err: any) {
      setError(err.message || 'Failed to submit dealer registration request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="rounded-full bg-emerald-50 p-2 text-emerald-800"
            >
              <Icon name="arrow-left" size={20} color="#065f46" />
            </TouchableOpacity>
            <Text className="text-lg font-black text-[#1b4d3a] tracking-wider uppercase">Dealer Register</Text>
            <View className="w-9" />
          </View>

          {/* Intro Card */}
          <View className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-50 mb-6">
            <Text className="text-xl font-black text-slate-900">Store Onboarding</Text>
            <Text className="text-xs font-semibold text-slate-400 mt-1">
              Submit your request to join the dealer network.
            </Text>
          </View>

          {/* Feedback Messages */}
          {error ? (
            <View className="bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-5">
              <Text className="text-rose-700 font-semibold text-sm">{error}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl mb-5">
              <Text className="text-emerald-800 font-black text-sm">{successMsg}</Text>
              <TouchableOpacity
                onPress={() => router.replace('/(auth)/login')}
                className="mt-4 bg-[#1b4d3a] rounded-xl py-3 items-center"
              >
                <Text className="text-white font-black text-xs uppercase tracking-wider">Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Form */}
          {!successMsg && (
            <View className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-50 space-y-4">
              {/* Dealer Name */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Dealer Name *</Text>
                <TextInput
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold"
                  placeholder="Enter your full name"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Mobile Number */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Mobile Number *</Text>
                <TextInput
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold"
                  placeholder="Enter 10-digit mobile"
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="numeric"
                />
              </View>

              {/* Email */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Email Address</Text>
                <TextInput
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold"
                  placeholder="Enter email (optional)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Store Name */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Store Name *</Text>
                <TextInput
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold"
                  placeholder="Enter store designation"
                  value={storeName}
                  onChangeText={setStoreName}
                />
              </View>

              {/* Store Location */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Store Address *</Text>
                <TextInput
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold"
                  placeholder="Enter detailed store address"
                  value={storeLocation}
                  onChangeText={setStoreLocation}
                />
              </View>

              {/* GST Number */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">GST Number *</Text>
                <TextInput
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold uppercase"
                  placeholder="27ABCDE1234F1Z5"
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  autoCapitalize="characters"
                />
              </View>

              {/* SGST Number */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">SGST Number *</Text>
                <TextInput
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold uppercase"
                  placeholder="27ABCDE1234F1Z5"
                  value={sgstNumber}
                  onChangeText={setSgstNumber}
                  autoCapitalize="characters"
                />
              </View>

              {/* Password */}
              <View>
                <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Secure Password *</Text>
                <TextInput
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSignup}
                disabled={loading}
                className="w-full bg-[#1b4d3a] rounded-2xl py-4 items-center mt-4 shadow-sm"
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-black text-base uppercase tracking-wider">Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Switch Back to Login */}
          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-sm text-slate-500 font-semibold">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text className="text-sm text-[#1b4d3a] font-black">Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
