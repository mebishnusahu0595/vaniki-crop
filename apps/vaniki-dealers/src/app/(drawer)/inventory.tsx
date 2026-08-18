import React, { useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { adminApi } from '../../utils/api';
import { currencyFormatter } from '../../utils/format';
import { resolveMediaUrl } from '../../utils/media';
import { Feather } from '@expo/vector-icons';
import type { DealerInventoryProduct } from '../../types/admin';

const Icon = Feather as any;

export default function InventoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Draft quantity state mapping "productId-variantId" -> number
  const [draft, setDraft] = useState<Record<string, number>>({});

  const { data: inventory = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: adminApi.inventoryProducts,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminApi.categories({ limit: 100 }),
  });
  const categories = categoriesData?.data || [];

  const updateInventoryMutation = useMutation({
    mutationFn: (entries: Array<{ productId: string; variantId: string; quantity: number }>) => 
      adminApi.updateInventory(entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      setDraft({});
      Alert.alert('Stock Updated! ✅', 'Your store inventory counts have been updated.');
    },
    onError: (error: any) => {
      Alert.alert('Update Failed', error.message || 'Failed to update inventory.');
    }
  });

  const getVariantKey = (productId: string, variantId: string) => `${productId}-${variantId}`;

  const handleQtyChange = (productId: string, variantId: string, value: number) => {
    const key = getVariantKey(productId, variantId);
    const product = inventory.find(p => p.id === productId);
    const variant = product?.variants.find(v => v.id === variantId);
    const originalQty = variant ? variant.quantity : 0;
    const nextQty = Math.max(0, value);

    setDraft(prev => {
      const updated = { ...prev };
      if (nextQty === originalQty) {
        delete updated[key];
      } else {
        updated[key] = nextQty;
      }
      return updated;
    });
  };

  const getQty = (productId: string, variantId: string, originalQty: number) => {
    const key = getVariantKey(productId, variantId);
    return draft[key] !== undefined ? draft[key] : originalQty;
  };

  const hasChanges = Object.keys(draft).length > 0;

  const handleSave = () => {
    const entries = Object.entries(draft).map(([key, quantity]) => {
      const [productId, variantId] = key.split('-');
      return { productId, variantId, quantity };
    });
    
    updateInventoryMutation.mutate(entries);
  };

  // Filter products based on search term and category
  const filteredProducts = inventory.filter(product => {
    const prodCategoryId = product.category?.id || (product.category as any)?._id;
    const categoryMatch = !selectedCategory || prodCategoryId === selectedCategory;
    const searchMatch = product.name.toLowerCase().includes(search.toLowerCase());
    return categoryMatch && searchMatch;
  });

  // Calculate totals
  const totalVariants = inventory.reduce((sum, p) => sum + (p.variants?.length || 0), 0);
  const lowStockCount = inventory.reduce((sum, p) => {
    return sum + (p.variants?.filter(v => (draft[getVariantKey(p.id, v.id)] ?? v.quantity) <= 5).length || 0);
  }, 0);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* ─── Search & Category Filter Header ──────────────────────────────── */}
        <View className="bg-white border-b border-slate-100 shadow-xs">
          <View className="px-4 pt-3 pb-2">
            <View className="flex-row items-center bg-slate-100 rounded-2xl px-4 py-2.5">
              <Icon name="search" size={17} color="#059669" />
              <TextInput
                placeholder="Search inventory formulations..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
                className="flex-1 ml-2 text-slate-900 font-semibold text-sm"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Icon name="x-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View className="px-4 py-2 flex-row items-center justify-between border-t border-slate-50">
            <View className="flex-row items-center gap-1.5">
              <Icon name="package" size={14} color="#059669" />
              <Text className="text-xs font-bold text-slate-700">{totalVariants} SKUs in Catalog</Text>
            </View>

            {lowStockCount > 0 ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 border border-amber-200">
                <Icon name="alert-triangle" size={12} color="#d97706" />
                <Text className="text-[10px] font-black uppercase text-amber-800">{lowStockCount} Low Stock</Text>
              </View>
            ) : null}
          </View>

          {/* Horizontal Category Scroll */}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: '', name: 'All Categories' }, ...categories]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, paddingTop: 2 }}
            renderItem={({ item }) => {
              const isActive = selectedCategory === item.id;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedCategory(item.id)}
                  className={`px-4 py-2 rounded-full mr-2 border ${
                    isActive
                      ? 'bg-[#143D2E] border-[#143D2E]'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-black uppercase tracking-wider ${
                      isActive ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* ─── Inventory Products List ──────────────────────────────────────── */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#143D2E" />
            <Text className="mt-3 text-slate-400 font-bold text-xs">Loading store inventory...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
            refreshControl={
              <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={['#143D2E']} />
            }
            ListEmptyComponent={
              <View className="items-center justify-center py-20 px-6 rounded-3xl bg-white border border-dashed border-slate-200">
                <Icon name="package" size={40} color="#94a3b8" />
                <Text className="mt-4 font-black text-slate-800 text-base">No inventory products</Text>
                <Text className="mt-1 text-center text-xs text-slate-400">
                  {search ? 'Try a different search term.' : 'Assigned products will appear here.'}
                </Text>
              </View>
            }
            renderItem={({ item: product }) => {
              const imgUri = product.image ? resolveMediaUrl(product.image) : null;

              return (
                <View className="mb-4 rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-xs">
                  {/* Product Header */}
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 rounded-2xl bg-emerald-50/60 p-1 border border-emerald-100/40 items-center justify-center">
                      {imgUri ? (
                        <Image source={{ uri: imgUri }} className="h-full w-full rounded-xl" resizeMode="contain" />
                      ) : (
                        <Icon name="package" size={20} color="#94a3b8" />
                      )}
                    </View>

                    <View className="flex-1">
                      <Text className="text-base font-black text-slate-900 leading-tight">
                        {product.name}
                      </Text>
                      <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mt-0.5">
                        {product.category?.name || 'Crop Care'}
                      </Text>
                    </View>

                    {/* Re-order Shortcut */}
                    <TouchableOpacity
                      onPress={() => router.push('/(drawer)/product-requests')}
                      className="rounded-full bg-emerald-50 px-3 py-1.5 border border-emerald-100 flex-row items-center gap-1 active:scale-95"
                    >
                      <Icon name="plus" size={12} color="#047857" />
                      <Text className="text-[10px] font-black uppercase text-emerald-800">Re-order</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Variants List */}
                  <View className="mt-4 space-y-2.5">
                    {product.variants.map((variant) => {
                      const currentQty = getQty(product.id, variant.id, variant.quantity);
                      const isLow = currentQty <= 5;
                      const hasDraftChange = draft[getVariantKey(product.id, variant.id)] !== undefined;

                      return (
                        <View
                          key={variant.id}
                          className={`flex-row items-center justify-between rounded-2xl p-3 border ${
                            hasDraftChange
                              ? 'bg-amber-50/50 border-amber-200'
                              : isLow
                              ? 'bg-rose-50/30 border-rose-100'
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          {/* Label & Price */}
                          <View>
                            <Text className="text-sm font-black text-slate-800">
                              {variant.label}
                            </Text>
                            <Text className="text-xs font-bold text-emerald-800 mt-0.5">
                              {currencyFormatter.format(variant.dealerPrice || variant.adminPrice || variant.price)}
                              <Text className="text-[10px] font-normal text-slate-400"> (MRP: {currencyFormatter.format(variant.mrp)})</Text>
                            </Text>
                          </View>

                          {/* Stepper Controls */}
                          <View className="flex-row items-center gap-2">
                            <TouchableOpacity
                              onPress={() => handleQtyChange(product.id, variant.id, currentQty - 1)}
                              className="h-8 w-8 rounded-xl bg-white border border-slate-200 items-center justify-center shadow-xs active:bg-slate-100"
                            >
                              <Icon name="minus" size={14} color="#334155" />
                            </TouchableOpacity>

                            <TextInput
                              value={String(currentQty)}
                              onChangeText={(val) => {
                                const parsed = parseInt(val.replace(/\D/g, ''), 10);
                                handleQtyChange(product.id, variant.id, isNaN(parsed) ? 0 : parsed);
                              }}
                              keyboardType="number-pad"
                              className="h-8 min-w-[40px] text-center text-sm font-black text-slate-900 bg-white border border-slate-200 rounded-xl px-2 shadow-xs"
                            />

                            <TouchableOpacity
                              onPress={() => handleQtyChange(product.id, variant.id, currentQty + 1)}
                              className="h-8 w-8 rounded-xl bg-[#143D2E] items-center justify-center shadow-xs active:bg-emerald-900"
                            >
                              <Icon name="plus" size={14} color="#ffffff" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* ─── Sticky Save Changes Bar ──────────────────────────────────────── */}
        {hasChanges && (
          <View className="absolute bottom-4 left-4 right-4 rounded-2xl bg-[#143D2E] p-4 flex-row items-center justify-between shadow-xl shadow-emerald-950/40">
            <View>
              <Text className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Unsaved Stock Edits
              </Text>
              <Text className="text-xs font-semibold text-white">
                {Object.keys(draft).length} items modified
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={updateInventoryMutation.isPending}
              className="rounded-xl bg-white px-5 py-2.5 active:bg-slate-100"
            >
              {updateInventoryMutation.isPending ? (
                <ActivityIndicator size="small" color="#143D2E" />
              ) : (
                <Text className="text-xs font-black uppercase tracking-wider text-[#143D2E]">
                  Save Changes
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
