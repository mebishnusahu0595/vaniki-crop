import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../src/components/Screen';
import { ProductCard } from '../src/components/ProductCard';
import { SectionHeader } from '../src/components/SectionHeader';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { storefrontApi } from '../src/lib/api';
import { useStoreStore } from '../src/store/useStoreStore';

const sortOptions = [
  { key: 'popular', label: 'Popular' },
  { key: 'price_asc', label: 'Price Low' },
  { key: 'price_desc', label: 'Price High' },
  { key: 'newest', label: 'Newest' },
  { key: 'rating', label: 'Top Rated' },
  { key: 'name', label: 'Name' },
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
  const [selectedCategory, setSelectedCategory] = useState(params.category || '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<(typeof sortOptions)[number]['key']>('popular');
  const debouncedSearch = useDebouncedValue(search, 300);
  const categoriesQuery = useQuery({
    queryKey: ['mobile-product-categories'],
    queryFn: storefrontApi.categories,
  });

  const productsQuery = useQuery({
    queryKey: ['mobile-products', page, selectedCategory, debouncedSearch, selectedStore?.id, sort, minPrice, maxPrice],
    queryFn: () =>
      storefrontApi.products({
        page,
        limit: 12,
        category: selectedCategory || undefined,
        search: debouncedSearch,
        storeId: selectedStore?.id,
        sort,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
      }),
  });

  const products = useMemo(() => productsQuery.data?.data || [], [productsQuery.data?.data]);
  const categoryOptions = useMemo<MobileCategoryOption[]>(
    () => [{ id: 'all', name: 'All', slug: '' }, ...((categoriesQuery.data || []).map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
    })))],
    [categoriesQuery.data],
  );

  return (
    <Screen scroll={false}>
      <SectionHeader title="Products" kicker={selectedStore ? `Showing ${selectedStore.name}` : 'All stores'} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search pesticides, fungicides..."
        className="mb-4 rounded-[22px] border border-primary-100 bg-white px-4 py-4 text-base text-primary-900"
        placeholderTextColor="#7a978b"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        <View className="flex-row gap-2">
          {categoryOptions.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              setSelectedCategory(item.slug);
              setPage(1);
            }}
            className={`rounded-full px-4 py-3 ${selectedCategory === item.slug ? 'bg-primary-500' : 'bg-white'}`}
          >
            <Text className={`text-[10px] font-black uppercase tracking-[1.2px] ${selectedCategory === item.slug ? 'text-white' : 'text-primary-900'}`}>
              {item.name}
            </Text>
          </Pressable>
          ))}
        </View>
      </ScrollView>
      <View className="mb-4 flex-row gap-3">
        <TextInput
          value={minPrice}
          onChangeText={setMinPrice}
          placeholder="Min Price"
          keyboardType="number-pad"
          className="flex-1 rounded-[22px] border border-primary-100 bg-white px-4 py-4 text-base text-primary-900"
          placeholderTextColor="#7a978b"
        />
        <TextInput
          value={maxPrice}
          onChangeText={setMaxPrice}
          placeholder="Max Price"
          keyboardType="number-pad"
          className="flex-1 rounded-[22px] border border-primary-100 bg-white px-4 py-4 text-base text-primary-900"
          placeholderTextColor="#7a978b"
        />
      </View>
      <View className="mb-5 flex-row gap-2">
        {sortOptions.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => {
              setSort(option.key);
              setPage(1);
            }}
            className={`rounded-full px-4 py-3 ${sort === option.key ? 'bg-primary-500' : 'bg-white'}`}
          >
            <Text className={`text-xs font-black uppercase tracking-[1px] ${sort === option.key ? 'text-white' : 'text-primary-900'}`}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-1 mt-2 mb-4">
        <FlashList
          data={products}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View className="flex-1 px-1.5 mb-4">
              <ProductCard product={item} />
            </View>
          )}
          ListFooterComponent={
            <View className="flex-row items-center justify-between py-4 pb-8">
              <Pressable
                disabled={page <= 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                className={`rounded-full px-4 py-3 ${page <= 1 ? 'bg-primary-100' : 'bg-white'}`}
              >
                <Text className="text-xs font-black uppercase tracking-[1px] text-primary-900">Previous</Text>
              </Pressable>
              <Text className="text-xs font-black uppercase tracking-[2px] text-primary-400">
                Page {productsQuery.data?.pagination.page || 1}
              </Text>
              <Pressable
                disabled={!productsQuery.data || page >= productsQuery.data.pagination.totalPages}
                onPress={() => setPage((current) => current + 1)}
                className={`rounded-full px-4 py-3 ${
                  !productsQuery.data || page >= productsQuery.data.pagination.totalPages ? 'bg-primary-100' : 'bg-white'
                }`}
              >
                <Text className="text-xs font-black uppercase tracking-[1px] text-primary-900">Next</Text>
              </Pressable>
            </View>
          }
        />
      </View>
    </Screen>
  );
}
