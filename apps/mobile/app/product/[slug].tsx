// Product Details Screen with Dealer Availability & Store Validation
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { Screen } from '../../src/components/Screen';
import { Skeleton } from '../../src/components/Skeleton';
import { ProductCard } from '../../src/components/ProductCard';
import { ReviewStars } from '../../src/components/ReviewStars';
import { storefrontApi } from '../../src/lib/api';
import { useCartStore } from '../../src/store/useCartStore';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useCompareStore } from '../../src/store/useCompareStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { currencyFormatter, getDiscountPercent, getPrimaryImage } from '../../src/utils/format';
import { stripHtml } from '../../src/utils/html';
import { resolveMediaUrl } from '../../src/utils/media';

export default function ProductDetailScreen() {
  const { t } = useTranslation();
  const { slug, image: routeImage } = useLocalSearchParams<{ slug: string; image?: string }>();
  const { width } = useWindowDimensions();
  const addItem = useCartStore((state) => state.addItem);
  const increaseQty = useCartStore((state) => state.increaseQty);
  const decreaseQty = useCartStore((state) => state.decreaseQty);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const comparedProducts = useCompareStore((state) => state.products);
  const toggleCompareProduct = useCompareStore((state) => state.toggleProduct);

  const selectedStore = useStoreStore((state) => state.selectedStore);
  const setStore = useStoreStore((state) => state.setStore);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<string | null>('dosage');
  const galleryRef = useRef<ScrollView>(null);

  const productQuery = useQuery({
    queryKey: ['mobile-product', slug],
    queryFn: () => storefrontApi.productDetail(slug),
    enabled: Boolean(slug),
  });

  const product = productQuery.data;
  const selectedVariant =
    product?.variants.find((variant) => variant.id === selectedVariantId) || product?.variants[0];

  // Dealer availability query for this product & variant
  const storeAvailabilityQuery = useQuery({
    queryKey: ['mobile-product-dealer-availability', product?.id, selectedVariant?.id],
    queryFn: () => storefrontApi.productAvailability(product!.id, selectedVariant!.id),
    enabled: Boolean(product?.id && selectedVariant?.id),
  });

  const storeAvailability = storeAvailabilityQuery.data || [];

  const selectedStoreStockInfo = storeAvailability.find((s) => s.id === selectedStore?.id);
  const isSelectedStoreOutOfStock = selectedStore && selectedStoreStockInfo && selectedStoreStockInfo.quantity === 0;

  const quantityInCart = useCartStore(
    (state) => state.items.find((item) => item.variantId === selectedVariant?.id)?.qty || 0,
  );

  // 1. Related Products Query
  const relatedQuery = useQuery({
    queryKey: ['mobile-related-products', product?.category?.slug],
    queryFn: () =>
      storefrontApi.products({
        category: product?.category?.slug,
        limit: 8,
      }),
    enabled: Boolean(product?.category?.slug),
  });

  // 2. Best Sellers Products Query
  const bestSellersQuery = useQuery({
    queryKey: ['mobile-bestsellers-footer'],
    queryFn: () =>
      storefrontApi.products({
        limit: 8,
        sort: 'popular',
      }),
  });

  const relatedProducts = useMemo(
    () => (relatedQuery.data?.data || []).filter((item) => item.slug !== product?.slug),
    [product?.slug, relatedQuery.data?.data],
  );

  const bestSellerProducts = useMemo(
    () => (bestSellersQuery.data?.data || []).filter((item) => item.slug !== product?.slug),
    [product?.slug, bestSellersQuery.data?.data],
  );

  const galleryImages = useMemo(
    () =>
      [...(product?.images || [])]
        .filter((image) => Boolean(image.url?.trim()))
        .sort((left, right) => Number(Boolean(right.isPrimary)) - Number(Boolean(left.isPrimary))),
    [product?.images],
  );
  const galleryImageWidth = Math.max(width - 32, 240);

  const maxStock = Math.max(selectedVariant?.stock || 0, 0);
  const canIncrease = maxStock > quantityInCart;
  const isOutOfStock = maxStock === 0 || isSelectedStoreOutOfStock;
  const wishlistIds = (user?.wishlist || []).map((entry) => (typeof entry === 'string' ? entry : entry.id));
  const isWishlisted = wishlistIds.includes(product?.id || '');
  const isCompared = comparedProducts.some((entry) => entry.id === product?.id);

  if (!product || !selectedVariant) {
    return (
      <Screen>
        <View className="gap-4 pb-10">
          <Skeleton height={280} borderRadius={28} className="w-full" />
          <View className="flex-row justify-center gap-1.5 mt-1">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width={8} height={8} borderRadius={4} />
            ))}
          </View>
          <View className="flex-row justify-center gap-2 mt-1">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width={50} height={50} borderRadius={12} />
            ))}
          </View>
          <View className="gap-2.5 mt-3">
            <Skeleton width="40%" height={10} borderRadius={4} />
            <Skeleton width="85%" height={24} borderRadius={6} />
            <Skeleton width="30%" height={14} borderRadius={4} />
          </View>
          <View className="flex-row items-center gap-3 mt-1">
            <Skeleton width={80} height={24} borderRadius={6} />
            <Skeleton width={60} height={16} borderRadius={4} />
            <Skeleton width={50} height={14} borderRadius={4} />
          </View>
          <Skeleton height={48} borderRadius={24} className="w-full mt-4" />
        </View>
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
      {/* Gallery Section Block Wrapper */}
      <View className="mb-6 gap-3">
        {/* Main Image Box */}
        <View className="relative w-full rounded-[28px] bg-[#f4f7f6] overflow-hidden items-center justify-center border border-slate-200/60 shadow-xs">
          {/* Wishlist & Compare Icon Buttons on Image Top Right */}
          <View className="absolute right-3 top-3 z-30 flex-col gap-2">
            <Pressable
              onPress={() => void handleToggleWishlist()}
              className={`h-9 w-9 items-center justify-center rounded-full border active:scale-90 shadow-md ${
                isWishlisted ? 'border-rose-200 bg-rose-50' : 'border-white/85 bg-white/95'
              }`}
            >
              <Feather name="heart" size={16} color={isWishlisted ? '#E11D48' : '#082018'} />
            </Pressable>
            <Pressable
              onPress={handleToggleCompare}
              className={`h-9 w-9 items-center justify-center rounded-full border active:scale-90 shadow-md ${
                isCompared ? 'border-primary-500 bg-primary-500' : 'border-white/85 bg-white/95'
              }`}
            >
              <Feather name="sliders" size={16} color={isCompared ? '#FFFFFF' : '#082018'} />
            </Pressable>
          </View>

          {/* Main Product Image Carousel */}
          <ScrollView
            ref={galleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(event) => {
              const contentOffsetX = event.nativeEvent.contentOffset.x;
              const index = Math.round(contentOffsetX / galleryImageWidth);
              if (index !== activeImageIndex) {
                setActiveImageIndex(index);
              }
            }}
            scrollEventThrottle={16}
            style={{ width: galleryImageWidth, height: 280 }}
          >
            {galleryImages.length ? (
              galleryImages.map((image) => {
                const imageUrl = resolveMediaUrl(image.url, image.publicId);
                return (
                  <View
                    key={image.url}
                    style={{ width: galleryImageWidth, height: 280 }}
                    className="items-center justify-center relative"
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="contain"
                    />
                  </View>
                );
              })
            ) : (
              <View
                style={{ width: galleryImageWidth, height: 280 }}
                className="items-center justify-center relative"
              >
                <Image
                  source={{ uri: getPrimaryImage(product, routeImage) }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
            )}
          </ScrollView>
        </View>

        {/* Dots indicator */}
        {galleryImages.length > 1 ? (
          <View className="flex-row justify-center gap-1.5 py-1">
            {galleryImages.map((_, index) => (
              <Pressable
                key={index}
                onPress={() => {
                  galleryRef.current?.scrollTo({ x: index * galleryImageWidth, animated: true });
                  setActiveImageIndex(index);
                }}
                className={`h-2 rounded-full ${
                  activeImageIndex === index ? 'w-5 bg-primary-500' : 'w-2 bg-primary-200'
                }`}
              />
            ))}
          </View>
        ) : null}

        {/* Thumbnail previews */}
        {galleryImages.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
          >
            {galleryImages.map((image, index) => {
              const imageUrl = resolveMediaUrl(image.url, image.publicId);
              const isSelected = index === activeImageIndex;
              return (
                <Pressable
                  key={`thumb-${image.url}`}
                  onPress={() => {
                    galleryRef.current?.scrollTo({ x: index * galleryImageWidth, animated: true });
                    setActiveImageIndex(index);
                  }}
                  className={`h-14 w-14 overflow-hidden rounded-xl border bg-[#f4f7f6] items-center justify-center active:scale-95 ${
                    isSelected ? 'border-primary-500 border-2' : 'border-primary-100'
                  }`}
                >
                  <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* Product Details Information */}
      <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
        {product.category?.name || 'Crop Care'}
      </Text>
      <Text className="mt-1 text-3xl font-black text-primary-900">{product.name}</Text>
      {product.shortDescription ? (
        <Text className="mt-2 text-sm leading-6 text-primary-900/70">{product.shortDescription}</Text>
      ) : null}

      <View className="mt-4 flex-row items-center gap-3">
        <Text className="text-2xl font-black text-primary-900">{currencyFormatter.format(selectedVariant.price)}</Text>
        {selectedVariant.mrp > selectedVariant.price ? (
          <>
            <Text className="text-sm font-semibold text-primary-900/40 line-through">
              {currencyFormatter.format(selectedVariant.mrp)}
            </Text>
            <Text className="rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-[1px] text-white">
              {getDiscountPercent(selectedVariant.price, selectedVariant.mrp)}% off
            </Text>
          </>
        ) : null}
      </View>

      <View className="mt-3 flex-row items-center gap-3">
        <View
          className={`rounded-full px-3 py-1 ${isOutOfStock ? 'bg-rose-100' : maxStock < 10 ? 'bg-amber-100' : 'bg-emerald-100'}`}
        >
          <Text
            className={`text-[10px] font-black uppercase tracking-[1px] ${
              isOutOfStock ? 'text-rose-600' : maxStock < 10 ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {isOutOfStock ? t('mobile.actions.outOfStock') : maxStock < 10 ? t('mobile.actions.onlyLeft', { count: maxStock }) : t('mobile.actions.unitsAvailable', { count: maxStock })}
          </Text>
        </View>
        <Text className="text-[10px] font-black uppercase tracking-[1px] text-primary-900/40">
          Dealer Inventory
        </Text>
      </View>

      {/* Selected Dealer Stock Warning Banner */}
      {isSelectedStoreOutOfStock ? (
        <View className="mt-3 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 flex-row items-start gap-2.5">
          <Feather name="alert-triangle" size={18} color="#E11D48" className="mt-0.5" />
          <View className="flex-1">
            <Text className="text-xs font-black text-rose-900">
              Selected Dealer Out of Stock!
            </Text>
            <Text className="text-xs text-rose-700 mt-0.5 leading-5">
              Product is out of stock at <Text className="font-black">{selectedStore?.name}</Text>. Please select another dealer below to order.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Select Variant Chips */}
      <View className="mt-5 flex-row flex-wrap gap-2">
        {product.variants.map((variant) => (
          <Pressable
            key={variant.id}
            onPress={() => setSelectedVariantId(variant.id)}
            className={`rounded-full px-4 py-3 active:scale-95 ${selectedVariant.id === variant.id ? 'bg-primary-500' : 'bg-white border border-primary-100'}`}
          >
            <Text className={`text-xs font-black uppercase tracking-[1px] ${selectedVariant.id === variant.id ? 'text-white' : 'text-primary-900'}`}>
              {variant.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Add / Quantity Counter */}
      {quantityInCart > 0 ? (
        <View className="mt-6 flex-row items-center justify-between rounded-full bg-primary-50 px-3 py-2">
          <Pressable onPress={() => decreaseQty(selectedVariant.id)} className="h-10 w-10 items-center justify-center rounded-full bg-white active:scale-90">
            <Feather name="minus" size={16} color="#082018" />
          </Pressable>
          <Text className="text-sm font-black text-primary-900">{quantityInCart}</Text>
          <Pressable
            onPress={() => {
              if (canIncrease && !isSelectedStoreOutOfStock) {
                increaseQty(selectedVariant.id);
              }
            }}
            disabled={!canIncrease || Boolean(isSelectedStoreOutOfStock)}
            className={`h-10 w-10 items-center justify-center rounded-full active:scale-90 ${canIncrease && !isSelectedStoreOutOfStock ? 'bg-primary-500' : 'bg-primary-100'}`}
          >
            <Feather name="plus" size={16} color={canIncrease && !isSelectedStoreOutOfStock ? '#FFFFFF' : '#6D8A7D'} />
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
          className={`mt-6 rounded-full px-5 py-4 active:scale-95 active:opacity-90 ${isOutOfStock ? 'bg-slate-200' : 'bg-primary-500'}`}
        >
          <Text className={`text-center text-sm font-black uppercase tracking-[2px] ${isOutOfStock ? 'text-slate-500' : 'text-white'}`}>
            {isSelectedStoreOutOfStock ? 'Out of Stock at Selected Dealer' : isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </Text>
        </Pressable>
      )}

      {/* ========================================================================= */}
      {/* NEW SECTION: DEALER AVAILABILITY CHECK                                   */}
      {/* ========================================================================= */}
      <View className="mt-8 rounded-[28px] bg-white p-5 border border-primary-100 shadow-xs">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Feather name="map-pin" size={18} color="#166534" />
            <Text className="text-base font-black text-primary-900">Dealer & Store Availability</Text>
          </View>
          <Text className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-1 rounded-full">
            Realtime Stock
          </Text>
        </View>
        <Text className="text-xs text-slate-500 mb-4">
          Check which registered Vaniki Agri dealers have stock available in your area:
        </Text>

        {storeAvailabilityQuery.isLoading ? (
          <View className="py-4 items-center">
            <Skeleton height={40} borderRadius={16} className="w-full mb-2" />
            <Skeleton height={40} borderRadius={16} className="w-full" />
          </View>
        ) : storeAvailability.length > 0 ? (
          <View className="gap-2.5">
            {storeAvailability.map((store) => {
              const inStock = store.quantity > 0;
              const isCurrentSelected = selectedStore?.id === store.id;

              return (
                <Pressable
                  key={store.id}
                  onPress={() => {
                    setStore(store as any);
                    if (!inStock) {
                      Alert.alert(
                        'Out of Stock Dealer Selected',
                        `${store.name} is currently out of stock for this item. Please choose an in-stock dealer to order.`,
                      );
                    }
                  }}
                  className={`rounded-2xl border p-3.5 flex-row items-center justify-between active:scale-98 ${
                    isCurrentSelected
                      ? 'border-emerald-600 bg-emerald-50/80 shadow-2xs'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs font-black text-slate-900">{store.name}</Text>
                      {isCurrentSelected ? (
                        <Text className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-200 px-1.5 py-0.5 rounded-md">
                          Active Store
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-[11px] text-slate-500 mt-0.5" numberOfLines={1}>
                      📍 {store.address?.city || (store.address as any)?.street || 'Local Dealer Point'}, {store.address?.state || 'CG'}
                    </Text>
                  </View>

                  <View className={`rounded-full px-3 py-1.5 ${inStock ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                    <Text className={`text-[10px] font-black uppercase tracking-[0.5px] ${inStock ? 'text-emerald-800' : 'text-rose-700'}`}>
                      {inStock ? `In Stock (${store.quantity})` : 'Out of Stock'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View className="rounded-2xl bg-slate-50 p-4 items-center">
            <Text className="text-xs font-semibold text-slate-500">
              No specific store mapped for this product. Central delivery available.
            </Text>
          </View>
        )}
      </View>

      {/* ========================================================================= */}
      {/* FOOTER SECTIONS                                                           */}
      {/* ========================================================================= */}

      {/* SECTION 1: Product Description */}
      <View className="mt-6 rounded-[28px] bg-white p-5 border border-primary-100 shadow-xs">
        <Text className="text-lg font-black text-primary-900">Description</Text>
        <Text className="mt-3 text-sm leading-7 text-primary-900/70">{stripHtml(product.description)}</Text>
      </View>

      {/* SECTION 2: Why Choose Vaniki Crop (4 Trust Badges Grid - Perfectly Aligned) */}
      <View className="mt-6 rounded-[28px] bg-white p-5 border border-primary-100 shadow-xs">
        <Text className="text-xs font-black uppercase tracking-[2px] text-[#2D6A4F] mb-4">
          Why Choose Vaniki Crop Science
        </Text>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <View style={{ width: '48.5%' }} className="flex-row items-center gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 min-h-[64px]">
            <Feather name="shield" size={18} color="#166534" />
            <View className="flex-1">
              <Text style={{ color: '#0F172A' }} className="text-xs font-black">100% Genuine</Text>
              <Text style={{ color: '#64748B' }} className="text-[10px] font-bold">Certified Crop Care</Text>
            </View>
          </View>

          <View style={{ width: '48.5%' }} className="flex-row items-center gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 min-h-[64px]">
            <Feather name="truck" size={18} color="#166534" />
            <View className="flex-1">
              <Text style={{ color: '#0F172A' }} className="text-xs font-black">Fast Delivery</Text>
              <Text style={{ color: '#64748B' }} className="text-[10px] font-bold">Across Pin Codes</Text>
            </View>
          </View>

          <View style={{ width: '48.5%' }} className="flex-row items-center gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 min-h-[64px]">
            <Feather name="tag" size={18} color="#166534" />
            <View className="flex-1">
              <Text style={{ color: '#0F172A' }} className="text-xs font-black">Best Price</Text>
              <Text style={{ color: '#64748B' }} className="text-[10px] font-bold">Dealer Discount</Text>
            </View>
          </View>

          <View style={{ width: '48.5%' }} className="flex-row items-center gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 min-h-[64px]">
            <Feather name="phone-call" size={18} color="#166534" />
            <View className="flex-1">
              <Text style={{ color: '#0F172A' }} className="text-xs font-black">Agri Expert</Text>
              <Text style={{ color: '#64748B' }} className="text-[10px] font-bold">Free Consultation</Text>
            </View>
          </View>
        </View>
      </View>

      {/* SECTION 3: Usage Instructions & FAQs Accordion */}
      <View className="mt-6 rounded-[28px] bg-white p-5 border border-primary-100 shadow-xs">
        <Text className="text-lg font-black text-primary-900 mb-3">Usage & Crop Safety Guide</Text>
        
        <View className="gap-2.5">
          <Pressable
            onPress={() => setExpandedFaq(expandedFaq === 'dosage' ? null : 'dosage')}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-black text-slate-900">🧪 Recommended Dosage & Method</Text>
              <Feather name={expandedFaq === 'dosage' ? 'chevron-up' : 'chevron-down'} size={18} color="#082018" />
            </View>
            {expandedFaq === 'dosage' ? (
              <Text className="mt-2.5 text-xs leading-5 text-slate-600 border-t border-slate-200 pt-2">
                Mix 250ml to 500ml per acre with 150-200 liters of clean water for foliar spray. Ensure uniform coverage on healthy leaves.
              </Text>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => setExpandedFaq(expandedFaq === 'crops' ? null : 'crops')}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-black text-slate-900">🌿 Target Crops & Compatibility</Text>
              <Feather name={expandedFaq === 'crops' ? 'chevron-up' : 'chevron-down'} size={18} color="#082018" />
            </View>
            {expandedFaq === 'crops' ? (
              <Text className="mt-2.5 text-xs leading-5 text-slate-600 border-t border-slate-200 pt-2">
                Suitable for Rice, Paddy, Cotton, Soybean, Vegetables (Tomato, Chilli, Brinjal) and Fruit Crops. Compatible with most standard crop nutrients.
              </Text>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => setExpandedFaq(expandedFaq === 'safety' ? null : 'safety')}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-black text-slate-900">⚠️ Safety & Storage Precautions</Text>
              <Feather name={expandedFaq === 'safety' ? 'chevron-up' : 'chevron-down'} size={18} color="#082018" />
            </View>
            {expandedFaq === 'safety' ? (
              <Text className="mt-2.5 text-xs leading-5 text-slate-600 border-t border-slate-200 pt-2">
                Store in a cool, dry place away from direct sunlight. Keep out of reach of children and domestic animals. Wear protective gloves during application.
              </Text>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* SECTION 4: Related Category Products Carousel */}
      <View className="mt-6">
        <View className="flex-row items-center justify-between mb-3 px-1">
          <Text className="text-lg font-black text-primary-900">Similar Category Products</Text>
          <Pressable onPress={() => router.push('/products')}>
            <Text className="text-xs font-bold text-emerald-700">View All →</Text>
          </Pressable>
        </View>

        {relatedProducts.length ? (
          <View style={{ height: 320, width: '100%' }}>
            <FlashList
              horizontal
              data={relatedProducts}
              showsHorizontalScrollIndicator={false}
              estimatedItemSize={184}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View className="mr-3 w-[184px]">
                  <ProductCard product={item} compact />
                </View>
              )}
            />
          </View>
        ) : (
          <Text className="text-xs font-semibold text-primary-900/60 pl-1">
            No related category products found.
          </Text>
        )}
      </View>

      {/* SECTION 5: Best Seller Recommendations */}
      {bestSellerProducts.length > 0 ? (
        <View className="mt-6">
          <View className="flex-row items-center justify-between mb-3 px-1">
            <Text className="text-lg font-black text-primary-900">Best Seller Recommendations</Text>
            <Pressable onPress={() => router.push('/products')}>
              <Text className="text-xs font-bold text-emerald-700">Explore Store →</Text>
            </Pressable>
          </View>

          <View style={{ height: 320, width: '100%' }}>
            <FlashList
              horizontal
              data={bestSellerProducts}
              showsHorizontalScrollIndicator={false}
              estimatedItemSize={184}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View className="mr-3 w-[184px]">
                  <ProductCard product={item} compact />
                </View>
              )}
            />
          </View>
        </View>
      ) : null}

      {/* SECTION 6: Customer Reviews & Rating Summary */}
      <View className="mt-6 rounded-[28px] bg-white p-5 border border-primary-100 shadow-xs">
        <Text className="text-lg font-black text-primary-900">Customer Reviews ({product.reviews?.length || 0})</Text>
        
        <View className="mt-4 gap-3">
          {(product.reviews || []).length > 0 ? (
            (product.reviews || []).map((review) => (
              <View key={review.id} className="rounded-[22px] bg-primary-50 p-4">
                <ReviewStars rating={review.rating} />
                <Text className="mt-2 text-sm font-black text-primary-900">{review.userId?.name || 'Verified Farmer'}</Text>
                <Text className="mt-1 text-sm leading-6 text-primary-900/70">{review.comment}</Text>
              </View>
            ))
          ) : (
            <Text className="text-xs font-semibold text-slate-500 py-2">
              No reviews yet for this product. Be the first farmer to review!
            </Text>
          )}
        </View>

        {user ? (
          <View className="mt-5 gap-3 pt-3 border-t border-slate-100">
            <Text className="text-xs font-black uppercase tracking-[1px] text-slate-900">Write Your Review</Text>
            <ReviewStars rating={rating} onChange={setRating} />
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Share your crop results and experience..."
              multiline
              className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3.5 text-sm text-primary-900"
              placeholderTextColor="#7a978b"
            />
            <Pressable
              onPress={async () => {
                await storefrontApi.submitReview({ productId: product.id, rating, comment });
                setComment('');
                Alert.alert('Review Submitted! ⭐', 'Thank you for reviewing this product.');
              }}
              style={{ backgroundColor: '#166534' }}
              className="rounded-full py-3.5 items-center justify-center active:scale-95 shadow-xs"
            >
              <Text className="text-xs font-black uppercase tracking-[1.5px] text-white">
                Submit Review
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* SECTION 7: Agri Expert Assistance Footer CTA Banner (Pure Bright White Text) */}
      <View style={{ backgroundColor: '#0B281E' }} className="mt-6 mb-10 rounded-[28px] p-6 border border-emerald-800 shadow-md items-center">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 mb-3">
          <Feather name="message-circle" size={24} color="#34D399" />
        </View>
        <Text style={{ color: '#FFFFFF' }} className="text-base font-black text-center">
          Need Help With Crop Dosage or Disease Treatment?
        </Text>
        <Text style={{ color: '#FFFFFF' }} className="mt-1.5 text-xs font-bold text-center px-4">
          Chat directly with our Agri Advisory Team on WhatsApp for free crop consultation!
        </Text>

        <Pressable
          onPress={() => Linking.openURL('https://wa.me/919301105706?text=Hello%20Vaniki%20Crop%20Team,%20I%20need%20help%20with%20crop%20care')}
          style={{ backgroundColor: '#25D366' }}
          className="mt-4 rounded-full px-6 py-3.5 flex-row items-center gap-2 active:scale-95 shadow-sm"
        >
          <Feather name="message-square" size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF' }} className="text-xs font-black uppercase tracking-[1px]">
            Chat On WhatsApp
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
