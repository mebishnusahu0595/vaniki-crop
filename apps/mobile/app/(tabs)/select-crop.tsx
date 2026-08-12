import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_MARGIN * 3) / 2;

export default function SelectCropScreen() {
  const { t } = useTranslation();
  const router = useRouter();

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
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: CARD_MARGIN }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchCrops(true)}
            tintColor="#2D6A4F"
          />
        }
      >
        {/* Header */}
        <View style={{ marginVertical: 16, alignItems: 'center' }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#D8F3DC',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#B7E4C7',
            }}
          >
            <Feather name="sun" size={30} color="#2D6A4F" />
          </View>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '900',
              color: '#0B281E',
              textAlign: 'center',
              letterSpacing: -0.5,
            }}
          >
            {t('mobile.selectCropPage.title')}
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
            {t('mobile.selectCropPage.sub')}
          </Text>
        </View>

        {/* Loading */}
        {loading && (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color="#2D6A4F" size="large" />
            <Text style={{ marginTop: 12, color: '#52B788', fontWeight: '600', fontSize: 13 }}>
              Loading crops...
            </Text>
          </View>
        )}

        {/* Error */}
        {!loading && error ? (
          <View
            style={{
              backgroundColor: '#FFF5F5',
              borderRadius: 20,
              padding: 20,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#FED7D7',
            }}
          >
            <Feather name="alert-circle" size={24} color="#E53E3E" />
            <Text style={{ marginTop: 8, color: '#E53E3E', fontWeight: '700', textAlign: 'center' }}>
              {error}
            </Text>
            <Pressable
              onPress={() => fetchCrops()}
              style={{
                marginTop: 12,
                backgroundColor: '#2D6A4F',
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Empty state */}
        {!loading && !error && crops.length === 0 && (
          <View
            style={{
              marginTop: 8,
              backgroundColor: '#fff',
              borderRadius: 28,
              padding: 40,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#D8F3DC',
            }}
          >
            <Feather name="clock" size={28} color="#D97706" />
            <Text
              style={{ marginTop: 12, fontSize: 18, fontWeight: '900', color: '#0B281E', textAlign: 'center' }}
            >
              {t('mobile.selectCropPage.comingSoon')}
            </Text>
            <Text
              style={{ marginTop: 8, fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 18 }}
            >
              {t('mobile.selectCropPage.desc')}
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
              Select a crop to see guidance
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: CARD_MARGIN }}>
              {crops.map((crop) => {
                const imageUrl = resolveMediaUrl(crop.image?.url, crop.image?.publicId);

                return (
                  <Pressable
                    key={crop.id}
                    onPress={() => router.push(`/crop/${crop.slug}` as any)}
                    style={({ pressed }) => ({
                      width: CARD_WIDTH,
                      borderRadius: 20,
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
                    {/* Crop Image */}
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={{ width: '100%', height: CARD_WIDTH }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: '100%',
                          height: CARD_WIDTH,
                          backgroundColor: '#D8F3DC',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name="sun" size={32} color="#52B788" />
                      </View>
                    )}

                    {/* Name */}
                    <View style={{ padding: 10 }}>
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
                      {crop.sections?.length > 0 && (
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
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
