import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { useCartStore } from '../../src/store/useCartStore';
import { useStoreStore } from '../../src/store/useStoreStore';
import { storefrontApi } from '../../src/lib/api';
import { currencyFormatter } from '../../src/utils/format';
import { resolveMediaUrl } from '../../src/utils/media';

import { useSettingsStore } from '../../src/store/useSettingsStore';

export default function CartScreen() {
  const { t } = useTranslation();
  const { settings } = useSettingsStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const { items, couponCode, couponDiscount, increaseQty, decreaseQty, setCouponCode, clearCoupon } = useCartStore();
  const [couponInput, setCouponInput] = useState(couponCode);
  const [couponMessage, setCouponMessage] = useState('');

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items]);
  const deliveryCharge = subtotal >= (settings?.freeDeliveryThreshold || 2000) ? 0 : (settings?.standardDeliveryCharge || 50);
  const total = subtotal - couponDiscount + deliveryCharge;

  if (!items.length) {
    return (
      <Screen>
        <View className="rounded-[28px] bg-white p-8 items-center border border-primary-100 shadow-sm">
          <Text className="text-2xl font-black text-primary-900 text-center">
            {t('mobile.cartPage.emptyTitle')}
          </Text>
          <Text className="mt-3 text-sm leading-6 text-primary-900/70 text-center">
            {t('mobile.cartPage.emptySub')}
          </Text>
          <Pressable 
            onPress={() => router.push('/products')} 
            className="mt-6 rounded-full bg-primary-500 px-6 py-4 active:scale-95 shadow-md"
          >
            <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
              {t('mobile.cartPage.startShopping')}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text className="text-3xl font-black text-primary-900">
        {t('mobile.cartPage.title')}
      </Text>
      
      <View className="mt-5 gap-4">
        {items.map((item) => (
          <View key={item.variantId} className="rounded-[28px] bg-white p-4 border border-primary-100 shadow-2xs">
            <View className="flex-row gap-4">
              <Image
                source={{ uri: resolveMediaUrl(item.image) }}
                style={{ width: 92, height: 92, borderRadius: 20 }}
                contentFit="contain"
              />
              <View className="flex-1">
                <Text className="text-sm font-black text-primary-900">{item.productName}</Text>
                <Text className="mt-1 text-xs font-semibold text-primary-500">{item.variantLabel}</Text>
                <Text className="mt-3 text-lg font-black text-primary-900">
                  {currencyFormatter.format(item.price * item.qty)}
                </Text>
                <View className="mt-3 flex-row items-center gap-3">
                  <Pressable onPress={() => decreaseQty(item.variantId)} className="rounded-full bg-primary-50 px-3 py-2 active:scale-90">
                    <Text className="text-sm font-black text-primary-900">-</Text>
                  </Pressable>
                  <Text className="text-sm font-black text-primary-900">{item.qty}</Text>
                  <Pressable onPress={() => increaseQty(item.variantId)} className="rounded-full bg-primary-50 px-3 py-2 active:scale-90">
                    <Text className="text-sm font-black text-primary-900">+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Coupon Box */}
      <View className="mt-6 rounded-[28px] bg-white p-5 border border-primary-100 shadow-2xs">
        <Text className="text-base font-black text-primary-900">
          {t('mobile.cartPage.couponTitle')}
        </Text>
        <View className="mt-4 flex-row gap-3">
          <TextInput
            value={couponInput}
            onChangeText={setCouponInput}
            placeholder={t('mobile.cartPage.couponPlaceholder')}
            className="flex-1 rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-3.5 text-base text-primary-900 font-bold"
            placeholderTextColor="#7a978b"
          />
          <Pressable
            onPress={async () => {
              if (!selectedStore) {
                setCouponMessage(t('mobile.cartPage.storeWarning'));
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
                  setCouponMessage(t('mobile.cartPage.couponApplied'));
                } else {
                  clearCoupon();
                  setCouponMessage(response.message || 'Invalid coupon code');
                }
              } catch (err: any) {
                setCouponMessage(err?.message || 'Could not validate coupon');
              }
            }}
            className="rounded-2xl bg-emerald-700 px-5 py-3.5 items-center justify-center active:scale-95"
          >
            <Text className="text-xs font-black uppercase tracking-wider text-white">
              {t('mobile.cartPage.applyBtn')}
            </Text>
          </Pressable>
        </View>
        {couponMessage ? (
          <Text className="mt-2 text-xs font-bold text-emerald-700">{couponMessage}</Text>
        ) : null}
      </View>

      {/* Bill Breakdown */}
      <View className="mt-6 rounded-[28px] bg-white p-5 border border-primary-100 shadow-2xs">
        <Text className="text-lg font-black text-primary-900 mb-3">
          {t('mobile.cartPage.billDetails')}
        </Text>
        <View className="space-y-2.5">
          <View className="flex-row justify-between py-1">
            <Text className="text-sm font-semibold text-primary-900/60">{t('mobile.cartPage.subtotal')}</Text>
            <Text className="text-sm font-black text-primary-900">{currencyFormatter.format(subtotal)}</Text>
          </View>
          {couponDiscount > 0 ? (
            <View className="flex-row justify-between py-1">
              <Text className="text-sm font-semibold text-emerald-600">{t('mobile.cartPage.discount')}</Text>
              <Text className="text-sm font-black text-emerald-600">-{currencyFormatter.format(couponDiscount)}</Text>
            </View>
          ) : null}
          <View className="flex-row justify-between py-1">
            <Text className="text-sm font-semibold text-primary-900/60">{t('mobile.cartPage.deliveryFee')}</Text>
            <Text className="text-sm font-black text-primary-900">
              {deliveryCharge === 0 ? t('mobile.cartPage.freeDeliveryNotice') : currencyFormatter.format(deliveryCharge)}
            </Text>
          </View>
          <View className="h-px bg-primary-100 my-2" />
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-base font-black text-primary-900">{t('mobile.cartPage.totalAmount')}</Text>
            <Text className="text-2xl font-black text-emerald-700">{currencyFormatter.format(total)}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/checkout')}
          className="mt-6 rounded-full bg-primary-500 py-4 items-center active:scale-95 shadow-md"
        >
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-white">
            {t('mobile.cartPage.proceedBtn')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
