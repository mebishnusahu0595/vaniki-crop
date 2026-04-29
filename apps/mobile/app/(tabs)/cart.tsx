import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { useCartStore } from '../../src/store/useCartStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { storefrontApi } from '../../src/lib/api';
import { currencyFormatter } from '../../src/utils/format';
import { resolveMediaUrl } from '../../src/utils/media';

import { useSettingsStore } from '../../src/store/useSettingsStore';

export default function CartScreen() {
  const { settings } = useSettingsStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const { items, couponCode, couponDiscount, increaseQty, decreaseQty, setCouponCode, clearCoupon } = useCartStore();
  const [couponInput, setCouponInput] = useState(couponCode);
  const [couponMessage, setCouponMessage] = useState('');

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items]);
  const deliveryCharge = subtotal >= settings.freeDeliveryThreshold ? 0 : settings.standardDeliveryCharge;
  const total = subtotal - couponDiscount + deliveryCharge;

  if (!items.length) {
    return (
      <Screen>
        <View className="rounded-[28px] bg-white p-8">
          <Text className="text-2xl font-black text-primary-900">Your cart is empty.</Text>
          <Text className="mt-3 text-sm leading-6 text-primary-900/70">
            Add products from your nearby Vaniki store to start checkout.
          </Text>
          <Pressable onPress={() => router.push('/products')} className="mt-6 rounded-full bg-primary-500 px-5 py-4">
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">Shop Now</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text className="text-3xl font-black text-primary-900">Cart</Text>
      <View className="mt-5 gap-4">
        {items.map((item) => (
          <View key={item.variantId} className="rounded-[28px] bg-white p-4">
            <View className="flex-row gap-4">
              <Image
                source={{ uri: resolveMediaUrl(item.image) }}
                style={{ width: 92, height: 92, borderRadius: 20 }}
                contentFit="cover"
              />
              <View className="flex-1">
                <Text className="text-sm font-black text-primary-900">{item.productName}</Text>
                <Text className="mt-1 text-xs font-semibold text-primary-500">{item.variantLabel}</Text>
                <Text className="mt-3 text-lg font-black text-primary-900">
                  {currencyFormatter.format(item.price * item.qty)}
                </Text>
                <View className="mt-3 flex-row items-center gap-3">
                  <Pressable onPress={() => decreaseQty(item.variantId)} className="rounded-full bg-primary-50 px-3 py-2">
                    <Text className="text-sm font-black text-primary-900">-</Text>
                  </Pressable>
                  <Text className="text-sm font-black text-primary-900">{item.qty}</Text>
                  <Pressable onPress={() => increaseQty(item.variantId)} className="rounded-full bg-primary-50 px-3 py-2">
                    <Text className="text-sm font-black text-primary-900">+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View className="mt-6 rounded-[28px] bg-white p-5">
        <Text className="text-lg font-black text-primary-900">Coupon</Text>
        <View className="mt-4 flex-row gap-3">
          <TextInput
            value={couponInput}
            onChangeText={setCouponInput}
            placeholder="Enter coupon code"
            className="flex-1 rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
            placeholderTextColor="#7a978b"
          />
          <Pressable
            onPress={async () => {
              if (!selectedStore) {
                setCouponMessage('Please choose a store first.');
                return;
              }

              try {
                const response = await storefrontApi.validateCoupon({
                  code: couponInput,
                  storeId: selectedStore.id,
                  cartTotal: subtotal,
                });
                if (response.valid) {
                  setCouponCode(couponInput, response.discount || 0);
                } else {
                  clearCoupon();
                }
                setCouponMessage(response.message);
              } catch (caughtError) {
                setCouponMessage(caughtError instanceof Error ? caughtError.message : 'Coupon could not be validated.');
              }
            }}
            className="justify-center rounded-[20px] bg-primary-500 px-4"
          >
            <Text className="text-xs font-black uppercase tracking-[1px] text-white">Validate</Text>
          </Pressable>
        </View>
        {Boolean(couponMessage) ? (
          <Text className="mt-3 text-sm font-semibold text-primary-500">{couponMessage}</Text>
        ) : null}
      </View>

      <View className="mt-6 rounded-[28px] bg-primary-900 p-5">
        <Text className="text-lg font-black text-white">Order Summary</Text>
        <View className="mt-4 gap-3">
          <View className="flex-row justify-between">
            <Text className="text-sm text-white/75">Subtotal</Text>
            <Text className="text-sm font-bold text-white">{currencyFormatter.format(subtotal)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-white/75">Coupon Discount</Text>
            <Text className="text-sm font-bold text-white">- {currencyFormatter.format(couponDiscount)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-white/75">Delivery Charge</Text>
            <Text className="text-sm font-bold text-white">{currencyFormatter.format(deliveryCharge)}</Text>
          </View>
          <View className="mt-2 flex-row justify-between border-t border-white/10 pt-3">
            <Text className="text-base font-black text-white">Total</Text>
            <Text className="text-base font-black text-white">{currencyFormatter.format(total)}</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/checkout')} className="mt-5 rounded-full bg-white px-5 py-4">
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-900">Checkout</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
