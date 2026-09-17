import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { storefrontApi } from '../../src/lib/api';
import { resolveMediaUrl } from '../../src/utils/media';
import type { Crop } from '../../src/types/storefront';
import { getAppLanguage } from '../../src/i18n';

const CARD_MARGIN = 12;

export default function SelectCropScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const isHindi = (i18n.language || getAppLanguage()) === 'hi';
  // Available width inside Screen padding (16px left + 16px right)
  const availableWidth = Math.max(280, windowWidth - 32);
  const cardWidth = Math.floor((availableWidth - CARD_MARGIN) / 2);

  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function fetchCrops(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const data = await storefrontApi.crops();
      setCrops(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load crops');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchCrops();
  }, []);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchCrops(true)}
            tintColor="#2D6A4F"
          />
        }
      >
        <View style={{ gap: 16 }}>
          {/* Header Banner */}
          <View
            style={{
              alignItems: 'center',
              paddingVertical: 12,
              backgroundColor: 'transparent',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#D8F3DC',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Feather name="sun" size={26} color="#2D6A4F" />
            </View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '900',
                color: '#0B281E',
                textAlign: 'center',
              }}
            >
              {isHindi ? 'फसल चुनें' : 'Select Crop'}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: '#2D6A4F',
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              {isHindi
                ? 'फसल सुरक्षा और उर्वरक प्रबंधन का विशेष शेड्यूल'
                : 'Special crop protection & fertilizer schedule'}
            </Text>
          </View>

          {/* Loading */}
          {loading && (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#52B788" />
              <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#2D6A4F' }}>
                {t('common.loading', 'Loading...')}
              </Text>
            </View>
          )}

          {/* Error */}
          {Boolean(error) && (
            <View
              style={{
                padding: 16,
                backgroundColor: '#FEE2E2',
                borderRadius: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, color: '#DC2626', fontWeight: '700' }}>{error}</Text>
              <Pressable
                onPress={() => fetchCrops()}
                style={{
                  marginTop: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  backgroundColor: '#DC2626',
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Retry</Text>
              </Pressable>
            </View>
          )}

          {/* Empty state */}
          {!loading && !error && crops.length === 0 && (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#64748B', fontWeight: '600' }}>
                {t('mobile.selectCropPage.desc', 'No crops found')}
              </Text>
            </View>
          )}

          {/* Crop Grid */}
          {!loading && crops.length > 0 && (
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '900',
                  color: '#52B788',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  marginBottom: 12,
                  marginTop: 4,
                }}
              >
                {isHindi ? 'गाइडेंस देखने के लिए फसल चुनें' : 'SELECT A CROP TO SEE GUIDANCE'}
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: CARD_MARGIN }}>
                {crops.map((crop) => {
                  const imageUrl = resolveMediaUrl(crop.image?.url, crop.image?.publicId);

                  return (
                    <Pressable
                      key={crop.id}
                      onPress={() => router.push(`/crop/${crop.slug}` as any)}
                      style={({ pressed }) => ({
                        width: cardWidth,
                        borderRadius: 18,
                        overflow: 'hidden',
                        backgroundColor: '#fff',
                        borderWidth: 1,
                        borderColor: '#D8F3DC',
                        opacity: pressed ? 0.88 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                        shadowColor: '#2D6A4F',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.08,
                        shadowRadius: 8,
                        elevation: 3,
                      })}
                    >
                      {/* Crop Image Container with proper fit */}
                      <View
                        style={{
                          width: '100%',
                          height: 135,
                          backgroundColor: '#F1F8F5',
                          overflow: 'hidden',
                        }}
                      >
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <View
                            style={{
                              width: '100%',
                              height: '100%',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Feather name="sun" size={32} color="#52B788" />
                          </View>
                        )}
                      </View>

                      {/* Name & Details */}
                      <View style={{ padding: 10, alignItems: 'center' }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 14,
                            fontWeight: '900',
                            color: '#0B281E',
                            textAlign: 'center',
                          }}
                        >
                          {crop.name}
                        </Text>
                        {crop.sections?.length > 0 ? (
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '600',
                              color: '#52B788',
                              textAlign: 'center',
                              marginTop: 2,
                            }}
                          >
                            {crop.sections.length} guide{crop.sections.length !== 1 ? 's' : ''}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
