import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';

export default function OrderSuccessScreen() {
  return (
    <Screen withServiceBar={false}>
      <View className="mt-16 rounded-[32px] bg-white p-8">
        <View className="mx-auto h-24 w-24 items-center justify-center rounded-full bg-emerald-500">
          <Text className="text-5xl font-black text-white">✓</Text>
        </View>
        <Text className="mt-5 text-[11px] font-black uppercase tracking-[2px] text-emerald-600">Order Confirmed</Text>
        <Text className="mt-3 text-3xl font-black text-primary-900">Order Placed Successfully.</Text>
        <Text className="mt-4 text-sm leading-7 text-primary-900/70">
          Your order is confirmed and being processed.
        </Text>
        <Pressable onPress={() => router.replace('/(tabs)')} className="mt-6 rounded-full bg-primary-500 px-5 py-4">
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Go to Home</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
