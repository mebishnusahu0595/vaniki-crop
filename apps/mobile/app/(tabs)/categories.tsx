import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { CategoryCard } from '../../src/components/CategoryCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { storefrontApi } from '../../src/lib/api';

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

  return (
    <Screen scroll={false}>
      <SectionHeader title="Categories" kicker="Shop by crop need" />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search category"
        className="mb-5 rounded-[22px] border border-primary-100 bg-white px-4 py-4 text-base text-primary-900"
        placeholderTextColor="#7a978b"
      />
      <View className="flex-1 mt-2">
        <FlashList
          data={filtered}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View className="mb-5 flex-1 items-center">
              <CategoryCard
                category={item}
                onPress={() => router.push({ pathname: '/products', params: { category: item.slug } })}
              />
            </View>
          )}
          ListFooterComponent={
            <Pressable
              onPress={() => router.push('/products')}
              className="mt-4 mb-8 rounded-full bg-primary-500 px-5 py-4"
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
