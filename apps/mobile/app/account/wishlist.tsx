import { Pressable, Text, View, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ProductCard } from '../../src/components/ProductCard';
import { useAuthStore } from '../../src/store/useAuthStore';
import type { Product } from '../../src/types/storefront';

export default function WishlistScreen() {
  const { user } = useAuthStore();

  if (!user) return null;

  const wishlistProducts = (user.wishlist || []).filter(
    (entry): entry is Product => typeof entry !== 'string',
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Back and Title */}
        <View className="flex-row items-center gap-3 mb-6">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-primary-50 active:scale-90">
            <Feather name="arrow-left" size={18} color="#082018" />
          </Pressable>
          <Text className="text-2xl font-black text-primary-900">My Wishlist</Text>
        </View>

        {wishlistProducts.length ? (
          <View className="gap-2">
            {wishlistProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </View>
        ) : (
          <View className="rounded-[28px] bg-white border border-primary-100 p-8 items-center mt-6">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-rose-50 mb-4">
              <Feather name="heart" size={24} color="#E11D48" />
            </View>
            <Text className="text-lg font-black text-primary-900 text-center">Your wishlist is empty</Text>
            <Text className="mt-2 text-sm text-center text-primary-900/60 leading-6 px-4">
              Tap the heart icon on any product to save it here for quick access later.
            </Text>
            <Pressable
              onPress={() => router.push('/products')}
              className="mt-6 rounded-full bg-primary-500 px-6 py-3.5 active:scale-95 w-full"
            >
              <Text className="text-center text-xs font-black uppercase tracking-[1.5px] text-white">Browse Products</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
