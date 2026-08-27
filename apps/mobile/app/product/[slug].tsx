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
import { translateCategory, useTranslatedContent } from '../../src/utils/translator';
import { getAppLanguage } from '../../src/i18n';

export default function ProductDetailScreen() {
  const { t, i18n } = useTranslation();
  const isHindi = getAppLanguage() === 'hi';
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

  // Dynamic Hindi translation of database content
  const translatedDescription = useTranslatedContent(product?.description ? stripHtml(product.description) : '');
  const translatedShortDescription = useTranslatedContent(product?.shortDescription || '');

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

  // 2. Best Sellers Fallback Query
  const bestSellersQuery = useQuery({
    queryKey: ['mobile-best-sellers-fallback'],
    queryFn: () =>
      storefrontApi.products({
        sort: 'popular',
        limit: 8,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const relatedProducts = useMemo(() => {
    const list = relatedQuery.data?.data || [];
    return list.filter((p) => p.id !== product?.id);
  }, [relatedQuery.data?.data, product?.id]);

  const bestSellerProducts = useMemo(() => {
    const list = bestSellersQuery.data?.data || [];
    return list.filter((p) => p.id !== product?.id);
  }, [bestSellersQuery.data?.data, product?.id]);

  const wishlistIds = (user?.wishlist || []).map((item) => (typeof item === 'string' ? item : item.id));
  const isWishlisted = product ? wishlistIds.includes(product.id) : false;
  const isCompared = product ? comparedProducts.some((item) => item.id === product.id) : false;

  const handleToggleWishlist = async () => {
    if (!product) return;
    if (!user) {
      Alert.alert(
        isHindi ? 'लॉगिन आवश्यक है' : 'Login required',
        isHindi ? 'पसंदीदा दवाइयां सहेजने के लिए कृपया लॉगिन करें।' : 'Please login to save wishlist products.',
      );
      router.push('/(auth)/login');
      return;
    }

    try {
      const updatedUser = await storefrontApi.toggleWishlist(product.id);
      setUser(updatedUser);
    } catch (caughtError) {
      Alert.alert(
        isHindi ? 'विशलिस्ट अपडेट विफल' : 'Wishlist update failed',
        caughtError instanceof Error ? caughtError.message : 'Please try again.',
      );
    }
  };

  const handleToggleCompare = () => {
    if (!product) return;
    const result = toggleCompareProduct(product);
    if (result.message.includes('up to 3')) {
      Alert.alert(isHindi ? 'तुलना सीमा' : 'Compare limit', result.message);
    }
  };

  if (productQuery.isLoading) {
    return (
      <Screen>
        <Skeleton height={260} borderRadius={28} className="w-full" />
        <Skeleton width={120} height={14} borderRadius={4} className="mt-6" />
        <Skeleton width={220} height={24} borderRadius={8} className="mt-3" />
        <Skeleton width={160} height={18} borderRadius={6} className="mt-4" />
        <Skeleton height={90} borderRadius={24} className="mt-6 w-full" />
      </Screen>
    );
  }

  if (!product || !selectedVariant) {
    return (
      <Screen>
        <View className="rounded-[28px] bg-white p-8 items-center">
          <Text className="text-2xl font-black text-primary-900">
            {isHindi ? 'उत्पाद नहीं मिला।' : 'Product not found.'}
          </Text>
          <Text className="mt-3 text-sm leading-6 text-primary-900/70 text-center">
            {isHindi ? 'यह उत्पाद अब उपलब्ध नहीं है या हटा दिया गया है।' : 'The item you are looking for is no longer available.'}
          </Text>
        </View>
      </Screen>
    );
  }

  const primaryImage = routeImage || getPrimaryImage(product);
  const galleryImages =
    product.images && product.images.length > 0
      ? product.images
      : [{ url: primaryImage, publicId: '', isPrimary: true }];

  const galleryImageWidth = Math.max(width - 48, 260);
  const maxStock = Math.max(selectedVariant.stock || 0, 0);
  const isOutOfStock = maxStock === 0;
  const canIncrease = quantityInCart < maxStock;

  return (
    <Screen>
      {/* Top Media Gallery with Floating Wishlist/Compare */}
      <View className="relative mb-6">
        <ScrollView
          ref={galleryRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / galleryImageWidth);
            setActiveImageIndex(index);
          }}
          className="rounded-[32px] bg-white overflow-hidden border border-primary-100 shadow-sm"
        >
          {galleryImages.map((image, index) => {
            const imageUrl = resolveMediaUrl(image.url, image.publicId);
            return (
              <View
                key={`${image.url}-${index}`}
                style={{ width: galleryImageWidth, height: 280 }}
                className="items-center justify-center p-4"
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            );
          })}
        </ScrollView>

        {/* Floating Action Buttons */}
        <View className="absolute right-4 top-4 z-20 flex-row gap-2">
          <Pressable
            onPress={handleToggleWishlist}
            className={`h-10 w-10 items-center justify-center rounded-full border active:scale-90 shadow-md ${
              isWishlisted ? 'border-rose-200 bg-rose-50' : 'border-white/90 bg-white/95'
            }`}
          >
            <Feather name="heart" size={18} color={isWishlisted ? '#E11D48' : '#082018'} />
          </Pressable>
          <Pressable
            onPress={handleToggleCompare}
            className={`h-10 w-10 items-center justify-center rounded-full border active:scale-90 shadow-md ${
              isCompared ? 'border-primary-500 bg-primary-500' : 'border-white/90 bg-white/95'
            }`}
          >
            <Feather name="sliders" size={18} color={isCompared ? '#FFFFFF' : '#082018'} />
          </Pressable>
        </View>

        {/* Dots indicator */}
        {galleryImages.length > 1 ? (
          <View className="flex-row justify-center gap-1.5 mt-3">
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
        {translateCategory(product.category?.name || product.category?.slug)}
      </Text>
      <Text className="mt-1 text-2xl font-black text-primary-900">{product.name}</Text>
      {translatedShortDescription ? (
        <Text className="mt-2 text-sm leading-6 text-primary-900/70">{translatedShortDescription}</Text>
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
          {isHindi ? 'डीलर इन्वेंटरी' : 'Dealer Inventory'}
        </Text>
      </View>

      {/* Selected Dealer Stock Warning Banner */}
      {isSelectedStoreOutOfStock ? (
        <View className="mt-3 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 flex-row items-start gap-2.5">
          <Feather name="alert-triangle" size={18} color="#E11D48" className="mt-0.5" />
          <View className="flex-1">
            <Text className="text-xs font-black text-rose-900">
              {isHindi ? 'चयनित डीलर पर स्टॉक समाप्त!' : 'Selected Dealer Out of Stock!'}
            </Text>
            <Text className="text-xs text-rose-700 mt-0.5 leading-5">
              {isHindi ? (
                <>यह उत्पाद <Text className="font-black">{selectedStore?.name}</Text> पर उपलब्ध नहीं है। कृपया नीचे से दूसरा डीलर चुनें।</>
              ) : (
                <>Product is out of stock at <Text className="font-black">{selectedStore?.name}</Text>. Please select another dealer below to order.</>
              )}
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
            {isSelectedStoreOutOfStock ? (t('mobile.actions.outOfStock')) : isOutOfStock ? t('mobile.actions.outOfStock') : t('mobile.actions.addToCart')}
          </Text>
        </Pressable>
      )}

      {/* ========================================================================= */}
      {/* DEALER AVAILABILITY CHECK                                                 */}
      {/* ========================================================================= */}
      <View className="mt-8 rounded-[28px] bg-white p-5 border border-primary-100 shadow-xs">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Feather name="map-pin" size={18} color="#166534" />
            <Text className="text-base font-black text-primary-900">
              {isHindi ? 'डीलर और स्टोर में उपलब्धता' : 'Dealer & Store Availability'}
            </Text>
          </View>
          <Text className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-1 rounded-full">
            {isHindi ? 'लाइव स्टॉक' : 'Realtime Stock'}
          </Text>
        </View>
        <Text className="text-xs text-slate-500 mb-4">
          {isHindi
            ? 'देखें आपके क्षेत्र में किन Vaniki प्रमाणित कृषि डीलरों के पास स्टॉक उपलब्ध है:'
            : 'Check which registered Vaniki Agri dealers have stock available in your area:'}
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
                        isHindi ? 'स्टॉक समाप्त डीलर चयनित' : 'Out of Stock Dealer Selected',
                        isHindi
                          ? `${store.name} पर यह उत्पाद अभी उपलब्ध नहीं है। कृपया स्टॉक वाले डीलर से ऑर्डर करें।`
                          : `${store.name} is currently out of stock for this item. Please choose an in-stock dealer to order.`,
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
                          {isHindi ? 'सक्रिय स्टोर' : 'Active Store'}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-[11px] text-slate-500 mt-0.5" numberOfLines={1}>
                      📍 {store.address?.city || (store.address as any)?.street || 'Local Dealer Point'}, {store.address?.state || 'CG'}
                    </Text>
                  </View>

                  <View className={`rounded-full px-3 py-1.5 ${inStock ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                    <Text className={`text-[10px] font-black uppercase tracking-[0.5px] ${inStock ? 'text-emerald-800' : 'text-rose-700'}`}>
                      {inStock
                        ? isHindi ? `स्टॉक में (${store.quantity})` : `In Stock (${store.quantity})`
                        : isHindi ? 'स्टॉक समाप्त' : 'Out of Stock'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View className="rounded-2xl bg-slate-50 p-4 items-center">
            <Text className="text-xs font-semibold text-slate-500">
              {isHindi ? 'इस उत्पाद के लिए कोई स्थानीय डीलर मैप नहीं है। केंद्रीय डिलीवरी उपलब्ध है।' : 'No specific store mapped for this product. Central delivery available.'}
            </Text>
          </View>
        )}
      </View>

      {/* ========================================================================= */}
      {/* FOOTER SECTIONS                                                           */}
      {/* ========================================================================= */}

      {/* SECTION 1: Product Description */}
      <View className="mt-6 rounded-[28px] bg-white p-5 border border-primary-100 shadow-xs">
        <Text className="text-lg font-black text-primary-900">{t('mobile.productDetail.description')}</Text>
        <Text className="mt-3 text-sm leading-7 text-primary-900/70">
          {translatedDescription || stripHtml(product.description)}
        </Text>
      </View>

      {/* SECTION 2: Why Choose Vaniki Crop */}
      <View className="mt-6 rounded-[28px] bg-white p-5 border border-primary-100 shadow-xs">
        <Text className="text-xs font-black uppercase tracking-[2px] text-[#2D6A4F] mb-4">
          {isHindi ? 'VANIKI CROP SCIENCE क्यों चुनें' : 'Why Choose Vaniki Crop Science'}
        </Text>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <View style={{ width: '48.5%' }} className="flex-row items-center gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 min-h-[64px]">
            <Feather name="shield" size={18} color="#166534" />
            <View className="flex-1">
              <Text style={{ color: '#0F172A' }} className="text-xs font-black">
                {isHindi ? '100% असली उत्पाद' : '100% Genuine'}
              </Text>
              <Text style={{ color: '#64748B' }} className="text-[10px] font-bold">
                {isHindi ? 'प्रमाणित फसल सुरक्षा' : 'Certified Crop Care'}
              </Text>
            </View>
          </View>

          <View style={{ width: '48.5%' }} className="flex-row items-center gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 min-h-[64px]">
            <Feather name="truck" size={18} color="#166534" />
            <View className="flex-1">
              <Text style={{ color: '#0F172A' }} className="text-xs font-black">
                {isHindi ? 'तेज़ डिलीवरी' : 'Fast Delivery'}
              </Text>
              <Text style={{ color: '#64748B' }} className="text-[10px] font-bold">
                {isHindi ? 'नजदीकी स्टोर से' : 'Local Store Dispatch'}
              </Text>
            </View>
          </View>

          <View style={{ width: '48.5%' }} className="flex-row items-center gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 min-h-[64px]">
            <Feather name="tag" size={18} color="#166534" />
            <View className="flex-1">
              <Text style={{ color: '#0F172A' }} className="text-xs font-black">
                {isHindi ? 'उचित मूल्य' : 'Best Price'}
              </Text>
              <Text style={{ color: '#64748B' }} className="text-[10px] font-bold">
                {isHindi ? 'डीलर विशेष छूट' : 'Dealer Discount'}
              </Text>
            </View>
          </View>

          <View style={{ width: '48.5%' }} className="flex-row items-center gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 min-h-[64px]">
            <Feather name="phone-call" size={18} color="#166534" />
            <View className="flex-1">
              <Text style={{ color: '#0F172A' }} className="text-xs font-black">
                {isHindi ? 'कृषि विशेषज्ञ' : 'Agri Expert'}
              </Text>
              <Text style={{ color: '#64748B' }} className="text-[10px] font-bold">
                {isHindi ? 'मुफ्त परामर्श' : 'Free Consultation'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* SECTION 3: Usage Instructions & FAQs Accordion */}
      <View className="mt-6 rounded-[28px] bg-white p-5 border border-primary-100 shadow-xs">
        <Text className="text-lg font-black text-primary-900 mb-3">
          {isHindi ? 'उपयोग विधि एवं फसल सुरक्षा गाइड' : 'Usage & Crop Safety Guide'}
        </Text>
        
        <View className="gap-2.5">
          <Pressable
            onPress={() => setExpandedFaq(expandedFaq === 'dosage' ? null : 'dosage')}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-black text-slate-900">
                {isHindi ? '🧪 अनुशंसित मात्रा एवं छिड़काव विधि' : '🧪 Recommended Dosage & Method'}
              </Text>
              <Feather name={expandedFaq === 'dosage' ? 'chevron-up' : 'chevron-down'} size={18} color="#082018" />
            </View>
            {expandedFaq === 'dosage' ? (
              <Text className="mt-2.5 text-xs leading-5 text-slate-600 border-t border-slate-200 pt-2">
                {isHindi
                  ? '250 मिली से 500 मिली प्रति एकड़ की दर से 150-200 लीटर साफ पानी में घोलकर पत्तियों पर समान रूप से छिड़काव करें।'
                  : 'Mix 250ml to 500ml per acre with 150-200 liters of clean water for foliar spray. Ensure uniform coverage on healthy leaves.'}
              </Text>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => setExpandedFaq(expandedFaq === 'crops' ? null : 'crops')}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-black text-slate-900">
                {isHindi ? '🌿 उपयुक्त फसलें एवं अनुकूलता' : '🌿 Target Crops & Compatibility'}
              </Text>
              <Feather name={expandedFaq === 'crops' ? 'chevron-up' : 'chevron-down'} size={18} color="#082018" />
            </View>
            {expandedFaq === 'crops' ? (
              <Text className="mt-2.5 text-xs leading-5 text-slate-600 border-t border-slate-200 pt-2">
                {isHindi
                  ? 'धान, गेहूं, कपास, सोयाबीन, सब्जियों (टमाटर, मिर्च, बैंगन) और फलदार फसलों के लिए उपयुक्त। सभी सामान्य फसल पोषकों के साथ अनुकूल।'
                  : 'Suitable for Rice, Paddy, Cotton, Soybean, Vegetables (Tomato, Chilli, Brinjal) and Fruit Crops. Compatible with most standard crop nutrients.'}
              </Text>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => setExpandedFaq(expandedFaq === 'safety' ? null : 'safety')}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-black text-slate-900">
                {isHindi ? '⚠️ सुरक्षा एवं भंडारण सावधानियां' : '⚠️ Safety & Storage Precautions'}
              </Text>
              <Feather name={expandedFaq === 'safety' ? 'chevron-up' : 'chevron-down'} size={18} color="#082018" />
            </View>
            {expandedFaq === 'safety' ? (
              <Text className="mt-2.5 text-xs leading-5 text-slate-600 border-t border-slate-200 pt-2">
                {isHindi
                  ? 'धूप से दूर ठंडी व सूखी जगह पर रखें। बच्चों और पशुओं की पहुंच से दूर रखें। छिड़काव के समय दस्ताने और मास्क का उपयोग करें।'
                  : 'Store in a cool, dry place away from direct sunlight. Keep out of reach of children and domestic animals. Wear protective gloves during application.'}
              </Text>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* SECTION 4: Related Category Products Carousel */}
      <View className="mt-6">
        <View className="flex-row items-center justify-between mb-3 px-1">
          <Text className="text-lg font-black text-primary-900">
            {isHindi ? 'संबंधित फसल सुरक्षा दवाइयां' : 'Similar Category Products'}
          </Text>
          <Pressable onPress={() => router.push('/products')}>
            <Text className="text-xs font-bold text-emerald-700">
              {isHindi ? 'सभी देखें →' : 'View All →'}
            </Text>
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
            {isHindi ? 'कोई संबंधित उत्पाद नहीं मिला।' : 'No related category products found.'}
          </Text>
        )}
      </View>

      {/* SECTION 5: Best Seller Recommendations */}
      {bestSellerProducts.length > 0 ? (
        <View className="mt-6">
          <View className="flex-row items-center justify-between mb-3 px-1">
            <Text className="text-lg font-black text-primary-900">
              {isHindi ? 'सबसे ज्यादा बिकने वाली दवाइयां' : 'Best Seller Recommendations'}
            </Text>
            <Pressable onPress={() => router.push('/products')}>
              <Text className="text-xs font-bold text-emerald-700">
                {isHindi ? 'स्टोर देखें →' : 'Explore Store →'}
              </Text>
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
        <Text className="text-lg font-black text-primary-900">
          {isHindi ? `किसान समीक्षाएं (${product.reviews?.length || 0})` : `Customer Reviews (${product.reviews?.length || 0})`}
        </Text>
        
        <View className="mt-4 gap-3">
          {(product.reviews || []).length > 0 ? (
            (product.reviews || []).map((review) => (
              <View key={review.id} className="rounded-[22px] bg-primary-50 p-4">
                <ReviewStars rating={review.rating} />
                <Text className="mt-2 text-sm font-black text-primary-900">{review.userId?.name || (isHindi ? 'प्रमाणित किसान' : 'Verified Farmer')}</Text>
                <Text className="mt-1 text-sm leading-6 text-primary-900/70">{review.comment}</Text>
              </View>
            ))
          ) : (
            <Text className="text-xs font-semibold text-slate-500 py-2">
              {isHindi ? 'इस उत्पाद के लिए अभी कोई समीक्षा नहीं है। पहले समीक्षक बनें!' : 'No reviews yet for this product. Be the first farmer to review!'}
            </Text>
          )}
        </View>

        {user ? (
          <View className="mt-5 gap-3 pt-3 border-t border-slate-100">
            <Text className="text-xs font-black uppercase tracking-[1px] text-slate-900">
              {isHindi ? 'अपनी समीक्षा लिखें' : 'Write Your Review'}
            </Text>
            <ReviewStars rating={rating} onChange={setRating} />
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={isHindi ? 'अपनी फसल के परिणाम और अनुभव साझा करें...' : 'Share your crop results and experience...'}
              multiline
              className="rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3.5 text-sm text-primary-900"
              placeholderTextColor="#7a978b"
            />
            <Pressable
              onPress={async () => {
                await storefrontApi.submitReview({ productId: product.id, rating, comment });
                setComment('');
                Alert.alert(
                  isHindi ? 'समीक्षा सबमिट हो गई! ⭐' : 'Review Submitted! ⭐',
                  isHindi ? 'इस उत्पाद की समीक्षा के लिए धन्यवाद।' : 'Thank you for reviewing this product.',
                );
              }}
              style={{ backgroundColor: '#166534' }}
              className="rounded-full py-3.5 items-center justify-center active:scale-95 shadow-xs"
            >
              <Text className="text-xs font-black uppercase tracking-[1.5px] text-white">
                {isHindi ? 'समीक्षा सबमिट करें' : 'Submit Review'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* SECTION 7: Agri Expert Assistance Footer CTA Banner */}
      <View style={{ backgroundColor: '#0B281E' }} className="mt-6 mb-10 rounded-[28px] p-6 border border-emerald-800 shadow-md items-center">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 mb-3">
          <Feather name="message-circle" size={24} color="#34D399" />
        </View>
        <Text style={{ color: '#FFFFFF' }} className="text-base font-black text-center">
          {isHindi ? 'फसल में बीमारी या दवा की मात्रा के लिए सलाह चाहिए?' : 'Need Help With Crop Dosage or Disease Treatment?'}
        </Text>
        <Text style={{ color: '#FFFFFF' }} className="mt-1.5 text-xs font-bold text-center px-4">
          {isHindi
            ? 'मुफ्त फसल डॉक्टर परामर्श के लिए सीधे व्हाट्सऐप पर हमारी टीम से बात करें!'
            : 'Chat directly with our Agri Advisory Team on WhatsApp for free crop consultation!'}
        </Text>

        <Pressable
          onPress={() => Linking.openURL('https://wa.me/919301105706?text=Hello%20Vaniki%20Crop%20Team,%20I%20need%20help%20with%20crop%20care')}
          style={{ backgroundColor: '#25D366' }}
          className="mt-4 rounded-full px-6 py-3.5 flex-row items-center gap-2 active:scale-95 shadow-sm"
        >
          <Feather name="message-square" size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF' }} className="text-xs font-black uppercase tracking-[1px]">
            {isHindi ? 'व्हाट्सऐप पर बात करें' : 'Chat On WhatsApp'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
