import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { useCompareStore } from '../../src/store/useCompareStore';
import { currencyFormatter, getPrimaryImage } from '../../src/utils/format';

export default function CompareScreen() {
  const comparedProducts = useCompareStore((state) => state.products);
  const toggleProduct = useCompareStore((state) => state.toggleProduct);
  const clearAll = useCompareStore((state) => state.clearAll);

  if (!comparedProducts.length) {
    return (
      <Screen>
        <View className="rounded-[28px] bg-white p-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-50">
            <Feather name="sliders" size={24} color="#2D6A4F" />
          </View>
          <Text className="mt-4 text-2xl font-black text-primary-900">Compare products</Text>
          <Text className="mt-3 text-sm leading-6 text-primary-900/70">
            Add products from listing cards and compare price, stock, and ratings side by side.
          </Text>
          <Pressable
            onPress={() => router.push('/products')}
            className="mt-6 rounded-full bg-primary-500 px-5 py-4"
          >
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Browse Products</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="rounded-[28px] bg-primary-900 p-5">
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-200">Compare</Text>
        <Text className="mt-2 text-2xl font-black text-white">Side by side overview</Text>
        <Text className="mt-2 text-sm leading-6 text-white/75">Compare up to 3 products and pick the best fit.</Text>
        <Pressable onPress={clearAll} className="mt-4 self-start rounded-full border border-white/25 px-4 py-2">
          <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-white">Clear All</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5 -mx-1" contentContainerStyle={{ paddingHorizontal: 4 }}>
        <View className="flex-row gap-3">
          {comparedProducts.map((product) => {
            const firstVariant = product.variants[0];
            const totalStock = product.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);

            return (
              <View key={product.id} className="w-[220px] rounded-[24px] border border-primary-100 bg-white p-4">
                <View className="relative h-[140px] overflow-hidden rounded-[18px] bg-primary-50">
                  <Image source={{ uri: getPrimaryImage(product) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <Pressable
                    onPress={() => toggleProduct(product)}
                    className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white"
                  >
                    <Feather name="x" size={14} color="#082018" />
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })}
                  className="mt-3"
                >
                  <Text numberOfLines={2} className="text-sm font-black leading-5 text-primary-900">
                    {product.name}
                  </Text>
                </Pressable>

                <View className="mt-3 gap-2 rounded-[16px] bg-primary-50 p-3">
                  <CompareField label="Category" value={product.category?.name || '-'} />
                  <CompareField
                    label="Starting Price"
                    value={firstVariant ? currencyFormatter.format(firstVariant.price) : '-'}
                  />
                  <CompareField label="Top Variant" value={firstVariant?.label || '-'} />
                  <CompareField
                    label="Stock"
                    value={totalStock > 0 ? `${totalStock} units` : 'Out of stock'}
                  />
                  <CompareField
                    label="Rating"
                    value={product.averageRating ? `${product.averageRating.toFixed(1)} / 5` : 'No ratings'}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

function CompareField({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-[10px] font-black uppercase tracking-[1.4px] text-primary-500">{label}</Text>
      <Text className="mt-1 text-sm font-semibold text-primary-900/75">{value}</Text>
    </View>
  );
}
