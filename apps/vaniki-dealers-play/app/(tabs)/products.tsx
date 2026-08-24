import { useState, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { dealerApi } from '../../src/lib/api';
import { currencyFormatter, getPrimaryImage } from '../../src/utils/format';

const Icon = Feather as any;

export default function DealerProductsScreen() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ category?: string; search?: string }>();
  const [search, setSearch] = useState(params.search || '');
  const [selectedCategory, setSelectedCategory] = useState(params.category || '');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch bulk catalogue
  const catalogueQuery = useQuery({
    queryKey: ['bulk-catalogue', selectedCategory, search],
    queryFn: () =>
      dealerApi.getBulkCatalogue({
        category: selectedCategory || undefined,
        search: search || undefined,
        limit: 50,
      }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['bulk-catalogue'] });
    setRefreshing(false);
  }, [queryClient]);

  const products = catalogueQuery.data?.data || [];

  // Extract unique categories from products
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p: any) => {
      if (p.category?.slug && p.category?.name) {
        map.set(p.category.slug, p.category.name);
      }
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [products]);

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View className="bg-white border-b border-primary-100 px-4 pt-3 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
              B2B Catalogue
            </Text>
            <Text className="text-xl font-black text-primary-900 leading-tight">
              Bulk Ordering
            </Text>
          </View>
          <View className="rounded-full bg-emerald-100 px-3 py-1">
            <Text className="text-[11px] font-black text-emerald-800">
              {products.length} Products
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center rounded-2xl border border-primary-200 bg-offwhite px-3 py-2">
          <Icon name="search" size={18} color="#2D6A4F" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search products, chemicals, brands..."
            placeholderTextColor="#9BB5A8"
            className="flex-1 ml-2 text-sm font-bold text-primary-900 py-0"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Icon name="x" size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Categories Horizontal Scroll */}
      <View className="bg-white border-b border-primary-50 py-2.5 px-4">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ slug: '', name: 'All Products' }, ...categories]}
          keyExtractor={(item) => item.slug || 'all'}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item.slug;
            return (
              <Pressable
                onPress={() => setSelectedCategory(item.slug)}
                className={`rounded-full px-4 py-1.5 border active:scale-95 ${
                  isSelected
                    ? 'bg-primary-700 border-primary-700'
                    : 'bg-white border-primary-100'
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    isSelected ? 'text-white' : 'text-primary-900'
                  }`}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Product List */}
      {catalogueQuery.isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text className="mt-3 text-xs font-bold text-slate-500">Loading products...</Text>
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
            <Icon name="package" size={32} color="#2D6A4F" />
          </View>
          <Text className="text-base font-black text-slate-800 text-center">No Products Found</Text>
          <Text className="text-xs font-semibold text-slate-500 text-center mt-1">
            Try adjusting your search or category filters.
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id || item._id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 12 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />
          }
          renderItem={({ item }) => <DealerProductGridCard product={item} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Grid Product Card ───────────────────────────────────────────────────

function DealerProductGridCard({ product }: { product: any }) {
  const primaryImage = getPrimaryImage(product);
  const defaultVariant = product.variants?.[0];
  const moq = product.moq || 1;
  const unitPrice = defaultVariant?.price || 0;
  const minOrderTotal = unitPrice * moq;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })
      }
      className="flex-1 rounded-[22px] border border-primary-100 bg-white overflow-hidden active:scale-[0.98] shadow-xs"
    >
      {/* Image with MOQ Ribbon */}
      <View className="relative bg-[#f4f7f6] pt-2">
        <Image
          source={{ uri: primaryImage }}
          placeholder={{ uri: 'https://placehold.co/400x400?text=Vaniki+Crop' }}
          style={{ width: '100%', height: 130 }}
          contentFit="contain"
          transition={400}
        />
        {/* MOQ Badge */}
        <View className="absolute left-2 top-2 rounded-full bg-emerald-800 px-2.5 py-0.5 shadow-xs">
          <Text className="text-[9px] font-black uppercase tracking-wider text-white">
            MOQ: {moq} {moq === 1 ? 'Unit' : 'Units'}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View className="p-3">
        <Text className="text-[9px] font-black uppercase tracking-[1.5px] text-primary-400">
          {product.category?.name || 'Crop Care'}
        </Text>
        <Text numberOfLines={2} className="mt-0.5 text-xs font-black text-primary-900 leading-tight">
          {product.name}
        </Text>

        {/* Pricing */}
        <View className="mt-2">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-base font-black text-primary-800">
              {currencyFormatter.format(unitPrice)}
            </Text>
            <Text className="text-[10px] font-bold text-slate-400">/unit</Text>
          </View>
          {defaultVariant?.mrp && defaultVariant.mrp > unitPrice ? (
            <Text className="text-[10px] font-semibold text-slate-400 line-through">
              MRP {currencyFormatter.format(defaultVariant.mrp)}
            </Text>
          ) : null}
        </View>

        {/* Min Order Cost Banner */}
        <View className="mt-2 rounded-xl bg-primary-50 px-2 py-1 border border-primary-100">
          <Text className="text-[9px] font-bold text-primary-800">
            Min Total: <Text className="font-black">{currencyFormatter.format(minOrderTotal)}</Text>
          </Text>
        </View>

        {/* Order Button */}
        <Pressable
          onPress={() =>
            router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })
          }
          style={{ backgroundColor: '#143D2E' }}
          className="mt-2.5 rounded-xl py-2 items-center active:scale-95 shadow-xs"
        >
          <Text className="text-[11px] font-black uppercase tracking-[1px] text-white">
            Order Bulk →
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
