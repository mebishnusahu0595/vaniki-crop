import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../src/components/Screen';
import { ProductCard } from '../src/components/ProductCard';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { storefrontApi } from '../src/lib/api';
import { useStoreStore } from '../src/store/useStoreStore';
import { Skeleton } from '../src/components/Skeleton';

const sortOptions = [
  { key: 'popular', label: 'Popular' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'newest', label: 'Newest Arrivals' },
  { key: 'rating', label: 'Top Rated' },
] as const;

interface MobileCategoryOption {
  id: string;
  name: string;
  slug: string;
}

export default function ProductsScreen() {
  const params = useLocalSearchParams<{ category?: string; search?: string }>();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(params.search || '');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(params.category || '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<(typeof sortOptions)[number]['key']>('popular');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Temporary filter state inside modal
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [tempSort, setTempSort] = useState<(typeof sortOptions)[number]['key']>('popular');
  const [tempCategory, setTempCategory] = useState('');

  const debouncedSearch = useDebouncedValue(search, 300);

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
    () => [{ id: 'all', name: 'All Categories', slug: '' }, ...((categoriesQuery.data || []).map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
    })))],
    [categoriesQuery.data],
  );

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

  const activeFiltersCount = (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (selectedCategory ? 1 : 0) + (sort !== 'popular' ? 1 : 0);
  const selectedCategoryName = categoryOptions.find((c) => c.slug === selectedCategory)?.name || 'All Products';
  const totalPages = productsQuery.data?.pagination.totalPages || 1;
  const pageNumbers = Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1);

  return (
    <Screen scroll={false}>
      <View className="flex-1">
        <FlashList
          data={listData as any}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          estimatedItemSize={250}
          ListHeaderComponent={
            <View className="mb-3">
              {/* Header Title Row with inline Search Toggle & Filter Button */}
              <View className="flex-row items-center justify-between py-2">
                <View className="flex-1 mr-2">
                  <Text className="text-xl font-black text-[#0F172A]" numberOfLines={1}>
                    {selectedCategoryName}
                  </Text>
                  <Text className="text-xs font-semibold text-slate-500">
                    {selectedStore ? `${selectedStore.name}` : 'All stores'}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  {/* Inline Search Toggle Icon */}
                  <Pressable
                    onPress={() => setIsSearchVisible(!isSearchVisible)}
                    style={{ backgroundColor: isSearchVisible ? '#000000' : '#FFFFFF' }}
                    className="h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 active:scale-95 shadow-xs"
                  >
                    <Feather name="search" size={18} color={isSearchVisible ? '#FFFFFF' : '#0F172A'} />
                  </Pressable>

                  {/* Filter & Sort Button (Black Theme) */}
                  <Pressable
                    onPress={openFilterModal}
                    style={{ backgroundColor: '#000000' }}
                    className="h-10 flex-row items-center gap-1.5 rounded-2xl px-4 active:scale-95 shadow-sm"
                  >
                    <Feather name="sliders" size={15} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF' }} className="text-xs font-black">Filter</Text>
                    {activeFiltersCount > 0 ? (
                      <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1">
                        <Text className="text-[10px] font-black text-slate-900">{activeFiltersCount}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              </View>

              {/* Inline Search Input Bar */}
              {isSearchVisible ? (
                <View className="mt-2 mb-2 flex-row items-center rounded-2xl border border-slate-300 bg-white px-3 py-1.5 shadow-xs">
                  <Feather name="search" size={16} color="#0F172A" />
                  <TextInput
                    value={search}
                    onChangeText={(val) => {
                      setSearch(val);
                      setPage(1);
                    }}
                    placeholder="Search products in this list..."
                    className="mx-2 flex-1 py-1 text-xs font-semibold text-slate-900"
                    style={{ outlineStyle: 'none', outlineWidth: 0 } as any}
                    placeholderTextColor="#94A3B8"
                    underlineColorAndroid="transparent"
                    autoFocus
                  />
                  {search ? (
                    <Pressable onPress={() => setSearch('')} className="p-1">
                      <Feather name="x" size={14} color="#94A3B8" />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {/* Category Horizontal Chips bar */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 mb-1">
                <View className="flex-row gap-2">
                  {categoryOptions.map((item) => {
                    const isSelected = selectedCategory === item.slug;
                    return (
                      <Pressable
                        key={item.id}
                        disabled={isLoading}
                        onPress={() => {
                          setSelectedCategory(item.slug);
                          setPage(1);
                        }}
                        style={{
                          backgroundColor: isSelected ? '#000000' : '#FFFFFF',
                          borderColor: isSelected ? '#000000' : '#CBD5E1',
                        }}
                        className={`rounded-2xl px-4 py-2 border ${isLoading ? 'opacity-50' : ''}`}
                      >
                        <Text
                          style={{ color: isSelected ? '#FFFFFF' : '#0F172A' }}
                          className="text-xs font-black"
                        >
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
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
            /* Clean Centered Page Number Buttons Pagination (1, 2, 3...) */
            <View className="py-6 pb-12 flex-row items-center justify-center gap-2 flex-wrap">
              {/* Prev Button */}
              <Pressable
                disabled={page <= 1 || isLoading}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                style={{ backgroundColor: page <= 1 || isLoading ? '#F1F5F9' : '#FFFFFF' }}
                className={`h-9 px-3 flex-row items-center justify-center rounded-xl border border-slate-300 ${page <= 1 || isLoading ? 'opacity-40' : 'active:scale-95'}`}
              >
                <Feather name="chevron-left" size={14} color="#0F172A" />
                <Text className="text-xs font-black text-slate-800 ml-1">Prev</Text>
              </Pressable>

              {/* Page Numbers 1, 2, 3... */}
              {pageNumbers.map((pNum) => {
                const isCurrent = page === pNum;
                return (
                  <Pressable
                    key={pNum}
                    disabled={isLoading}
                    onPress={() => setPage(pNum)}
                    style={{
                      backgroundColor: isCurrent ? '#000000' : '#FFFFFF',
                      borderColor: isCurrent ? '#000000' : '#CBD5E1',
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

              {/* Next Button */}
              <Pressable
                disabled={!productsQuery.data || page >= totalPages || isLoading}
                onPress={() => setPage((current) => current + 1)}
                style={{ backgroundColor: (!productsQuery.data || page >= totalPages || isLoading) ? '#F1F5F9' : '#FFFFFF' }}
                className={`h-9 px-3 flex-row items-center justify-center rounded-xl border border-slate-300 ${(!productsQuery.data || page >= totalPages || isLoading) ? 'opacity-40' : 'active:scale-95'}`}
              >
                <Text className="text-xs font-black text-slate-800 mr-1">Next</Text>
                <Feather name="chevron-right" size={14} color="#0F172A" />
              </Pressable>
            </View>
          }
        />
      </View>

      {/* Filter & Sort Bottom Sheet Modal */}
      <Modal visible={isFilterModalOpen} transparent animationType="slide" onRequestClose={() => setIsFilterModalOpen(false)}>
        <Pressable className="flex-1 bg-black/75 justify-end" onPress={() => setIsFilterModalOpen(false)}>
          <Pressable
            className="w-full bg-white rounded-t-[32px] border-t-2 border-slate-300 p-6 max-h-[85%]"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-slate-200">
              <View className="flex-row items-center gap-2">
                <Feather name="sliders" size={20} color="#0F172A" />
                <Text className="text-lg font-black text-slate-900">Filter & Sort</Text>
              </View>

              <View className="flex-row items-center gap-4">
                <Pressable onPress={resetFilters}>
                  <Text className="text-xs font-bold text-rose-600 uppercase tracking-wider">Reset All</Text>
                </Pressable>
                <Pressable onPress={() => setIsFilterModalOpen(false)} className="p-1">
                  <Feather name="x" size={22} color="#64748B" />
                </Pressable>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="py-4">
              {/* Category Filter Section */}
              <View className="mb-6">
                <Text className="text-xs font-black uppercase tracking-[1.5px] text-slate-900 mb-3">
                  Categories
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {categoryOptions.map((cat) => {
                    const isSelected = tempCategory === cat.slug;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setTempCategory(cat.slug)}
                        style={{
                          backgroundColor: isSelected ? '#000000' : '#F8FAFC',
                          borderColor: isSelected ? '#000000' : '#CBD5E1',
                        }}
                        className="rounded-2xl px-4 py-2.5 border active:scale-95"
                      >
                        <Text
                          style={{ color: isSelected ? '#FFFFFF' : '#0F172A' }}
                          className="text-xs font-black"
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Price Range Section with Slider Representation & Compact Input Boxes */}
              <View className="mb-6">
                <Text className="text-xs font-black uppercase tracking-[1.5px] text-slate-900 mb-2">
                  Price Range (₹)
                </Text>

                {/* Price Range Visual Slider Bar */}
                <View className="my-3 px-2">
                  <View className="h-2.5 w-full rounded-full bg-slate-200 relative justify-center">
                    <View className="h-2.5 rounded-full bg-black" style={{ width: '80%', marginLeft: '10%' }} />
                    <View className="h-5 w-5 rounded-full bg-white border-2 border-black shadow-md absolute left-[10%]" />
                    <View className="h-5 w-5 rounded-full bg-white border-2 border-black shadow-md absolute right-[10%]" />
                  </View>
                  <View className="flex-row justify-between mt-2">
                    <Text className="text-[11px] font-bold text-slate-500">₹0</Text>
                    <Text className="text-[11px] font-bold text-slate-500">₹10,000+</Text>
                  </View>
                </View>

                {/* Compact Min & Max Price Input Boxes */}
                <View className="flex-row items-center gap-3">
                  <View className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 flex-row items-center">
                    <Text className="text-xs font-bold text-slate-600 mr-1">₹</Text>
                    <TextInput
                      value={tempMinPrice}
                      onChangeText={setTempMinPrice}
                      placeholder="Min Price"
                      keyboardType="number-pad"
                      className="flex-1 text-xs font-black text-slate-900 py-1"
                      style={{ outlineStyle: 'none', outlineWidth: 0 } as any}
                      placeholderTextColor="#94A3B8"
                      underlineColorAndroid="transparent"
                    />
                  </View>

                  <Text className="text-xs font-bold text-slate-400">to</Text>

                  <View className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 flex-row items-center">
                    <Text className="text-xs font-bold text-slate-600 mr-1">₹</Text>
                    <TextInput
                      value={tempMaxPrice}
                      onChangeText={setTempMaxPrice}
                      placeholder="Max Price"
                      keyboardType="number-pad"
                      className="flex-1 text-xs font-black text-slate-900 py-1"
                      style={{ outlineStyle: 'none', outlineWidth: 0 } as any}
                      placeholderTextColor="#94A3B8"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                </View>
              </View>

              {/* Sort By Section */}
              <View className="mb-6">
                <Text className="text-xs font-black uppercase tracking-[1.5px] text-slate-900 mb-3">
                  Sort Products By
                </Text>
                <View className="gap-2.5">
                  {sortOptions.map((opt) => {
                    const isSelected = tempSort === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => setTempSort(opt.key)}
                        style={{
                          backgroundColor: isSelected ? '#F0FDF4' : '#F8FAFC',
                          borderColor: isSelected ? '#166534' : '#E2E8F0',
                        }}
                        className="rounded-2xl px-4 py-3.5 border-2 flex-row items-center justify-between active:scale-98"
                      >
                        <Text
                          style={{ color: isSelected ? '#166534' : '#0F172A' }}
                          className="text-sm font-bold"
                        >
                          {opt.label}
                        </Text>
                        {isSelected ? <Feather name="check-circle" size={18} color="#166534" /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Bottom Apply Action Button */}
            <View className="pt-3 border-t border-slate-200">
              <Pressable
                onPress={applyFilters}
                style={{ backgroundColor: '#000000' }}
                className="w-full rounded-2xl py-3.5 items-center justify-center active:scale-95 shadow-md"
              >
                <Text style={{ color: '#FFFFFF' }} className="text-xs font-black uppercase tracking-[1.5px]">
                  Apply Filters
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
