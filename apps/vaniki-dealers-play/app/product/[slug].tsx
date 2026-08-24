import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { dealerApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { currencyFormatter, getPrimaryImage } from '../../src/utils/format';

const Icon = Feather as any;

export default function DealerProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

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

  const moq = product?.moq || 1;
  const petiSize = product?.petiSize || 1;
  const [quantity, setQuantity] = useState(moq);

  // When product loads or variant changes, make sure quantity is at least MOQ
  const minQty = moq;
  const currentQty = Math.max(quantity, minQty);

  // Quick buy bottom sheet modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unitPrice = activeVariant?.price || 0;
  const unitMrp = activeVariant?.mrp || unitPrice;
  const subtotal = unitPrice * currentQty;
  const totalMrp = unitMrp * currentQty;
  const savings = Math.max(0, totalMrp - subtotal);
  const taxRate = product?.taxRate || 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const grandTotal = subtotal;

  const handleIncrement = (amount = 1) => {
    setQuantity((prev: number) => prev + amount);
  };

  const handleDecrement = (amount = 1) => {
    setQuantity((prev: number) => {
      const next = prev - amount;
      if (next < minQty) {
        Alert.alert('Minimum Order Quantity', `Minimum bulk order for this product is ${minQty} units.`);
        return minQty;
      }
      return next;
    });
  };

  const handleStartOrder = () => {
    if (!activeVariant) {
      Alert.alert('Selection Error', 'Please select a product variant.');
      return;
    }
    setIsCheckoutModalOpen(true);
  };

  const handleConfirmOrder = async (paymentMethod: 'razorpay' | 'cod') => {
    if (!activeVariant || !product) return;

    setIsSubmitting(true);
    try {
      const payload = {
        items: [
          {
            productId: product.id || product._id,
            variantId: activeVariant.id || activeVariant._id,
            qty: currentQty,
          },
        ],
        paymentMethod,
        deliveryAddress: user?.savedAddress,
      };

      const res = await dealerApi.initiateOrder(payload);

      setIsCheckoutModalOpen(false);

      if (paymentMethod === 'razorpay' && res.data?.razorpayOrderId) {
        // Razorpay checkout flow (can open razorpay or complete directly)
        Alert.alert(
          'Order Initiated',
          `Order #${res.data.orderNumber || res.data.id} initiated. Complete payment via Razorpay.`,
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(tabs)/orders'),
            },
          ],
        );
      } else {
        Alert.alert(
          'Bulk Order Placed! 🎉',
          `Your B2B order #${res.data?.orderNumber || 'CONFIRMED'} has been placed successfully.`,
          [
            {
              text: 'View Orders',
              onPress: () => router.replace('/(tabs)/orders'),
            },
          ],
        );
      }
    } catch (err: any) {
      Alert.alert('Order Failed', err?.message || 'Unable to place order. Please try again.');
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
                      {currencyFormatter.format(v.price)}
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

        {/* Description */}
        {product.description ? (
          <View className="p-5 bg-white mt-3">
            <Text className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
              Product Description
            </Text>
            <Text className="text-xs font-medium text-slate-700 leading-relaxed">
              {product.description}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-primary-100 p-4 flex-row items-center justify-between shadow-soft">
        <div>
          <Text className="text-[10px] font-bold text-slate-400 uppercase">
            Total ({currentQty} units)
          </Text>
          <Text className="text-xl font-black text-primary-800">
            {currencyFormatter.format(grandTotal)}
          </Text>
        </div>

        <Pressable
          onPress={handleStartOrder}
          style={{ backgroundColor: '#143D2E' }}
          className="rounded-2xl px-7 py-3.5 items-center active:scale-95 shadow-md"
        >
          <Text className="text-xs font-black uppercase tracking-[1.5px] text-white">
            Order Now →
          </Text>
        </Pressable>
      </View>

      {/* Quick Buy / Checkout Modal */}
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
            className="w-full bg-white rounded-t-[32px] border-t-2 border-emerald-200 p-5 max-h-[90%]"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
              <Text className="text-base font-black text-slate-900">B2B Order Confirmation</Text>
              <Pressable onPress={() => setIsCheckoutModalOpen(false)} className="p-1">
                <Icon name="x-circle" size={24} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="py-2 gap-4">
              {/* Product Summary */}
              <View className="flex-row items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <Image
                  source={{ uri: primaryImage }}
                  style={{ width: 50, height: 50, borderRadius: 10 }}
                  contentFit="contain"
                />
                <View className="flex-1">
                  <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text className="text-[11px] font-bold text-slate-500">
                    {activeVariant?.label} • {currentQty} units
                  </Text>
                  <Text className="text-xs font-black text-emerald-700 mt-0.5">
                    {currencyFormatter.format(grandTotal)}
                  </Text>
                </View>
              </View>

              {/* Payment Method Cards */}
              <View className="gap-3 mt-2">
                {/* Pay Online via Razorpay */}
                <View className="rounded-2xl border-2 border-emerald-600 bg-emerald-50/40 p-4">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm font-black text-slate-900">Pay Online (Razorpay)</Text>
                    <View className="rounded-full bg-emerald-700 px-2 py-0.5">
                      <Text className="text-[9px] font-black text-white">Recommended</Text>
                    </View>
                  </View>
                  <Text className="text-xs font-semibold text-slate-500 mb-3">
                    UPI, Credit/Debit Card, Netbanking with Instant B2B Invoice
                  </Text>
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => handleConfirmOrder('razorpay')}
                    style={{ backgroundColor: '#143D2E' }}
                    className="w-full rounded-xl py-3.5 items-center justify-center active:scale-95 shadow-sm"
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text className="text-xs font-black uppercase tracking-wider text-white">
                        Pay {currencyFormatter.format(grandTotal)} Online
                      </Text>
                    )}
                  </Pressable>
                </View>

                {/* Cash on Delivery / Offline Payment */}
                <View className="rounded-2xl border border-slate-200 bg-white p-4">
                  <Text className="text-sm font-black text-slate-900 mb-1">Pay on Delivery</Text>
                  <Text className="text-xs font-semibold text-slate-500 mb-3">
                    Pay upon arrival of shipment with physical GST invoice
                  </Text>
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => handleConfirmOrder('cod')}
                    className="w-full rounded-xl border border-slate-300 bg-slate-100 py-3.5 items-center justify-center active:scale-95"
                  >
                    <Text className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Confirm Pay on Delivery
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
