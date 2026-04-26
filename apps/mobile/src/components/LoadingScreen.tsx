import { ActivityIndicator, Text, View } from 'react-native';
import { Image } from 'expo-image';

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <View className="mb-6 h-24 w-24 overflow-hidden rounded-3xl bg-primary-50 p-4">
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
        />
      </View>
      <ActivityIndicator size="large" color="#2D6A4F" />
      <Text className="mt-6 text-center text-sm font-black uppercase tracking-[2px] text-primary-900">
        Vaniki Crop
      </Text>
      <Text className="mt-2 text-center text-xs font-semibold text-primary-900/50">
        Loading fresh products for you...
      </Text>
    </View>
  );
}
