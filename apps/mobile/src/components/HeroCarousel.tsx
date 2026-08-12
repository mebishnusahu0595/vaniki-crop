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
              title: 'Stronger Crops, Greater Yields.',
              subtitle: 'Premium crop care solutions for every stage of farming',
              ctaText: t('mobile.home.viewAll'),
              ctaLink: '/products',
              image: { url: fallbackImage },
              linkedProducts: [],
            },
          ],
    [banners, t],
  );

  const cardWidth = width - 32;

  return (
    <View className="gap-2">
      <FlashList
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={items}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
          setActiveIndex(nextIndex);
        }}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth, height: 185 }} className="relative overflow-hidden rounded-2xl bg-primary-900">
            <Image
              source={{ uri: item.image.mobileUrl || item.image.url || fallbackImage }}
              style={{ width: '100%', height: '100%', position: 'absolute' }}
              contentFit="cover"
            />
            <View className="absolute inset-0 bg-black/60 p-5 justify-between">
              <View className="max-w-[88%] gap-1.5">
                <Text className="text-[10px] font-black uppercase tracking-[2px] text-emerald-400">
                  WHAT FARMERS SAY
                </Text>
                <Text className="text-xl font-black leading-6 text-white shadow-sm" numberOfLines={2}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text className="text-xs font-semibold leading-5 text-white/90 shadow-sm" numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={() => router.push((item.ctaLink as '/products') || '/products')}
                className="self-start rounded-xl bg-white px-4 py-2.5 shadow-sm active:scale-95"
              >
                <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-primary-900">
                  {item.ctaText || 'SHOP NOW'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      {items.length > 1 ? (
        <View className="flex-row justify-center gap-1.5 mt-1">
          {items.map((item, index) => (
            <View
              key={item.id}
              className={`h-1.5 rounded-full ${index === activeIndex ? 'w-6 bg-primary-500' : 'w-1.5 bg-primary-200'}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});
