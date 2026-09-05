import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { dealerApi } from '../src/lib/api';
import { currencyFormatter, getPrimaryImage } from '../src/utils/format';

const Icon = Feather as any;

interface StagedItem {
  product: any;
  variant: any;
  petiQuantity: number;
  petiSize: number;
}

export default function ProductRequestScreen() {
  const queryClient = useQueryClient();
  const [selectedGarage, setSelectedGarage] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);

  // Selection modal state
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [petiQtyInput, setPetiQtyInput] = useState<string>('1');
  const [petiSizeInput, setPetiSizeInput] = useState<string>('12');
  const [customizerVisible, setCustomizerVisible] = useState(false);
  const [garageModalVisible, setGarageModalVisible] = useState(false);

  // Fetch Garages
  const { data: garagesData } = useQuery({
    queryKey: ['dealer-garages'],
    queryFn: dealerApi.getGarages,
  });
  const garages = garagesData?.data || [];

  // Fetch Catalogue Products
  const { data: catalogueData, isLoading: loadingProducts } = useQuery({
    queryKey: ['dealer-bulk-products', search],
    queryFn: () => dealerApi.getBulkCatalogue({ limit: 100, search: search || undefined }),
  });
  const products = catalogueData?.data || [];

  // Auto-select first garage
  React.useEffect(() => {
    if (garages.length > 0 && !selectedGarage) {
      setSelectedGarage(garages[0]);
    }
  }, [garages, selectedGarage]);

  // Mutation to submit batch
  const createRequestMutation = useMutation({
    mutationFn: (payload: any) => dealerApi.createProductRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-invoices'] });
      setStagedItems([]);
      setNotes('');
      Alert.alert(
        'Request Submitted! 🎉',
        'Your product stock request has been submitted to Superadmin. Once approved, the official Tally Tax Invoice will be generated and visible in your Invoices tab.',
        [
          {
            text: 'View Invoices',
            onPress: () => router.replace('/(tabs)/invoices'),
          },
          {
            text: 'OK',
          },
        ],
      );
    },
    onError: (error: any) => {
      Alert.alert('Submission Failed', error?.message || 'Failed to submit product requests.');
    },
  });

  const handleOpenCustomizer = (product: any) => {
    setSelectedProduct(product);
    setSelectedVariant(product.variants?.[0] || null);
    setPetiQtyInput('1');
    setPetiSizeInput(String(product.petiSize || 12));
    setCustomizerVisible(true);
  };

  const handleAddStagedItem = () => {
    if (!selectedProduct || !selectedVariant) return;

    const qty = parseInt(petiQtyInput, 10);
    const pSize = parseInt(petiSizeInput, 10);

    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Peti quantity must be at least 1.');
      return;
    }
    if (isNaN(pSize) || pSize <= 0) {
      Alert.alert('Invalid Size', 'Peti size must be at least 1.');
      return;
    }

    const duplicateIdx = stagedItems.findIndex(
      (item) =>
        (item.product.id || item.product._id) === (selectedProduct.id || selectedProduct._id) &&
        (item.variant.id || item.variant._id) === (selectedVariant.id || selectedVariant._id),
    );

    if (duplicateIdx > -1) {
      setStagedItems((prev) => {
        const next = [...prev];
        next[duplicateIdx].petiQuantity += qty;
        next[duplicateIdx].petiSize = pSize;
        return next;
      });
    } else {
      setStagedItems((prev) => [
        ...prev,
        { product: selectedProduct, variant: selectedVariant, petiQuantity: qty, petiSize: pSize },
      ]);
    }

    setCustomizerVisible(false);
    setSelectedProduct(null);
    setSelectedVariant(null);
  };

  const handleRemoveStagedItem = (index: number) => {
    setStagedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitBatch = () => {
    if (!selectedGarage) {
      Alert.alert('Selection Error', 'Please select a fulfillment garage / warehouse.');
      return;
    }
    if (stagedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please add at least 1 product to your request batch.');
      return;
    }

    const payload = {
      garageName: selectedGarage,
      notes: notes.trim() || undefined,
      items: stagedItems.map((item) => ({
        productId: item.product.id || item.product._id,
        productName: item.product.name,
        variantId: item.variant.id || item.variant._id,
        requestedPack: item.variant.packSize ? `${item.variant.packSize} ${item.variant.packUnit || ''}`.trim() : undefined,
        petiQuantity: item.petiQuantity,
        petiSize: item.petiSize,
        petiUnit: item.variant.packUnit || 'Liter',
      })),
    };

    createRequestMutation.mutate(payload);
  };

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="bg-white border-b border-primary-100 px-4 pt-3 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="p-1 rounded-xl bg-primary-50">
            <Icon name="arrow-left" size={20} color="#2D6A4F" />
          </Pressable>
          <View>
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
              B2B Stock Procurement
            </Text>
            <Text className="text-lg font-black text-primary-900 leading-tight">
              Request Products
            </Text>
          </View>
        </View>

        {stagedItems.length > 0 && (
          <View className="rounded-full bg-emerald-100 px-3 py-1">
            <Text className="text-xs font-black text-emerald-800">
              {stagedItems.length} in Batch
            </Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Garage Selection */}
        <View className="bg-white p-4 mx-4 mt-4 rounded-3xl border border-primary-100 shadow-xs">
          <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
            1. Fulfillment Warehouse / Garage
          </Text>
          <Pressable
            onPress={() => setGarageModalVisible(true)}
            className="flex-row items-center justify-between p-3.5 rounded-2xl bg-primary-50 border border-primary-200 mt-1"
          >
            <View className="flex-row items-center gap-2.5">
              <Icon name="home" size={18} color="#2D6A4F" />
              <Text className="text-sm font-black text-primary-900">
                {selectedGarage || 'Select Warehouse'}
              </Text>
            </View>
            <Icon name="chevron-down" size={18} color="#2D6A4F" />
          </Pressable>
        </View>

        {/* Staged Batch Items */}
        {stagedItems.length > 0 && (
          <View className="bg-white p-4 mx-4 mt-4 rounded-3xl border border-primary-100 shadow-xs">
            <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              2. Staged Batch Items ({stagedItems.length})
            </Text>
            <View className="gap-2.5">
              {stagedItems.map((item, idx) => (
                <View
                  key={idx}
                  className="flex-row items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-black text-slate-900 numberOfLines={1}">
                      {item.product.name}
                    </Text>
                    <Text className="text-xs font-semibold text-slate-500">
                      Pack: {item.variant.packSize} {item.variant.packUnit} • {item.petiQuantity} Peti ({item.petiSize} pcs/peti)
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRemoveStagedItem(idx)}
                    className="h-8 w-8 items-center justify-center rounded-xl bg-rose-50 border border-rose-100"
                  >
                    <Icon name="trash-2" size={14} color="#E11D48" />
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Notes Input */}
            <View className="mt-4">
              <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                Order Notes / Delivery Instructions (Optional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Urgent dispatch needed via Chauki route"
                placeholderTextColor="#94A3B8"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-900"
              />
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmitBatch}
              disabled={createRequestMutation.isPending}
              className="mt-4 rounded-2xl bg-emerald-600 py-3.5 items-center justify-center shadow-md active:scale-95 transition"
            >
              {createRequestMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-black uppercase tracking-widest text-white">
                  Submit Stock Request Batch
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Product Catalogue Selection */}
        <View className="p-4">
          <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
            3. Select Products to Add
          </Text>

          {/* Search */}
          <View className="flex-row items-center rounded-2xl border border-primary-200 bg-white px-3 py-2 mb-4">
            <Icon name="search" size={16} color="#2D6A4F" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search catalogue products..."
              placeholderTextColor="#9BB5A8"
              className="flex-1 ml-2 text-xs font-bold text-primary-900 py-0"
            />
            {search ? (
              <Pressable onPress={() => setSearch('')}>
                <Icon name="x" size={14} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>

          {loadingProducts ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator color="#2D6A4F" />
              <Text className="text-xs font-bold text-slate-400 mt-2">Loading products...</Text>
            </View>
          ) : (
            <View className="gap-3">
              {products.map((prod: any) => {
                const imgUrl = getPrimaryImage(prod);
                return (
                  <View
                    key={prod.id || prod._id}
                    className="flex-row items-center justify-between p-3 rounded-2xl bg-white border border-primary-100 shadow-2xs"
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <Image
                        source={{ uri: imgUrl }}
                        style={{ width: 44, height: 44, borderRadius: 12 }}
                        contentFit="cover"
                      />
                      <View className="flex-1 pr-2">
                        <Text className="text-sm font-black text-slate-900" numberOfLines={1}>
                          {prod.name}
                        </Text>
                        <Text className="text-[11px] font-semibold text-primary-600">
                          {prod.brand || 'Vaniki Crop'} • {prod.variants?.length || 1} packs
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => handleOpenCustomizer(prod)}
                      className="rounded-xl bg-primary-600 px-3.5 py-2 active:scale-95"
                    >
                      <Text className="text-xs font-black text-white">+ Add</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Warehouse Selector Modal */}
      <Modal visible={garageModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-[32px] p-6 max-h-[60%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-black text-slate-900">Select Fulfillment Garage</Text>
              <Pressable onPress={() => setGarageModalVisible(false)} className="p-1">
                <Icon name="x" size={20} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView>
              {garages.map((g: string) => (
                <Pressable
                  key={g}
                  onPress={() => {
                    setSelectedGarage(g);
                    setGarageModalVisible(false);
                  }}
                  className={`p-4 rounded-2xl mb-2 flex-row justify-between items-center ${
                    selectedGarage === g ? 'bg-primary-50 border border-primary-200' : 'bg-slate-50'
                  }`}
                >
                  <Text className={`text-sm font-bold ${selectedGarage === g ? 'text-primary-900' : 'text-slate-700'}`}>
                    {g}
                  </Text>
                  {selectedGarage === g && <Icon name="check" size={16} color="#2D6A4F" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Item Customizer Modal */}
      <Modal visible={customizerVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-[32px] p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-black text-slate-900">Configure Stock Petis</Text>
              <Pressable onPress={() => setCustomizerVisible(false)} className="p-1">
                <Icon name="x" size={20} color="#64748B" />
              </Pressable>
            </View>

            {selectedProduct && (
              <View className="space-y-4">
                <Text className="text-sm font-black text-slate-800">{selectedProduct.name}</Text>

                {/* Variant Selection */}
                <View>
                  <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Select Pack Size
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {selectedProduct.variants?.map((v: any) => {
                      const isSelected = (selectedVariant?.id || selectedVariant?._id) === (v.id || v._id);
                      return (
                        <Pressable
                          key={v.id || v._id}
                          onPress={() => setSelectedVariant(v)}
                          className={`px-3 py-2 rounded-xl border ${
                            isSelected ? 'bg-primary-50 border-primary-500' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <Text className={`text-xs font-bold ${isSelected ? 'text-primary-900' : 'text-slate-700'}`}>
                            {v.packSize} {v.packUnit} • {currencyFormatter.format(v.price)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Peti Quantity & Peti Size */}
                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Peti Quantity
                    </Text>
                    <TextInput
                      value={petiQtyInput}
                      onChangeText={setPetiQtyInput}
                      keyboardType="numeric"
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-900 text-center"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Pcs / Peti Size
                    </Text>
                    <TextInput
                      value={petiSizeInput}
                      onChangeText={setPetiSizeInput}
                      keyboardType="numeric"
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-900 text-center"
                    />
                  </View>
                </View>

                {/* Total Units Summary */}
                <View className="rounded-2xl bg-emerald-50 p-3.5 border border-emerald-100 flex-row justify-between items-center">
                  <Text className="text-xs font-bold text-emerald-800">Total Units in Request:</Text>
                  <Text className="text-base font-black text-emerald-900">
                    {(parseInt(petiQtyInput, 10) || 0) * (parseInt(petiSizeInput, 10) || 0)} Units
                  </Text>
                </View>

                <Pressable
                  onPress={handleAddStagedItem}
                  className="rounded-2xl bg-primary-600 py-3.5 items-center justify-center shadow-md active:scale-95"
                >
                  <Text className="text-sm font-black uppercase tracking-widest text-white">
                    Add to Request Batch
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
