import { useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { staffApi, type InventoryProduct } from '../src/lib/staffApi';
import { resolveMediaUrl } from '../src/utils/media';
import { currencyFormatter } from '../src/utils/format';

function categoryLabel(category: InventoryProduct['category']) {
  if (!category) return '';
  if (typeof category === 'string') return '';
  return category.name || '';
}

export default function InventoryScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  // local edits keyed by `${productId}:${variantId}` -> quantity string
  const [edits, setEdits] = useState<Record<string, string>>({});

  const inventoryQuery = useQuery({
    queryKey: ['dealer-staff-inventory'],
    queryFn: staffApi.inventoryProducts,
  });

  const products = useMemo(() => inventoryQuery.data || [], [inventoryQuery.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const saveMutation = useMutation({
    mutationFn: (entries: Array<{ productId: string; variantId: string; quantity: number }>) =>
      staffApi.updateInventory(entries),
    onSuccess: () => {
      setEdits({});
      queryClient.invalidateQueries({ queryKey: ['dealer-staff-inventory'] });
      Alert.alert('Saved', 'Inventory updated successfully.');
    },
    onError: (error) => Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.'),
  });

  const handleSave = () => {
    const entries: Array<{ productId: string; variantId: string; quantity: number }> = [];
    for (const product of products) {
      for (const variant of product.variants) {
        const key = `${product.id}:${variant.id}`;
        const raw = edits[key];
        if (raw === undefined) continue;
        const qty = Math.max(0, parseInt(raw || '0', 10) || 0);
        if (qty !== variant.quantity) {
          entries.push({ productId: product.id, variantId: variant.id, quantity: qty });
        }
      }
    }
    if (entries.length === 0) {
      Alert.alert('Nothing to save', 'Change at least one quantity first.');
      return;
    }
    saveMutation.mutate(entries);
  };

  const pendingCount = Object.keys(edits).length;

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
          <Feather name="arrow-left" size={20} color="#143D2E" />
        </Pressable>
        <Text className="text-lg font-black text-primary-900">Inventory</Text>
        <Pressable onPress={() => inventoryQuery.refetch()} className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
          <Feather name="refresh-cw" size={18} color="#143D2E" />
        </Pressable>
      </View>

      <View className="px-4 pb-2">
        <View className="flex-row items-center gap-2 rounded-full bg-white px-4 py-3 border border-primary-50">
          <Feather name="search" size={16} color="#7a978b" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search products..."
            placeholderTextColor="#7a978b"
            className="flex-1 text-sm font-semibold text-primary-900"
          />
        </View>
      </View>

      {inventoryQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#2D6A4F" />
          <Text className="mt-3 text-sm font-semibold text-primary-900/60">Loading inventory...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View className="rounded-[28px] bg-white p-8 border border-primary-50">
              <Text className="text-center text-base font-black text-primary-900">No products found.</Text>
            </View>
          ) : (
            filtered.map((product) => (
              <View key={product.id} className="mb-4 rounded-[24px] bg-white p-4 border border-primary-50">
                <View className="flex-row items-center gap-3">
                  {product.image ? (
                    <Image source={{ uri: resolveMediaUrl(product.image) }} style={{ width: 48, height: 48, borderRadius: 14 }} />
                  ) : (
                    <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-primary-50">
                      <Feather name="package" size={18} color="#527164" />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-sm font-black text-primary-900" numberOfLines={2}>{product.name}</Text>
                    {categoryLabel(product.category) ? (
                      <Text className="mt-0.5 text-[11px] font-semibold text-primary-900/50">{categoryLabel(product.category)}</Text>
                    ) : null}
                  </View>
                </View>

                <View className="mt-3 gap-2">
                  {product.variants.map((variant) => {
                    const key = `${product.id}:${variant.id}`;
                    const value = edits[key] ?? String(variant.quantity);
                    return (
                      <View key={variant.id} className="flex-row items-center justify-between gap-3 rounded-[16px] border border-primary-100 px-3 py-2">
                        <View className="flex-1">
                          <Text className="text-xs font-black text-primary-900">{variant.label}</Text>
                          <Text className="mt-0.5 text-[11px] font-semibold text-primary-900/50">
                            {currencyFormatter.format(variant.price)} · in stock {variant.quantity}
                          </Text>
                        </View>
                        <TextInput
                          value={value}
                          onChangeText={(t) => setEdits((cur) => ({ ...cur, [key]: t.replace(/[^0-9]/g, '') }))}
                          keyboardType="number-pad"
                          className="w-20 rounded-[12px] bg-primary-50 px-3 py-2 text-center text-base font-black text-primary-900"
                          placeholder="0"
                          placeholderTextColor="#7a978b"
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {pendingCount > 0 ? (
        <View className="absolute inset-x-0 bottom-0 border-t border-primary-100 bg-white px-4 pb-7 pt-3">
          <Pressable
            onPress={handleSave}
            disabled={saveMutation.isPending}
            className="flex-row items-center justify-center gap-2 rounded-full bg-primary-900 px-4 py-4 disabled:opacity-60"
          >
            {saveMutation.isPending ? <ActivityIndicator color="#ffffff" size="small" /> : <Feather name="save" size={16} color="#ffffff" />}
            <Text className="text-[11px] font-black uppercase tracking-[1px] text-white">
              {saveMutation.isPending ? 'Saving...' : `Save ${pendingCount} change${pendingCount > 1 ? 's' : ''}`}
            </Text>
          </Pressable>
          <Text className="mt-2 text-center text-[10px] font-semibold text-primary-900/45">
            Quantities can be increased here. Decreases happen automatically via orders.
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
