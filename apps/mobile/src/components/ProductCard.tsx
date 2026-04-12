import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../store/useCartStore';
import type { Product } from '../types/storefront';
import { currencyFormatter, getDefaultVariant, getDiscountPercent, getPrimaryImage } from '../utils/format';

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

export const ProductCard = memo(function ProductCard({ product, compact = false }: ProductCardProps) {
  const { t } = useTranslation();
  const addItem = useCartStore((state) => state.addItem);
  const increaseQty = useCartStore((state) => state.increaseQty);
  const decreaseQty = useCartStore((state) => state.decreaseQty);
  const variant = getDefaultVariant(product);
  const quantityInCart = useCartStore(
    (state) => state.items.find((item) => item.variantId === variant?.id)?.qty || 0,
  );
  const discount = getDiscountPercent(variant?.price, variant?.mrp);

  if (!variant) return null;

  const maxStock = Math.max(variant.stock || 0, 0);
  const isOutOfStock = maxStock === 0;
  const canIncrease = maxStock > quantityInCart;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })}
      className={
        compact
          ? 'mb-3 flex-1 overflow-hidden rounded-[22px] border border-primary-100 bg-white'
          : 'mb-4 flex-1 overflow-hidden rounded-[26px] border border-primary-100 bg-white'
      }
    >
      <View className="relative">
        <Image
          source={{ uri: getPrimaryImage(product) }}
          style={{ width: '100%', height: compact ? 118 : 150 }}
          contentFit="cover"
        />
        {discount ? (
          <View className="absolute left-3 top-3 rounded-full bg-rose-500 px-2.5 py-1">
            <Text className="text-[10px] font-black uppercase tracking-[1px] text-white">{discount}% Off</Text>
          </View>
        ) : null}
      </View>
      <View className={compact ? 'p-3' : 'p-4'}>
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-400">
          {product.category?.name || 'Crop Care'}
        </Text>
        <Text
          numberOfLines={2}
          className={`mt-2 font-black leading-5 text-primary-900 ${compact ? 'min-h-[34px] text-[13px]' : 'min-h-[42px] text-sm'}`}
        >
          {product.name}
        </Text>
        <View className="mt-3 flex-row items-center gap-2">
          <Text className={`${compact ? 'text-base' : 'text-lg'} font-black text-primary-900`}>
            {currencyFormatter.format(variant.price)}
          </Text>
          {variant.mrp > variant.price ? (
            <Text className="text-xs font-semibold text-primary-900/40 line-through">
              {currencyFormatter.format(variant.mrp)}
            </Text>
          ) : null}
        </View>

        {quantityInCart > 0 ? (
          <View className={`mt-4 flex-row items-center justify-between rounded-full bg-primary-50 px-2 ${compact ? 'py-1' : 'py-1.5'}`}>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                decreaseQty(variant.id);
              }}
              className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} items-center justify-center rounded-full bg-white`}
            >
              <Feather name="minus" size={16} color="#082018" />
            </Pressable>
            <Text className={`${compact ? 'text-xs' : 'text-sm'} font-black text-primary-900`}>{quantityInCart}</Text>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                if (canIncrease) {
                  increaseQty(variant.id);
                }
              }}
              disabled={!canIncrease}
              className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} items-center justify-center rounded-full ${canIncrease ? 'bg-primary-500' : 'bg-primary-100'}`}
            >
              <Feather name="plus" size={16} color={canIncrease ? '#FFFFFF' : '#6D8A7D'} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              if (!isOutOfStock) {
                addItem(product, variant);
              }
            }}
            disabled={isOutOfStock}
            className={`mt-4 rounded-full px-4 ${compact ? 'py-2.5' : 'py-3'} ${isOutOfStock ? 'bg-primary-100' : 'bg-primary-500'}`}
          >
            <Text className={`text-center font-black uppercase ${compact ? 'text-[10px] tracking-[1.5px]' : 'text-xs tracking-[2px]'} ${isOutOfStock ? 'text-primary-900/45' : 'text-white'}`}>
              {isOutOfStock ? t('mobile.actions.outOfStock') : t('mobile.actions.addToCart')}
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});
