import { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { useStoreStore } from '../store/useStoreStore';
import { Image } from 'expo-image';
import { storefrontApi } from '../lib/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getLanguageToggleLabel, toggleAppLanguage, getAppLanguage } from '../i18n';

import { useDrawerStore } from '../store/useDrawerStore';
import { SidebarDrawer } from './SidebarDrawer';

export const AppHeader = memo(function AppHeader() {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.qty, 0));
  const { user, setShowCheckInModal } = useAuthStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const openDrawer = useDrawerStore((state) => state.openDrawer);
  const debouncedQuery = useDebouncedValue(query.trim(), 160);
  const isHomepageSearch = pathname === '/(tabs)' || pathname === '/(tabs)/index' || pathname === '/';
  const shouldRunSearch = isHomepageSearch && debouncedQuery.length >= 2;

  const categoriesQuery = useQuery({
    queryKey: ['mobile-header-categories'],
    queryFn: storefrontApi.categories,
    enabled: isHomepageSearch,
    staleTime: 5 * 60 * 1000,
  });
  const searchProductsQuery = useQuery({
    queryKey: ['mobile-inline-search', debouncedQuery, selectedStore?.id],
    queryFn: () => storefrontApi.searchProducts(debouncedQuery, selectedStore?.id),
    enabled: shouldRunSearch,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const matchedCategories = useMemo(() => {
    if (!shouldRunSearch) return [];
    const normalized = debouncedQuery.toLowerCase();

    return (categoriesQuery.data || [])
      .filter(
        (category) =>
          category.name.toLowerCase().includes(normalized) ||
          category.slug.toLowerCase().includes(normalized),
      )
      .slice(0, 5);
  }, [categoriesQuery.data, debouncedQuery, shouldRunSearch]);

  const matchedProducts = searchProductsQuery.data?.data || [];
  const shouldShowInlinePanel = isHomepageSearch && (isSearchOpen || query.trim().length > 0);
  const isInlineLoading = shouldRunSearch && searchProductsQuery.isFetching;
  const showNoResult =
    shouldRunSearch &&
    !isInlineLoading &&
    matchedCategories.length === 0 &&
    matchedProducts.length === 0;

  const submitSearch = () => {
    const trimmed = query.trim();

    if (trimmed) {
      router.push({ pathname: '/products', params: { search: trimmed } });
      setQuery('');
      setIsSearchOpen(false);
      return;
    }

    router.push('/products');
    setQuery('');
    setIsSearchOpen(false);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery('');
  };

  const handleLanguageToggle = async () => {
    if (switchingLanguage) return;
    setSwitchingLanguage(true);
    try {
      await toggleAppLanguage();
    } finally {
      setSwitchingLanguage(false);
    }
  };

  const openCart = () => {
    if (pathname !== '/(tabs)/cart') {
      router.push('/(tabs)/cart');
    }
  };

  return (
    <View className="relative z-30">
      <SidebarDrawer />

      {/* Top Header Row */}
      <View className="mt-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={openDrawer}
            className="h-9 w-9 items-center justify-center rounded-2xl border border-primary-100 bg-white active:scale-95 shadow-2xs"
            hitSlop={8}
            accessibilityLabel="Open Menu"
          >
            <Feather name="menu" size={18} color="#082018" />
          </Pressable>

          <Pressable onPress={() => router.push('/(tabs)')} className="flex-row items-center gap-2 active:scale-95">
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 22, height: 22, borderRadius: 5 }}
              contentFit="contain"
            />
            <View className="flex-row items-baseline gap-0.5">
              <Text className="text-[18px] font-black leading-tight tracking-tight text-primary-900">
                Vaniki
              </Text>
              <Text className="text-[18px] font-black leading-tight tracking-tight text-primary-500">
                Crop
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Right Header Controls */}
        <View className="flex-row items-center gap-1.5">
          {/* Quick Language Toggle Button */}
          <Pressable
            onPress={handleLanguageToggle}
            disabled={switchingLanguage}
            className="h-9 min-w-[50px] flex-row items-center justify-center gap-1 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-2.5 active:scale-95 shadow-2xs"
            hitSlop={6}
            accessibilityLabel="Switch Language"
          >
            <Feather name="globe" size={12} color="#2D6A4F" />
            <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-900">
              {getLanguageToggleLabel()}
            </Text>
          </Pressable>

          {/* Search Toggle Icon */}
          <Pressable
            onPress={() => setIsSearchOpen(!isSearchOpen)}
            className={`h-9 w-9 items-center justify-center rounded-2xl border active:scale-95 shadow-2xs ${
              isSearchOpen ? 'bg-primary-500 border-primary-500' : 'bg-white border-primary-100'
            }`}
            hitSlop={6}
          >
            <Feather name="search" size={16} color={isSearchOpen ? '#FFFFFF' : '#082018'} />
          </Pressable>

          {/* Loyalty Coin */}
          <Pressable
            onPress={() => setShowCheckInModal(true)}
            className="h-9 flex-row items-center gap-1 rounded-2xl border border-amber-100 bg-amber-50 px-2 active:scale-95 shadow-2xs"
          >
            <Image source={require('../../assets/coin.png')} style={{ width: 14, height: 14 }} />
            <Text className="text-xs font-black text-amber-900">{user?.loyaltyPoints || 0}</Text>
          </Pressable>

          {/* Cart Icon */}
          <Pressable
            onPress={openCart}
            className="relative h-9 w-9 items-center justify-center rounded-2xl bg-primary-900 active:scale-95 shadow-2xs"
            hitSlop={6}
          >
            <Feather name="shopping-cart" size={16} color="#FFFFFF" />
            {cartCount > 0 ? (
              <View className="absolute -right-1 -top-1 min-w-[16px] rounded-full border border-white bg-rose-500 px-1 py-0.5">
                <Text className="text-center text-[9px] font-black text-white">{cartCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* Inline Search Input & Dropdown */}
      {(isSearchOpen || query.trim().length > 0) && (
        <View className="relative z-40 mt-2">
          <View className="flex-row items-center rounded-2xl border-2 border-primary-400 bg-white px-3 py-1.5 shadow-sm">
            <Feather name="search" size={15} color="#2D6A4F" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('mobile.header.searchPlaceholder')}
              className="mx-2 flex-1 py-1.5 text-xs font-bold text-primary-900"
              style={{ outlineStyle: 'none', outlineWidth: 0 } as any}
              placeholderTextColor="#7a978b"
              underlineColorAndroid="transparent"
              returnKeyType="search"
              autoFocus
              onSubmitEditing={submitSearch}
            />
            {query.trim().length > 0 ? (
              <Pressable onPress={() => setQuery('')} className="p-1 mr-1">
                <Feather name="x-circle" size={14} color="#94A3B8" />
              </Pressable>
            ) : null}
            <Pressable onPress={submitSearch} className="h-7 w-7 items-center justify-center rounded-xl bg-primary-50 active:bg-primary-100">
              <MaterialIcons name="arrow-forward" size={16} color="#082018" />
            </Pressable>
          </View>

          {/* Search Dropdown / Suggestion List */}
          {shouldShowInlinePanel && (
            <View
              className="absolute left-0 right-0 top-[48px] max-h-80 rounded-2xl border border-primary-200 bg-white px-2 py-2 shadow-2xl z-50"
              style={{
                elevation: 12,
              }}
            >
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {query.trim().length < 2 ? (
                  <Text className="px-2 py-3 text-xs font-semibold text-primary-900/60">
                    {t('mobile.header.typeMinChars')}
                  </Text>
                ) : null}

                {matchedCategories.length > 0 ? (
                  <View className="mb-2">
                    <Text className="px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">
                      {t('mobile.header.categoriesTitle')}
                    </Text>
                    {matchedCategories.map((category) => (
                      <Pressable
                        key={category.id}
                        onPress={() => {
                          closeSearch();
                          router.push({ pathname: '/products', params: { category: category.slug } });
                        }}
                        className="rounded-xl px-3 py-2.5 active:bg-emerald-50"
                      >
                        <Text className="text-sm font-black text-primary-900">{category.name}</Text>
                        <Text className="mt-0.5 text-[11px] font-semibold text-primary-900/50">/{category.slug}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {matchedProducts.length > 0 ? (
                  <View>
                    <Text className="px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">
                      {t('mobile.header.productsTitle')}
                    </Text>
                    {matchedProducts.map((product) => (
                      <Pressable
                        key={product.id}
                        onPress={() => {
                          closeSearch();
                          router.push({ pathname: '/product/[slug]', params: { slug: product.slug } });
                        }}
                        className="rounded-xl px-3 py-2.5 active:bg-emerald-50"
                      >
                        <Text className="text-sm font-black text-primary-900">{product.name}</Text>
                        <Text className="mt-0.5 text-[11px] font-semibold text-primary-900/55">
                          {product.category?.name || 'Crop Care'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {isInlineLoading ? (
                  <Text className="px-2 py-3 text-xs font-semibold text-primary-900/60">
                    {t('mobile.header.searching')}
                  </Text>
                ) : null}

                {showNoResult ? (
                  <Text className="px-2 py-3 text-xs font-semibold text-primary-900/60">
                    {t('mobile.header.noResultsFound')}
                  </Text>
                ) : null}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* Outside click dismiss for open search */}
      {(isSearchOpen || query.trim().length > 0) && (
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { top: 50, height: 1000, zIndex: 20, backgroundColor: 'transparent' },
          ]}
          onPress={closeSearch}
        />
      )}
    </View>
  );
});
