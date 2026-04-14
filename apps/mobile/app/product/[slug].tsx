import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Screen } from '../../src/components/Screen';
import { ProductCard } from '../../src/components/ProductCard';
import { ReviewStars } from '../../src/components/ReviewStars';
import { storefrontApi } from '../../src/lib/api';
import { useCartStore } from '../../src/store/useCartStore';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useCompareStore } from '../../src/store/useCompareStore';
import { currencyFormatter, getDiscountPercent, getPrimaryImage } from '../../src/utils/format';
import { stripHtml } from '../../src/utils/html';

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const addItem = useCartStore((state) => state.addItem);
  const increaseQty = useCartStore((state) => state.increaseQty);
  const decreaseQty = useCartStore((state) => state.decreaseQty);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const comparedProducts = useCompareStore((state) => state.products);
  const toggleCompareProduct = useCompareStore((state) => state.toggleProduct);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const productQuery = useQuery({
    queryKey: ['mobile-product', slug],
    queryFn: () => storefrontApi.productDetail(slug),
    enabled: Boolean(slug),
  });

  const product = productQuery.data;
  const selectedVariant =
    product?.variants.find((variant) => variant.id === selectedVariantId) || product?.variants[0];
  const quantityInCart = useCartStore(
    (state) => state.items.find((item) => item.variantId === selectedVariant?.id)?.qty || 0,
  );
  const relatedQuery = useQuery({
    queryKey: ['mobile-related-products', product?.category?.slug],
    queryFn: () =>
      storefrontApi.products({
        category: product?.category?.slug,
        limit: 6,
      }),
    enabled: Boolean(product?.category?.slug),
  });

  const relatedProducts = useMemo(
    () => (relatedQuery.data?.data || []).filter((item) => item.slug !== product?.slug),
    [product?.slug, relatedQuery.data?.data],
  );
  const galleryImages = useMemo(
    () => (product?.images || []).filter((image) => Boolean(image.url?.trim())),
    [product?.images],
  );

  const maxStock = Math.max(selectedVariant?.stock || 0, 0);
  const canIncrease = maxStock > quantityInCart;
  const isOutOfStock = maxStock === 0;
  const wishlistIds = (user?.wishlist || []).map((entry) => (typeof entry === 'string' ? entry : entry.id));
  const isWishlisted = wishlistIds.includes(product?.id || '');
  const isCompared = comparedProducts.some((entry) => entry.id === product?.id);

  if (!product || !selectedVariant) {
    return (
      <Screen>
        <Text className="text-base font-semibold text-primary-900">Loading product...</Text>
      </Screen>
    );
  }

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
    <Screen>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} className="mb-5">
        {galleryImages.length ? (
          galleryImages.map((image) => (
            <Image
              key={image.url}
              source={{ uri: image.url }}
              style={{ width: 330, height: 280, borderRadius: 28, marginRight: 12 }}
              contentFit="cover"
            />
          ))
        ) : (
          <Image
            source={{ uri: getPrimaryImage(product) }}
            style={{ width: 330, height: 280, borderRadius: 28 }}
            contentFit="cover"
          />
        )}
      </ScrollView>

      <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
        {product.category?.name || 'Crop Care'}
      </Text>
      <Text className="mt-2 text-3xl font-black text-primary-900">{product.name}</Text>
      <Text className="mt-3 text-sm leading-6 text-primary-900/70">{product.shortDescription}</Text>

      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={() => void handleToggleWishlist()}
          className={`flex-1 rounded-full border px-4 py-3 ${
            isWishlisted ? 'border-rose-200 bg-rose-50' : 'border-primary-200 bg-white'
          }`}
        >
          <Text
            className={`text-center text-[10px] font-black uppercase tracking-[1.4px] ${
              isWishlisted ? 'text-rose-600' : 'text-primary-900'
            }`}
          >
            {isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleToggleCompare}
          className={`flex-1 rounded-full border px-4 py-3 ${
            isCompared ? 'border-primary-500 bg-primary-500' : 'border-primary-200 bg-white'
          }`}
        >
          <Text
            className={`text-center text-[10px] font-black uppercase tracking-[1.4px] ${
              isCompared ? 'text-white' : 'text-primary-900'
            }`}
          >
            {isCompared ? 'Compared' : 'Add to Compare'}
          </Text>
        </Pressable>
      </View>

      <View className="mt-5 flex-row items-center gap-3">
        <Text className="text-2xl font-black text-primary-900">{currencyFormatter.format(selectedVariant.price)}</Text>
        {selectedVariant.mrp > selectedVariant.price ? (
          <>
            <Text className="text-sm font-semibold text-primary-900/40 line-through">
              {currencyFormatter.format(selectedVariant.mrp)}
            </Text>
            <Text className="rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black uppercase tracking-[1px] text-white">
              {getDiscountPercent(selectedVariant.price, selectedVariant.mrp)}% off
            </Text>
          </>
        ) : null}
      </View>
      <Text className="mt-2 text-xs font-semibold text-primary-500">Stock: {selectedVariant.stock}</Text>

      <View className="mt-5 flex-row flex-wrap gap-2">
        {product.variants.map((variant) => (
          <Pressable
            key={variant.id}
            onPress={() => setSelectedVariantId(variant.id)}
            className={`rounded-full px-4 py-3 ${selectedVariant.id === variant.id ? 'bg-primary-500' : 'bg-white'}`}
          >
            <Text className={`text-xs font-black uppercase tracking-[1px] ${selectedVariant.id === variant.id ? 'text-white' : 'text-primary-900'}`}>
              {variant.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {quantityInCart > 0 ? (
        <View className="mt-6 flex-row items-center justify-between rounded-full bg-primary-50 px-3 py-2">
          <Pressable onPress={() => decreaseQty(selectedVariant.id)} className="h-10 w-10 items-center justify-center rounded-full bg-white">
            <Feather name="minus" size={16} color="#082018" />
          </Pressable>
          <Text className="text-sm font-black text-primary-900">{quantityInCart}</Text>
          <Pressable
            onPress={() => {
              if (canIncrease) {
                increaseQty(selectedVariant.id);
              }
            }}
            disabled={!canIncrease}
            className={`h-10 w-10 items-center justify-center rounded-full ${canIncrease ? 'bg-primary-500' : 'bg-primary-100'}`}
          >
            <Feather name="plus" size={16} color={canIncrease ? '#FFFFFF' : '#6D8A7D'} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            if (!isOutOfStock) {
              addItem(product, selectedVariant);
            }
          }}
          disabled={isOutOfStock}
          className={`mt-6 rounded-full px-5 py-4 ${isOutOfStock ? 'bg-primary-100' : 'bg-primary-500'}`}
        >
          <Text className={`text-center text-sm font-black uppercase tracking-[2px] ${isOutOfStock ? 'text-primary-900/45' : 'text-white'}`}>
            {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </Text>
        </Pressable>
      )}

      <View className="mt-7 rounded-[28px] bg-white p-5">
        <Text className="text-lg font-black text-primary-900">Description</Text>
        <Text className="mt-3 text-sm leading-7 text-primary-900/70">{stripHtml(product.description)}</Text>
      </View>

      <View className="mt-7 rounded-[28px] bg-white p-5">
        <Text className="text-lg font-black text-primary-900">Reviews</Text>
        <View className="mt-4 gap-4">
          {(product.reviews || []).map((review) => (
            <View key={review.id} className="rounded-[22px] bg-primary-50 p-4">
              <ReviewStars rating={review.rating} />
              <Text className="mt-2 text-sm font-black text-primary-900">{review.userId?.name || 'Customer'}</Text>
              <Text className="mt-1 text-sm leading-6 text-primary-900/70">{review.comment}</Text>
            </View>
          ))}
        </View>
        {user ? (
          <View className="mt-5 gap-3">
            <ReviewStars rating={rating} onChange={setRating} />
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Share your experience"
              multiline
              className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
              placeholderTextColor="#7a978b"
            />
            <Pressable
              onPress={async () => {
                await storefrontApi.submitReview({ productId: product.id, rating, comment });
                setComment('');
              }}
              className="rounded-full bg-primary-500 px-5 py-4"
            >
              <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                Submit Review
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View className="mt-7">
        <Text className="mb-4 text-lg font-black text-primary-900">Related Products</Text>
        {relatedProducts.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </View>
    </Screen>
  );
}
