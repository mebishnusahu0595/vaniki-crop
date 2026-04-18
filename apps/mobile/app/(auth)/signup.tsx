import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useServiceModeStore } from '../../src/store/useServiceModeStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { useFocusAwareScroll } from '../../src/hooks/useFocusAwareScroll';

export default function SignupScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);
  const setStore = useStoreStore((state) => state.setStore);
  const params = useLocalSearchParams<{ ref?: string }>();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    referralCode: typeof params.ref === 'string' ? params.ref : '',
  });
  const { scrollRef, onInputFocus } = useFocusAwareScroll(110);

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
            <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-400">Create Account</Text>
            <Text className="mt-3 text-3xl font-black text-primary-900">Start shopping with Vaniki Crop.</Text>
            <View className="mt-6 gap-3">
              {([
                ['name', 'Full Name'],
                ['email', 'Email Address'],
                ['mobile', 'Mobile Number'],
                ['referralCode', 'Referral Code (Optional)'],
              ] as const).map(([key, label]) => (
                <View key={key}>
                  <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">{label}</Text>
                  <TextInput
                    value={form[key]}
                    onChangeText={(value) =>
                      setForm((current) => ({
                        ...current,
                        [key]: key === 'referralCode' ? value.toUpperCase() : value,
                      }))
                    }
                    onFocus={onInputFocus}
                    placeholder={label}
                    keyboardType={key === 'mobile' ? 'number-pad' : 'default'}
                    className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                    placeholderTextColor="#7a978b"
                  />
                </View>
              ))}
              <View>
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">Password</Text>
                <View className="relative">
                  <TextInput
                    value={form.password}
                    onChangeText={(value) => setForm((current) => ({ ...current, password: value }))}
                    onFocus={onInputFocus}
                    placeholder="Password"
                    secureTextEntry={!showPassword}
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
            </View>
            <Pressable
              onPress={async () => {
                setLoading(true);
                try {
                  const response = await storefrontApi.signup({
                    name: form.name,
                    email: form.email,
                    mobile: form.mobile,
                    password: form.password,
                    referralCode: form.referralCode || undefined,
                  });

                  setSession({ user: response.user, token: response.accessToken });
                  const session = await storefrontApi.me();
                  setUser(session);
                  setMode(session.serviceMode);
                  setAddress(session.savedAddress || null);
                  if (session.serviceMode === 'pickup' && session.selectedStore && typeof session.selectedStore !== 'string') {
                    setStore(session.selectedStore);
                  } else {
                    setStore(null);
                  }
                  router.replace('/(tabs)/account');
                } catch (caughtError) {
                  Alert.alert('Signup failed', caughtError instanceof Error ? caughtError.message : 'Try again.');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="mt-6 rounded-full bg-primary-500 px-5 py-4"
            >
              <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                {loading ? 'Creating account...' : 'Create Account'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
