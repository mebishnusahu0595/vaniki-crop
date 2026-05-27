import React, { useState } from 'react';
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
  Alert
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../utils/api';
import { Feather } from '@expo/vector-icons';
import type { DealerInventoryProduct, DealerInventoryVariant } from '../../types/admin';

const Icon = Feather as any;

interface DraftItem {
  product: DealerInventoryProduct;
  variant: DealerInventoryVariant;
  petiQuantity: number;
}

export default function ProductRequestsScreen() {
  const queryClient = useQueryClient();
  const [selectedGarage, setSelectedGarage] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // Staged batch items
  const [batchItems, setBatchItems] = useState<DraftItem[]>([]);

  // Selection state for adding new items
  const [selectedProduct, setSelectedProduct] = useState<DealerInventoryProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<DealerInventoryVariant | null>(null);
  const [petiQtyInput, setPetiQtyInput] = useState<string>('1');

  // Modals visibility
  const [garageModalVisible, setGarageModalVisible] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [variantModalVisible, setVariantModalVisible] = useState(false);

  // Fetch Garages
  const { data: garages = [], isLoading: loadingGarages } = useQuery({
    queryKey: ['admin-garages'],
    queryFn: adminApi.garages,
  });

  // Fetch Inventory Products for selection
  const { data: inventory = [], isLoading: loadingInventory } = useQuery({
    queryKey: ['admin-inventory-products'],
    queryFn: adminApi.inventoryProducts,
  });

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

  const handleAddStagedItem = () => {
    if (!selectedProduct) {
      alert('Please select a product first.');
      return;
    }
    if (!selectedVariant) {
      alert('Please select a pack size variant.');
      return;
    }
    const qty = parseInt(petiQtyInput, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Peti quantity must be at least 1.');
      return;
    }

    // Check if variant already exists in batch
    const duplicateIdx = batchItems.findIndex(
      item => item.product.id === selectedProduct.id && item.variant.id === selectedVariant.id
    );

    if (duplicateIdx > -1) {
      // Add quantity to existing
      setBatchItems(prev => {
        const next = [...prev];
        next[duplicateIdx].petiQuantity += qty;
        return next;
      });
    } else {
      // Add new staged item
      setBatchItems(prev => [
        ...prev, 
        { product: selectedProduct, variant: selectedVariant, petiQuantity: qty }
      ]);
    }

    // Reset selection inputs
    setSelectedProduct(null);
    setSelectedVariant(null);
    setPetiQtyInput('1');
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
      items: batchItems.map(item => ({
        productId: item.product.id,
        requestedPack: item.variant.label,
        petiQuantity: item.petiQuantity,
        quantity: item.petiQuantity * (item.product.petiSize || 12),
        requestedQuantity: item.petiQuantity * (item.product.petiSize || 12),
        price: item.variant.dealerPrice || item.variant.price,
        dealerPrice: item.variant.dealerPrice,
        offerPrice: item.variant.offerPrice,
        hsnCode: item.product.hsnCode
      }))
    };

    createRequestMutation.mutate(payload);
  };

  // Calculations for summary card
  const totalPeti = batchItems.reduce((sum, item) => sum + item.petiQuantity, 0);
  const totalVolume = batchItems.reduce((sum, item) => {
    const pSize = item.product.petiSize || 12;
    return sum + (item.petiQuantity * pSize);
  }, 0);

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} className="flex-1" style={{ overflow: 'visible' }}>
        
        {/* Form Container */}
        <View className="bg-white border border-zinc-100 rounded-[2rem] p-5 shadow-sm space-y-4">
          <Text className="text-zinc-900 font-black text-lg mb-2">Create Request</Text>

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

          <View className="h-px bg-zinc-100 my-2" />

          {/* Staging Product Picker */}
          <View>
            <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Product Name</Text>
            <TouchableOpacity
              onPress={() => setProductModalVisible(true)}
              className="flex-row justify-between items-center bg-zinc-50 border border-zinc-200 rounded-2xl py-4 px-4 active:bg-zinc-100"
            >
              <Text className="text-zinc-800 font-bold text-sm flex-1 mr-2" numberOfLines={1}>
                {selectedProduct ? `${selectedProduct.name} ${selectedProduct.shortDescription ? `(${selectedProduct.shortDescription})` : ''}` : 'Choose product...'}
              </Text>
              <Icon name="chevron-down" size={16} color="#71717A" />
            </TouchableOpacity>
          </View>

          {/* Product Info & Pricing Card */}
          {selectedProduct && (
            <View className="bg-emerald-50/50 rounded-[1.5rem] p-4 border border-emerald-100">
              <Text className="text-base font-black text-emerald-900 leading-tight">
                {selectedProduct.name}
              </Text>
              {selectedProduct.shortDescription ? (
                <Text className="mt-1 text-xs font-medium text-emerald-700 opacity-80">
                  {selectedProduct.shortDescription}
                </Text>
              ) : null}
              {selectedProduct.hsnCode ? (
                <Text className="mt-2 text-[9px] font-black text-emerald-600 bg-emerald-100 w-fit px-2 py-0.5 rounded-md border border-emerald-200">
                  HSN: {selectedProduct.hsnCode}
                </Text>
              ) : null}

              <View className="mt-4 pt-4 border-t border-emerald-200/50">
                <Text className="text-[9px] font-black uppercase tracking-wider text-emerald-600 mb-3">Product Pricing Information</Text>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row pb-1">
                  {selectedProduct.variants.map((v: any) => (
                    <View key={v.id} className="rounded-xl bg-white p-3 border border-emerald-100 mr-3 min-w-[140px]">
                      <Text className="text-xs font-black text-slate-900 mb-2">{v.label}</Text>
                      <View className="space-y-1.5">
                        <View className="flex-row justify-between items-center gap-3">
                          <Text className="text-[9px] font-bold text-slate-500 uppercase">Price (Dealer)</Text>
                          <Text className="text-[10px] font-black text-emerald-700">₹{v.dealerPrice || v.price || 'N/A'}</Text>
                        </View>
                        <View className="flex-row justify-between items-center gap-3">
                          <Text className="text-[9px] font-bold text-slate-500 uppercase">Offer Price</Text>
                          <Text className="text-[10px] font-black text-emerald-600">₹{v.offerPrice || 'N/A'}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Variant Selector */}
          {selectedProduct && (
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Pack Size Variant</Text>
              <TouchableOpacity
                onPress={() => setVariantModalVisible(true)}
                className="flex-row justify-between items-center bg-zinc-50 border border-zinc-200 rounded-2xl py-4 px-4 active:bg-zinc-100"
              >
                <Text className="text-zinc-800 font-bold text-sm">
                  {selectedVariant ? selectedVariant.label : 'Choose pack size...'}
                </Text>
                <Icon name="chevron-down" size={16} color="#71717A" />
              </TouchableOpacity>
            </View>
          )}

          {/* Peti Quantity Input */}
          {selectedProduct && (
            <View className="flex-row gap-4 items-end">
              <View className="flex-1">
                <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Peti Quantity</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={petiQtyInput}
                  onChangeText={setPetiQtyInput}
                  placeholder="Enter number of Petis..."
                  placeholderTextColor="#A1A1AA"
                  className="bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 px-4 text-zinc-900 font-bold text-sm h-12"
                />
              </View>
              <TouchableOpacity
                onPress={handleAddStagedItem}
                className="bg-emerald-950 border border-emerald-950 px-5 h-12 rounded-2xl items-center justify-center active:scale-95"
              >
                <Text className="text-white font-black text-xs uppercase tracking-widest">Add Item</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Batch Summary Card */}
        {batchItems.length > 0 && (
          <View className="mt-6" style={{ marginHorizontal: 2 }}>
            <View className="bg-emerald-950 rounded-3xl overflow-hidden" style={{ elevation: 6, padding: 24 }}>
              <View className="flex-row items-center gap-2 mb-4">
                <Icon name="info" size={16} color="#34D399" />
                <Text className="text-xs font-bold uppercase text-emerald-400" style={{ includeFontPadding: false }}>Request Volume Summary</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <View style={{ flex: 1 }}>
                  <Text className="text-[9px] font-bold uppercase text-emerald-300" style={{ includeFontPadding: false }}>Total Staged</Text>
                  <View className="flex-row items-baseline mt-1 gap-1">
                    <Text className="text-2xl font-extrabold text-white" style={{ includeFontPadding: false }}>{totalPeti}</Text>
                    <Text className="text-xs font-bold text-emerald-200" style={{ includeFontPadding: false }}>Petis</Text>
                  </View>
                </View>
                <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 24, alignItems: 'flex-end' }}>
                  <Text className="text-[9px] font-bold uppercase text-emerald-300" style={{ includeFontPadding: false }}>Estimated Volume</Text>
                  <View className="flex-row items-baseline mt-1 gap-1">
                    <Text className="text-2xl font-extrabold text-white" style={{ includeFontPadding: false }}>{totalVolume}</Text>
                    <Text className="text-xs font-bold text-emerald-200" style={{ includeFontPadding: false }}>Liters/Kg</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Batch Staged Items List */}
        {batchItems.length > 0 && (
          <View className="mt-6">
            <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3 ml-2">Request Batch Items</Text>
            {batchItems.map((item, idx) => (
              <View key={idx} className="flex-row justify-between items-center bg-white border border-zinc-100 rounded-3xl p-5 mb-3 shadow-sm">
                <View className="flex-1 mr-3">
                  <Text className="text-zinc-900 font-black text-base leading-tight">{item.product.name}</Text>
                  <Text className="text-[10px] font-bold text-emerald-600 mt-1">
                    {item.variant.label}
                    {item.variant.dealerPrice || item.variant.price ? ` • Dealer: ₹${item.variant.dealerPrice || item.variant.price}` : ''}
                    {item.variant.offerPrice ? ` • Offer: ₹${item.variant.offerPrice}` : ''}
                  </Text>
                  <Text className="mt-1 text-[10px] text-zinc-500 italic" numberOfLines={1}>
                    {item.product.hsnCode ? `HSN: ${item.product.hsnCode} • ` : ''}{item.product.shortDescription}
                  </Text>
                  <Text className="text-zinc-500 font-bold text-xs mt-2">
                    Qty: <Text className="text-zinc-800">{item.petiQuantity} Peti</Text>
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
          <View className="mt-6 bg-white border border-zinc-100 rounded-3xl p-5 shadow-sm">
            <Text className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-2">Request Notes (Optional)</Text>
            <TextInput
              placeholder="Provide special instructions or delivery details..."
              placeholderTextColor="#A1A1AA"
              value={notes}
              onChangeText={setNotes}
              className="text-zinc-800 text-xs font-semibold h-20 p-2 border border-zinc-200 rounded-2xl"
              multiline
            />
          </View>
        )}

        {/* Action Button */}
        {batchItems.length > 0 && (
          <TouchableOpacity
            onPress={handleSubmitRequest}
            disabled={createRequestMutation.isPending}
            className="mt-6 w-full rounded-2xl bg-emerald-700 py-4 items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
          >
            {createRequestMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-black text-xs uppercase tracking-[0.2em]">Submit Stock Request</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

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

      {/* Product Dropdown Modal */}
      <Modal
        visible={productModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setProductModalVisible(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setProductModalVisible(false)}
          className="flex-1 bg-black/40 justify-center items-center p-6"
        >
          <View className="bg-white rounded-3xl w-full max-h-[70%] border border-zinc-200 shadow-2xl p-6">
            <Text className="text-zinc-900 font-black text-base mb-4 uppercase tracking-wider">Select Product</Text>
            <FlatList
              data={inventory}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedProduct(item);
                    setSelectedVariant(null); // Reset variant on change
                    setProductModalVisible(false);
                  }}
                  className="py-4 border-b border-zinc-100 active:bg-zinc-50"
                >
                  <Text className="text-zinc-800 font-bold text-sm">
                    {item.name} {item.shortDescription ? <Text className="text-zinc-500 font-medium">({item.shortDescription})</Text> : null}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Variant Dropdown Modal */}
      <Modal
        visible={variantModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setVariantModalVisible(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setVariantModalVisible(false)}
          className="flex-1 bg-black/40 justify-center items-center p-6"
        >
          <View className="bg-white rounded-3xl w-full max-h-[50%] border border-zinc-200 shadow-2xl p-6">
            <Text className="text-zinc-900 font-black text-base mb-4 uppercase tracking-wider">Select Pack Variant</Text>
            <FlatList
              data={selectedProduct?.variants || []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedVariant(item);
                    setVariantModalVisible(false);
                  }}
                  className="py-4 border-b border-zinc-100 active:bg-zinc-50"
                >
                  <Text className="text-zinc-800 font-bold text-sm">{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}
