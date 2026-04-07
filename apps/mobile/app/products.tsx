import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
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
] as const;

export default function ProductsScreen() {
  const params = useLocalSearchParams<{ category?: string; search?: string }>();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(params.search || '');
  const [sort, setSort] = useState<(typeof sortOptions)[number]['key']>('popular');
  const debouncedSearch = useDebouncedValue(search, 300);

  const productsQuery = useQuery({
    queryKey: ['mobile-products', page, params.category, debouncedSearch, selectedStore?.id, sort],
    queryFn: () =>
      storefrontApi.products({
        page,
        limit: 12,
        category: params.category,
        search: debouncedSearch,
        storeId: selectedStore?.id,
        sort,
      }),
  });

  const products = useMemo(() => productsQuery.data?.data || [], [productsQuery.data?.data]);

  return (
    <Screen>
      <SectionHeader title="Products" kicker={selectedStore ? `Showing ${selectedStore.name}` : 'All stores'} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search pesticides, fungicides..."
        className="mb-4 rounded-[22px] border border-primary-100 bg-white px-4 py-4 text-base text-primary-900"
        placeholderTextColor="#7a978b"
      />
      <View className="mb-5 flex-row gap-2">
        {sortOptions.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setSort(option.key)}
            className={`rounded-full px-4 py-3 ${sort === option.key ? 'bg-primary-500' : 'bg-white'}`}
          >
            <Text className={`text-xs font-black uppercase tracking-[1px] ${sort === option.key ? 'text-white' : 'text-primary-900'}`}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlashList
        data={products}
        numColumns={2}
        renderItem={({ item }) => (
          <View className="flex-1 px-1.5">
            <ProductCard product={item} />
          </View>
        )}
        ListFooterComponent={
          <View className="flex-row items-center justify-between py-4">
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
    </Screen>
  );
}
