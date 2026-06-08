import { memo, useMemo, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { HomepageBanner } from '../types/storefront';

interface HeroCarouselProps {
  banners: HomepageBanner[];
}

const fallbackImage =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80';

export const HeroCarousel = memo(function HeroCarousel({ banners }: HeroCarouselProps) {
  const { t } = useTranslation();
  const listRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { width } = useWindowDimensions();

  const items = useMemo(
    () =>
      banners.length
        ? banners
        : [
            {
              id: 'fallback-banner',
              title: t('mobile.home.bestDeals'),
              subtitle: t('mobile.home.title'),
              ctaText: t('mobile.home.viewAll'),
              ctaLink: '/products',
              image: { url: fallbackImage },
              linkedProducts: [],
            },
          ],
    [banners],
  );

  return (
    <View className="gap-3">
      <FlashList
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={items}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
          setActiveIndex(nextIndex);
        }}
        renderItem={({ item }) => (
          <View style={{ width: width - 32 }} className="overflow-hidden rounded-[30px] bg-primary-800">
            <Image
              source={{ uri: item.image.mobileUrl || item.image.url || fallbackImage }}
              style={{ width: '100%', height: 250 }}
              contentFit="cover"
            />
            <View className="absolute inset-0 bg-primary-900/45 px-5 py-5">
              <View className="mt-auto rounded-[28px] bg-primary-500/80 p-5">
                <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-100">
                  {t('mobile.home.whatFarmersSay')}
                </Text>
                <Text className="mt-3 text-3xl font-black leading-9 text-white">{item.title}</Text>
                <Text className="mt-2 text-sm leading-6 text-white/80">{item.subtitle}</Text>
                <Pressable
                  onPress={() => router.push((item.ctaLink as '/products') || '/products')}
                  className="mt-5 self-start rounded-full bg-white px-5 py-3"
                >
                  <Text className="text-xs font-black uppercase tracking-[2px] text-primary-900">
                    {item.ctaText || t('mobile.home.viewAll')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
      <View className="flex-row justify-center gap-2">
        {items.map((item, index) => (
          <View
            key={item.id}
            className={`h-2 rounded-full ${index === activeIndex ? 'w-8 bg-primary-500' : 'w-2 bg-primary-200'}`}
          />
        ))}
      </View>
    </View>
  );
});
