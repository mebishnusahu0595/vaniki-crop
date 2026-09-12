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
  unitPrice: number;
}

// Standard packaging specs
function getVariantPcsPerPeti(variant: any, defaultSize = 10): number {
  if (variant?.petiSize && variant.petiSize > 0) return variant.petiSize;
  const label = (variant?.label || variant?.packSize || '').toString().toLowerCase();
  const volume = variant?.volume ? Number(variant.volume) : 0;
  const unit = (variant?.unit || variant?.packUnit || '').toString().toLowerCase();

  if (label.includes('5 l') || label.includes('5l') || (volume === 5 && unit.includes('l'))) return 4;
  if (label.includes('1 l') || label.includes('1l') || label.includes('1 kg') || (volume === 1 && (unit.includes('l') || unit.includes('k')))) return 10;
  if (label.includes('500') || volume === 500) return 20;
  if (label.includes('250') || volume === 250) return 40;
  if (label.includes('100') || volume === 100) return 80;
  return defaultSize;
}

export default function ProductRequestScreen() {
  const queryClient = useQueryClient();
  const [selectedGarage, setSelectedGarage] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);

  // Selection modal state
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [variantPetiMap, setVariantPetiMap] = useState<Record<string, number>>({});
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
    const initialMap: Record<string, number> = {};
    const firstVarId = product.variants?.[0]?.id || product.variants?.[0]?._id;
    if (firstVarId) {
      initialMap[firstVarId] = 1;
    }
    setVariantPetiMap(initialMap);
    setCustomizerVisible(true);
  };

  const setVariantPeti = (varId: string, count: number) => {
    setVariantPetiMap((prev) => ({
      ...prev,
      [varId]: Math.max(0, count),
    }));
  };

  const handleAddStagedItems = () => {
    if (!selectedProduct || !selectedProduct.variants) return;

    const variantsToAdd = selectedProduct.variants
      .map((v: any) => {
        const vId = v.id || v._id;
        const petis = variantPetiMap[vId] || 0;
        const pcsPerPeti = getVariantPcsPerPeti(v, selectedProduct.petiSize || 10);
        return {
          variant: v,
          vId,
          petis,
          pcsPerPeti,
          unitPrice: v.price || 0,
        };
      })
      .filter((item: any) => item.petis > 0);

    if (variantsToAdd.length === 0) {
      Alert.alert('Selection Error', 'Please select at least 1 Peti for any pack size.');
      return;
    }

    setStagedItems((prev) => {
      const next = [...prev];
      for (const toAdd of variantsToAdd) {
        const existingIdx = next.findIndex(
          (item) =>
            (item.product.id || item.product._id) === (selectedProduct.id || selectedProduct._id) &&
            (item.variant.id || item.variant._id) === toAdd.vId,
        );

        if (existingIdx > -1) {
          next[existingIdx].petiQuantity += toAdd.petis;
          next[existingIdx].petiSize = toAdd.pcsPerPeti;
        } else {
          next.push({
            product: selectedProduct,
            variant: toAdd.variant,
            petiQuantity: toAdd.petis,
            petiSize: toAdd.pcsPerPeti,
            unitPrice: toAdd.unitPrice,
          });
        }
      }
      return next;
    });

    setCustomizerVisible(false);
    setSelectedProduct(null);
    setVariantPetiMap({});
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
        requestedPack: item.variant.label || `${item.variant.packSize || item.variant.volume || ''} ${item.variant.packUnit || item.variant.unit || 'Liter'}`.trim(),
        requestedQuantity: item.petiQuantity * item.petiSize,
        petiQuantity: item.petiQuantity,
        petiSize: item.petiSize,
        petiUnit: item.variant.packUnit || item.variant.unit || 'Liter',
        dealerPrice: item.unitPrice || 0,
        offerPrice: item.unitPrice || 0,
        hsnCode: item.product.hsnCode || '38089190',
        taxRate: item.product.taxRate || 18,
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
              {stagedItems.map((item, idx) => {
                const totalUnits = item.petiQuantity * item.petiSize;
                const totalCost = totalUnits * (item.unitPrice || 0);
                const packLabel = item.variant.label || `${item.variant.packSize || item.variant.volume || ''} ${item.variant.packUnit || item.variant.unit || 'Liter'}`.trim();

                return (
                  <View
                    key={idx}
                    className="flex-row items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80"
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-sm font-black text-slate-900" numberOfLines={1}>
                        {item.product.name}
                      </Text>
                      <Text className="text-xs font-bold text-emerald-800 mt-0.5">
                        {packLabel} • {item.petiQuantity} {item.petiQuantity === 1 ? 'Peti' : 'Petis'} ({item.petiSize} pcs/peti = {totalUnits} units)
                      </Text>
                      {item.unitPrice > 0 && (
                        <Text className="text-[11px] font-semibold text-slate-500 mt-0.5">
                          Total: {currencyFormatter.format(totalCost)}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => handleRemoveStagedItem(idx)}
                      className="h-8 w-8 items-center justify-center rounded-xl bg-rose-50 border border-rose-100 active:scale-90"
                    >
                      <Icon name="trash-2" size={14} color="#E11D48" />
                    </Pressable>
                  </View>
                );
              })}
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
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-[32px] p-5 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <View>
                <Text className="text-base font-black text-slate-900">Configure Stock Petis</Text>
                <Text className="text-xs font-semibold text-emerald-700 mt-0.5">
                  Multi-variant wholesale stock selection
                </Text>
              </View>
              <Pressable onPress={() => setCustomizerVisible(false)} className="p-1.5 rounded-full active:bg-slate-100">
                <Icon name="x" size={20} color="#64748B" />
              </Pressable>
            </View>

            {selectedProduct && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="text-sm font-black text-slate-900 mb-1">{selectedProduct.name}</Text>
                {selectedProduct.shortDescription ? (
                  <Text className="text-xs font-medium text-slate-500 mb-3">{selectedProduct.shortDescription}</Text>
                ) : null}

                <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Select Petis per Pack Size
                </Text>

                <View className="gap-2.5">
                  {selectedProduct.variants?.map((v: any) => {
                    const vId = v.id || v._id;
                    const pcsPerPeti = getVariantPcsPerPeti(v, selectedProduct.petiSize || 10);
                    const currentPetis = variantPetiMap[vId] || 0;
                    const units = currentPetis * pcsPerPeti;

                    return (
                      <View
                        key={vId}
                        className={`rounded-2xl border p-3 ${
                          currentPetis > 0 ? 'bg-emerald-50/50 border-emerald-600' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <View className="flex-row justify-between items-start mb-2">
                          <View className="flex-1 pr-2">
                            <Text className="text-xs font-black text-slate-900">
                              {v.label || `${v.packSize || v.volume || ''} ${v.packUnit || v.unit || 'Liter'}`.trim()}
                            </Text>
                            <Text className="text-[11px] font-bold text-emerald-800 mt-0.5">
                              {currencyFormatter.format(v.price || 0)} / unit • {currencyFormatter.format((v.price || 0) * pcsPerPeti)} / Peti
                            </Text>
                          </View>

                          <View className="rounded-xl bg-slate-200/80 px-2 py-0.5 border border-slate-300">
                            <Text className="text-[10px] font-black text-slate-700">
                              🔒 {pcsPerPeti} Pcs / Peti
                            </Text>
                          </View>
                        </View>

                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1">
                            {[0, 1, 2, 5].map((preset) => (
                              <Pressable
                                key={preset}
                                onPress={() => setVariantPeti(vId, preset)}
                                className={`rounded-xl px-2 py-1 border ${
                                  currentPetis === preset
                                    ? 'bg-emerald-700 border-emerald-800'
                                    : 'bg-white border-slate-200 active:bg-slate-100'
                                }`}
                              >
                                <Text
                                  className={`text-[10px] font-black ${
                                    currentPetis === preset ? 'text-white' : 'text-slate-700'
                                  }`}
                                >
                                  {preset === 0 ? '0' : `${preset}P`}
                                </Text>
                              </Pressable>
                            ))}
                          </View>

                          <View className="flex-row items-center gap-2 bg-white rounded-xl border border-slate-200 px-2 py-1">
                            <Pressable
                              onPress={() => setVariantPeti(vId, Math.max(0, currentPetis - 1))}
                              className="w-7 h-7 rounded-lg bg-slate-100 items-center justify-center active:scale-90"
                            >
                              <Icon name="minus" size={14} color="#143D2E" />
                            </Pressable>

                            <View className="items-center px-1 min-w-[50px]">
                              <Text className="text-xs font-black text-slate-900">{currentPetis} Peti</Text>
                              <Text className="text-[9px] font-semibold text-slate-400">{units} pcs</Text>
                            </View>

                            <Pressable
                              onPress={() => setVariantPeti(vId, currentPetis + 1)}
                              className="w-7 h-7 rounded-lg bg-emerald-700 items-center justify-center active:scale-90"
                            >
                              <Icon name="plus" size={14} color="#FFFFFF" />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Packaging lock notice */}
                <View className="mt-3 p-2.5 rounded-xl bg-slate-100 border border-slate-200 flex-row items-center gap-2">
                  <Icon name="lock" size={13} color="#64748B" />
                  <Text className="text-[10px] font-semibold text-slate-600 flex-1">
                    Pcs / Peti size is standardized per factory carton packaging and is fixed.
                  </Text>
                </View>

                {/* Summary */}
                {(() => {
                  let modalPetis = 0;
                  let modalUnits = 0;
                  selectedProduct.variants?.forEach((v: any) => {
                    const vId = v.id || v._id;
                    const p = variantPetiMap[vId] || 0;
                    modalPetis += p;
                    modalUnits += p * getVariantPcsPerPeti(v, selectedProduct.petiSize || 10);
                  });

                  return (
                    <View className="mt-3 rounded-2xl bg-emerald-50 p-3.5 border border-emerald-200 flex-row justify-between items-center">
                      <Text className="text-xs font-bold text-emerald-900">Configured in Product:</Text>
                      <Text className="text-sm font-black text-emerald-950">
                        {modalPetis} Petis ({modalUnits} Units)
                      </Text>
                    </View>
                  );
                })()}

                <Pressable
                  onPress={handleAddStagedItems}
                  className="rounded-2xl bg-emerald-700 py-3.5 items-center justify-center shadow-md active:scale-95 mt-4 mb-2"
                >
                  <Text className="text-xs font-black uppercase tracking-wider text-white">
                    Add Selected Petis to Batch
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
