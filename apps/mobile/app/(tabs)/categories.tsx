import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { CategoryCard } from '../../src/components/CategoryCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { storefrontApi } from '../../src/lib/api';
import { Skeleton } from '../../src/components/Skeleton';

export default function CategoriesScreen() {
  const categoriesQuery = useQuery({
    queryKey: ['mobile-categories'],
    queryFn: storefrontApi.categories,
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return categoriesQuery.data || [];

    return (categoriesQuery.data || []).filter((category) =>
      category.name.toLowerCase().includes(term),
    );
  }, [categoriesQuery.data, debouncedSearch]);

  const isLoading = categoriesQuery.isLoading;
  const listData = useMemo(() => {
    if (isLoading) {
      return Array.from({ length: 6 }).map((_, i) => ({ id: `skeleton-${i}` }));
    }
    return filtered;
  }, [isLoading, filtered]);

  return (
    <Screen scroll={false}>
      <View className="flex-1">
        <FlashList
          data={listData as any}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          estimatedItemSize={120}
          ListHeaderComponent={
            <View>
              <SectionHeader title="Categories" kicker="Shop by crop need" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search category"
                editable={!isLoading}
                className="mb-5 rounded-[22px] border border-primary-100 bg-white px-4 py-4 text-base text-primary-900"
                placeholderTextColor="#7a978b"
              />
            </View>
          }
          renderItem={({ item }) => {
            const anyItem = item as any;
            if (anyItem && typeof anyItem === 'object' && 'id' in anyItem && typeof anyItem.id === 'string' && anyItem.id.startsWith('skeleton-')) {
              return (
                <View className="mb-5 flex-1 items-center">
                  <View className="mr-3 items-center">
                    <Skeleton width={84} height={84} borderRadius={24} />
                    <Skeleton width={70} height={10} borderRadius={4} className="mt-3" />
                  </View>
                </View>
              );
            }

            return (
              <View className="mb-5 flex-1 items-center">
                <CategoryCard
                  category={anyItem}
                  onPress={() => router.push({ pathname: '/products', params: { category: anyItem.slug } })}
                />
              </View>
            );
          }}
          ListEmptyComponent={
            !isLoading ? (
              <View className="rounded-[24px] bg-white px-4 py-8">
                <Text className="text-center text-sm font-semibold text-primary-900/65">
                  No categories found.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            <Pressable
              onPress={() => router.push('/products')}
              className="mt-4 mb-8 rounded-full bg-primary-500 px-5 py-4 active:scale-95"
            >
              <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
                Browse All Products
              </Text>
            </Pressable>
          }
        />
      </View>
    </Screen>
  );
}
