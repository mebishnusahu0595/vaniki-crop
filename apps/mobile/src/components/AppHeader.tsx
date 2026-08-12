import { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
import { getLanguageToggleLabel, toggleAppLanguage } from '../i18n';

import { useSettingsStore } from '../store/useSettingsStore';
import { useDrawerStore } from '../store/useDrawerStore';
import { SidebarDrawer } from './SidebarDrawer';

export const AppHeader = memo(function AppHeader() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
  const shouldShowInlinePanel = isHomepageSearch && query.trim().length > 0;
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

  const openCart = () => {
    if (pathname !== '/(tabs)/cart') {
      router.push('/(tabs)/cart');
    }
  };

  return (
    <View>
      <SidebarDrawer />

      <View className="mt-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={openDrawer}
            className="h-9 w-9 items-center justify-center rounded-2xl border border-primary-100 bg-white active:scale-95"
            hitSlop={8}
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

        <View className="flex-row items-center gap-1.5">
          <Pressable
            onPress={() => setIsSearchOpen(!isSearchOpen)}
            className={`h-9 w-9 items-center justify-center rounded-2xl border active:scale-95 ${
              isSearchOpen ? 'bg-primary-500 border-primary-500' : 'bg-white border-primary-100'
            }`}
          >
            <Feather name="search" size={16} color={isSearchOpen ? '#FFFFFF' : '#082018'} />
          </Pressable>

          <Pressable
            onPress={() => setShowCheckInModal(true)}
            className="h-9 flex-row items-center gap-1 rounded-2xl border border-amber-100 bg-amber-50 px-2.5 active:scale-95 active:opacity-90"
          >
            <Image source={require('../../assets/coin.png')} style={{ width: 14, height: 14 }} />
            <Text className="text-xs font-black text-amber-900">{user?.loyaltyPoints || 0}</Text>
          </Pressable>

          <Pressable
            onPress={openCart}
            className="relative h-9 w-9 items-center justify-center rounded-2xl bg-primary-900 active:scale-95 active:opacity-90"
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

      {isSearchOpen || query.trim().length > 0 ? (
        <View className="relative z-20 mt-2">
          <View className="flex-row items-center rounded-2xl border border-primary-100 bg-white px-3 py-1.5">
            <Feather name="search" size={14} color="#527164" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('mobile.header.searchPlaceholder')}
              className="mx-2 flex-1 py-1.5 text-xs font-semibold text-primary-900"
              style={{ outlineStyle: 'none', outlineWidth: 0 } as any}
              placeholderTextColor="#7a978b"
              underlineColorAndroid="transparent"
              returnKeyType="search"
              autoFocus
              onSubmitEditing={submitSearch}
            />
            <Pressable onPress={submitSearch} className="h-7 w-7 items-center justify-center rounded-xl bg-primary-50">
              <MaterialIcons name="arrow-forward" size={16} color="#082018" />
            </Pressable>
          </View>

          {shouldShowInlinePanel ? (
          <View
            className="absolute left-0 right-0 top-[58px] max-h-80 rounded-2xl border border-primary-100 bg-white px-2 py-2"
            style={{
              shadowColor: '#082018',
              shadowOpacity: 0.08,
              shadowOffset: { width: 0, height: 10 },
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {query.trim().length < 2 ? (
                <Text className="px-2 py-3 text-sm font-semibold text-primary-900/55">
                  Type at least 2 letters to search products and categories.
                </Text>
              ) : null}

              {matchedCategories.length ? (
                <View className="mb-2">
                  <Text className="px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">
                    Categories
                  </Text>
                  {matchedCategories.map((category) => (
                    <Pressable
                      key={category.id}
                      onPress={() => {
                        setQuery('');
                        router.push({ pathname: '/products', params: { category: category.slug } });
                      }}
                      className="rounded-xl px-3 py-3"
                    >
                      <Text className="text-sm font-black text-primary-900">{category.name}</Text>
                      <Text className="mt-0.5 text-xs font-semibold text-primary-900/50">/{category.slug}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {matchedProducts.length ? (
                <View>
                  <Text className="px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-[1.5px] text-primary-500">
                    Products
                  </Text>
                  {matchedProducts.map((product) => (
                    <Pressable
                      key={product.id}
                      onPress={() => {
                        setQuery('');
                        router.push({ pathname: '/product/[slug]', params: { slug: product.slug } });
                      }}
                      className="rounded-xl px-3 py-3"
                    >
                      <Text className="text-sm font-black text-primary-900">{product.name}</Text>
                      <Text className="mt-0.5 text-xs font-semibold text-primary-900/55">
                        {product.category?.name || 'Crop Care'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {isInlineLoading ? (
                <Text className="px-2 py-3 text-sm font-semibold text-primary-900/55">Searching...</Text>
              ) : null}

              {showNoResult ? (
                <Text className="px-2 py-3 text-sm font-semibold text-primary-900/55">
                  No matching products or categories found.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </View>
    ) : null}
    </View>
  );
});
