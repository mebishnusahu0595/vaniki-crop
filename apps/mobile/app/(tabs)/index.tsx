import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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

const bestSellerTabs = ['Insecticides', 'Herbicides', 'Fungicides'] as const;

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

  const testimonialCardWidth = Math.min(Math.max(width - 72, 220), 300);
  const testimonialSnapInterval = testimonialCardWidth + 12;

  const tabProducts = useMemo(
    () =>
      (homepageQuery.data?.bestSellers || []).filter((product) =>
        (product.category?.name || '').toLowerCase().includes(activeTab.toLowerCase().replace('icides', 'icide')),
      ),
    [activeTab, homepageQuery.data?.bestSellers],
  );

  useEffect(() => {
    const total = homepageQuery.data?.testimonials?.length || 0;
    setActiveTestimonialIndex(0);
    if (!total) return;

    testimonialListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [homepageQuery.data?.testimonials?.length]);

  useEffect(() => {
    const total = homepageQuery.data?.testimonials?.length || 0;
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
  }, [homepageQuery.data?.testimonials?.length, testimonialSnapInterval]);

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
          <FlashList
            horizontal
            data={homepageQuery.data?.featuredCategories || []}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <CategoryCard
                category={item}
                onPress={() => router.push({ pathname: '/products', params: { category: item.slug } })}
              />
            )}
          />
        </View>

        <View>
          <SectionHeader title={t('mobile.home.bestDeals')} />
          <FlashList
            horizontal
            data={homepageQuery.data?.saleProducts || []}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View className="mr-3 w-[184px]">
                <ProductCard product={item} compact />
              </View>
            )}
          />
        </View>

        <View>
          <SectionHeader title={t('mobile.home.bestSellers')} />
          <View className="mb-4 flex-row rounded-full bg-primary-50 p-1">
            {bestSellerTabs.map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 rounded-full px-3 py-3 ${activeTab === tab ? 'bg-white' : ''}`}
              >
                <Text
                  className={`text-center text-[10px] font-black uppercase tracking-[1px] ${
                    activeTab === tab ? 'text-primary-900' : 'text-primary-900/45'
                  }`}
                >
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>
          <FlashList
            data={tabProducts}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View className="mr-3 w-[184px]">
                <ProductCard product={item} compact />
              </View>
            )}
          />
        </View>

        <View className="pb-4">
          <SectionHeader title={t('mobile.home.whatFarmersSay')} />
          <FlashList
            ref={testimonialListRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={homepageQuery.data?.testimonials || []}
            snapToInterval={testimonialSnapInterval}
            decelerationRate="fast"
            onMomentumScrollEnd={(event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const nextIndex = Math.round(offsetX / testimonialSnapInterval);
              setActiveTestimonialIndex(nextIndex);
            }}
            renderItem={({ item }) => (
              <View
                style={{ width: testimonialCardWidth }}
                className="mr-3 rounded-[24px] border border-primary-100 bg-white p-4"
              >
                <ReviewStars rating={item.rating} />
                <Text className="mt-4 text-sm leading-6 text-primary-900/70">{item.message}</Text>
                <Text className="mt-5 text-sm font-black text-primary-900">{item.name}</Text>
                <Text className="text-xs font-semibold text-primary-500">{item.designation}</Text>
              </View>
            )}
          />
          {(homepageQuery.data?.testimonials || []).length > 1 ? (
            <View className="mt-3 flex-row justify-center gap-2">
              {(homepageQuery.data?.testimonials || []).map((item, index) => (
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
