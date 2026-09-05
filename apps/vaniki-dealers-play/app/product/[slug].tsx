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

  // Peti configuration state
  const [petiQtyInput, setPetiQtyInput] = useState('1');
  const [petiSizeInput, setPetiSizeInput] = useState(String(product?.petiSize || 10));

  // Sync default petiSize when product loads
  useMemo(() => {
    if (product?.petiSize && petiSizeInput === '10') {
      setPetiSizeInput(String(product.petiSize));
    }
  }, [product?.petiSize]);

  const moq = product?.moq || 1;
  const petiSize = product?.petiSize || 10;
  const minQty = moq;
  const [quantity, setQuantity] = useState(moq);
  const currentQty = Math.max(quantity, minQty);

  const pQty = parseInt(petiQtyInput, 10) || 1;
  const pSize = parseInt(petiSizeInput, 10) || (product?.petiSize || 10);
  const totalUnitsInRequest = pQty * pSize;

  // Quick buy bottom sheet modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unitPrice = activeVariant?.price || 0;
  const unitMrp = activeVariant?.mrp || unitPrice;
  const subtotal = unitPrice * totalUnitsInRequest;
  const totalMrp = unitMrp * totalUnitsInRequest;
  const savings = Math.max(0, (unitMrp - unitPrice) * currentQty);
  const grandTotal = subtotal;

  const handleIncrement = (amount = 1) => {
    setQuantity((prev: number) => prev + amount);
  };

  const handleDecrement = (amount = 1) => {
    setQuantity((prev: number) => Math.max(minQty, prev - amount));
  };

  const handleStartOrder = () => {
    if (!activeVariant) {
      Alert.alert('Selection Error', 'Please select a product variant.');
      return;
    }
    setPetiQtyInput('1');
    setPetiSizeInput(String(product?.petiSize || 10));
    setIsCheckoutModalOpen(true);
  };

  const handleSubmitProductRequest = async () => {
    if (!activeVariant || !product) return;

    const parsedQty = parseInt(petiQtyInput, 10);
    const parsedSize = parseInt(petiSizeInput, 10);

    if (isNaN(parsedQty) || parsedQty <= 0) {
      Alert.alert('Invalid Quantity', 'Peti quantity must be at least 1.');
      return;
    }
    if (isNaN(parsedSize) || parsedSize <= 0) {
      Alert.alert('Invalid Size', 'Pcs / Peti size must be at least 1.');
      return;
    }

    const totalUnits = parsedQty * parsedSize;
    const reqUnitPrice = activeVariant?.price || 0;

    setIsSubmitting(true);
    try {
      const payload = {
        garageName: selectedGarage || garages[0] || 'Vaniki garage',
        items: [
          {
            productId: product.id || product._id,
            productName: product.name,
            requestedQuantity: totalUnits,
            requestedPack: activeVariant?.label || `${activeVariant?.volume} ${activeVariant?.unit || 'Liter'}`,
            petiQuantity: parsedQty,
            petiSize: parsedSize,
            petiUnit: activeVariant?.unit || 'Liter',
            dealerPrice: reqUnitPrice,
            offerPrice: reqUnitPrice,
            hsnCode: product.hsnCode || '38089190',
            taxRate: product.taxRate || 18,
          },
        ],
        notes: `Stock Request for ${product.name}`,
      };

      await dealerApi.createProductRequest(payload);
      setIsCheckoutModalOpen(false);

      Alert.alert(
        'Stock Request Submitted! 🎉',
        `Your B2B procurement request for ${totalUnits} units of ${product.name} has been sent to SuperAdmin.\n\nOnce SuperAdmin approves it, the official Tally GST Tax Invoice will be generated automatically and you will receive a notification with payment QR & bank details.`,
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
                Packaging: {petiSize} {product.petiUnit || 'units'} per Peti
              </Text>
              <Text className="text-[11px] font-semibold text-primary-700 mt-0.5">
                Minimum order requirement: {moq} units
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
                const isSelected = (v.id || v._id) === (activeVariant?.id || activeVariant?._id);
                return (
                  <Pressable
                    key={v.id || v._id}
                    onPress={() => setSelectedVariantId(v.id || v._id)}
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
                    <Text className="text-xs font-bold text-primary-700 mt-0.5">
                      {isApproved ? currencyFormatter.format(v.price) : '🔒 ₹ •••••'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* MOQ Bulk Quantity Selector */}
        <View className="p-5 bg-white border-b border-slate-100">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-black uppercase tracking-wider text-slate-400">
              Bulk Order Quantity
            </Text>
            <Text className="text-[11px] font-bold text-emerald-700">
              Min: {minQty} units
            </Text>
          </View>

          {/* Stepper Control */}
          <View className="flex-row items-center justify-between rounded-2xl border-2 border-primary-200 bg-slate-50 p-2">
            <Pressable
              onPress={() => handleDecrement(1)}
              className="w-12 h-12 rounded-xl bg-white border border-slate-200 items-center justify-center active:scale-90 shadow-xs"
            >
              <Icon name="minus" size={20} color="#143D2E" />
            </Pressable>

            <View className="items-center">
              <Text className="text-2xl font-black text-primary-900">{currentQty}</Text>
              <Text className="text-[10px] font-bold text-slate-400">Units</Text>
            </View>

            <Pressable
              onPress={() => handleIncrement(1)}
              style={{ backgroundColor: '#143D2E' }}
              className="w-12 h-12 rounded-xl items-center justify-center active:scale-90 shadow-xs"
            >
              <Icon name="plus" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Preset Buttons */}
          <View className="flex-row gap-2 mt-3">
            {[
              { label: `MOQ (${moq})`, qty: moq },
              { label: `+5`, amount: 5 },
              { label: `+10`, amount: 10 },
              { label: `+1 Peti (${petiSize})`, amount: petiSize },
            ].map((preset, idx) => (
              <Pressable
                key={idx}
                onPress={() => {
                  if (preset.qty !== undefined) setQuantity(preset.qty);
                  else if (preset.amount !== undefined) handleIncrement(preset.amount);
                }}
                className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-2 items-center active:bg-slate-200"
              >
                <Text className="text-[10px] font-black text-slate-700">{preset.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Live Cost Breakdown */}
        {isApproved ? (
          <View className="p-5 bg-white">
            <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Price Details ({currentQty} Units)
            </Text>
            <View className="gap-2 border-b border-slate-100 pb-3">
              <View className="flex-row justify-between">
                <Text className="text-xs font-semibold text-slate-600">
                  Base Price ({currentQty} × {currencyFormatter.format(unitPrice)})
                </Text>
                <Text className="text-xs font-bold text-slate-900">
                  {currencyFormatter.format(subtotal)}
                </Text>
              </View>
              {savings > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-xs font-semibold text-slate-600">Total MRP Savings</Text>
                  <Text className="text-xs font-black text-emerald-600">
                    - {currencyFormatter.format(savings)}
                  </Text>
                </View>
              )}
              <View className="flex-row justify-between">
                <Text className="text-xs font-semibold text-slate-600">Delivery / Shipping</Text>
                <Text className="text-xs font-black text-emerald-600">FREE</Text>
              </View>
            </View>

            <View className="flex-row justify-between pt-3">
              <Text className="text-sm font-black text-slate-900">Total Amount</Text>
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
              { label: 'Packaging Format', value: `${petiSize} ${product.petiUnit || 'Units'} per Peti` },
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
            Total ({totalUnitsInRequest} units)
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
            {isApproved ? 'Request Stock →' : '🔒 KYC Pending'}
          </Text>
        </Pressable>
      </View>

      {/* Configure Stock Petis Modal (B2B Procurement Request) */}
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
              <Text className="text-lg font-black text-slate-900">Configure Stock Petis</Text>
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

              {/* 2. Select Pack Size / Variant */}
              <View className="mt-4">
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-slate-400 mb-2">
                  SELECT PACK SIZE
                </Text>
                <View className="flex-row flex-wrap gap-2.5">
                  {variants.map((v: any) => {
                    const isSelected = (v.id || v._id) === (activeVariant?.id || activeVariant?._id);
                    return (
                      <Pressable
                        key={v.id || v._id}
                        onPress={() => setSelectedVariantId(v.id || v._id)}
                        className={`rounded-xl px-4 py-2.5 border active:scale-95 ${
                          isSelected
                            ? 'bg-emerald-50 border-2 border-emerald-700'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs font-black ${
                            isSelected ? 'text-emerald-950' : 'text-slate-700'
                          }`}
                        >
                          {v.label ? `${v.label} • ` : ''}• ₹{v.price}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 3. Peti Quantity and Pcs / Peti Size Inputs */}
              <View className="flex-row gap-3 mt-4">
                <View className="flex-1">
                  <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-slate-400 mb-1.5">
                    PETI QUANTITY
                  </Text>
                  <TextInput
                    value={petiQtyInput}
                    onChangeText={setPetiQtyInput}
                    keyboardType="number-pad"
                    placeholder="1"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-black text-slate-900"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-slate-400 mb-1.5">
                    PCS / PETI SIZE
                  </Text>
                  <TextInput
                    value={petiSizeInput}
                    onChangeText={setPetiSizeInput}
                    keyboardType="number-pad"
                    placeholder="10"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-black text-slate-900"
                  />
                </View>
              </View>

              {/* 4. Total Units in Request Banner */}
              <View className="mt-4 rounded-2xl bg-[#E8F8F0] border border-emerald-200 p-4 flex-row items-center justify-between">
                <Text className="text-xs font-bold text-emerald-950">
                  Total Units in Request:
                </Text>
                <Text className="text-base font-black text-emerald-950">
                  {totalUnitsInRequest} Units
                </Text>
              </View>

              {/* Estimated Wholesale Total */}
              <View className="mt-2 px-1 flex-row items-center justify-between">
                <Text className="text-[11px] font-bold text-slate-500">
                  Estimated Taxable Amount:
                </Text>
                <Text className="text-sm font-black text-emerald-800">
                  {currencyFormatter.format(grandTotal)}
                </Text>
              </View>

              {/* Info Notice */}
              <View className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200/60">
                <Text className="text-[11px] font-semibold text-amber-900 leading-relaxed">
                  ℹ️ This submits a stock procurement request directly to SuperAdmin. Once approved, an official Tally GST Tax Invoice is generated with Company QR & Bank payment options.
                </Text>
              </View>

              {/* 5. Submit Button */}
              <Pressable
                disabled={isSubmitting}
                onPress={handleSubmitProductRequest}
                style={{ backgroundColor: '#1B4332' }}
                className="w-full rounded-2xl py-4 items-center justify-center active:scale-[0.98] shadow-md mt-4 mb-2"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-xs font-black uppercase tracking-[2px] text-white">
                    ADD TO REQUEST BATCH
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
