import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';

export default function OrderSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen withServiceBar={false}>
      <View className="mt-16 rounded-[32px] bg-white p-8">
        <View className="mx-auto h-20 w-20 items-center justify-center rounded-full bg-primary-500">
          <Text className="text-4xl font-black text-white">✓</Text>
        </View>
        <Text className="mt-5 text-[11px] font-black uppercase tracking-[2px] text-primary-400">Order Success</Text>
        <Text className="mt-3 text-3xl font-black text-primary-900">Your order has been placed.</Text>
        <Text className="mt-4 text-sm leading-7 text-primary-900/70">
          Order reference: {id}. We&apos;ll keep you posted as your order moves from placed to delivered.
        </Text>
        <Pressable onPress={() => router.replace('/(tabs)/account')} className="mt-6 rounded-full bg-primary-500 px-5 py-4">
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">My Order</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)')} className="mt-3 rounded-full border border-primary-100 bg-white px-5 py-4">
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-900">Back to Home</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
