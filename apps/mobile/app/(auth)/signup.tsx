import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function SignupScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
  });

  return (
    <Screen withServiceBar={false}>
      <View className="mt-10 rounded-[32px] bg-white p-8">
        <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-400">Create Account</Text>
        <Text className="mt-3 text-3xl font-black text-primary-900">Start shopping with Vaniki Crop.</Text>
        <View className="mt-6 gap-3">
          {([
            ['name', 'Full Name'],
            ['email', 'Email'],
            ['mobile', 'Mobile Number'],
            ['password', 'Password'],
          ] as const).map(([key, placeholder]) => (
            <TextInput
              key={key}
              value={form[key]}
              onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
              placeholder={placeholder}
              secureTextEntry={key === 'password'}
              keyboardType={key === 'mobile' ? 'number-pad' : 'default'}
              className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
              placeholderTextColor="#7a978b"
            />
          ))}
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
              });

              setSession({ user: response.user, token: response.accessToken });
              router.replace('/(tabs)');
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
    </Screen>
  );
}
