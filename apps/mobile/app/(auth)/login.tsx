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
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
            <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-400">Mobile Login</Text>
            <Text className="mt-3 text-3xl font-black text-primary-900">Welcome back to Vaniki Crop.</Text>
            <Text className="mt-4 text-sm leading-7 text-primary-900/70">Login with your mobile number and password.</Text>

            <View className="mt-6">
              <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Mobile Number</Text>
              <TextInput
                value={mobile}
                onChangeText={setMobile}
                onFocus={onInputFocus}
                placeholder="Mobile Number"
                keyboardType="number-pad"
                className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                placeholderTextColor="#7a978b"
              />
            </View>

            <View className="mt-5 gap-3">
              <View>
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Password</Text>
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
                className="rounded-full bg-primary-900 px-5 py-4"
              >
                <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                  {loading ? 'Signing In...' : 'Login'}
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={() => router.push('/(auth)/signup')} className="mt-6 py-2">
              <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
                Create Account
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
