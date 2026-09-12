import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { dealerApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { currencyFormatter, getPrimaryImage } from '../../src/utils/format';

const Icon = Feather as any;

function cleanHtmlText(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

export default function DealerProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const user = useAuthStore((s) => s.user);
  const isApproved = user?.approvalStatus === 'approved';

  const productQuery = useQuery({
    queryKey: ['dealer-product', slug],
    queryFn: () => dealerApi.getProductBySlug(slug!),
    enabled: Boolean(slug),
  });

  const product = productQuery.data?.data;
  const variants = product?.variants || [];
  const defaultVariant = variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Standard agro packaging calculator
  const getVariantPcsPerPeti = (v: any) => {
    if (v?.petiSize && v.petiSize > 0) return v.petiSize;
    const label = (v?.label || v?.packSize || '').toString().toLowerCase();
    const volume = v?.volume ? Number(v.volume) : 0;
    const unit = (v?.unit || v?.packUnit || '').toString().toLowerCase();

    if (label.includes('5 l') || label.includes('5l') || (volume === 5 && unit.includes('l'))) return 4;
    if (label.includes('1 l') || label.includes('1l') || label.includes('1 kg') || (volume === 1 && (unit.includes('l') || unit.includes('k')))) return 10;
    if (label.includes('500') || volume === 500) return 20;
    if (label.includes('250') || volume === 250) return 40;
    if (label.includes('100') || volume === 100) return 80;
    return product?.petiSize || 10;
  };

  const activeVariant = useMemo(() => {
    if (!variants.length) return null;
    if (!selectedVariantId) return defaultVariant;
    return variants.find((v: any) => (v.id || v._id) === selectedVariantId) || defaultVariant;
  }, [variants, selectedVariantId, defaultVariant]);

  // Garages Query
  const garagesQuery = useQuery({
    queryKey: ['dealer-garages'],
    queryFn: dealerApi.getGarages,
  });
  const garages = garagesQuery.data?.data || [];
  const [selectedGarage, setSelectedGarage] = useState<string>('');

  // Auto-select first garage
  useMemo(() => {
    if (garages.length > 0 && !selectedGarage) {
      setSelectedGarage(garages[0]);
    }
  }, [garages, selectedGarage]);

  // Multi-variant Peti mapping: { [variantId]: petiCount }
  const [variantPetiMap, setVariantPetiMap] = useState<Record<string, number>>({});

  // Initialize or update variant peti count
  const setVariantPeti = (variantId: string, count: number) => {
    setVariantPetiMap((prev) => ({
      ...prev,
      [variantId]: Math.max(0, count),
    }));
  };

  // Compute total configured items across all variants
  const configuredItems = useMemo(() => {
    if (!variants.length) return [];
    return variants
      .map((v: any) => {
        const vId = v.id || v._id;
        const petis = variantPetiMap[vId] || 0;
        const pcsPerPeti = getVariantPcsPerPeti(v);
        const totalUnits = petis * pcsPerPeti;
        const unitPrice = v.price || 0;
        const unitMrp = v.mrp || unitPrice;
        const totalAmount = totalUnits * unitPrice;
        const totalMrp = totalUnits * unitMrp;
        return {
          variant: v,
          vId,
          petis,
          pcsPerPeti,
          totalUnits,
          unitPrice,
          unitMrp,
          totalAmount,
          totalMrp,
        };
      })
      .filter((item: any) => item.petis > 0);
  }, [variants, variantPetiMap, product?.petiSize]);

  const totalPetisInRequest = useMemo(() => {
    return configuredItems.reduce((sum: number, item: any) => sum + item.petis, 0);
  }, [configuredItems]);

  const totalUnitsInRequest = useMemo(() => {
    return configuredItems.reduce((sum: number, item: any) => sum + item.totalUnits, 0);
  }, [configuredItems]);

  const grandTotal = useMemo(() => {
    return configuredItems.reduce((sum: number, item: any) => sum + item.totalAmount, 0);
  }, [configuredItems]);

  const totalMrp = useMemo(() => {
    return configuredItems.reduce((sum: number, item: any) => sum + item.totalMrp, 0);
  }, [configuredItems]);

  const totalSavings = Math.max(0, totalMrp - grandTotal);

  const unitPrice = activeVariant?.price || 0;
  const unitMrp = activeVariant?.mrp || unitPrice;

  const moq = product?.moq || 1;
  const activeVariantPcsPerPeti = getVariantPcsPerPeti(activeVariant);

  // Quick buy bottom sheet modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStartOrder = () => {
    if (!variants.length) {
      Alert.alert('Selection Error', 'Product has no variants available.');
      return;
    }
    // If no variant has petis configured yet, default active variant to 1 Peti
    if (configuredItems.length === 0) {
      const targetId = activeVariant?.id || activeVariant?._id || variants[0]?.id || variants[0]?._id;
      if (targetId) {
        setVariantPeti(targetId, 1);
      }
    }
    setIsCheckoutModalOpen(true);
  };

  const handleSubmitProductRequest = async () => {
    if (!product) return;

    if (configuredItems.length === 0) {
      Alert.alert('No Petis Selected', 'Please configure at least 1 Peti for any variant.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        garageName: selectedGarage || garages[0] || 'Vaniki garage',
        items: configuredItems.map((item: any) => ({
          productId: product.id || product._id,
          productName: product.name,
          requestedQuantity: item.totalUnits,
          requestedPack: item.variant.label || `${item.variant.volume || ''} ${item.variant.unit || 'Liter'}`.trim(),
          petiQuantity: item.petis,
          petiSize: item.pcsPerPeti,
          petiUnit: item.variant.unit || 'Liter',
          dealerPrice: item.unitPrice,
          offerPrice: item.unitPrice,
          hsnCode: product.hsnCode || '38089190',
          taxRate: product.taxRate || 18,
        })),
        notes: `Stock Request for ${product.name} (${totalPetisInRequest} Petis, ${totalUnitsInRequest} Units)`,
      };

      await dealerApi.createProductRequest(payload);
      setIsCheckoutModalOpen(false);

      Alert.alert(
        'Stock Request Submitted! 🎉',
        `Your B2B procurement request for ${totalPetisInRequest} Petis (${totalUnitsInRequest} units) of ${product.name} has been sent to SuperAdmin.\n\nOnce SuperAdmin approves it, the official Tally GST Tax Invoice will be generated automatically and you will receive a notification with payment QR & bank details.`,
        [
          {
            text: 'View Requests',
            onPress: () => router.replace('/(tabs)/orders'),
          },
          {
            text: 'OK',
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Request Failed', err?.message || 'Failed to submit product request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (productQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-offwhite items-center justify-center">
        <ActivityIndicator size="large" color="#2D6A4F" />
        <Text className="mt-3 text-xs font-bold text-slate-500">Loading product details...</Text>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView className="flex-1 bg-offwhite items-center justify-center p-6">
        <Icon name="alert-circle" size={48} color="#E11D48" />
        <Text className="text-lg font-black text-slate-900 mt-3">Product Not Found</Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 rounded-full bg-primary-700 px-6 py-2.5"
        >
          <Text className="text-xs font-black text-white">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const primaryImage = getPrimaryImage(product);

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top', 'left', 'right']}>
      {/* Navigation Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-primary-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center border border-slate-200 active:scale-95"
        >
          <Icon name="arrow-left" size={20} color="#143D2E" />
        </Pressable>
        <Text className="text-sm font-black text-primary-900" numberOfLines={1}>
          B2B Product Details
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Product Image */}
        <View className="relative bg-[#f4f7f6] py-6 items-center border-b border-primary-100">
          <Image
            source={{ uri: primaryImage }}
            placeholder={{ uri: 'https://placehold.co/500x500?text=Vaniki+Crop' }}
            style={{ width: '85%', height: 260 }}
            contentFit="contain"
            transition={400}
          />
          {/* MOQ Banner Badge */}
          <View className="absolute left-4 top-4 rounded-full bg-emerald-800 px-3 py-1 shadow-md">
            <Text className="text-[10px] font-black uppercase tracking-wider text-white">
              Min Order: {moq} Units
            </Text>
          </View>
        </View>

        {/* Product Info */}
        <View className="p-5 bg-white border-b border-slate-100">
          <Text className="text-[10px] font-black uppercase tracking-[2px] text-primary-500">
            {product.category?.name || 'Crop Protection'}
          </Text>
          <Text className="text-xl font-black text-primary-900 leading-tight mt-1">
            {product.name}
          </Text>
          {product.shortDescription ? (
            <Text className="text-xs font-semibold text-slate-500 mt-1.5 leading-relaxed">
              {product.shortDescription}
            </Text>
          ) : null}

          {/* Pricing Row */}
          {isApproved ? (
            <View className="flex-row items-baseline gap-2 mt-4">
              <Text className="text-2xl font-black text-primary-800">
                {currencyFormatter.format(unitPrice)}
              </Text>
              <Text className="text-xs font-bold text-slate-400">/ unit</Text>
              {unitMrp > unitPrice ? (
                <Text className="text-sm font-bold text-slate-400 line-through ml-1">
                  MRP {currencyFormatter.format(unitMrp)}
                </Text>
              ) : null}
            </View>
          ) : (
            <View className="mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex-row items-start gap-3">
              <View className="w-8 h-8 rounded-xl bg-amber-500 items-center justify-center mt-0.5 shadow-2xs">
                <Icon name="lock" size={16} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-black text-amber-900 leading-snug">
                  ₹ ••••• (Wholesale Price Locked)
                </Text>
                <Text className="text-xs font-semibold text-amber-800 mt-1 leading-relaxed">
                  Awaiting SuperAdmin KYC approval. Once approved by SuperAdmin, full wholesale B2B pricing will be unlocked.
                </Text>
              </View>
            </View>
          )}

          {/* Peti & MOQ Info Bar */}
          <View className="flex-row items-center gap-3 mt-4 rounded-2xl bg-primary-50 p-3.5 border border-primary-100">
            <View className="w-9 h-9 rounded-xl bg-white items-center justify-center">
              <Icon name="package" size={18} color="#2D6A4F" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-black text-primary-900">
                Factory Packaging: {activeVariantPcsPerPeti} Pcs per Peti (Standard Packaging)
              </Text>
              <Text className="text-[11px] font-semibold text-primary-700 mt-0.5">
                Wholesale Peti Stock • 1 Peti = {activeVariantPcsPerPeti} Units ({activeVariant?.label || 'Bottles'})
              </Text>
            </View>
          </View>
        </View>

        {/* Variants Selector */}
        {variants.length > 1 && (
          <View className="p-5 bg-white border-b border-slate-100">
            <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Select Package / Variant
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              {variants.map((v: any) => {
                const vId = v.id || v._id;
                const isSelected = vId === (activeVariant?.id || activeVariant?._id);
                const vPcs = getVariantPcsPerPeti(v);
                return (
                  <Pressable
                    key={vId}
                    onPress={() => setSelectedVariantId(vId)}
                    className={`rounded-2xl border px-4 py-3 active:scale-95 ${
                      isSelected
                        ? 'border-primary-700 bg-primary-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <Text
                      className={`text-xs font-black ${
                        isSelected ? 'text-primary-900' : 'text-slate-700'
                      }`}
                    >
                      {v.label}
                    </Text>
                    <Text className="text-[10px] font-semibold text-slate-500 mt-0.5">
                      {vPcs} pcs/peti
                    </Text>
                    <Text className="text-xs font-bold text-primary-700 mt-0.5">
                      {isApproved ? currencyFormatter.format(v.price) : '🔒 ₹ •••••'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Peti Order Configuration for Active Variant */}
        <View className="p-5 bg-white border-b border-slate-100">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-black uppercase tracking-wider text-slate-400">
              Order by Peti ({activeVariant?.label || 'Current Pack'})
            </Text>
            <View className="rounded-full bg-emerald-100 px-2.5 py-0.5">
              <Text className="text-[10px] font-black text-emerald-800">
                1 Peti = {activeVariantPcsPerPeti} Pcs
              </Text>
            </View>
          </View>

          {/* Stepper Control */}
          {(() => {
            const activeId = activeVariant?.id || activeVariant?._id || '';
            const activePetis = variantPetiMap[activeId] || (configuredItems.length === 0 ? 1 : 0);
            const activeUnits = activePetis * activeVariantPcsPerPeti;

            return (
              <View>
                <View className="flex-row items-center justify-between rounded-2xl border-2 border-primary-200 bg-slate-50 p-2">
                  <Pressable
                    onPress={() => setVariantPeti(activeId, Math.max(0, activePetis - 1))}
                    className="w-12 h-12 rounded-xl bg-white border border-slate-200 items-center justify-center active:scale-90 shadow-xs"
                  >
                    <Icon name="minus" size={20} color="#143D2E" />
                  </Pressable>

                  <View className="items-center">
                    <Text className="text-2xl font-black text-primary-900">{activePetis}</Text>
                    <Text className="text-[10px] font-bold text-slate-400">
                      {activePetis === 1 ? 'Peti' : 'Petis'} ({activeUnits} Units)
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => setVariantPeti(activeId, activePetis + 1)}
                    style={{ backgroundColor: '#143D2E' }}
                    className="w-12 h-12 rounded-xl items-center justify-center active:scale-90 shadow-xs"
                  >
                    <Icon name="plus" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>

                {/* Peti Presets */}
                <View className="flex-row gap-2 mt-3">
                  {[1, 2, 5, 10].map((presetCount) => (
                    <Pressable
                      key={presetCount}
                      onPress={() => setVariantPeti(activeId, presetCount)}
                      className={`flex-1 rounded-xl py-2 items-center border ${
                        activePetis === presetCount
                          ? 'bg-emerald-700 border-emerald-800'
                          : 'bg-slate-100 border-slate-200 active:bg-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-black ${
                          activePetis === presetCount ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {presetCount} {presetCount === 1 ? 'Peti' : 'Petis'}
                      </Text>
                      <Text
                        className={`text-[9px] font-semibold ${
                          activePetis === presetCount ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        {presetCount * activeVariantPcsPerPeti} Pcs
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })()}
        </View>

        {/* Live Cost Breakdown */}
        {isApproved ? (
          <View className="p-5 bg-white">
            <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Price Details ({totalPetisInRequest} Petis • {totalUnitsInRequest} Units)
            </Text>
            <View className="gap-2 border-b border-slate-100 pb-3">
              {configuredItems.map((item: any) => (
                <View key={item.vId} className="flex-row justify-between">
                  <Text className="text-xs font-semibold text-slate-600">
                    {item.variant.label || 'Pack'}: {item.petis} Peti ({item.totalUnits} pcs)
                  </Text>
                  <Text className="text-xs font-bold text-slate-900">
                    {currencyFormatter.format(item.totalAmount)}
                  </Text>
                </View>
              ))}
              {totalSavings > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-xs font-semibold text-slate-600">Total MRP Savings</Text>
                  <Text className="text-xs font-black text-emerald-600">
                    - {currencyFormatter.format(totalSavings)}
                  </Text>
                </View>
              )}
              <View className="flex-row justify-between">
                <Text className="text-xs font-semibold text-slate-600">Delivery / Doorstep Dispatch</Text>
                <Text className="text-xs font-black text-emerald-600">FREE</Text>
              </View>
            </View>

            <View className="flex-row justify-between pt-3">
              <Text className="text-sm font-black text-slate-900">Total Procurement Amount</Text>
              <Text className="text-lg font-black text-primary-800">
                {currencyFormatter.format(grandTotal)}
              </Text>
            </View>
          </View>
        ) : (
          <View className="p-5 bg-white">
            <View className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex-row items-center gap-3">
              <Icon name="lock" size={20} color="#D97706" />
              <View className="flex-1">
                <Text className="text-sm font-black text-amber-900">
                  Wholesale Price Breakdown Locked
                </Text>
                <Text className="text-xs font-semibold text-amber-700 mt-0.5">
                  Full unit rates, tiers and petis will be unlocked once SuperAdmin approves your Store KYC.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Technical Specifications Table */}
        <View className="p-5 bg-white mt-3 border-b border-slate-100">
          <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
            Product Specifications
          </Text>
          <View className="rounded-2xl border border-slate-200 overflow-hidden">
            {[
              { label: 'Category', value: product.category?.name || 'Crop Care' },
              { label: 'Formulation / Active', value: product.shortDescription || product.name },
              { label: 'Packaging Format', value: `${activeVariantPcsPerPeti} Pcs per Peti (Standard Packaging)` },
              { label: 'Minimum Order (MOQ)', value: `${moq} ${moq === 1 ? 'Unit' : 'Units'}` },
              { label: 'Quality Standard', value: '100% Genuine Certified Formulation' },
              { label: 'Tax & Invoicing', value: 'Instant Tally GST Tax Invoice with ITC' },
            ].map((spec, i) => (
              <View
                key={spec.label}
                className={`flex-row p-3 ${i % 2 === 0 ? 'bg-slate-50/70' : 'bg-white'}`}
              >
                <Text className="w-36 text-xs font-bold text-slate-500">{spec.label}</Text>
                <Text className="flex-1 text-xs font-black text-slate-800">{spec.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Description (Raw HTML Cleaned) */}
        {product.description ? (
          <View className="p-5 bg-white mt-3 mb-10">
            <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
              Detailed Description &amp; Usage
            </Text>
            <Text className="text-sm font-medium text-slate-700 leading-relaxed">
              {cleanHtmlText(product.description)}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-primary-100 p-4 flex-row items-center justify-between shadow-soft">
        <View>
          <Text className="text-[10px] font-bold text-slate-400 uppercase">
            Total ({totalPetisInRequest} Petis • {totalUnitsInRequest} units)
          </Text>
          <Text className="text-xl font-black text-primary-800">
            {isApproved ? currencyFormatter.format(grandTotal) : '₹ •••••'}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            if (!isApproved) {
              Alert.alert(
                'KYC Approval Required',
                'Your Store KYC is under review by SuperAdmin. Once approved by SuperAdmin, full wholesale B2B pricing and stock requests will be unlocked.',
              );
              return;
            }
            handleStartOrder();
          }}
          style={{ backgroundColor: isApproved ? '#1B4332' : '#D97706' }}
          className="rounded-2xl px-7 py-3.5 items-center active:scale-95 shadow-md"
        >
          <Text className="text-xs font-black uppercase tracking-[1.5px] text-white">
            {isApproved ? 'Request Petis →' : '🔒 KYC Pending'}
          </Text>
        </Pressable>
      </View>

      {/* Configure Stock Petis Modal (Multi-Variant Procurement Request) */}
      <Modal
        visible={isCheckoutModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCheckoutModalOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/75 justify-end"
          onPress={() => setIsCheckoutModalOpen(false)}
        >
          <Pressable
            className="w-full bg-white rounded-t-[32px] border-t-2 border-emerald-300 p-5 max-h-[92%]"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
              <View>
                <Text className="text-lg font-black text-slate-900">Configure Stock Petis</Text>
                <Text className="text-xs font-semibold text-emerald-700 mt-0.5">
                  Select Petis across multiple pack sizes
                </Text>
              </View>
              <Pressable onPress={() => setIsCheckoutModalOpen(false)} className="p-1.5 active:bg-slate-100 rounded-full">
                <Icon name="x" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="py-3">
              {/* Product Name */}
              <Text className="text-base font-black text-slate-900">
                {product.name}
              </Text>
              {product.shortDescription ? (
                <Text className="text-xs font-semibold text-slate-500 mt-0.5">
                  {product.shortDescription}
                </Text>
              ) : null}

              {/* 1. Fulfillment Warehouse / Garage */}
              {garages.length > 0 && (
                <View className="mt-4 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-emerald-800 mb-1.5">
                    Fulfillment Warehouse / Garage
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {garages.map((g: string) => {
                      const isSelected = (selectedGarage || garages[0]) === g;
                      return (
                        <Pressable
                          key={g}
                          onPress={() => setSelectedGarage(g)}
                          className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${
                            isSelected
                              ? 'bg-white border-emerald-700 shadow-2xs'
                              : 'bg-white/60 border-slate-200'
                          }`}
                        >
                          <Icon name="home" size={13} color={isSelected ? '#1B4332' : '#64748B'} />
                          <Text
                            className={`text-xs font-black ${
                              isSelected ? 'text-emerald-950' : 'text-slate-600'
                            }`}
                          >
                            {g}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 2. Multi-Pack Size Peti Configuration List */}
              <View className="mt-4">
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-slate-400 mb-2.5">
                  CONFIGURE PETIS PER PACK SIZE
                </Text>

                <View className="gap-3">
                  {variants.map((v: any) => {
                    const vId = v.id || v._id;
                    const pcsPerPeti = getVariantPcsPerPeti(v);
                    const currentPetis = variantPetiMap[vId] || 0;
                    const units = currentPetis * pcsPerPeti;
                    const cost = units * (v.price || 0);

                    return (
                      <View
                        key={vId}
                        className={`rounded-2xl border p-3.5 ${
                          currentPetis > 0
                            ? 'bg-emerald-50/50 border-emerald-600'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* Variant Info & Standard Packaging Badge */}
                        <View className="flex-row justify-between items-start mb-2">
                          <View className="flex-1 pr-2">
                            <Text className="text-sm font-black text-slate-900">
                              {v.label || `${v.volume} ${v.unit || 'Liter'}`}
                            </Text>
                            <Text className="text-xs font-bold text-emerald-800 mt-0.5">
                              {currencyFormatter.format(v.price || 0)} / unit • {currencyFormatter.format((v.price || 0) * pcsPerPeti)} / Peti
                            </Text>
                          </View>

                          {/* Fixed Standard Packaging Badge (Non-Editable) */}
                          <View className="rounded-xl bg-slate-200/80 px-2.5 py-1 border border-slate-300">
                            <Text className="text-[10px] font-black text-slate-700">
                              🔒 {pcsPerPeti} Pcs / Peti
                            </Text>
                          </View>
                        </View>

                        {/* Peti Stepper & Direct Counter */}
                        <View className="flex-row items-center justify-between pt-1">
                          <View className="flex-row items-center gap-1.5">
                            {[0, 1, 2, 5].map((preset) => (
                              <Pressable
                                key={preset}
                                onPress={() => setVariantPeti(vId, preset)}
                                className={`rounded-xl px-2.5 py-1.5 border ${
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
                              <Text className="text-sm font-black text-slate-900">{currentPetis} Peti</Text>
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

                        {currentPetis > 0 && (
                          <View className="mt-2 pt-2 border-t border-emerald-200 flex-row justify-between items-center">
                            <Text className="text-[11px] font-bold text-emerald-850">
                              Subtotal ({units} units):
                            </Text>
                            <Text className="text-xs font-black text-emerald-900">
                              {currencyFormatter.format(cost)}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* 3. Total Summary Banner */}
              <View className="mt-4 rounded-2xl bg-[#E8F8F0] border border-emerald-200 p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-emerald-950">
                    Total Petis in Request:
                  </Text>
                  <Text className="text-base font-black text-emerald-950">
                    {totalPetisInRequest} {totalPetisInRequest === 1 ? 'Peti' : 'Petis'} ({totalUnitsInRequest} Units)
                  </Text>
                </View>

                <View className="mt-2 pt-2 border-t border-emerald-200/60 flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-emerald-950">
                    Estimated Procurement Amount:
                  </Text>
                  <Text className="text-base font-black text-emerald-900">
                    {currencyFormatter.format(grandTotal)}
                  </Text>
                </View>
              </View>

              {/* Packaging Lock Notice */}
              <View className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex-row items-center gap-2">
                <Icon name="lock" size={14} color="#64748B" />
                <Text className="text-[10px] font-semibold text-slate-600 flex-1">
                  Pcs / Peti packaging is standardized based on factory carton specifications and cannot be modified.
                </Text>
              </View>

              {/* 4. Submit Button */}
              <Pressable
                disabled={isSubmitting || totalPetisInRequest === 0}
                onPress={handleSubmitProductRequest}
                style={{ backgroundColor: totalPetisInRequest > 0 ? '#1B4332' : '#94A3B8' }}
                className="w-full rounded-2xl py-4 items-center justify-center active:scale-[0.98] shadow-md mt-4 mb-2"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-xs font-black uppercase tracking-[2px] text-white">
                    SUBMIT REQUEST ({totalPetisInRequest} PETIS)
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
