import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { OtpInput } from '../../src/components/OtpInput';
import { storefrontApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function OtpVerifyScreen() {
  const params = useLocalSearchParams<{
    flow: 'login' | 'signup' | 'reset';
    mobile: string;
    name?: string;
    email?: string;
    password?: string;
  }>();
  const setSession = useAuthStore((state) => state.setSession);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (!seconds) return;
    const timer = setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return (
    <Screen withServiceBar={false}>
      <View className="mt-10 rounded-[32px] bg-white p-8">
        <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-400">OTP Verification</Text>
        <Text className="mt-3 text-3xl font-black text-primary-900">Enter the 6-digit code.</Text>
        <Text className="mt-4 text-sm leading-7 text-primary-900/70">
          We sent an OTP to {params.mobile}.
        </Text>
        <View className="mt-6">
          <OtpInput value={otp} onChange={setOtp} />
        </View>

        {params.flow === 'reset' ? (
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New Password"
            secureTextEntry
            className="mt-5 rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
            placeholderTextColor="#7a978b"
          />
        ) : null}

        <Pressable
          onPress={async () => {
            try {
              if (params.flow === 'login') {
                const response = await storefrontApi.loginWithOtp({ mobile: params.mobile, otp });
                setSession({ user: response.user, token: response.accessToken });
                router.replace('/(tabs)');
                return;
              }

              if (params.flow === 'signup') {
                const response = await storefrontApi.signup({
                  name: params.name || '',
                  email: params.email,
                  mobile: params.mobile,
                  password: params.password || '',
                  otp,
                });
                setSession({ user: response.user, token: response.accessToken });
                router.replace('/(tabs)');
                return;
              }

              await storefrontApi.resetPassword({
                mobile: params.mobile,
                otp,
                newPassword,
              });
              router.replace('/(auth)/login');
            } catch (caughtError) {
              Alert.alert('Verification failed', caughtError instanceof Error ? caughtError.message : 'Try again.');
            }
          }}
          className="mt-6 rounded-full bg-primary-500 px-5 py-4"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Verify OTP</Text>
        </Pressable>

        <Pressable
          disabled={seconds > 0}
          onPress={async () => {
            await storefrontApi.sendOtp(params.mobile);
            setSeconds(60);
          }}
          className="mt-4 py-2"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
            {seconds > 0 ? `Resend in ${seconds}s` : 'Resend OTP'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
