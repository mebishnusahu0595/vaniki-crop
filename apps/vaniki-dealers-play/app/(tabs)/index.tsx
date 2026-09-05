import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/useAuthStore';
import { dealerApi } from '../../src/lib/api';
import { currencyFormatter, getPrimaryImage } from '../../src/utils/format';

const Icon = Feather as any;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Default fallback promotion banners if SuperAdmin hasn't uploaded custom ones yet
const DEFAULT_DEALER_PROMOTIONS = [
  {
    _id: 'def-1',
    title: 'Factory-Direct Wholesale Peti Schemes',
    description: 'Procure bulk crop care inventory at factory rates with verified Tally GST invoices.',
    tag: 'Rabi & Kharif Scheme',
    badgeColor: '#143D2E',
    image: { url: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop&q=80' },
  },
  {
    _id: 'def-2',
    title: 'Instant GST Pass-Through Invoicing',
    description: 'All wholesale orders include automatic Tally tax invoices with full input tax credit.',
    tag: '100% Tax Compliant',
    badgeColor: '#2563EB',
    image: { url: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=800&auto=format&fit=crop&q=80' },
  },
  {
    _id: 'def-3',
    title: 'Direct Doorstep Logistics Support',
    description: 'Bulk shipments delivered directly to your store with real-time transit status.',
    tag: 'Assured Logistics',
    badgeColor: '#D97706',
    image: { url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80' },
  },
];

export default function DealerHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showKycPopup, setShowKycPopup] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch current user profile to stay in sync with SuperAdmin approval
  const profileQuery = useQuery({
    queryKey: ['dealer-profile'],
    queryFn: dealerApi.getProfile,
  });

  useEffect(() => {
    if (profileQuery.data?.data) {
      useAuthStore.getState().setUser(profileQuery.data.data);
    }
  }, [profileQuery.data]);

  const currentUser = profileQuery.data?.data || user;
  const isApproved =
    currentUser?.approvalStatus === 'approved' ||
    currentUser?.dealerProfile?.approvalStatus === 'approved' ||
    currentUser?.role === 'storeAdmin';

  const homeRawLocation =
    currentUser?.dealerProfile?.storeLocation ||
    currentUser?.storeLocation ||
    '';
  const homeSavedAddress = currentUser?.savedAddress
    ? [
        currentUser.savedAddress.street,
        currentUser.savedAddress.landmark,
        currentUser.savedAddress.city,
        currentUser.savedAddress.district,
        currentUser.savedAddress.state,
        currentUser.savedAddress.pincode,
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const homeStoreLocation =
    homeRawLocation && homeRawLocation.trim().toLowerCase() !== 'store location'
      ? homeRawLocation.trim()
      : homeSavedAddress || '';

  // Fetch all products (limit 100 to get full 36+ catalogue)
  const catalogueQuery = useQuery({
    queryKey: ['bulk-catalogue', { limit: 100 }],
    queryFn: () => dealerApi.getBulkCatalogue({ limit: 100 }),
  });

  // Fetch SuperAdmin Dealer Promotions
  const promotionsQuery = useQuery({
    queryKey: ['dealer-promotions'],
    queryFn: dealerApi.getPromotions,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dealer-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['bulk-catalogue'] }),
      queryClient.invalidateQueries({ queryKey: ['dealer-promotions'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const allProducts: any[] = catalogueQuery.data?.data || [];
  const rawPromos = promotionsQuery.data?.data || [];
  const promoBanners = rawPromos.length > 0 ? rawPromos : DEFAULT_DEALER_PROMOTIONS;

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    allProducts.forEach((p) => {
      if (p.category?.name) set.add(p.category.name);
    });
    return ['All', ...Array.from(set)];
  }, [allProducts]);

  // Live debounced search dropdown results
  const liveSearchResults = useMemo(() => {
    if (!debouncedSearch) return [];
    return allProducts.filter((p) => {
      const name = p.name?.toLowerCase() || '';
      const slug = p.slug?.toLowerCase() || '';
      const cat = p.category?.name?.toLowerCase() || '';
      const shortDesc = p.shortDescription?.toLowerCase() || '';
      const desc = p.description?.toLowerCase() || '';
      const tech = (p as any).technicalName?.toLowerCase() || '';
      return (
        name.includes(debouncedSearch) ||
        slug.includes(debouncedSearch) ||
        cat.includes(debouncedSearch) ||
        shortDesc.includes(debouncedSearch) ||
        desc.includes(debouncedSearch) ||
        tech.includes(debouncedSearch)
      );
    });
  }, [allProducts, debouncedSearch]);

  // Filtered products based on search and category (includes shortDescription)
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category?.name === selectedCategory;
      const name = p.name?.toLowerCase() || '';
      const slug = p.slug?.toLowerCase() || '';
      const cat = p.category?.name?.toLowerCase() || '';
      const shortDesc = p.shortDescription?.toLowerCase() || '';
      const desc = p.description?.toLowerCase() || '';
      const tech = (p as any).technicalName?.toLowerCase() || '';
      const matchSearch =
        !debouncedSearch ||
        name.includes(debouncedSearch) ||
        slug.includes(debouncedSearch) ||
        cat.includes(debouncedSearch) ||
        shortDesc.includes(debouncedSearch) ||
        desc.includes(debouncedSearch) ||
        tech.includes(debouncedSearch);
      return matchCat && matchSearch;
    });
  }, [allProducts, selectedCategory, debouncedSearch]);

  // Specific categorized groups for endless user-app feel
  const insecticideProducts = useMemo(
    () => allProducts.filter((p) => p.category?.name?.toLowerCase().includes('insecticide')),
    [allProducts],
  );
  const fungicideProducts = useMemo(
    () => allProducts.filter((p) => p.category?.name?.toLowerCase().includes('fungicide')),
    [allProducts],
  );
  const herbicideProducts = useMemo(
    () => allProducts.filter((p) => p.category?.name?.toLowerCase().includes('herbicide')),
    [allProducts],
  );
  const hotDeals = useMemo(
    () => allProducts.filter((p) => (p.moq || 1) >= 1).slice(0, 10),
    [allProducts],
  );

  const handleStockRequestPress = () => {
    if (!isApproved) {
      Alert.alert(
        'KYC Approval Required',
        'Your Store KYC is currently under review by SuperAdmin. Once approved by SuperAdmin, full wholesale B2B pricing and stock procurement will be unlocked.',
        [
          { text: 'Refresh Status', onPress: () => onRefresh() },
          { text: 'OK' },
        ],
      );
      return;
    }
    router.push('/product-request' as any);
  };

  const bannerWidth = Math.min(SCREEN_WIDTH - 32, 440);

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAF9]" edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />}
      >
        {/* Top Header (Light Green Theme) */}
        <View className="bg-[#EBF5EE] px-4 pt-3.5 pb-4 rounded-b-[24px] border-b border-emerald-200 shadow-2xs">
          {/* Logo & Greeting on the Same Line */}
          <View className="flex-row items-center justify-between mb-3 gap-2">
            <View className="flex-row items-center gap-2.5 flex-1">
              <Image
                source={require('../../assets/logo.png')}
                style={{ width: 44, height: 36 }}
                contentFit="contain"
              />
              <View className="flex-1 pr-1">
                <Text className="text-[15px] font-black text-emerald-950 leading-snug">
                  Namaste, {currentUser?.name || 'Dealer'} 👋
                </Text>
                {currentUser?.storeName || currentUser?.dealerProfile?.storeName ? (
                  <Text className="text-xs font-bold text-emerald-800 mt-0.5" numberOfLines={1}>
                    🏪 {currentUser.storeName || currentUser.dealerProfile?.storeName}
                  </Text>
                ) : null}
                {homeStoreLocation ? (
                  <Text className="text-[10px] font-semibold text-slate-500 mt-0.5" numberOfLines={1}>
                    📍 {homeStoreLocation}
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="flex-row items-center gap-2 shrink-0">
              {isApproved ? (
                <View className="rounded-full bg-emerald-600/15 px-2.5 py-1 border border-emerald-500/30">
                  <Text className="text-[10px] font-black text-emerald-800">✓ VERIFIED</Text>
                </View>
              ) : (
                <View className="rounded-full bg-amber-500/20 px-2.5 py-1 border border-amber-500/30">
                  <Text className="text-[10px] font-black text-amber-900">⏳ PENDING</Text>
                </View>
              )}

              <Pressable
                onPress={() => router.push('/(tabs)/account')}
                className="w-9 h-9 rounded-full bg-white border border-emerald-300 items-center justify-center active:scale-95 shadow-2xs"
              >
                <Icon name="user" size={17} color="#143D2E" />
              </Pressable>
            </View>
          </View>

          {/* Quick Search Bar with Live Debounce */}
          <View className="flex-row items-center bg-white rounded-2xl px-3.5 py-2.5 border border-emerald-200 shadow-xs">
            <Icon name="search" size={18} color="#166534" />
            <TextInput
              placeholder="Search 36+ crop care wholesale products..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ outlineWidth: 0, outlineStyle: 'none' } as any}
              className="flex-1 ml-2 text-sm font-semibold text-slate-900"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} className="p-1">
                <Icon name="x" size={16} color="#64748B" />
              </Pressable>
            ) : null}
          </View>

          {/* Live Search Results Dropdown with Debounce */}
          {debouncedSearch.length > 0 && (
            <View className="mt-2.5 bg-white rounded-2xl shadow-xl border border-emerald-300 overflow-hidden z-40">
              <View className="bg-emerald-100/70 px-3.5 py-2 border-b border-emerald-200 flex-row items-center justify-between">
                <Text className="text-xs font-black text-emerald-900">
                  Found {liveSearchResults.length} {liveSearchResults.length === 1 ? 'Product' : 'Products'} for "{searchQuery}"
                </Text>
                <Pressable onPress={() => setSearchQuery('')} className="px-1">
                  <Text className="text-xs font-bold text-emerald-700">✕ Close</Text>
                </Pressable>
              </View>

              {liveSearchResults.length === 0 ? (
                <View className="p-4 items-center">
                  <Icon name="alert-circle" size={22} color="#94A3B8" />
                  <Text className="text-xs font-bold text-slate-600 mt-1">No matching wholesale products</Text>
                  <Text className="text-[11px] text-slate-400">Try searching for pesticide, herbicide, 505, or crop name</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {liveSearchResults.map((p) => {
                    const pImage = getPrimaryImage(p);
                    const defaultVar = p.variants?.[0];
                    return (
                      <Pressable
                        key={p.id || p._id}
                        onPress={() => {
                          setSearchQuery('');
                          router.push({ pathname: '/product/[slug]', params: { slug: p.slug } });
                        }}
                        className="flex-row items-center gap-3 p-3 border-b border-slate-100 active:bg-emerald-50"
                      >
                        <Image
                          source={{ uri: pImage }}
                          placeholder={{ uri: 'https://placehold.co/400x400?text=Vaniki' }}
                          style={{ width: 44, height: 44, borderRadius: 10 }}
                          contentFit="contain"
                        />
                        <View className="flex-1">
                          <Text className="text-sm font-black text-slate-900 leading-tight" numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text className="text-xs font-bold text-emerald-700 mt-0.5">
                            {p.category?.name || 'Crop Care'} • MOQ: {p.moq || 1}
                          </Text>
                        </View>
                        <View className="items-end pl-2">
                          {isApproved ? (
                            <Text className="text-sm font-black text-primary-800">
                              {defaultVar ? currencyFormatter.format(defaultVar.price) : ''}
                            </Text>
                          ) : (
                            <View className="flex-row items-center gap-1">
                              <Icon name="lock" size={12} color="#D97706" />
                              <Text className="text-xs font-black text-amber-700">₹ •••••</Text>
                            </View>
                          )}
                          <Text className="text-[10px] font-bold text-slate-400">View Details →</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* ─── Dismissible KYC Pending Popup Card (With Cut 'X' button) ─── */}
        {!isApproved && showKycPopup && (
          <View className="mx-4 mt-3 mb-2 rounded-3xl bg-amber-50 border border-amber-300 p-4 shadow-sm relative">
            {/* Prominent Cut / Close 'X' Button */}
            <Pressable
              onPress={() => setShowKycPopup(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-amber-200/80 items-center justify-center active:scale-90 z-20 shadow-2xs"
            >
              <Icon name="x" size={16} color="#78350F" />
            </Pressable>

            <View className="flex-row items-start gap-3 pr-6">
              <View className="w-9 h-9 rounded-2xl bg-amber-500 items-center justify-center mt-0.5 shadow-xs">
                <Icon name="clock" size={18} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-black text-amber-900 leading-tight">
                  Store KYC Pending SuperAdmin Approval
                </Text>
                <Text className="text-[11px] font-semibold text-amber-800 mt-1 leading-relaxed">
                  Your store details and GSTIN are being reviewed by SuperAdmin. Once approved by SuperAdmin, full wholesale B2B pricing and stock requests will be unlocked.
                </Text>

                <View className="flex-row items-center gap-2.5 mt-3">
                  <Pressable
                    onPress={() => onRefresh()}
                    className="rounded-xl bg-amber-600 px-3.5 py-1.5 active:scale-95 shadow-2xs"
                  >
                    <Text className="text-[10px] font-black uppercase tracking-wider text-white">
                      Check Status
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/(auth)/kyc' as any)}
                    className="rounded-xl bg-white border border-amber-300 px-3 py-1.5 active:scale-95"
                  >
                    <Text className="text-[10px] font-black text-amber-900">
                      Update KYC
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Reopen KYC Banner Pill if user closed it */}
        {!isApproved && !showKycPopup && (
          <Pressable
            onPress={() => setShowKycPopup(true)}
            className="mx-4 mt-3 mb-2 rounded-2xl bg-amber-100 border border-amber-300 py-2.5 px-4 flex-row items-center justify-between active:scale-98 shadow-xs"
          >
            <View className="flex-row items-center gap-2">
              <Icon name="clock" size={14} color="#B45309" />
              <Text className="text-xs font-bold text-amber-900">
                ⏳ KYC Pending • Tap to view status &amp; details
              </Text>
            </View>
            <Icon name="chevron-down" size={16} color="#B45309" />
          </Pressable>
        )}

        {/* ─── SuperAdmin Dealer Promotion Banners Carousel ─── */}
        <View className="mt-2 mb-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={bannerWidth + 12}
            decelerationRate="fast"
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / (bannerWidth + 12));
              setActiveBannerIdx(slide);
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {promoBanners.map((promo: any, idx: number) => {
              const bgBannerImage = promo.image?.url || promo.imageUrl;
              return (
                <Pressable
                  key={promo._id || promo.id || idx}
                  onPress={() => router.push('/(tabs)/products')}
                  style={{ width: bannerWidth, height: 175 }}
                  className="rounded-[24px] overflow-hidden bg-primary-950 shadow-md border border-slate-200 active:scale-[0.99] relative"
                >
                  {bgBannerImage ? (
                    <Image
                      source={{ uri: bgBannerImage }}
                      style={{ width: '100%', height: '100%', position: 'absolute' }}
                      contentFit="cover"
                      transition={300}
                    />
                  ) : null}

                  {/* High contrast scrim for crystal-clear readability */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      top: 0,
                      backgroundColor: bgBannerImage ? 'rgba(8, 26, 19, 0.65)' : undefined,
                    }}
                    className="p-4 justify-between"
                  >
                    <View>
                      <View className="self-start rounded-full bg-emerald-500/90 px-2.5 py-0.5 mb-1.5 shadow-2xs">
                        <Text className="text-[10px] font-black uppercase tracking-wider text-white">
                          {promo.tag || 'Special Dealer Offer'}
                        </Text>
                      </View>
                      <Text
                        className="text-base font-black text-white leading-tight max-w-[92%]"
                        numberOfLines={2}
                      >
                        {promo.title}
                      </Text>
                      {promo.description ? (
                        <Text
                          className="text-xs font-semibold text-white/90 mt-1 max-w-[95%] leading-snug"
                          numberOfLines={2}
                        >
                          {promo.description}
                        </Text>
                      ) : null}
                    </View>

                    <View className="flex-row items-center justify-between pt-2 border-t border-white/20">
                      <View className="flex-row items-center gap-1.5 bg-white rounded-full px-3 py-1 shadow-xs">
                        <Text className="text-xs font-black text-primary-950">Explore Bulk Deals</Text>
                        <Icon name="arrow-right" size={12} color="#071F17" />
                      </View>
                      <Text className="text-[11px] font-black text-white/90">Vaniki Agro Direct</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Carousel Dot Indicators */}
          {promoBanners.length > 1 && (
            <View className="flex-row justify-center gap-1.5 mt-2.5">
              {promoBanners.map((_: any, i: number) => (
                <View
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    activeBannerIdx === i ? 'w-6 bg-primary-700' : 'w-1.5 bg-slate-300'
                  }`}
                />
              ))}
            </View>
          )}
        </View>

        {/* ─── Category Quick Filter Pills ─── */}
        <View className="mb-5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  className={`rounded-2xl px-4 py-2.5 border active:scale-95 shadow-2xs ${
                    isSelected
                      ? 'bg-primary-800 border-primary-900'
                      : 'bg-white border-primary-100'
                  }`}
                >
                  <Text
                    className={`text-sm font-black ${
                      isSelected ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Quick Actions (4 Action Tiles) ─── */}
        <View className="px-4 mb-6">
          <View className="flex-row gap-2.5">
            {[
              { label: 'Request Stock', icon: 'package', color: '#166534', bg: '#DCFCE7', onPress: handleStockRequestPress },
              { label: 'Bulk Catalogue', icon: 'grid', color: '#1D4ED8', bg: '#DBEAFE', onPress: () => router.push('/(tabs)/products') },
              { label: 'My Orders', icon: 'list', color: '#7E22CE', bg: '#F3E8FF', onPress: () => router.push('/(tabs)/orders') },
              { label: 'Tax Invoices', icon: 'file-text', color: '#C2410C', bg: '#FFEDD5', onPress: () => router.push('/(tabs)/invoices') },
            ].map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                className="flex-1 items-center rounded-2xl bg-white border border-primary-100 py-3.5 px-1 active:scale-95 shadow-2xs"
              >
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center mb-1.5"
                  style={{ backgroundColor: a.bg }}
                >
                  <Icon name={a.icon} size={19} color={a.color} />
                </View>
                <Text className="text-xs font-bold text-slate-800 text-center" numberOfLines={1}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>


        {/* ─── Section 1: Hot B2B Wholesale Deals (Horizontal Scroll) ─── */}
        {hotDeals.length > 0 && (
          <View className="mb-7">
            <View className="px-4 flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-emerald-700">
                  ⚡ High Margin Schemes
                </Text>
                <Text className="text-lg font-black text-primary-900">
                  Hot Wholesale Peti Deals
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/(tabs)/products')}
                className="flex-row items-center gap-1"
              >
                <Text className="text-xs font-black text-primary-700">View All ({allProducts.length})</Text>
                <Icon name="arrow-right" size={13} color="#2D6A4F" />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            >
              {hotDeals.map((p) => (
                <View key={p.id || p._id} style={{ width: 170 }}>
                  <DealerProductCard product={p} isApproved={isApproved} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ─── Section 2: Insecticides & Pest Management ─── */}
        {insecticideProducts.length > 0 && (
          <View className="px-4 mb-7">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-red-700">
                  🐛 Pest Management
                </Text>
                <Text className="text-lg font-black text-primary-900">
                  Insecticides &amp; Sprays
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setSelectedCategory('Insecticide');
                  router.push('/(tabs)/products');
                }}
              >
                <Text className="text-xs font-black text-primary-700">View All →</Text>
              </Pressable>
            </View>

            <View className="flex-row flex-wrap justify-between">
              {insecticideProducts.slice(0, 4).map((p) => (
                <View key={p.id || p._id} style={{ width: '48%' }} className="mb-3">
                  <DealerProductCard product={p} isApproved={isApproved} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Section 3: Fungicides & Disease Solutions ─── */}
        {fungicideProducts.length > 0 && (
          <View className="px-4 mb-7">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-amber-700">
                  🌾 Crop Disease Control
                </Text>
                <Text className="text-lg font-black text-primary-900">
                  Fungicides &amp; Systemic Care
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setSelectedCategory('Fungicide');
                  router.push('/(tabs)/products');
                }}
              >
                <Text className="text-xs font-black text-primary-700">View All →</Text>
              </Pressable>
            </View>

            <View className="flex-row flex-wrap justify-between">
              {fungicideProducts.slice(0, 4).map((p) => (
                <View key={p.id || p._id} style={{ width: '48%' }} className="mb-3">
                  <DealerProductCard product={p} isApproved={isApproved} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Section 4: Herbicides & Weed Control ─── */}
        {herbicideProducts.length > 0 && (
          <View className="px-4 mb-7">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-blue-700">
                  🌿 Weed Elimination
                </Text>
                <Text className="text-lg font-black text-primary-900">
                  Herbicides &amp; Weedicides
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setSelectedCategory('Herbicide');
                  router.push('/(tabs)/products');
                }}
              >
                <Text className="text-xs font-black text-primary-700">View All →</Text>
              </Pressable>
            </View>

            <View className="flex-row flex-wrap justify-between">
              {herbicideProducts.slice(0, 4).map((p) => (
                <View key={p.id || p._id} style={{ width: '48%' }} className="mb-3">
                  <DealerProductCard product={p} isApproved={isApproved} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Section 5: All Wholesale Products Continuous Grid (36+ Items) ─── */}
        <View className="px-4 mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">
                Bulk Agri Catalogue ({filteredProducts.length} Products)
              </Text>
              <Text className="text-lg font-black text-primary-900">
                {selectedCategory === 'All' ? 'All Wholesale Products' : `${selectedCategory} Catalogue`}
              </Text>
            </View>
          </View>

          {catalogueQuery.isLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#2D6A4F" />
              <Text className="text-xs font-bold text-slate-400 mt-2">Loading full dealer catalogue...</Text>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View className="py-12 items-center bg-white rounded-3xl border border-dashed border-slate-300">
              <Icon name="inbox" size={36} color="#94A3B8" />
              <Text className="text-sm font-black text-slate-700 mt-2">No products found</Text>
              <Text className="text-xs font-medium text-slate-400 mt-0.5">Try clearing your search query</Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {filteredProducts.map((p) => (
                <View key={p.id || p._id} style={{ width: '48%' }} className="mb-3">
                  <DealerProductCard product={p} isApproved={isApproved} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ─── Section 6: Vaniki Dealership Perks ─── */}
        <View className="mx-4 mb-7 rounded-[26px] bg-primary-800 p-5 shadow-lg overflow-hidden">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-emerald-300 mb-1">
            Vaniki Advantage
          </Text>
          <Text className="text-xl font-black text-white leading-tight mb-2">
            Why 5,000+ Agri Retailers Trust Vaniki Crop
          </Text>
          <Text className="text-xs font-semibold text-emerald-100/70 mb-4 leading-relaxed">
            Eliminating distributor markups to maximize dealer margins with direct factory supply.
          </Text>

          <View className="gap-3">
            {[
              { title: 'Zero Middlemen Cut', desc: 'Direct factory pricing with higher retail profit margins.', icon: 'percent' },
              { title: 'Automated Tally Invoices', desc: 'Instant GST tax invoices with seamless credit pass-through.', icon: 'check-circle' },
              { title: 'Doorstep Freight & Safe Dispatch', desc: 'Insured transportation with tracking right up to your kendra.', icon: 'truck' },
              { title: 'Farmer Demand Generation', desc: 'Active field demos and farmer campaigns driving footfall to your shop.', icon: 'users' },
            ].map((perk) => (
              <View key={perk.title} className="flex-row items-center gap-3 bg-white/10 rounded-2xl p-3 border border-white/10">
                <View className="w-8 h-8 rounded-xl bg-emerald-400/20 items-center justify-center">
                  <Icon name={perk.icon} size={16} color="#A7F3D0" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-black text-white">{perk.title}</Text>
                  <Text className="text-[10px] font-medium text-emerald-100/70">{perk.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ─── Section 7: Verified Dealer Testimonials ─── */}
        <View className="px-4 mb-8">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500 mb-1">
            Dealer Network
          </Text>
          <Text className="text-lg font-black text-primary-900 mb-3">
            Voices of Agri Retailers
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {[
              { name: 'Kisan Krishi Kendra', owner: 'Gurpreet Singh', loc: 'Bathinda, Punjab', quote: 'Vaniki ki dispatch speed bahut fast hai. Tally invoice instant download ho jata hai.' },
              { name: 'Shree Ram Agro Agency', owner: 'Manoj Patidar', loc: 'Ujjain, MP', quote: 'Direct factory rate milne se retail margin 18-22% tak badh gaya hai.' },
              { name: 'Annapurna Krishi Seva', owner: 'Suresh Patil', loc: 'Kolhapur, Maharashtra', quote: 'Insecticides aur bio-stimulants ka farmer result zabardast hai, repeat demand aati hai.' },
            ].map((t) => (
              <View
                key={t.name}
                style={{ width: 260 }}
                className="bg-white rounded-3xl p-4 border border-primary-100 shadow-2xs justify-between"
              >
                <Text className="text-xs font-semibold text-slate-700 italic leading-relaxed mb-3">
                  "{t.quote}"
                </Text>
                <View className="pt-2 border-t border-slate-100">
                  <Text className="text-xs font-black text-primary-900">{t.name}</Text>
                  <Text className="text-[10px] font-bold text-slate-400">{t.owner} • {t.loc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ─── Section 8: Dedicated Dealer Helpline ─── */}
        <View className="mx-4 mb-6 p-5 rounded-3xl bg-white border border-primary-100 items-center shadow-xs">
          <View className="w-12 h-12 rounded-2xl bg-primary-50 items-center justify-center mb-2">
            <Icon name="headphones" size={24} color="#2D6A4F" />
          </View>
          <Text className="text-sm font-black text-primary-900 text-center">
            Dedicated B2B Dealer Support
          </Text>
          <Text className="text-xs font-semibold text-slate-500 text-center mt-1 mb-4">
            Need custom truckload dispatch or bulk scheme details? Your Relationship Manager is here to help.
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => router.push('/(tabs)/account')}
              className="rounded-full bg-primary-800 px-5 py-2.5 active:scale-95 shadow-xs"
            >
              <Text className="text-xs font-black text-white">Contact Relationship Manager</Text>
            </Pressable>
          </View>
        </View>

        {/* Footer Brand Seal */}
        <View className="items-center pb-6 pt-2">
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 100, height: 32, opacity: 0.8 }}
            contentFit="contain"
          />
          <Text className="text-xs font-bold text-slate-400 mt-1">
            Vaniki Agro Direct • Certified Agri B2B Network
          </Text>
          <Text className="text-[10px] text-slate-400 mt-0.5">
            Direct Factory Supply • Instant Tally GST Tax Invoicing
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Dealer Product Card (small, home use) ────────────────────────────────

function DealerProductCard({ product, isApproved }: { product: any; isApproved?: boolean }) {
  const primaryImage = getPrimaryImage(product);
  const defaultVariant = product.variants?.[0];
  const moq = product.moq || 1;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })
      }
      className="flex-1 overflow-hidden rounded-[20px] border border-primary-100 bg-white active:scale-[0.98] shadow-2xs"
    >
      <View className="relative bg-[#f4f7f6] pt-2">
        <Image
          source={{ uri: primaryImage }}
          placeholder={{ uri: 'https://placehold.co/400x400?text=Vaniki+Crop' }}
          style={{ width: '100%', height: 120 }}
          contentFit="contain"
          transition={400}
        />
        {/* MOQ Badge */}
        <View className="absolute left-2 top-2 rounded-full bg-emerald-700 px-2.5 py-0.5 shadow-2xs">
          <Text className="text-[10px] font-bold text-white uppercase">
            Min {moq} {moq === 1 ? 'unit' : 'units'}
          </Text>
        </View>
      </View>
      <View className="p-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-emerald-700">
          {product.category?.name || 'Crop Care'}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-sm font-black text-slate-900 leading-snug">
          {product.name}
        </Text>

        {/* Pricing: Locked if KYC not approved */}
        {isApproved ? (
          defaultVariant ? (
            <Text className="mt-1 text-base font-black text-primary-800">
              {currencyFormatter.format(defaultVariant.price)}
              <Text className="text-xs font-semibold text-slate-400"> /unit</Text>
            </Text>
          ) : null
        ) : (
          <View className="flex-row items-center gap-1.5 mt-1">
            <Icon name="lock" size={13} color="#D97706" />
            <Text className="text-sm font-black text-amber-700">₹ •••••</Text>
            <View className="rounded bg-amber-100 px-1 py-0.2">
              <Text className="text-[10px] font-bold text-amber-800">KYC Req</Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}
