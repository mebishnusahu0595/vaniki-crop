import React, { useState, useEffect } from 'react';
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
  Platform
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { currencyFormatter } from '../../utils/format';
import { resolveMediaUrl } from '../../utils/media';
import { Feather } from '@expo/vector-icons';
import type { DealerInventoryProduct } from '../../types/admin';

const Icon = Feather as any;
const ImageComponent = Image as any;

export default function InventoryScreen() {
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
      alert('Inventory updated successfully!');
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to update inventory.');
    }
  });

  const getVariantKey = (productId: string, variantId: string) => `${productId}-${variantId}`;

  const handleQtyChange = (productId: string, variantId: string, value: number) => {
    const key = getVariantKey(productId, variantId);
    
    // Find original value
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

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Search Header */}
        <View className="bg-white border-b border-zinc-100 shadow-sm">
          <View className="px-4 pt-4 pb-2">
            <View className="flex-row items-center bg-zinc-100 rounded-2xl px-4 py-3">
              <Icon name="search" size={18} color="#71717A" />
              <TextInput
                placeholder="Search inventory products..."
                placeholderTextColor="#A1A1AA"
                value={search}
                onChangeText={setSearch}
                className="flex-1 ml-2 text-zinc-900 font-semibold text-sm"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Icon name="x-circle" size={16} color="#A1A1AA" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Horizontal Category Scroll */}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: '', name: 'All' }, ...categories]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}
            renderItem={({ item }) => {
              const isActive = selectedCategory === item.id;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedCategory(item.id)}
                  className={`px-4 py-2 rounded-full mr-2.5 border ${
                    isActive
                      ? 'bg-emerald-800 border-emerald-800'
                      : 'bg-zinc-100 border-zinc-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-black uppercase tracking-wider ${
                      isActive ? 'text-white' : 'text-zinc-500'
                    }`}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Inventory List */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#143D2E" />
            <Text className="mt-3 text-zinc-400 font-bold">Loading inventory items...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl 
                refreshing={isFetching} 
                onRefresh={refetch} 
                colors={['#143D2E']} 
              />
            }
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center py-20">
                <Icon name="package" size={48} color="#D4D4D8" />
                <Text className="text-zinc-500 font-black mt-4 uppercase tracking-widest text-xs">No Products Found</Text>
              </View>
            }
            renderItem={({ item: product }) => (
              <View className="bg-white border border-zinc-100 rounded-[2rem] p-5 mb-4 shadow-sm overflow-hidden">
                {/* Product Detail Card Header */}
                <View className="flex-row items-center">
                  <View className="h-16 w-16 bg-zinc-50 border border-zinc-100 rounded-2xl overflow-hidden mr-4">
                    {product.image ? (
                      <ImageComponent
                        source={{ uri: resolveMediaUrl(product.image) }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                    ) : (
                      <View className="flex-1 justify-center items-center">
                        <Icon name="image" size={24} color="#A1A1AA" />
                      </View>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-zinc-900 font-black text-base">{product.name}</Text>
                    {product.petiSize ? (
                      <Text className="text-[10px] text-emerald-800 font-black uppercase tracking-wider mt-1 bg-emerald-50 self-start px-2 py-0.5 rounded-full">
                        {product.petiSize} {product.petiUnit || 'Liter'} per Peti
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Variants List */}
                <View className="mt-4 pt-4 border-t border-zinc-100 space-y-3">
                  {product.variants.map((variant) => {
                    const currentQty = getQty(product.id, variant.id, variant.quantity);
                    const isChanged = currentQty !== variant.quantity;

                    return (
                      <View 
                        key={variant.id} 
                        className={`flex-row justify-between items-center p-3.5 border rounded-2xl ${
                          isChanged ? 'bg-emerald-50/30 border-emerald-300' : 'bg-zinc-50/50 border-zinc-100'
                        }`}
                      >
                        <View className="flex-1 mr-2">
                          <Text className="text-zinc-900 font-black text-sm">{variant.label}</Text>
                          <Text className="text-xs text-zinc-500 font-bold mt-0.5">
                            Dealer Price: {currencyFormatter.format(variant.dealerPrice || variant.price)}
                          </Text>
                        </View>

                        {/* Quantity Counter Control */}
                        <View className="flex-row items-center border border-zinc-200 bg-white rounded-xl overflow-hidden">
                          <TouchableOpacity 
                            onPress={() => handleQtyChange(product.id, variant.id, currentQty - 1)}
                            className="p-2.5 bg-zinc-50 active:bg-zinc-100"
                          >
                            <Icon name="minus" size={14} color="#3F3F46" />
                          </TouchableOpacity>
                          
                          <TextInput
                            keyboardType="number-pad"
                            value={String(currentQty)}
                            onChangeText={(val) => {
                              const numVal = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
                              handleQtyChange(product.id, variant.id, numVal);
                            }}
                            className="w-12 text-center text-zinc-950 font-black text-sm h-9"
                          />

                          <TouchableOpacity 
                            onPress={() => handleQtyChange(product.id, variant.id, currentQty + 1)}
                            className="p-2.5 bg-zinc-50 active:bg-zinc-100"
                          >
                            <Icon name="plus" size={14} color="#3F3F46" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          />
        )}

        {/* Sticky Bottom Save Changes Banner */}
        {hasChanges && (
          <View className="absolute bottom-0 left-0 right-0 bg-zinc-900 px-6 py-4 flex-row justify-between items-center border-t border-zinc-800 shadow-2xl rounded-t-[2rem]">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Unsaved Changes</Text>
              <Text className="text-white font-black text-sm mt-0.5">
                {Object.keys(draft).length} items modified
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleSave}
              disabled={updateInventoryMutation.isPending}
              className="bg-emerald-500 px-6 py-3 rounded-2xl active:scale-95 flex-row items-center"
            >
              {updateInventoryMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="save" size={14} color="#fff" />
                  <Text className="text-white font-black text-xs uppercase tracking-widest ml-2">Save Quantity</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
