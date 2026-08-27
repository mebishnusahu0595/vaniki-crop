import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { HomepageBanner } from '../types/storefront';
import { getAppLanguage } from '../i18n';
import { resolveMediaUrl } from '../utils/media';

interface HeroCarouselProps {
  banners: HomepageBanner[];
}

const fallbackImage =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80';

export const HeroCarousel = memo(function HeroCarousel({ banners }: HeroCarouselProps) {
  const { t } = useTranslation();
  const isHindi = getAppLanguage() === 'hi';
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { width: windowWidth } = useWindowDimensions();

  // Full-bleed width across entire screen width
  const screenWidth = windowWidth || Dimensions.get('window').width;
  const bannerHeight = Math.min(Math.max(screenWidth * 0.65, 230), 270);

  const items = useMemo(() => {
    if (banners && banners.length > 0) {
      return banners;
    }
    return [
      {
        id: 'fallback-banner-1',
        title: isHindi ? 'मजबूत फसलें, अधिक पैदावार।' : 'Stronger Crops, Greater Yields.',
        subtitle: isHindi
          ? 'खेती के हर चरण के लिए प्रीमियम फसल सुरक्षा व पौध पोषण'
          : 'Premium crop care solutions for every stage of farming',
        ctaText: isHindi ? 'अभी खरीदें' : 'SHOP NOW',
        ctaLink: '/products',
        image: { url: fallbackImage },
        linkedProducts: [],
      },
    ];
  }, [banners, isHindi]);

  // Auto-scroll loop for multiple banners
  useEffect(() => {
    if (items.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % items.length;
        scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
        return next;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [items.length, screenWidth]);

  return (
    <View className="-mx-4 relative overflow-hidden" style={{ width: screenWidth }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
          setActiveIndex(nextIndex);
        }}
        style={{ width: screenWidth }}
      >
        {items.map((item) => {
          const rawUrl = item.image?.mobileUrl || item.image?.url || fallbackImage;
          const imageUrl = resolveMediaUrl(rawUrl, (item.image as any)?.publicId);

          return (
            <View
              key={item.id}
              style={{ width: screenWidth, height: bannerHeight }}
              className="relative overflow-hidden bg-[#071F17]"
            >
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: '100%', position: 'absolute' }}
                contentFit="cover"
                transition={300}
              />

              {/* High Contrast Gradient Tint Overlay */}
              <View
                style={{ backgroundColor: 'rgba(0,0,0,0.52)' }}
                className="absolute inset-0 p-6 justify-between"
              >
                <View className="max-w-[90%] gap-2 pt-1">
                  <View className="self-start bg-emerald-500/25 border border-emerald-400/40 px-2.5 py-0.5 rounded-full">
                    <Text className="text-[10px] font-black uppercase tracking-[2px] text-emerald-300">
                      {isHindi ? 'विशेष ऑफर • VANIKI CROP' : 'SPECIAL OFFER • VANIKI CROP'}
                    </Text>
                  </View>

                  <Text
                    className="text-2xl font-black leading-tight text-white shadow-md"
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  {item.subtitle ? (
                    <Text
                      className="text-xs font-semibold leading-5 text-white/90 shadow-sm"
                      numberOfLines={2}
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => router.push((item.ctaLink as '/products') || '/products')}
                  className="self-start flex-row items-center gap-2 rounded-2xl bg-white px-5 py-3 shadow-lg active:scale-95"
                >
                  <Text className="text-xs font-black uppercase tracking-[1.5px] text-[#071F17]">
                    {item.ctaText || (isHindi ? 'अभी खरीदें' : 'SHOP NOW')}
                  </Text>
                  <Feather name="arrow-right" size={14} color="#071F17" />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Pagination Dot Indicators */}
      {items.length > 1 ? (
        <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5 z-20">
          {items.map((item, index) => (
            <View
              key={item.id}
              className={`h-1.5 rounded-full ${
                index === activeIndex ? 'w-6 bg-emerald-400 shadow-sm' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});
