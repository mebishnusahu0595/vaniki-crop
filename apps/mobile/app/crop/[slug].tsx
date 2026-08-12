import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, router as staticRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { storefrontApi } from '../../src/lib/api';
import { resolveMediaUrl } from '../../src/utils/media';
import type { Crop, Product } from '../../src/types/storefront';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatPrice(variants: Product['variants']) {
  if (!variants?.length) return null;
  const prices = variants.map((v) => v.price ?? v.mrp);
  const min = Math.min(...prices);
  return `₹${min}`;
}

function getDiscount(v: Product['variants'][number]) {
  if (!v.mrp || !v.price) return 0;
  return Math.round(((v.mrp - v.price) / v.mrp) * 100);
}

export default function CropDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  const [crop, setCrop] = useState<Crop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await storefrontApi.cropDetail(slug);
        setCrop(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load crop details');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F0FFF4', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2D6A4F" size="large" />
        <Text style={{ marginTop: 12, color: '#52B788', fontWeight: '600', fontSize: 14 }}>
          Loading crop info...
        </Text>
      </View>
    );
  }

  if (error || !crop) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F0FFF4', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Feather name="alert-circle" size={40} color="#E53E3E" />
        <Text style={{ marginTop: 12, color: '#E53E3E', fontWeight: '700', textAlign: 'center', fontSize: 16 }}>
          {error || 'Crop not found'}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 16, backgroundColor: '#2D6A4F', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 10 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>← Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const heroUrl = resolveMediaUrl(crop.image?.url, crop.image?.publicId);
  const suggestedProducts = (crop.suggestedProductIds ?? []).filter(
    (p): p is Product => typeof p === 'object' && p !== null && 'id' in p,
  );
  const sortedSections = [...(crop.sections ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <View style={{ flex: 1, backgroundColor: '#F0FFF4' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Hero Image */}
        <View style={{ position: 'relative' }}>
          {heroUrl ? (
            <Image
              source={{ uri: heroUrl }}
              style={{ width: SCREEN_WIDTH, height: 260 }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: SCREEN_WIDTH,
                height: 200,
                backgroundColor: '#D8F3DC',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="sun" size={56} color="#52B788" />
            </View>
          )}

          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={{
              position: 'absolute',
              top: 48,
              left: 16,
              backgroundColor: 'rgba(255,255,255,0.92)',
              borderRadius: 12,
              padding: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <Feather name="arrow-left" size={20} color="#0B281E" />
          </Pressable>
        </View>

        {/* Content Card */}
        <View
          style={{
            marginTop: -20,
            backgroundColor: '#F0FFF4',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 24,
          }}
        >
          {/* Crop Name */}
          <Text
            style={{
              fontSize: 28,
              fontWeight: '900',
              color: '#0B281E',
              letterSpacing: -0.5,
            }}
          >
            {crop.name}
          </Text>

          {/* Short Description */}
          <Text
            style={{
              marginTop: 8,
              fontSize: 14,
              color: '#3D6B4F',
              lineHeight: 22,
              fontWeight: '500',
            }}
          >
            {crop.shortDescription}
          </Text>

          {/* Full Description */}
          {crop.description ? (
            <View
              style={{
                marginTop: 16,
                backgroundColor: '#fff',
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: '#D8F3DC',
              }}
            >
              <Text style={{ fontSize: 14, color: '#374151', lineHeight: 22 }}>
                {crop.description}
              </Text>
            </View>
          ) : null}

          {/* Dynamic Sections */}
          {sortedSections.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '900',
                  color: '#52B788',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Crop Guides & Tips
              </Text>

              {sortedSections.map((section, index) => (
                <View
                  key={section.id ?? index}
                  style={{
                    marginBottom: 12,
                    backgroundColor: '#fff',
                    borderRadius: 20,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: '#D8F3DC',
                  }}
                >
                  {/* Section Header */}
                  <View
                    style={{
                      backgroundColor: '#1B4332',
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: '#52B788',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '900',
                        color: '#fff',
                        flex: 1,
                      }}
                    >
                      {section.title}
                    </Text>
                  </View>

                  {/* Section Body */}
                  <View style={{ padding: 16 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        color: '#374151',
                        lineHeight: 22,
                      }}
                    >
                      {section.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Suggested Products */}
          {suggestedProducts.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '900',
                  color: '#52B788',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Recommended Products
              </Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>
                Best products for {crop.name} farming
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 8 }}
              >
                {suggestedProducts.map((product) => {
                  const img = product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
                  const imgUrl = resolveMediaUrl(img?.url, img?.publicId);
                  const firstVariant = product.variants?.[0];
                  const discount = firstVariant ? getDiscount(firstVariant) : 0;
                  const price = formatPrice(product.variants);

                  return (
                    <Pressable
                      key={product.id}
                    onPress={() => staticRouter.push(`/product/${product.slug}` as any)}
                      style={({ pressed }) => ({
                        width: 148,
                        backgroundColor: '#fff',
                        borderRadius: 20,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: '#D8F3DC',
                        opacity: pressed ? 0.88 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                        shadowColor: '#2D6A4F',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.07,
                        shadowRadius: 6,
                        elevation: 2,
                      })}
                    >
                      {imgUrl ? (
                        <Image
                          source={{ uri: imgUrl }}
                          style={{ width: '100%', height: 120 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: '100%',
                            height: 120,
                            backgroundColor: '#D8F3DC',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Feather name="package" size={24} color="#52B788" />
                        </View>
                      )}

                      {discount > 0 && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            backgroundColor: '#EF4444',
                            borderRadius: 8,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>
                            {discount}% OFF
                          </Text>
                        </View>
                      )}

                      <View style={{ padding: 10 }}>
                        <Text
                          numberOfLines={2}
                          style={{ fontSize: 12, fontWeight: '700', color: '#0B281E', lineHeight: 17 }}
                        >
                          {product.name}
                        </Text>
                        {price && (
                          <Text
                            style={{
                              marginTop: 4,
                              fontSize: 13,
                              fontWeight: '900',
                              color: '#2D6A4F',
                            }}
                          >
                            {price}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
