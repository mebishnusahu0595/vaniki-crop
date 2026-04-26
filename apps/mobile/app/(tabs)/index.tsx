import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
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

export default function HomeScreen() {
  const { t } = useTranslation();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<(typeof bestSellerTabs)[number]>('Insecticides');
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);
  const testimonialListRef = useRef<any>(null);
  const homepageQuery = useQuery({
    queryKey: ['mobile-homepage', selectedStore?.id],
    queryFn: () => storefrontApi.homepage(selectedStore?.id),
  });
  const fallbackProductsQuery = useQuery({
    queryKey: ['mobile-home-fallback-products', selectedStore?.id],
    queryFn: () =>
      storefrontApi.products({
        page: 1,
        limit: 12,
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

  const testimonialCardWidth = Math.min(Math.max(width - 72, 220), 300);
  const testimonialSnapInterval = testimonialCardWidth + 12;

  const saleProducts = useMemo(() => {
    const directSaleProducts = homepageQuery.data?.saleProducts || [];
    if (directSaleProducts.length) return directSaleProducts;

    return (fallbackProductsQuery.data?.data || []).slice(0, 10);
  }, [homepageQuery.data?.saleProducts, fallbackProductsQuery.data?.data]);

  const bestSellerProducts = useMemo(() => {
    const directBestSellers = homepageQuery.data?.bestSellers || [];
    if (directBestSellers.length) return directBestSellers;

    return fallbackProductsQuery.data?.data || [];
  }, [homepageQuery.data?.bestSellers, fallbackProductsQuery.data?.data]);

  const tabProducts = useMemo(() => {
    const filtered = bestSellerProducts.filter((product) =>
      (product.category?.name || '').toLowerCase().includes(activeTab.toLowerCase().replace('icides', 'icide')),
    );

    return filtered.length ? filtered : bestSellerProducts.slice(0, 10);
  }, [activeTab, bestSellerProducts]);
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
        <View className="pt-1">
          <Text className="text-3xl font-black text-primary-900">{t('mobile.home.title')}</Text>
        </View>

        {homepageQuery.isLoading ? (
          <View className="rounded-[30px] bg-primary-100 py-20">
            <ActivityIndicator color="#2D6A4F" />
          </View>
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
            <View style={{ height: 160, width: '100%' }}>
              <FlashList
                horizontal
                data={homeCategories}
                showsHorizontalScrollIndicator={false}
                estimatedItemSize={100}
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
            <View className="rounded-[24px] bg-white py-8">
              <ActivityIndicator color="#2D6A4F" />
            </View>
          ) : (
            <View className="rounded-[24px] bg-white px-4 py-5">
              <Text className="text-sm font-semibold text-primary-900/65">Categories will appear shortly.</Text>
            </View>
          )}
        </View>

        <View>
          <SectionHeader title={t('mobile.home.bestDeals')} />
          {saleProducts.length ? (
            <View style={{ height: 340, width: '100%' }}>
              <FlashList
                horizontal
                data={saleProducts}
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
          ) : homepageQuery.isLoading || fallbackProductsQuery.isLoading ? (
            <View className="rounded-[24px] bg-white py-8">
              <ActivityIndicator color="#2D6A4F" />
            </View>
          ) : (
            <View className="rounded-[24px] bg-white px-4 py-5">
              <Text className="text-sm font-semibold text-primary-900/65">Products will appear shortly.</Text>
            </View>
          )}
        </View>

        <View>
          <SectionHeader title={t('mobile.home.bestSellers')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-1 mb-4"
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            <View className="flex-row gap-2">
              {bestSellerTabs.map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`rounded-full border px-4 py-2.5 ${
                    activeTab === tab ? 'border-primary-500 bg-primary-500' : 'border-primary-200 bg-white'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-black uppercase tracking-[1.2px] ${
                      activeTab === tab ? 'text-white' : 'text-primary-900/65'
                    }`}
                  >
                    {tab}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          {tabProducts.length ? (
            <View style={{ height: 340, width: '100%' }}>
              <FlashList
                data={tabProducts}
                horizontal
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
          ) : homepageQuery.isLoading || fallbackProductsQuery.isLoading ? (
            <View className="rounded-[24px] bg-white py-8">
              <ActivityIndicator color="#2D6A4F" />
            </View>
          ) : (
            <View className="rounded-[24px] bg-white px-4 py-5">
              <Text className="text-sm font-semibold text-primary-900/65">No products found for this tab yet.</Text>
            </View>
          )}
        </View>

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
            <View className="rounded-[24px] bg-white py-8">
              <ActivityIndicator color="#2D6A4F" />
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
