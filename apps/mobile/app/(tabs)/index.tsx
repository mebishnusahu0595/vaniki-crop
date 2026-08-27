import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { HeroCarousel } from '../../src/components/HeroCarousel';
import { CategoryCard } from '../../src/components/CategoryCard';
import { ProductCard } from '../../src/components/ProductCard';
import { ReviewStars } from '../../src/components/ReviewStars';
import { SectionHeader } from '../../src/components/SectionHeader';
import { storefrontApi } from '../../src/lib/api';
import { useStoreStore } from '../../src/store/useStoreStore';
import type { Testimonial } from '../../src/types/storefront';
import { resolveMediaUrl } from '../../src/utils/media';
import { Skeleton } from '../../src/components/Skeleton';
import { Feather } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { useServiceModeStore } from '../../src/store/useServiceModeStore';

const bestSellerTabs = ['Insecticides', 'Herbicides', 'Fungicides'] as const;
const fallbackTestimonials: Testimonial[] = [
  {
    id: 'fallback-1',
    name: 'Ramesh Patel',
    designation: 'Soybean farmer',
    message: 'Products are genuine and local store delivery saves time during spray season.',
    rating: 5,
  },
  {
    id: 'fallback-2',
    name: 'Suresh Verma',
    designation: 'Vegetable grower',
    message: 'I can compare crop care products and reorder quickly when stock is available nearby.',
    rating: 5,
  },
];

