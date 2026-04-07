import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';

export default function SignupScreen() {
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
            try {
              await storefrontApi.sendOtp(form.mobile);
              router.push({
                pathname: '/(auth)/otp-verify',
                params: { flow: 'signup', ...form },
              });
            } catch (caughtError) {
              Alert.alert('OTP failed', caughtError instanceof Error ? caughtError.message : 'Try again.');
            }
          }}
          className="mt-6 rounded-full bg-primary-500 px-5 py-4"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Continue with OTP</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
