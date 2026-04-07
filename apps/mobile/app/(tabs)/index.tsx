import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { HeroCarousel } from '../../src/components/HeroCarousel';
import { CategoryCard } from '../../src/components/CategoryCard';
import { ProductCard } from '../../src/components/ProductCard';
import { ReviewStars } from '../../src/components/ReviewStars';
import { SectionHeader } from '../../src/components/SectionHeader';
import { storefrontApi } from '../../src/lib/api';
import { useStoreStore } from '../../src/store/useStoreStore';

const bestSellerTabs = ['Insecticides', 'Herbicides', 'Fungicides'] as const;

export default function HomeScreen() {
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const [activeTab, setActiveTab] = useState<(typeof bestSellerTabs)[number]>('Insecticides');
  const homepageQuery = useQuery({
    queryKey: ['mobile-homepage', selectedStore?.id],
    queryFn: () => storefrontApi.homepage(selectedStore?.id),
  });

  const tabProducts = useMemo(
    () =>
      (homepageQuery.data?.bestSellers || []).filter((product) =>
        (product.category?.name || '').toLowerCase().includes(activeTab.toLowerCase().replace('icides', 'icide')),
      ),
    [activeTab, homepageQuery.data?.bestSellers],
  );

  return (
    <Screen>
      <View className="gap-7">
        <View className="pt-1">
          <Text className="text-[11px] font-black uppercase tracking-[2px] text-primary-400">Vaniki Crop</Text>
          <Text className="mt-2 text-3xl font-black text-primary-900">Crop care made local, fast, and reliable.</Text>
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
            title="Categories"
            action={
              <Pressable onPress={() => router.push('/(tabs)/categories')}>
                <Text className="text-xs font-black uppercase tracking-[2px] text-primary-500">View All</Text>
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
          <SectionHeader title="Best Deals" />
          <FlashList
            data={homepageQuery.data?.saleProducts || []}
            numColumns={2}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View className="flex-1 px-1.5">
                <ProductCard product={item} />
              </View>
            )}
          />
        </View>

        <View>
          <SectionHeader title="Best Sellers" />
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
              <View className="mr-3 w-[220px]">
                <ProductCard product={item} />
              </View>
            )}
          />
        </View>

        <View className="pb-4">
          <SectionHeader title="What Farmers Say" />
          <FlashList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={homepageQuery.data?.testimonials || []}
            renderItem={({ item }) => (
              <View className="mr-3 w-[280px] rounded-[28px] border border-primary-100 bg-white p-5">
                <ReviewStars rating={item.rating} />
                <Text className="mt-4 text-sm leading-6 text-primary-900/70">{item.message}</Text>
                <Text className="mt-5 text-sm font-black text-primary-900">{item.name}</Text>
                <Text className="text-xs font-semibold text-primary-500">{item.designation}</Text>
              </View>
            )}
          />
        </View>
      </View>
    </Screen>
  );
}
