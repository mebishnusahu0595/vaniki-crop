import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { dealerApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { currencyFormatter, getPrimaryImage } from '../../src/utils/format';

const Icon = Feather as any;

export default function DealerProductsScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

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
  const isApproved = currentUser?.approvalStatus === 'approved';

  const catalogueQuery = useQuery({
    queryKey: ['bulk-catalogue', { search, category: selectedCategory }],
    queryFn: () =>
      dealerApi.getBulkCatalogue({
        search: search || undefined,
        category: selectedCategory || undefined,
        limit: 100,
      }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dealer-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['bulk-catalogue'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const rawProducts = catalogueQuery.data?.data || [];

  // Instant client-side search across name, category, shortDescription, and description
  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rawProducts;
    return rawProducts.filter((p: any) => {
      const name = (p.name || '').toLowerCase();
      const slug = (p.slug || '').toLowerCase();
      const cat = (p.category?.name || '').toLowerCase();
      const shortDesc = (p.shortDescription || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const tech = (p.technicalName || '').toLowerCase();
      return (
        name.includes(q) ||
        slug.includes(q) ||
        cat.includes(q) ||
        shortDesc.includes(q) ||
        desc.includes(q) ||
        tech.includes(q)
      );
    });
  }, [rawProducts, search]);

  // Extract unique categories from raw products
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    rawProducts.forEach((p) => {
      if (p.category?.slug && p.category?.name) {
        map.set(p.category.slug, p.category.name);
      }
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [rawProducts]);

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View className="bg-white border-b border-primary-100 px-4 pt-3 pb-3">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
              Procurement Catalogue
            </Text>
            <Text className="text-xl font-black text-primary-900 leading-tight">
              Wholesale Products
            </Text>
          </View>
          <View className="rounded-full bg-primary-50 px-3 py-1 border border-primary-100">
            <Text className="text-xs font-black text-primary-800">
              {products.length} Products
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center rounded-2xl border border-primary-200 bg-offwhite px-3 py-2">
          <Icon name="search" size={16} color="#2D6A4F" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search crop medicines, seeds, fertilizers..."
            placeholderTextColor="#9BB5A8"
            style={{ outlineWidth: 0, outlineStyle: 'none' } as any}
            className="flex-1 ml-2 text-xs font-bold text-primary-900 py-0"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Icon name="x" size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* KYC Warning Banner if not approved */}
      {!isApproved && (
        <View className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1 pr-2">
            <Icon name="lock" size={14} color="#D97706" />
            <Text className="text-[11px] font-bold text-amber-900" numberOfLines={1}>
              B2B Prices locked: Awaiting SuperAdmin KYC approval
            </Text>
          </View>
          <Pressable
            onPress={() => onRefresh()}
            className="rounded-lg bg-amber-600 px-2.5 py-1"
          >
            <Text className="text-[10px] font-black uppercase text-white">Refresh</Text>
          </Pressable>
        </View>
      )}

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
          renderItem={({ item }) => (
            <DealerProductGridCard
              product={item}
              isApproved={isApproved}
              onUnapprovedAlert={() => {
                Alert.alert(
                  'KYC Approval Required',
                  'Wholesale bulk pricing and ordering are locked until SuperAdmin approves your store KYC. Once approved by SuperAdmin, full wholesale B2B pricing will be unlocked.',
                );
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Grid Product Card ───────────────────────────────────────────────────

function DealerProductGridCard({
  product,
  isApproved,
  onUnapprovedAlert,
}: {
  product: any;
  isApproved: boolean;
  onUnapprovedAlert: () => void;
}) {
  const primaryImage = getPrimaryImage(product);
  const defaultVariant = product.variants?.[0];
  const moq = product.moq || 1;
  const unitPrice = defaultVariant?.price || 0;
  const minOrderTotal = unitPrice * moq;

  const handleAction = () => {
    if (!isApproved) {
      onUnapprovedAlert();
      return;
    }
    router.push({ pathname: '/product/[slug]', params: { slug: product.slug } });
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })}
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

        {/* Pricing: Locked if KYC not approved */}
        {isApproved ? (
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
        ) : (
          <View className="mt-2">
            <View className="flex-row items-center gap-1">
              <Icon name="lock" size={13} color="#D97706" />
              <Text className="text-sm font-black text-amber-700">₹ •••••</Text>
            </View>
            <Text className="text-[10px] font-bold text-slate-400">KYC Approval Required</Text>
          </View>
        )}

        {/* Min Order Cost Banner */}
        <View className="mt-2 rounded-xl bg-primary-50 px-2 py-1 border border-primary-100">
          <Text className="text-[9px] font-bold text-primary-800">
            Min Total:{' '}
            <Text className="font-black">
              {isApproved ? currencyFormatter.format(minOrderTotal) : '••••'}
            </Text>
          </Text>
        </View>

        {/* Order Button */}
        <Pressable
          onPress={handleAction}
          style={{ backgroundColor: isApproved ? '#143D2E' : '#D97706' }}
          className="mt-2.5 rounded-xl py-2 items-center active:scale-95 shadow-xs"
        >
          <Text className="text-[11px] font-black uppercase tracking-[1px] text-white">
            {isApproved ? 'Order Bulk →' : '🔒 KYC Pending'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
