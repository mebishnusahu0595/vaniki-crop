import React, { useState, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal, 
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { resolveMediaUrl } from '../../utils/media';
import { Feather } from '@expo/vector-icons';
import type { DealerInventoryProduct, DealerInventoryVariant } from '../../types/admin';

const Icon = Feather as any;
const ImageComponent = Image as any;

interface DraftItem {
  product: DealerInventoryProduct;
  variant: DealerInventoryVariant;
  petiQuantity: number;
  petiSize: number;
}

export default function ProductRequestsScreen() {
  const queryClient = useQueryClient();
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedGarage, setSelectedGarage] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // Staged batch items
  const [batchItems, setBatchItems] = useState<DraftItem[]>([]);

  // Selection state for customizing popup
  const [selectedProduct, setSelectedProduct] = useState<DealerInventoryProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<DealerInventoryVariant | null>(null);
  const [petiQtyInput, setPetiQtyInput] = useState<string>('1');
  const [petiSizeInput, setPetiSizeInput] = useState<string>('12');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Modals visibility
  const [garageModalVisible, setGarageModalVisible] = useState(false);
  const [customizerModalVisible, setCustomizerModalVisible] = useState(false);

  // Fetch Garages
  const { data: garages = [] } = useQuery({
    queryKey: ['admin-garages'],
    queryFn: adminApi.garages,
  });

  // Fetch Inventory Products
  const { data: inventory = [], isLoading: loadingInventory } = useQuery({
    queryKey: ['admin-inventory-products'],
    queryFn: adminApi.inventoryProducts,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminApi.categories({ limit: 100 }),
  });
  const categories = categoriesData?.data || [];

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return inventory.filter(product => {
      const prodCategoryId = product.category?.id || (product.category as any)?._id;
      return !selectedCategory || prodCategoryId === selectedCategory;
    });
  }, [inventory, selectedCategory]);

  // Create Product Request Mutation
  const createRequestMutation = useMutation({
    mutationFn: (payload: any) => adminApi.createProductRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-requests'] });
      setBatchItems([]);
      setSelectedGarage('');
      setNotes('');
      alert('Stock request batch submitted to Super Admin successfully!');
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to submit product requests.');
    }
  });

  // Set default garage when garages load
  useState(() => {
    if (garages.length && !selectedGarage) {
      setSelectedGarage(garages[0]);
    }
  });

  if (garages.length && !selectedGarage) {
    setSelectedGarage(garages[0]);
  }

  const handleAddStagedItem = () => {
    if (!selectedProduct || !selectedVariant) return;

    const qty = parseInt(petiQtyInput, 10);
    const pSize = parseInt(petiSizeInput, 10);

    if (isNaN(qty) || qty <= 0) {
      alert('Peti quantity must be at least 1.');
      return;
    }
    if (isNaN(pSize) || pSize <= 0) {
      alert('Peti size must be at least 1.');
      return;
    }

    // Check if variant already exists in batch
    const duplicateIdx = batchItems.findIndex(
      item => item.product.id === selectedProduct.id && item.variant.id === selectedVariant.id
    );

    if (duplicateIdx > -1) {
      // Add quantity and overwrite petiSize
      setBatchItems(prev => {
        const next = [...prev];
        next[duplicateIdx].petiQuantity += qty;
        next[duplicateIdx].petiSize = pSize;
        return next;
      });
    } else {
      // Add new staged item
      setBatchItems(prev => [
        ...prev, 
        { product: selectedProduct, variant: selectedVariant, petiQuantity: qty, petiSize: pSize }
      ]);
    }

    // Reset customization popup
    setSelectedProduct(null);
    setSelectedVariant(null);
    setPetiQtyInput('1');
    setPetiSizeInput('12');
    setCustomizerModalVisible(false);
  };

  const handleRemoveStagedItem = (index: number) => {
    setBatchItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitRequest = () => {
    if (!selectedGarage) {
      alert('Please select a target garage warehouse.');
      return;
    }
    if (batchItems.length === 0) {
      alert('Please add at least one product into your request batch.');
      return;
    }

    const payload = {
      garageName: selectedGarage,
      notes: notes || undefined,
      items: batchItems.map(item => {
        const brand = (item.product.name || '').trim();
        const desc = (item.product.shortDescription || '').trim();
        const fullName = brand && desc && !brand.toLowerCase().includes(desc.toLowerCase()) ? `${brand} (${desc})` : (brand || desc);
        return {
          productId: item.product.id,
          productName: fullName,
          requestedPack: item.variant.label,
          petiQuantity: item.petiQuantity,
          petiSize: item.petiSize,
          quantity: item.petiQuantity * item.petiSize,
          requestedQuantity: item.petiQuantity * item.petiSize,
          price: item.variant.dealerPrice || item.variant.price,
          dealerPrice: item.variant.dealerPrice,
          offerPrice: item.variant.offerPrice,
          hsnCode: item.product.hsnCode
        };
      })
    };

    createRequestMutation.mutate(payload);
  };

  // Calculations for summary card
  const totalVolumeText = useMemo(() => {
    const groups: Record<string, number> = {};
    batchItems.forEach(item => {
      const unit = item.product.petiUnit || 'Liter';
      const vol = item.petiQuantity * item.petiSize;
      groups[unit] = (groups[unit] || 0) + vol;
    });
    const parts = Object.entries(groups).map(([unit, vol]) => `${vol} ${unit}`);
    return parts.length > 0 ? parts.join(', ') : '0 Liter';
  }, [batchItems]);

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={{ padding: 16, paddingBottom: batchItems.length > 0 ? 140 : 80 }} 
          className="flex-1"
        >
          {/* Main Form Box */}
          <View className="bg-white border border-zinc-100 rounded-[2rem] p-5 shadow-sm space-y-4 mb-4">
            <Text className="text-zinc-900 font-black text-base mb-2">Create Request</Text>

            {/* Garage Selector */}
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Select Garage / Source Warehouse</Text>
              <TouchableOpacity
                onPress={() => setGarageModalVisible(true)}
                className="flex-row justify-between items-center bg-zinc-50 border border-zinc-200 rounded-2xl py-4 px-4 active:bg-zinc-100"
              >
                <Text className="text-zinc-800 font-bold text-sm">
                  {selectedGarage || 'Choose target warehouse...'}
                </Text>
                <Icon name="chevron-down" size={16} color="#71717A" />
              </TouchableOpacity>
            </View>

            <View className="h-px bg-zinc-100 my-1" />

            {/* Category selection scroll */}
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Filter by Category</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={[{ id: '', name: 'All' }, ...categories]}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 4 }}
                renderItem={({ item }) => {
                  const isActive = selectedCategory === item.id;
                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedCategory(item.id)}
                      className={`px-4 py-2 rounded-full mr-2 border ${
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
          </View>

          {/* Staged Batch Summary Card (AT THE TOP) */}
          {batchItems.length > 0 && (
            <View className="mb-4" style={{ marginHorizontal: 2 }}>
              <View className="bg-emerald-950 rounded-3xl overflow-hidden" style={{ elevation: 6, padding: 20 }}>
                <View className="flex-row items-center gap-2 mb-4">
                  <Icon name="info" size={16} color="#34D399" />
                  <Text className="text-xs font-bold uppercase text-emerald-400">Request Volume Summary</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <View style={{ flex: 1 }}>
                    <Text className="text-[9px] font-bold uppercase text-emerald-300">Total Items</Text>
                    <View className="flex-row items-baseline mt-1 gap-1">
                      <Text className="text-2xl font-extrabold text-white">{batchItems.length}</Text>
                      <Text className="text-xs font-bold text-emerald-200">items</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1.5, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 20, alignItems: 'flex-end' }}>
                    <Text className="text-[9px] font-bold uppercase text-emerald-300">Estimated Volume</Text>
                    <Text className="text-lg font-extrabold text-white mt-1 text-right" numberOfLines={2}>
                      {totalVolumeText}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Product Cards Grid */}
          <View className="mb-6">
            <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3 ml-2">Choose Products below</Text>
            {loadingInventory ? (
              <ActivityIndicator size="small" color="#143D2E" className="my-6" />
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {filteredProducts.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    onPress={() => {
                      setSelectedProduct(product);
                      const firstVariant = product.variants?.[0] || null;
                      setSelectedVariant(firstVariant);
                      setPetiQtyInput('1');
                      setPetiSizeInput(String(product.petiSize || 12));
                      setCustomizerModalVisible(true);
                    }}
                    activeOpacity={0.8}
                    style={{ width: '48.5%' }}
                    className="bg-white border border-zinc-100 rounded-3xl p-3 mb-3 shadow-sm overflow-hidden"
                  >
                    <View className="aspect-square w-full bg-zinc-50 border border-zinc-100 rounded-2xl overflow-hidden mb-3.5 flex justify-center items-center">
                      {product.image ? (
                        <ImageComponent
                          source={{ uri: resolveMediaUrl(product.image) }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                        />
                      ) : (
                        <Icon name="package" size={28} color="#D4D4D8" />
                      )}
                    </View>
                    <Text className="text-zinc-900 font-black text-xs leading-tight" numberOfLines={1}>
                      {product.name}
                    </Text>
                    {product.shortDescription ? (
                      <Text className="text-[10px] text-zinc-500 font-semibold mt-1" numberOfLines={2}>
                        {product.shortDescription}
                      </Text>
                    ) : null}
                    {product.petiSize ? (
                      <Text className="text-[8px] text-emerald-800 font-black mt-2 bg-emerald-50 self-start px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {product.petiSize} {product.petiUnit || 'Liter'} per Peti
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
                {filteredProducts.length === 0 && (
                  <Text className="text-zinc-400 font-bold text-center w-full py-8">No products found in this category</Text>
                )}
              </View>
            )}
          </View>

          {/* Batch Staged Items List */}
          {batchItems.length > 0 && (
            <View className="mb-6">
              <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3 ml-2">Request Batch Items</Text>
              {batchItems.map((item, idx) => (
                <View key={idx} className="flex-row justify-between items-center bg-white border border-zinc-100 rounded-3xl p-5 mb-3 shadow-sm">
                  <View className="flex-1 mr-3">
                    <Text className="text-zinc-900 font-black text-sm leading-tight">{item.product.name}</Text>
                    <Text className="text-[10px] font-bold text-emerald-600 mt-1">
                      {item.variant.label}
                      {item.variant.dealerPrice || item.variant.price ? ` • Dealer: ₹${item.variant.dealerPrice || item.variant.price}` : ''}
                      {item.variant.offerPrice ? ` • Offer: ₹${item.variant.offerPrice}` : ''}
                    </Text>
                    <Text className="mt-1 text-[10px] text-zinc-500 italic" numberOfLines={1}>
                      {item.product.hsnCode ? `HSN: ${item.product.hsnCode} • ` : ''}{item.product.shortDescription}
                    </Text>
                    <Text className="text-zinc-500 font-bold text-xs mt-2">
                      Qty: <Text className="text-zinc-800">{item.petiQuantity} Peti ({item.petiQuantity * item.petiSize} {item.product.petiUnit || 'Liter'})</Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveStagedItem(idx)}
                    className="bg-rose-50 border border-rose-100 p-2.5 rounded-full"
                  >
                    <Icon name="trash-2" size={14} color="#E11D48" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Request Notes */}
          {batchItems.length > 0 && (
            <View className="bg-white border border-zinc-100 rounded-[2rem] p-5 shadow-sm space-y-3 mb-4">
              <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-1">Request Notes (Optional)</Text>
              <TextInput
                placeholder="Provide special instructions or delivery details..."
                placeholderTextColor="#A1A1AA"
                value={notes}
                onChangeText={setNotes}
                className="text-zinc-800 text-xs font-semibold h-20 p-3 border border-zinc-200 rounded-2xl"
                multiline
              />
            </View>
          )}

          {/* Submit Action Button */}
          {batchItems.length > 0 && (
            <TouchableOpacity
              onPress={handleSubmitRequest}
              disabled={createRequestMutation.isPending}
              className="w-full rounded-2xl bg-emerald-700 py-4 items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
            >
              {createRequestMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-black text-xs uppercase tracking-[0.2em]">Submit Stock Request</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Bottom Cart Bar */}
      {batchItems.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }}
          activeOpacity={0.9}
          className="absolute bottom-6 left-6 right-6 bg-emerald-800 rounded-2xl flex-row justify-between items-center px-5 py-3.5 shadow-2xl border border-emerald-700/50"
          style={{ elevation: 8 }}
        >
          <View className="flex-row items-center gap-3">
            <View className="bg-emerald-950 p-2 rounded-xl relative">
              <Icon name="shopping-cart" size={16} color="#fff" />
              <View className="absolute -top-1.5 -right-1.5 bg-rose-500 rounded-full h-4 min-w-4 px-1 items-center justify-center border border-emerald-800">
                <Text className="text-white text-[8px] font-black leading-none">{batchItems.length}</Text>
              </View>
            </View>
            <View>
              <Text className="text-[8px] font-bold uppercase text-emerald-200 tracking-wider">View Batch List</Text>
              <Text className="text-white font-extrabold text-[11px] mt-0.5" numberOfLines={1}>
                Volume: {totalVolumeText}
              </Text>
            </View>
          </View>
          <View className="bg-emerald-950/60 px-2.5 py-1.5 rounded-full flex-row items-center gap-1.5">
            <Text className="text-emerald-100 text-[8px] font-black uppercase tracking-wider">Go to list</Text>
            <Icon name="arrow-down" size={10} color="#fff" />
          </View>
        </TouchableOpacity>
      )}

      {/* Garage Dropdown Modal */}
      <Modal
        visible={garageModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setGarageModalVisible(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setGarageModalVisible(false)}
          className="flex-1 bg-black/40 justify-center items-center p-6"
        >
          <View className="bg-white rounded-3xl w-full max-h-[60%] border border-zinc-200 shadow-2xl p-6">
            <Text className="text-zinc-900 font-black text-base mb-4 uppercase tracking-wider">Select Garage Warehouse</Text>
            <FlatList
              data={garages}

              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedGarage(item);
                    setGarageModalVisible(false);
                  }}
                  className="py-4 border-b border-zinc-100 active:bg-zinc-50"
                >
                  <Text className="text-zinc-800 font-bold text-sm">{item}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text className="text-zinc-400 font-bold text-center py-6">No warehouses available</Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Product Customizer Popup Modal */}
      <Modal
        visible={customizerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCustomizerModalVisible(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setCustomizerModalVisible(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-white rounded-t-[3rem] p-6 border-t border-zinc-200 shadow-2xl space-y-6 max-h-[85%]"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-100">
              <View className="flex-row items-center flex-1 mr-4">
                <View className="h-12 w-12 bg-zinc-50 border border-zinc-100 rounded-xl overflow-hidden mr-3 justify-center items-center">
                  {selectedProduct?.image ? (
                    <ImageComponent
                      source={{ uri: resolveMediaUrl(selectedProduct.image) }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  ) : (
                    <Icon name="package" size={20} color="#D4D4D8" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-900 font-black text-sm leading-tight" numberOfLines={1}>
                    {selectedProduct?.name}
                  </Text>
                  {selectedProduct?.shortDescription ? (
                    <Text className="text-zinc-500 font-medium text-[10px] mt-0.5" numberOfLines={1}>
                      {selectedProduct.shortDescription}
                    </Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setCustomizerModalVisible(false)}
                className="bg-zinc-100 p-2 rounded-full"
              >
                <Icon name="x" size={16} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* Customizer content */}
            <ScrollView showsVerticalScrollIndicator={false} className="space-y-5">
              {/* Variant Selector */}
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Select Pack Size (Variant)</Text>
                <View className="flex-row flex-wrap">
                  {selectedProduct?.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        onPress={() => setSelectedVariant(v)}
                        className={`px-4 py-3 rounded-2xl mr-2.5 mb-2.5 border ${
                          isSelected
                            ? 'bg-emerald-800 border-emerald-800'
                            : 'bg-zinc-50 border-zinc-200'
                        }`}
                      >
                        <Text className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                          {v.label}
                        </Text>
                        <Text className={`text-[9px] mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-zinc-400'}`}>
                          ₹{v.dealerPrice || v.price} (Offer: ₹{v.offerPrice || 'N/A'})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Peti Size and Peti Quantity inputs */}
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">
                    Peti Size ({selectedProduct?.petiUnit || 'Liter'})
                  </Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={petiSizeInput}
                    onChangeText={setPetiSizeInput}
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Peti Quantity</Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={petiQtyInput}
                    onChangeText={setPetiQtyInput}
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View className="flex-row gap-3 pt-3">
              <TouchableOpacity
                onPress={() => setCustomizerModalVisible(false)}
                className="flex-1 border border-zinc-200 py-4 rounded-2xl items-center"
              >
                <Text className="text-zinc-500 font-bold text-xs uppercase tracking-wider">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddStagedItem}
                disabled={!selectedVariant || !petiQtyInput || !petiSizeInput}
                className="flex-1 bg-emerald-800 py-4 rounded-2xl items-center shadow-lg active:scale-95 disabled:opacity-50"
              >
                <Text className="text-white font-black text-xs uppercase tracking-wider">Add to Batch</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}
