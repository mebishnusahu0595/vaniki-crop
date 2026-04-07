import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Screen } from '../../src/components/Screen';
import { ProductCard } from '../../src/components/ProductCard';
import { ReviewStars } from '../../src/components/ReviewStars';
import { storefrontApi } from '../../src/lib/api';
import { useCartStore } from '../../src/store/useCartStore';
import { useAuthStore } from '../../src/store/useAuthStore';
import { currencyFormatter, getDiscountPercent, getPrimaryImage } from '../../src/utils/format';
import { stripHtml } from '../../src/utils/html';

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);
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

  if (!product || !selectedVariant) {
    return (
      <Screen>
        <Text className="text-base font-semibold text-primary-900">Loading product...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} className="mb-5">
        {product.images.length ? (
          product.images.map((image) => (
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

      <Pressable onPress={() => addItem(product, selectedVariant)} className="mt-6 rounded-full bg-primary-500 px-5 py-4">
        <Text className="text-center text-sm font-black uppercase tracking-[2px] text-white">Add to Cart</Text>
      </Pressable>

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
