import { memo } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCompareStore } from '../store/useCompareStore';
import { storefrontApi } from '../lib/api';
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
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const comparedProducts = useCompareStore((state) => state.products);
  const toggleCompareProduct = useCompareStore((state) => state.toggleProduct);
  const variant = getDefaultVariant(product);
  const quantityInCart = useCartStore(
    (state) => state.items.find((item) => item.variantId === variant?.id)?.qty || 0,
  );
  const discount = getDiscountPercent(variant?.price, variant?.mrp);
  const wishlistIds = (user?.wishlist || []).map((entry) => (typeof entry === 'string' ? entry : entry.id));
  const isWishlisted = wishlistIds.includes(product.id);
  const isCompared = comparedProducts.some((entry) => entry.id === product.id);

  if (!variant) return null;

  const maxStock = Math.max(variant.stock || 0, 0);
  const isOutOfStock = maxStock === 0;
  const canIncrease = maxStock > quantityInCart;

  const handleToggleWishlist = async () => {
    if (!user) {
      Alert.alert('Login required', 'Please login to save wishlist products.');
      router.push('/(auth)/login');
      return;
    }

    try {
      const updatedUser = await storefrontApi.toggleWishlist(product.id);
      setUser(updatedUser);
    } catch (caughtError) {
      Alert.alert('Wishlist update failed', caughtError instanceof Error ? caughtError.message : 'Please try again.');
    }
  };

  const handleToggleCompare = () => {
    const result = toggleCompareProduct(product);
    if (result.message.includes('up to 3')) {
      Alert.alert('Compare limit', result.message);
    }
  };

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
        {isOutOfStock ? (
          <View className="absolute inset-0 z-30 items-center justify-center bg-white/60">
            <View className="rounded-full bg-rose-600 px-3 py-1 shadow-lg">
              <Text className="text-[10px] font-black uppercase tracking-[1px] text-white">
                {t('mobile.actions.outOfStock')}
              </Text>
            </View>
          </View>
        ) : null}

        {!isOutOfStock && maxStock < 10 ? (
          <View className="absolute bottom-2 left-3 z-20 rounded-full bg-amber-500 px-2 py-0.5">
            <Text className="text-[8px] font-black uppercase text-white">
              Only {maxStock} left
            </Text>
          </View>
        ) : null}

        <View className="absolute right-3 top-3 z-20 flex-row gap-2">
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              void handleToggleWishlist();
            }}
            className={`h-8 w-8 items-center justify-center rounded-full border ${
              isWishlisted ? 'border-rose-200 bg-rose-50' : 'border-white/85 bg-white/90'
            }`}
          >
            <Feather name="heart" size={14} color={isWishlisted ? '#E11D48' : '#082018'} />
          </Pressable>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              handleToggleCompare();
            }}
            className={`h-8 w-8 items-center justify-center rounded-full border ${
              isCompared ? 'border-primary-500 bg-primary-500' : 'border-white/85 bg-white/90'
            }`}
          >
            <Feather name="sliders" size={14} color={isCompared ? '#FFFFFF' : '#082018'} />
          </Pressable>
        </View>
        {discount ? (
          <View className="absolute left-3 top-3 z-20 rounded-full bg-rose-500 px-2.5 py-1">
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
