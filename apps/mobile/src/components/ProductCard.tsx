import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCartStore } from '../store/useCartStore';
import type { Product } from '../types/storefront';
import { currencyFormatter, getDefaultVariant, getDiscountPercent, getPrimaryImage } from '../utils/format';

interface ProductCardProps {
  product: Product;
}

export const ProductCard = memo(function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const variant = getDefaultVariant(product);
  const discount = getDiscountPercent(variant?.price, variant?.mrp);

  if (!variant) return null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })}
      className="mb-4 flex-1 overflow-hidden rounded-[26px] border border-primary-100 bg-white"
    >
      <View className="relative">
        <Image source={{ uri: getPrimaryImage(product) }} style={{ width: '100%', height: 150 }} contentFit="cover" />
        {discount ? (
          <View className="absolute left-3 top-3 rounded-full bg-rose-500 px-2.5 py-1">
            <Text className="text-[10px] font-black uppercase tracking-[1px] text-white">{discount}% Off</Text>
          </View>
        ) : null}
      </View>
      <View className="p-4">
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-400">
          {product.category?.name || 'Crop Care'}
        </Text>
        <Text numberOfLines={2} className="mt-2 min-h-[42px] text-sm font-black leading-5 text-primary-900">
          {product.name}
        </Text>
        <View className="mt-3 flex-row items-center gap-2">
          <Text className="text-lg font-black text-primary-900">{currencyFormatter.format(variant.price)}</Text>
          {variant.mrp > variant.price ? (
            <Text className="text-xs font-semibold text-primary-900/40 line-through">
              {currencyFormatter.format(variant.mrp)}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => addItem(product, variant)}
          className="mt-4 rounded-full bg-primary-500 px-4 py-3"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Add to Cart</Text>
        </Pressable>
      </View>
    </Pressable>
  );
});
