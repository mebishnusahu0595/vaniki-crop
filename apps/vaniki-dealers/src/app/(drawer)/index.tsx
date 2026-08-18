import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { adminApi } from '../../utils/api';
import { currencyFormatter } from '../../utils/format';
import { Feather } from '@expo/vector-icons';
import { resolveMediaUrl } from '../../utils/media';
import * as Linking from 'expo-linking';
import type { Product, Category } from '../../types/admin';

const Icon = Feather as any;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Product Details Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Quick Request Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestProduct, setRequestProduct] = useState<Product | null>(null);
  const [petiQuantity, setPetiQuantity] = useState('5');
  const [selectedPack, setSelectedPack] = useState('');
  const [selectedGarage, setSelectedGarage] = useState('');
  const [requestNotes, setRequestNotes] = useState('');

  // ─── Queries ─────────────────────────────────────────────────────────────

  // Dealer Promotions / Announcements
  const promotionsQuery = useQuery({
    queryKey: ['dealer-promotions'],
    queryFn: adminApi.promotions,
  });

  // Global Banners
  const bannersQuery = useQuery({
    queryKey: ['dealer-banners'],
    queryFn: adminApi.banners,
  });

  // Categories Query
  const categoriesQuery = useQuery({
    queryKey: ['dealer-categories'],
    queryFn: () => adminApi.categories({ limit: 50 }),
  });

  // Products Catalog Query
  const productsQuery = useQuery({
    queryKey: ['dealer-products'],
    queryFn: () => adminApi.products({ limit: 100 }),
  });

  // Garages List for product requests
  const garagesQuery = useQuery({
    queryKey: ['dealer-garages'],
    queryFn: adminApi.garages,
  });

  // Store Profile Query (for store name)
  const storeProfileQuery = useQuery({
    queryKey: ['dealer-store-profile'],
    queryFn: adminApi.storeSettings,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const createRequestMutation = useMutation({
    mutationFn: adminApi.createProductRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-requests'] });
      Alert.alert(
        'Request Submitted! ✅',
        'Your bulk product stock request has been sent to Super Admin. You can track its status in Request History.',
        [{ text: 'OK', onPress: () => setIsRequestModalOpen(false) }]
      );
      setPetiQuantity('5');
      setRequestNotes('');
    },
    onError: (err: any) => {
      Alert.alert('Request Failed', err.message || 'Could not submit product request. Please try again.');
    },
  });

  // ─── Refresh Handler ─────────────────────────────────────────────────────

  const onRefresh = useCallback(async () => {
    await Promise.all([
      promotionsQuery.refetch(),
      bannersQuery.refetch(),
      categoriesQuery.refetch(),
      productsQuery.refetch(),
      garagesQuery.refetch(),
      storeProfileQuery.refetch(),
    ]);
  }, [promotionsQuery, bannersQuery, categoriesQuery, productsQuery, garagesQuery, storeProfileQuery]);

  const isRefreshing =
    promotionsQuery.isFetching ||
    bannersQuery.isFetching ||
    categoriesQuery.isFetching ||
    productsQuery.isFetching;

  // ─── Filtered Products ───────────────────────────────────────────────────

  const rawProducts: Product[] = productsQuery.data?.data ?? [];
  const categories: Category[] = categoriesQuery.data?.data ?? [];
  const promotions = promotionsQuery.data?.data ?? [];
  const banners = bannersQuery.data ?? [];
  const garages = garagesQuery.data ?? ['Main Central Godown', 'North District Depot', 'South Regional Hub'];

  // Combined Banners List (Superadmin Promotions + Banners)
  const heroBanners = useMemo(() => {
    const list: Array<{ id: string; title: string; description?: string; imageUrl?: string; link?: string }> = [];

    // Add dealer promotions first
    promotions.forEach((p) => {
      if (p.isActive) {
        list.push({
          id: `promo-${p.id}`,
          title: p.title,
          description: p.description,
          imageUrl: p.image?.url ? resolveMediaUrl(p.image.url, p.image.publicId) : undefined,
          link: p.link,
        });
      }
    });

    // Add global banners
    banners.forEach((b) => {
      if (b.isActive) {
        list.push({
          id: `banner-${b.id}`,
          title: b.title,
          description: b.subtitle,
          imageUrl: b.image?.url ? resolveMediaUrl(b.image.url, b.image.publicId) : undefined,
          link: b.ctaLink,
        });
      }
    });

    return list;
  }, [promotions, banners]);

  const filteredProducts = useMemo(() => {
    return rawProducts.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.variants?.some((v) => v.sku?.toLowerCase().includes(searchQuery.toLowerCase()));

      const productCategoryId = typeof p.category === 'object' && p.category !== null ? (p.category as any)._id || (p.category as any).id : p.category;
      const matchesCategory =
        selectedCategory === 'all' ||
        productCategoryId === selectedCategory ||
        (typeof p.category === 'object' && (p.category as any)?.name === selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [rawProducts, searchQuery, selectedCategory]);

  const openProductDetails = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailModalOpen(true);
  };

  const openRequestModal = (product: Product) => {
    setRequestProduct(product);
    setSelectedPack(product.variants?.[0]?.label || '1L');
    setSelectedGarage(garages[0] || 'Main Central Godown');
    setIsDetailModalOpen(false);
    setIsRequestModalOpen(true);
  };

  const handleSendRequest = () => {
    if (!requestProduct) return;
    const qty = parseInt(petiQuantity, 10);
    if (!qty || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid number of Petis / Cartons.');
      return;
    }

    createRequestMutation.mutate({
      productId: requestProduct.id || (requestProduct as any)._id,
      productName: requestProduct.name,
      petiQuantity: qty,
      requestedQuantity: qty,
      requestedPack: selectedPack,
      garageName: selectedGarage || 'Main Central Godown',
      notes: requestNotes,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#143D2E']} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Top Header & Search Bar ────────────────────────────────────────── */}
        <View className="bg-[#143D2E] px-4 pt-4 pb-6 rounded-b-[2rem] shadow-lg shadow-emerald-950/20">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-emerald-300">
                Authorized Dealer Hub
              </Text>
              <Text className="text-xl font-black text-white" numberOfLines={1}>
                {storeProfileQuery.data?.name || (storeProfileQuery.data as any)?.storeName || 'Vaniki Agri Center'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(drawer)/profile')}
              activeOpacity={0.8}
              className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 border border-white/20"
            >
              <Icon name="check-circle" size={14} color="#34d399" />
              <Text className="text-xs font-bold text-white">Verified</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-md">
            <Icon name="search" size={18} color="#059669" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search formulations, insecticides, seeds..."
              placeholderTextColor="#94a3b8"
              className="ml-3 flex-1 text-sm font-semibold text-slate-800"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="x" size={16} color="#64748b" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ─── Banners / Announcements Carousel ──────────────────────────────── */}
        {heroBanners.length > 0 ? (
          <View className="mt-4 px-4">
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              className="rounded-[1.75rem] overflow-hidden"
              style={{ width: SCREEN_WIDTH - 32 }}
            >
              {heroBanners.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={item.link ? 0.9 : 1}
                  onPress={() => {
                    if (item.link) {
                      Linking.openURL(item.link).catch(() => undefined);
                    }
                  }}
                  style={{ width: SCREEN_WIDTH - 32 }}
                  className="bg-emerald-950 rounded-[1.75rem] overflow-hidden relative aspect-[2.3/1] shadow-md justify-end"
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      className="absolute inset-0 w-full h-full opacity-70"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-emerald-950" />
                  )}
                  <View className="bg-slate-950/70 p-4">
                    <Text className="text-white text-base font-black leading-tight drop-shadow-md">
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text className="text-emerald-300 text-xs font-semibold mt-1 drop-shadow-sm" numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ─── Quick B2B Shortcut Actions ───────────────────────────────────── */}
        <View className="mt-5 px-4">
          <View className="grid grid-cols-4 flex-row justify-between gap-2">
            {[
              {
                title: 'Inventory',
                icon: 'package',
                bg: 'bg-emerald-500/10',
                color: '#059669',
                to: '/(drawer)/inventory',
              },
              {
                title: 'Orders',
                icon: 'shopping-cart',
                bg: 'bg-blue-500/10',
                color: '#2563eb',
                to: '/(drawer)/orders',
              },
              {
                title: 'Invoices',
                icon: 'file-text',
                bg: 'bg-purple-500/10',
                color: '#7c3aed',
                to: '/(drawer)/invoices',
              },
              {
                title: 'Dashboard',
                icon: 'activity',
                bg: 'bg-amber-500/10',
                color: '#d97706',
                to: '/(drawer)/dashboard',
              },
            ].map((action, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => router.push(action.to as any)}
                activeOpacity={0.8}
                style={{ width: (SCREEN_WIDTH - 56) / 4 }}
                className="items-center rounded-2xl bg-white p-3 border border-slate-100 shadow-xs active:scale-95"
              >
                <View className={`h-11 w-11 items-center justify-center rounded-2xl ${action.bg}`}>
                  <Icon name={action.icon} size={20} color={action.color} />
                </View>
                <Text className="mt-2 text-[11px] font-black text-slate-800 text-center">{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Category Filter Chips ────────────────────────────────────────── */}
        <View className="mt-6">
          <View className="px-4 mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-black uppercase tracking-[1.5px] text-slate-400">Categories</Text>
            <Text className="text-xs font-bold text-emerald-700">{filteredProducts.length} Products Available</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
            <View className="flex-row items-center gap-2 pr-8">
              <TouchableOpacity
                onPress={() => setSelectedCategory('all')}
                className={`rounded-full px-4 py-2 border ${
                  selectedCategory === 'all'
                    ? 'bg-[#143D2E] border-[#143D2E]'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text
                  className={`text-xs font-black uppercase tracking-wider ${
                    selectedCategory === 'all' ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  All Products
                </Text>
              </TouchableOpacity>

              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  className={`rounded-full px-4 py-2 border ${
                    selectedCategory === cat.id
                      ? 'bg-[#143D2E] border-[#143D2E]'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-black uppercase tracking-wider ${
                      selectedCategory === cat.id ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ─── Products Catalog Grid ────────────────────────────────────────── */}
        <View className="mt-6 px-4">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-black text-slate-900">Wholesale Product Catalog</Text>
            <Text className="text-xs font-bold text-emerald-700">Factory Direct</Text>
          </View>

          {productsQuery.isLoading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#143D2E" />
              <Text className="mt-3 text-xs font-bold text-slate-400">Loading catalog items...</Text>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 items-center justify-center">
              <Icon name="package" size={32} color="#94a3b8" />
              <Text className="mt-3 text-sm font-black text-slate-700">No products found</Text>
              <Text className="text-xs text-slate-400 mt-1 text-center">
                Try searching for a different keyword or select another category.
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between gap-y-4">
              {filteredProducts.map((product) => {
                const primaryImage = product.images?.[0];
                const imgUri = primaryImage?.url ? resolveMediaUrl(primaryImage.url, primaryImage.publicId) : null;
                const firstVariant = product.variants?.[0];
                const wholesalePrice = firstVariant?.adminPrice || firstVariant?.price || (product as any).wholesalePrice || 0;
                const mrpPrice = firstVariant?.mrp || (wholesalePrice ? wholesalePrice * 1.25 : 0);
                const categoryName = typeof product.category === 'object' && product.category !== null ? (product.category as any).name : 'Crop Care';

                return (
                  <TouchableOpacity
                    key={product.id}
                    onPress={() => openProductDetails(product)}
                    activeOpacity={0.9}
                    style={{ width: (SCREEN_WIDTH - 44) / 2 }}
                    className="rounded-[1.75rem] border border-slate-100 bg-white p-3 shadow-sm active:scale-[0.98] flex flex-col justify-between"
                  >
                    <div>
                      {/* Product Thumbnail */}
                      <View className="relative aspect-square w-full overflow-hidden rounded-2xl bg-emerald-50/50 p-2 items-center justify-center">
                        {imgUri ? (
                          <Image source={{ uri: imgUri }} className="h-full w-full" resizeMode="contain" />
                        ) : (
                          <Icon name="image" size={32} color="#94a3b8" />
                        )}
                        {/* Margin Tag */}
                        <View className="absolute top-2 left-2 rounded-full bg-emerald-700 px-2 py-0.5 shadow-xs">
                          <Text className="text-[9px] font-black uppercase tracking-wider text-white">Wholesale</Text>
                        </View>
                      </View>

                      {/* Info */}
                      <View className="mt-3">
                        <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-700" numberOfLines={1}>
                          {categoryName}
                        </Text>
                        <Text className="mt-0.5 text-sm font-black text-slate-900 leading-tight" numberOfLines={2}>
                          {product.name}
                        </Text>

                        {/* Pricing */}
                        <View className="mt-2 flex-row items-baseline gap-1.5">
                          <Text className="text-base font-black text-emerald-800">
                            {currencyFormatter.format(wholesalePrice)}
                          </Text>
                          {mrpPrice > wholesalePrice ? (
                            <Text className="text-xs font-semibold text-slate-400 line-through">
                              {currencyFormatter.format(mrpPrice)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </div>

                    {/* Quick Action Button */}
                    <TouchableOpacity
                      onPress={() => openRequestModal(product)}
                      activeOpacity={0.85}
                      className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#143D2E] py-2.5 active:bg-emerald-900"
                    >
                      <Icon name="plus-circle" size={13} color="#ffffff" />
                      <Text className="text-xs font-black uppercase tracking-wider text-white">Request Stock</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ─── Factory Bulk Rebate Notice Banner ─────────────────────────────── */}
        <View className="mt-8 px-4">
          <View className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-xs">
            <View className="flex-row items-center gap-2.5">
              <View className="rounded-xl bg-amber-500 p-2 text-white">
                <Icon name="award" size={18} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-black text-amber-900">Direct Factory Bulk Rebate</Text>
                <Text className="text-xs font-semibold text-amber-800/80 mt-0.5">
                  Order 50+ Petis to unlock an additional 5% margin credit on your monthly GST invoice ledger.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ─── 1. PRODUCT DETAILS MODAL ────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={isDetailModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDetailModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-slate-950/60">
          <View className="max-h-[85%] rounded-t-[2.5rem] bg-white p-6 shadow-2xl">
            {selectedProduct && (() => {
              const firstVariant = selectedProduct.variants?.[0];
              const wholesalePrice = firstVariant?.adminPrice || firstVariant?.price || (selectedProduct as any).wholesalePrice || 0;
              const mrpPrice = firstVariant?.mrp || (wholesalePrice ? wholesalePrice * 1.25 : 0);

              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Close Button */}
                  <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
                    <Text className="text-xs font-black uppercase tracking-[2px] text-emerald-800">
                      Product Specifications
                    </Text>
                    <TouchableOpacity
                      onPress={() => setIsDetailModalOpen(false)}
                      className="rounded-full bg-slate-100 p-2"
                    >
                      <Icon name="x" size={16} color="#475569" />
                    </TouchableOpacity>
                  </View>

                  {/* High-res Image */}
                  <View className="mt-4 aspect-[4/3] w-full rounded-2xl bg-emerald-50/50 p-4 items-center justify-center">
                    {selectedProduct.images?.[0]?.url ? (
                      <Image
                        source={{
                          uri: resolveMediaUrl(
                            selectedProduct.images[0].url,
                            selectedProduct.images[0].publicId
                          ),
                        }}
                        className="h-full w-full"
                        resizeMode="contain"
                      />
                    ) : (
                      <Icon name="image" size={48} color="#94a3b8" />
                    )}
                  </View>

                  {/* Title & Brand */}
                  <View className="mt-4">
                    <Text className="text-xs font-black uppercase tracking-wider text-emerald-700">
                      {typeof selectedProduct.category === 'object' && selectedProduct.category !== null
                        ? (selectedProduct.category as any).name
                        : 'Agri Formulation'}
                    </Text>
                    <Text className="text-xl font-black text-slate-900 mt-1">{selectedProduct.name}</Text>

                    {/* Pricing Info */}
                    <View className="mt-3 flex-row items-baseline gap-3 rounded-2xl bg-emerald-50 p-3">
                      <Text className="text-2xl font-black text-emerald-800">
                        {currencyFormatter.format(wholesalePrice)}
                      </Text>
                      {mrpPrice > wholesalePrice ? (
                        <Text className="text-xs font-bold text-slate-500 line-through">
                          MRP: {currencyFormatter.format(mrpPrice)}
                        </Text>
                      ) : null}
                      <View className="ml-auto rounded-full bg-emerald-700 px-2.5 py-1">
                        <Text className="text-[10px] font-black uppercase tracking-wider text-white">
                          Factory Wholesale
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Description */}
                  {selectedProduct.description ? (
                    <View className="mt-5">
                      <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                        Description & Usage
                      </Text>
                      <Text className="text-sm font-semibold leading-relaxed text-slate-600">
                        {selectedProduct.description}
                      </Text>
                    </View>
                  ) : null}

                  {/* Variants / Packaging */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <View className="mt-5">
                      <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                        Available Pack Sizes
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {selectedProduct.variants.map((v, i) => (
                          <View
                            key={i}
                            className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2"
                          >
                            <Text className="text-xs font-black text-emerald-900">{v.label}</Text>
                            <Text className="text-[10px] font-bold text-slate-500">
                              {currencyFormatter.format(v.price)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Action Button: Open Request Modal */}
                  <TouchableOpacity
                    onPress={() => openRequestModal(selectedProduct)}
                    activeOpacity={0.9}
                    className="mt-8 flex-row items-center justify-center gap-2 rounded-2xl bg-[#143D2E] py-4 shadow-lg shadow-emerald-950/20 active:bg-emerald-900"
                  >
                    <Icon name="plus-circle" size={18} color="#ffffff" />
                    <Text className="text-sm font-black uppercase tracking-[1.5px] text-white">
                      Request This Stock From Factory
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ─── 2. PRODUCT REQUEST TO FACTORY MODAL ─────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={isRequestModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsRequestModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-slate-950/60">
          <View className="rounded-t-[2.5rem] bg-white p-6 shadow-2xl">
            {requestProduct && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
                  <View>
                    <Text className="text-[10px] font-black uppercase tracking-[2px] text-emerald-800">
                      Factory Stock Requisition
                    </Text>
                    <Text className="text-base font-black text-slate-900">{requestProduct.name}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsRequestModalOpen(false)}
                    className="rounded-full bg-slate-100 p-2"
                  >
                    <Icon name="x" size={16} color="#475569" />
                  </TouchableOpacity>
                </View>

                {/* Peti Quantity Input */}
                <View className="mt-5">
                  <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Required Peti / Carton Quantity
                  </Text>
                  <View className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <Icon name="box" size={18} color="#059669" />
                    <TextInput
                      value={petiQuantity}
                      onChangeText={(val) => setPetiQuantity(val.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                      placeholder="e.g. 10"
                      className="ml-3 flex-1 text-base font-black text-slate-900"
                    />
                    <Text className="text-xs font-bold text-slate-400">Petis / Cases</Text>
                  </View>
                </View>

                {/* Pack Size Selector */}
                <View className="mt-4">
                  <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Pack Size / Unit
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {requestProduct.variants && requestProduct.variants.length > 0 ? (
                      requestProduct.variants.map((v, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setSelectedPack(v.label)}
                          className={`rounded-xl px-4 py-2 border ${
                            selectedPack === v.label
                              ? 'bg-[#143D2E] border-[#143D2E]'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <Text
                            className={`text-xs font-black ${
                              selectedPack === v.label ? 'text-white' : 'text-slate-700'
                            }`}
                          >
                            {v.label}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <TouchableOpacity
                        onPress={() => setSelectedPack('Standard Case')}
                        className="rounded-xl px-4 py-2 bg-[#143D2E] border border-[#143D2E]"
                      >
                        <Text className="text-xs font-black text-white">Standard Case / 1L</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Destination Garage / Godown */}
                <View className="mt-4">
                  <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Destination Godown / Garage
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-2">
                      {garages.map((g, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => setSelectedGarage(g)}
                          className={`rounded-xl px-3.5 py-2 border ${
                            selectedGarage === g
                              ? 'bg-emerald-800 border-emerald-800'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <Text
                            className={`text-xs font-bold ${
                              selectedGarage === g ? 'text-white' : 'text-slate-700'
                            }`}
                          >
                            {g}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Additional Notes */}
                <View className="mt-4">
                  <Text className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Notes for Dispatch Manager (Optional)
                  </Text>
                  <TextInput
                    value={requestNotes}
                    onChangeText={setRequestNotes}
                    placeholder="e.g. Urgent dispatch needed before Friday spray season."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={2}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                  />
                </View>

                {/* Submit Action */}
                <TouchableOpacity
                  onPress={handleSendRequest}
                  disabled={createRequestMutation.isPending}
                  activeOpacity={0.9}
                  className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-[#143D2E] py-4 shadow-lg shadow-emerald-950/20 active:bg-emerald-900 disabled:opacity-60"
                >
                  {createRequestMutation.isPending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Icon name="send" size={16} color="#ffffff" />
                      <Text className="text-sm font-black uppercase tracking-[1.5px] text-white">
                        Submit Stock Request
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