function VerticalProductSection({
  title,
  subtitle,
  badgeText,
  products,
  fallbackProducts = [],
  onViewAll,
  isLoading,
}: {
  title: string;
  subtitle?: string;
  badgeText?: string;
  products: any[];
  fallbackProducts?: any[];
  onViewAll: () => void;
  isLoading?: boolean;
}) {
  const itemsMap = new Map();
  products.forEach((p) => p?.id && itemsMap.set(p.id, p));
  fallbackProducts.forEach((p) => {
    if (itemsMap.size < 4 && p?.id && !itemsMap.has(p.id)) {
      itemsMap.set(p.id, p);
    }
  });

  const displayItems = Array.from(itemsMap.values()).slice(0, 4);

  return (
    <View className="mb-8">
      <View className="mb-3">
        {badgeText ? (
          <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-emerald-600 mb-0.5">
            {badgeText}
          </Text>
        ) : null}
        <Text className="text-xl font-black text-primary-900 leading-6">{title}</Text>
        {subtitle ? (
          <Text className="text-xs font-semibold text-primary-900/60 mt-0.5">{subtitle}</Text>
        ) : null}
      </View>

      {isLoading ? (
        <View className="flex-row flex-wrap justify-between">
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ width: '48%' }} className="mb-3">
              <View className="p-3 rounded-[24px] border border-primary-100 bg-white gap-2">
                <Skeleton height={130} borderRadius={16} className="w-full" />
                <Skeleton width={110} height={14} borderRadius={4} className="mt-1" />
                <Skeleton width={70} height={10} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      ) : displayItems.length ? (
        <>
          <View className="flex-row flex-wrap justify-between">
            {displayItems.map((product) => (
              <View key={product.id} style={{ width: '48%' }} className="mb-3">
                <ProductCard product={product} compact />
              </View>
            ))}
          </View>
          <Pressable
            onPress={onViewAll}
            className="mt-1 rounded-2xl border border-primary-200 bg-white py-3.5 items-center justify-center active:bg-primary-50 shadow-xs"
          >
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-black uppercase tracking-[1.5px] text-primary-900">
                View All {title}
              </Text>
              <Feather name="arrow-right" size={14} color="#082018" />
            </View>
          </Pressable>
        </>
      ) : (
        <View className="rounded-2xl bg-white p-4 border border-primary-100 items-center">
          <Text className="text-xs font-semibold text-primary-900/60">No products available in this section.</Text>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const { settings } = useSettingsStore();
  const setSettings = useSettingsStore((state) => state.setSettings);
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<(typeof bestSellerTabs)[number]>('Insecticides');
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(false);
  const testimonialListRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const noticeOpacityAnim = useRef(new Animated.Value(1)).current;

  const dismissNotice = () => {
    Animated.timing(noticeOpacityAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setIsNoticeDismissed(true);
    });
  };

  // 10-second auto-dismiss timer for the top delivery notice banner
  useEffect(() => {
    const timer = setTimeout(() => {
      dismissNotice();
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.025,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);
  const homepageQuery = useQuery({
    queryKey: ['mobile-homepage', selectedStore?.id],
    queryFn: () => storefrontApi.homepage(selectedStore?.id),
  });
  const fallbackProductsQuery = useQuery({
    queryKey: ['mobile-home-fallback-products', selectedStore?.id],
    queryFn: () =>
      storefrontApi.products({
        page: 1,
        limit: 40,
        sort: 'popular',
        storeId: selectedStore?.id,
      }),
    staleTime: 60 * 1000,
  });
  const categoriesFallbackQuery = useQuery({
    queryKey: ['mobile-home-categories-fallback'],
    queryFn: storefrontApi.categories,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (homepageQuery.data?.siteSettings) {
      setSettings(homepageQuery.data.siteSettings);
    }
  }, [homepageQuery.data?.siteSettings, setSettings]);

  const testimonialCardWidth = Math.min(Math.max(width - 72, 220), 300);
  const testimonialSnapInterval = testimonialCardWidth + 12;

  const allProducts = useMemo(() => {
    const fromHomepage = [
      ...(homepageQuery.data?.bestSellers || []),
      ...(homepageQuery.data?.saleProducts || []),
    ];
    const fromFallback = fallbackProductsQuery.data?.data || [];
    const map = new Map();
    [...fromHomepage, ...fromFallback].forEach((p) => {
      if (p?.id && !map.has(p.id)) map.set(p.id, p);
    });
    return Array.from(map.values());
  }, [homepageQuery.data, fallbackProductsQuery.data]);

  const bestSellerProducts = useMemo(() => {
    const directBestSellers = homepageQuery.data?.bestSellers || [];
    if (directBestSellers.length) return directBestSellers;
    return allProducts;
  }, [homepageQuery.data?.bestSellers, allProducts]);

  const saleProducts = useMemo(() => {
    const directSaleProducts = homepageQuery.data?.saleProducts || [];
    if (directSaleProducts.length) return directSaleProducts;
    return allProducts.filter((p) => (p.salePrice || p.discountPercent || 0) > 0);
  }, [homepageQuery.data?.saleProducts, allProducts]);

  const insecticidesProducts = useMemo(() => {
    const match = allProducts.filter((p) =>
      (p.category?.name || '').toLowerCase().includes('insect') ||
      (p.category?.slug || '').toLowerCase().includes('insect'),
    );
    return match.length ? match : allProducts.slice(4, 12);
  }, [allProducts]);

  const herbicidesProducts = useMemo(() => {
    const match = allProducts.filter((p) =>
      (p.category?.name || '').toLowerCase().includes('herb') ||
      (p.category?.name || '').toLowerCase().includes('weed') ||
      (p.category?.slug || '').toLowerCase().includes('herb'),
    );
    return match.length ? match : allProducts.slice(8, 16);
  }, [allProducts]);

  const fungicidesProducts = useMemo(() => {
    const match = allProducts.filter((p) =>
      (p.category?.name || '').toLowerCase().includes('fung') ||
      (p.category?.slug || '').toLowerCase().includes('fung'),
    );
    return match.length ? match : allProducts.slice(12, 20);
  }, [allProducts]);

  const bioProducts = useMemo(() => {
    const match = allProducts.filter((p) =>
      (p.category?.name || '').toLowerCase().includes('bio') ||
      (p.category?.name || '').toLowerCase().includes('growth') ||
      (p.category?.name || '').toLowerCase().includes('tonic') ||
      (p.category?.slug || '').toLowerCase().includes('bio'),
    );
    return match.length ? match : allProducts.slice(16, 24);
  }, [allProducts]);

  const topRatedProducts = useMemo(() => {
    return [...allProducts].sort((a, b) => (b.rating || 5) - (a.rating || 5)).slice(0, 10);
  }, [allProducts]);
  const homeCategories = useMemo(() => {
    const featured = homepageQuery.data?.featuredCategories || [];
    if (featured.length) return featured;
    return (categoriesFallbackQuery.data || []).slice(0, 8);
  }, [categoriesFallbackQuery.data, homepageQuery.data?.featuredCategories]);
  const testimonials = useMemo(() => {
    const items = homepageQuery.data?.testimonials || [];
    if (items.length) return items;
    if (homepageQuery.isLoading) return [];
    return fallbackTestimonials;
  }, [homepageQuery.data?.testimonials, homepageQuery.isLoading]);

  useEffect(() => {
    const total = testimonials.length;
    setActiveTestimonialIndex(0);
    if (!total) return;

    testimonialListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [testimonials.length]);

  useEffect(() => {
    const total = testimonials.length;
    if (total <= 1) return undefined;

    const timer = setInterval(() => {
      setActiveTestimonialIndex((current) => {
        const next = (current + 1) % total;
        testimonialListRef.current?.scrollToOffset({
          offset: next * testimonialSnapInterval,
          animated: true,
        });
        return next;
      });
    }, 3500);

    return () => clearInterval(timer);
  }, [testimonials.length, testimonialSnapInterval]);

  return (
    <Screen>
      <View className="gap-7">
        {!isNoticeDismissed && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }], opacity: noticeOpacityAnim }}>
            <View className="relative overflow-hidden rounded-2xl border border-emerald-500/40 shadow-md">
              <Image
                source={require('../../assets/dark_leaf_bg.png')}
                style={{ width: '100%', height: '100%', position: 'absolute' }}
                contentFit="cover"
              />
              <View className="bg-black/40 p-4 flex-row items-center justify-between">
                <View className="flex-1 pr-3 gap-2.5">
                  <View className="flex-row items-center gap-2.5">
                    <View className="h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/25 border border-emerald-400/40">
                      <Feather name="truck" size={14} color="#52B788" />
                    </View>
                    <Text className="text-xs font-black uppercase tracking-wide text-white">
                      {t('mobile.topNotice.freeDelivery', { amount: (settings?.freeDeliveryThreshold || 2000).toLocaleString('en-IN') })}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2.5">
                    <View className="h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/25 border border-emerald-400/40">
                      <Feather name="phone" size={13} color="#52B788" />
                    </View>
                    <Text className="text-xs font-black uppercase tracking-wide text-white">
                      {t('mobile.topNotice.call')}: +91 9406160185
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={dismissNotice}
                  className="h-9 w-9 items-center justify-center rounded-full bg-rose-600 active:bg-rose-700 shadow-lg border-2 border-white"
                  hitSlop={10}
                >
                  <Feather name="x" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}

        {homepageQuery.isLoading ? (
          <Skeleton height={250} borderRadius={0} className="-mx-4" />
        ) : (
          <HeroCarousel banners={homepageQuery.data?.banners || []} />
        )}

        <View>
          <SectionHeader
            title={t('mobile.home.categories')}
            action={
              <Pressable onPress={() => router.push('/(tabs)/categories')}>
                <Text className="text-xs font-black uppercase tracking-[2px] text-primary-500">
                  {t('mobile.home.viewAll')}
                </Text>
              </Pressable>
            }
          />
          {homeCategories.length ? (
            <View style={{ height: 120, width: '100%' }}>
              <FlashList
                horizontal
                data={homeCategories}
                showsHorizontalScrollIndicator={false}
                estimatedItemSize={92}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <CategoryCard
                    category={item}
                    onPress={() => router.push({ pathname: '/products', params: { category: item.slug } })}
                  />
                )}
              />
            </View>
          ) : homepageQuery.isLoading || categoriesFallbackQuery.isLoading ? (
            <View className="flex-row gap-4 py-2">
              {[1, 2, 3, 4].map((i) => (
                <View key={i} className="items-center mr-1">
                  <Skeleton width={96} height={96} borderRadius={24} />
                  <Skeleton width={70} height={10} borderRadius={4} className="mt-3" />
                </View>
              ))}
            </View>
          ) : (
            <View className="rounded-[24px] bg-white px-4 py-5">
              <Text className="text-sm font-semibold text-primary-900/65">Categories will appear shortly.</Text>
            </View>
          )}
        </View>

        {/* Section 1: Best Sellers */}
        <VerticalProductSection
          badgeText={t('mobile.home.popularChoice')}
          title={t('mobile.home.bestSellers')}
          subtitle={t('mobile.home.bestSellersSub')}
          products={bestSellerProducts}
          fallbackProducts={allProducts}
          isLoading={homepageQuery.isLoading || fallbackProductsQuery.isLoading}
          onViewAll={() => router.push({ pathname: '/products', params: { sort: 'popular' } })}
        />

        {/* Section 2: Best Deals & Offers */}
        <VerticalProductSection
          badgeText={t('mobile.home.heavyDiscount')}
          title={t('mobile.home.bestDeals')}
          subtitle={t('mobile.home.bestDealsSub')}
          products={saleProducts}
          fallbackProducts={allProducts}
          isLoading={homepageQuery.isLoading || fallbackProductsQuery.isLoading}
          onViewAll={() => router.push({ pathname: '/products', params: { onSale: 'true' } })}
        />

        {/* Section 3: Insecticides & Pest Control */}
        <VerticalProductSection
          badgeText={t('mobile.home.pestProtection')}
          title={t('mobile.home.insecticides')}
          subtitle={t('mobile.home.insecticidesSub')}
          products={insecticidesProducts}
          fallbackProducts={allProducts}
          isLoading={homepageQuery.isLoading || fallbackProductsQuery.isLoading}
          onViewAll={() => router.push({ pathname: '/products', params: { category: 'insecticides' } })}
        />

        {/* Section 4: Herbicides & Weedicides */}
        <VerticalProductSection
          badgeText={t('mobile.home.weedControl')}
          title={t('mobile.home.herbicides')}
          subtitle={t('mobile.home.herbicidesSub')}
          products={herbicidesProducts}
          fallbackProducts={allProducts}
          isLoading={homepageQuery.isLoading || fallbackProductsQuery.isLoading}
          onViewAll={() => router.push({ pathname: '/products', params: { category: 'herbicides' } })}
        />

        {/* Section 5: Fungicides & Disease Care */}
        <VerticalProductSection
          badgeText={t('mobile.home.diseaseCare')}
          title={t('mobile.home.fungicides')}
          subtitle={t('mobile.home.fungicidesSub')}
          products={fungicidesProducts}
          fallbackProducts={allProducts}
          isLoading={homepageQuery.isLoading || fallbackProductsQuery.isLoading}
          onViewAll={() => router.push({ pathname: '/products', params: { category: 'fungicides' } })}
        />

        {/* Section 6: Bio & Plant Growth Promoters */}
        <VerticalProductSection
          badgeText={t('mobile.home.organicGrowth')}
          title={t('mobile.home.bioPesticides')}
          subtitle={t('mobile.home.bioPesticidesSub')}
          products={bioProducts}
          fallbackProducts={allProducts}
          isLoading={homepageQuery.isLoading || fallbackProductsQuery.isLoading}
          onViewAll={() => router.push({ pathname: '/products', params: { category: 'bio-pesticides' } })}
        />

        {/* Section 7: Farmer Top Rated */}
        <VerticalProductSection
          badgeText={t('mobile.home.highlyRated')}
          title={t('mobile.home.topRated')}
          subtitle={t('mobile.home.topRatedSub')}
          products={topRatedProducts}
          fallbackProducts={allProducts}
          isLoading={homepageQuery.isLoading || fallbackProductsQuery.isLoading}
          onViewAll={() => router.push({ pathname: '/products', params: { sort: 'rating' } })}
        />

        <View className="pb-4">
          <SectionHeader title={t('mobile.home.whatFarmersSay')} />
          {testimonials.length ? (
            <View style={{ height: 260, width: '100%' }}>
              <FlashList
                ref={testimonialListRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                data={testimonials}
                snapToInterval={testimonialSnapInterval}
                decelerationRate="fast"
                keyExtractor={(item) => item.id}
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const nextIndex = Math.round(offsetX / testimonialSnapInterval);
                  setActiveTestimonialIndex(Math.min(nextIndex, testimonials.length - 1));
                }}
                renderItem={({ item }) => {
                  const avatarUrl = resolveMediaUrl(item.avatar?.url, item.avatar?.publicId);

                  return (
                    <View
                      style={{ width: testimonialCardWidth }}
                      className="mr-3 rounded-[24px] border border-primary-100 bg-white p-4"
                    >
                      <View className="flex-row items-center gap-3">
                        {avatarUrl ? (
                          <Image
                            source={{ uri: avatarUrl }}
                            style={{ width: 44, height: 44, borderRadius: 22 }}
                            contentFit="cover"
                          />
                        ) : (
                          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50">
                            <Text className="text-xs font-black uppercase text-primary-500">
                              {item.name.slice(0, 2)}
                            </Text>
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-sm font-black text-primary-900">{item.name}</Text>
                          {item.designation ? (
                            <Text className="text-xs font-semibold text-primary-500">{item.designation}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View className="mt-4">
                        <ReviewStars rating={item.rating} />
                      </View>
                      <Text className="mt-4 text-sm leading-6 text-primary-900/70" numberOfLines={5}>
                        {item.message}
                      </Text>
                    </View>
                  );
                }}
              />
            </View>
          ) : (
            <View className="rounded-[24px] border border-primary-100 bg-white p-4 gap-4 mr-3" style={{ width: testimonialCardWidth }}>
              <View className="flex-row items-center gap-3">
                <Skeleton width={44} height={44} borderRadius={22} />
                <View className="gap-2">
                  <Skeleton width={100} height={12} borderRadius={4} />
                  <Skeleton width={75} height={10} borderRadius={4} />
                </View>
              </View>
              <Skeleton width={80} height={12} borderRadius={4} className="mt-2" />
              <View className="gap-1.5 mt-2">
                <Skeleton width="100%" height={10} borderRadius={4} />
                <Skeleton width="90%" height={10} borderRadius={4} />
                <Skeleton width="60%" height={10} borderRadius={4} />
              </View>
            </View>
          )}
          {testimonials.length > 1 ? (
            <View className="mt-3 flex-row justify-center gap-2">
              {testimonials.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    testimonialListRef.current?.scrollToOffset({
                      offset: index * testimonialSnapInterval,
                      animated: true,
                    });
                    setActiveTestimonialIndex(index);
                  }}
                  className={`h-2 rounded-full ${activeTestimonialIndex === index ? 'w-7 bg-primary-500' : 'w-2 bg-primary-200'}`}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
