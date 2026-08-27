import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/Screen';
import { ProductCard } from '../src/components/ProductCard';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { storefrontApi } from '../src/lib/api';
import { useStoreStore } from '../src/store/useStoreStore';
import { Skeleton } from '../src/components/Skeleton';

interface MobileCategoryOption {
  id: string;
  name: string;
  slug: string;
}

export default function ProductsScreen() {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';
  const params = useLocalSearchParams<{ category?: string; search?: string }>();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(params.search || '');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(params.category || '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<'popular' | 'price_asc' | 'price_desc' | 'newest' | 'rating'>('popular');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Temporary filter state inside modal
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [tempSort, setTempSort] = useState<'popular' | 'price_asc' | 'price_desc' | 'newest' | 'rating'>('popular');
  const [tempCategory, setTempCategory] = useState('');

  const debouncedSearch = useDebouncedValue(search, 300);

  const sortOptions = useMemo(() => [
    { key: 'popular' as const, label: t('mobile.productsPage.sortPopular') },
    { key: 'price_asc' as const, label: t('mobile.productsPage.sortPriceLowHigh') },
    { key: 'price_desc' as const, label: t('mobile.productsPage.sortPriceHighLow') },
    { key: 'newest' as const, label: t('mobile.productsPage.sortNewest') },
    { key: 'rating' as const, label: isHindi ? 'उच्चतम रेटिंग' : 'Top Rated' },
  ], [t, isHindi]);

  useEffect(() => {
    if (params.search !== undefined) {
      setSearch(params.search);
      setPage(1);
    }
  }, [params.search]);

  useEffect(() => {
    if (params.category !== undefined) {
      setSelectedCategory(params.category);
      setPage(1);
    }
  }, [params.category]);

  const categoriesQuery = useQuery({
    queryKey: ['mobile-product-categories'],
    queryFn: storefrontApi.categories,
  });

  const productsQuery = useQuery({
    queryKey: ['mobile-products', page, selectedCategory, debouncedSearch, selectedStore?.id, sort, minPrice, maxPrice],
    queryFn: () =>
      storefrontApi.products({
        page,
        limit: 16,
        category: selectedCategory || undefined,
        search: debouncedSearch,
        storeId: selectedStore?.id,
        sort,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
      }),
  });

  const products = useMemo(() => productsQuery.data?.data || [], [productsQuery.data?.data]);
  const isLoading = productsQuery.isLoading;

  const listData = useMemo(() => {
    if (isLoading) {
      return Array.from({ length: 6 }).map((_, i) => ({ id: `skeleton-${i}` }));
    }
    return products;
  }, [isLoading, products]);

  const categoryOptions = useMemo<MobileCategoryOption[]>(
    () => [{ id: 'all', name: isHindi ? 'सभी श्रेणियां' : 'All Categories', slug: '' }, ...((categoriesQuery.data || []).map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
    })))],
    [categoriesQuery.data, isHindi],
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory) count++;
    if (minPrice || maxPrice) count++;
    if (sort !== 'popular') count++;
    return count;
  }, [selectedCategory, minPrice, maxPrice, sort]);

  const openFilterModal = () => {
    setTempMinPrice(minPrice);
    setTempMaxPrice(maxPrice);
    setTempSort(sort);
    setTempCategory(selectedCategory);
    setIsFilterModalOpen(true);
  };

  const applyFilters = () => {
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
    setSort(tempSort);
    setSelectedCategory(tempCategory);
    setPage(1);
    setIsFilterModalOpen(false);
  };

  const resetFilters = () => {
    setTempMinPrice('');
    setTempMaxPrice('');
    setTempSort('popular');
    setTempCategory('');
  };

  const totalPages = productsQuery.data?.pagination?.totalPages || 1;

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <Screen scroll={false}>
      <View className="flex-1">
        {/* Top Header Controls */}
        <View className="pb-3">
          <View className="flex-row items-center justify-between gap-2 mb-3">
            <Text className="text-2xl font-black text-primary-900">
              {t('mobile.productsPage.title')}
            </Text>

            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setIsSearchVisible(!isSearchVisible)}
                className={`h-10 w-10 items-center justify-center rounded-2xl border ${
                  isSearchVisible ? 'bg-primary-500 border-primary-500' : 'bg-white border-primary-100'
                } active:scale-95`}
              >
                <Feather name="search" size={18} color={isSearchVisible ? '#FFFFFF' : '#082018'} />
              </Pressable>

              <Pressable
                onPress={openFilterModal}
                className="h-10 flex-row items-center gap-2 rounded-2xl bg-white border border-primary-100 px-4 active:scale-95"
              >
                <Feather name="sliders" size={16} color="#082018" />
                <Text className="text-xs font-black uppercase tracking-wider text-primary-900">
                  {t('mobile.productsPage.filter')}
                </Text>
                {activeFiltersCount > 0 && (
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-primary-500">
                    <Text className="text-[10px] font-black text-white">{activeFiltersCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Search Input Bar (Toggleable) */}
          {isSearchVisible && (
            <View className="mb-3 flex-row items-center rounded-2xl border-2 border-primary-300 bg-white px-3 py-1.5 shadow-sm">
              <Feather name="search" size={16} color="#2D6A4F" />
              <TextInput
                value={search}
                onChangeText={(text) => {
                  setSearch(text);
                  setPage(1);
                }}
                placeholder={t('mobile.productsPage.searchPlaceholder')}
                className="mx-2 flex-1 py-1.5 text-xs font-bold text-primary-900"
                placeholderTextColor="#7a978b"
                autoFocus
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} className="p-1">
                  <Feather name="x-circle" size={16} color="#94A3B8" />
                </Pressable>
              )}
            </View>
          )}

          {/* Horizontal Category Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
            {categoryOptions.map((category) => {
              const isSelected = selectedCategory === category.slug;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => {
                    setSelectedCategory(category.slug);
                    setPage(1);
                  }}
                  className={`mr-2 rounded-full px-4 py-2 border ${
                    isSelected
                      ? 'bg-emerald-800 border-emerald-900 shadow-sm'
                      : 'bg-white border-primary-100'
                  } active:scale-95`}
                >
                  <Text
                    className={`text-xs font-black ${
                      isSelected ? 'text-white' : 'text-primary-900/70'
                    }`}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Product Grid / FlashList */}
        <FlashList
          data={listData as any}
          numColumns={2}
          estimatedItemSize={260}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !isLoading ? (
              <View className="rounded-[28px] bg-white p-8 items-center border border-primary-100 mt-6">
                <Feather name="package" size={48} color="#D4D4D8" />
                <Text className="text-base font-black text-primary-900 mt-3 text-center">
                  {t('mobile.productsPage.noProducts')}
                </Text>
                <Pressable
                  onPress={() => {
                    setSelectedCategory('');
                    setSearch('');
                    setMinPrice('');
                    setMaxPrice('');
                    setSort('popular');
                  }}
                  className="mt-4 rounded-full bg-primary-500 px-5 py-2.5 active:scale-95"
                >
                  <Text className="text-xs font-black uppercase text-white">
                    {isHindi ? 'सभी फ़िल्टर हटाएं' : 'Clear Filters'}
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const anyItem = item as any;
            if (anyItem && typeof anyItem === 'object' && 'id' in anyItem && typeof anyItem.id === 'string' && anyItem.id.startsWith('skeleton-')) {
              return (
                <View className="flex-1 px-1.5 mb-4">
                  <View className="p-3 rounded-[24px] border border-primary-100 bg-white gap-2">
                    <Skeleton height={140} borderRadius={16} className="w-full" />
                    <Skeleton width="90%" height={14} borderRadius={4} className="mt-1" />
                    <Skeleton width="60%" height={10} borderRadius={4} />
                    <View className="flex-row justify-between items-center mt-2">
                      <Skeleton width={50} height={14} borderRadius={4} />
                      <Skeleton width={70} height={28} borderRadius={14} />
                    </View>
                  </View>
                </View>
              );
            }

            return (
              <View className="flex-1 px-1.5 mb-4">
                <ProductCard product={anyItem} />
              </View>
            );
          }}
          ListFooterComponent={
            <View className="py-6 pb-12 flex-row items-center justify-center gap-2 flex-wrap">
              <Pressable
                disabled={page <= 1 || isLoading}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                style={{ backgroundColor: page <= 1 || isLoading ? '#F1F5F9' : '#FFFFFF' }}
                className={`h-9 px-3 flex-row items-center justify-center rounded-xl border border-slate-300 ${page <= 1 || isLoading ? 'opacity-40' : 'active:scale-95'}`}
              >
                <Feather name="chevron-left" size={14} color="#0F172A" />
                <Text className="text-xs font-black text-slate-800 ml-1">
                  {isHindi ? 'पिछला' : 'Prev'}
                </Text>
              </Pressable>

              {pageNumbers.map((pNum) => {
                const isCurrent = page === pNum;
                return (
                  <Pressable
                    key={pNum}
                    disabled={isLoading}
                    onPress={() => setPage(pNum)}
                    style={{
                      backgroundColor: isCurrent ? '#0B281E' : '#FFFFFF',
                      borderColor: isCurrent ? '#0B281E' : '#CBD5E1',
                    }}
                    className="h-9 w-9 items-center justify-center rounded-xl border active:scale-95 shadow-xs"
                  >
                    <Text
                      style={{ color: isCurrent ? '#FFFFFF' : '#0F172A' }}
                      className="text-xs font-black text-center"
                    >
                      {pNum}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                disabled={!productsQuery.data || page >= totalPages || isLoading}
                onPress={() => setPage((current) => current + 1)}
                style={{ backgroundColor: (!productsQuery.data || page >= totalPages || isLoading) ? '#F1F5F9' : '#FFFFFF' }}
                className={`h-9 px-3 flex-row items-center justify-center rounded-xl border border-slate-300 ${(!productsQuery.data || page >= totalPages || isLoading) ? 'opacity-40' : 'active:scale-95'}`}
              >
                <Text className="text-xs font-black text-slate-800 mr-1">
                  {isHindi ? 'अगला' : 'Next'}
                </Text>
                <Feather name="chevron-right" size={14} color="#0F172A" />
              </Pressable>
            </View>
          }
        />
      </View>

      {/* Filter & Sort Bottom Sheet Modal */}
      <Modal 
        visible={isFilterModalOpen} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setIsFilterModalOpen(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          {/* Backdrop Click Dismiss */}
          <Pressable 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
            onPress={() => setIsFilterModalOpen(false)} 
          />

          <View 
            onStartShouldSetResponder={() => true}
            className="w-full bg-white rounded-t-[32px] border-t-2 border-slate-300 p-6 max-h-[85%] relative z-10"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-slate-200">
              <View className="flex-row items-center gap-2">
                <Feather name="sliders" size={20} color="#0F172A" />
                <Text className="text-lg font-black text-slate-900">
                  {isHindi ? 'फ़िल्टर और क्रम' : 'Filter & Sort'}
                </Text>
              </View>

              <View className="flex-row items-center gap-4">
                <Pressable onPress={resetFilters}>
                  <Text className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                    {isHindi ? 'रीसेट करें' : 'Reset All'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setIsFilterModalOpen(false)} className="p-1 rounded-full bg-slate-100">
                  <Feather name="x" size={18} color="#64748B" />
                </Pressable>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="py-4">
              {/* Category Filter Section */}
              <View className="mb-6">
                <Text className="text-xs font-black uppercase tracking-[1.5px] text-slate-900 mb-3">
                  {t('mobile.home.categories')}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {categoryOptions.map((cat) => {
                    const isSelected = tempCategory === cat.slug;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setTempCategory(cat.slug)}
                        style={{
                          backgroundColor: isSelected ? '#0B281E' : '#F8FAFC',
                          borderColor: isSelected ? '#0B281E' : '#E2E8F0',
                        }}
                        className="rounded-full px-4 py-2.5 border active:scale-95"
                      >
                        <Text
                          style={{ color: isSelected ? '#FFFFFF' : '#334155' }}
                          className="text-xs font-black"
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Sort By Section */}
              <View className="mb-6">
                <Text className="text-xs font-black uppercase tracking-[1.5px] text-slate-900 mb-3">
                  {t('mobile.productsPage.sortBy')}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {sortOptions.map((opt) => {
                    const isSelected = tempSort === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => setTempSort(opt.key)}
                        style={{
                          backgroundColor: isSelected ? '#0B281E' : '#F8FAFC',
                          borderColor: isSelected ? '#0B281E' : '#E2E8F0',
                        }}
                        className="rounded-full px-4 py-2.5 border active:scale-95"
                      >
                        <Text
                          style={{ color: isSelected ? '#FFFFFF' : '#334155' }}
                          className="text-xs font-black"
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Price Range Section */}
              <View className="mb-6">
                <Text className="text-xs font-black uppercase tracking-[1.5px] text-slate-900 mb-3">
                  {isHindi ? 'मूल्य सीमा (₹)' : 'Price Range (₹)'}
                </Text>
                <View className="flex-row items-center gap-3">
                  <TextInput
                    value={tempMinPrice}
                    onChangeText={setTempMinPrice}
                    placeholder="Min ₹"
                    keyboardType="numeric"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text className="text-slate-400 font-bold">-</Text>
                  <TextInput
                    value={tempMaxPrice}
                    onChangeText={setTempMaxPrice}
                    placeholder="Max ₹"
                    keyboardType="numeric"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Apply Button */}
            <Pressable
              onPress={applyFilters}
              style={{ backgroundColor: '#0B281E' }}
              className="w-full rounded-2xl py-4 items-center justify-center active:scale-95 shadow-md mt-2"
            >
              <Text className="text-xs font-black uppercase tracking-[2px] text-white">
                {isHindi ? 'फ़िल्टर लागू करें' : 'Apply Filters'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
