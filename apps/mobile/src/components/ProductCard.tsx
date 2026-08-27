import { memo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCompareStore } from '../store/useCompareStore';
import { storefrontApi } from '../lib/api';
import type { Product, ProductVariant } from '../types/storefront';
import { currencyFormatter, getDefaultVariant, getDiscountPercent, getPrimaryImage } from '../utils/format';

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

export const ProductCard = memo(function ProductCard({ product, compact = false }: ProductCardProps) {
  const { t } = useTranslation();
  const addItem = useCartStore((state) => state.addItem);
  const increaseQty = useCartStore((state) => state.increaseQty);
  const decreaseQty = useCartStore((state) => state.decreaseQty);
  const cartItems = useCartStore((state) => state.items);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const comparedProducts = useCompareStore((state) => state.products);
  const toggleCompareProduct = useCompareStore((state) => state.toggleProduct);

  const defaultVariant = getDefaultVariant(product);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(defaultVariant);
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'variants' | 'checkout'>('variants');

  const activeVariant = selectedVariant || defaultVariant;
  const discount = getDiscountPercent(activeVariant?.price, activeVariant?.mrp);
  const wishlistIds = (user?.wishlist || []).map((entry) => (typeof entry === 'string' ? entry : entry.id));
  const isWishlisted = wishlistIds.includes(product.id);
  const isCompared = comparedProducts.some((entry) => entry.id === product.id);
  const primaryImage = getPrimaryImage(product);

  const maxStock = activeVariant ? Math.max(activeVariant.stock || 0, 0) : 0;
  const isOutOfStock = activeVariant ? maxStock === 0 : true;

  // Cart quantity for active variant
  const cartItem = cartItems.find((item) => item.variantId === activeVariant?.id);
  const quantityInCart = cartItem?.qty || 0;

  const handleToggleWishlist = async () => {
    if (!user) {
      Alert.alert('Login required', 'Please login to save wishlist products.');
      router.push('/(auth)/login');
      return;
    }

    try {
      const updatedUser = await storefrontApi.toggleWishlist(product.id);
      setUser(updatedUser);
    } catch (caughtError) {
      Alert.alert('Wishlist update failed', caughtError instanceof Error ? caughtError.message : 'Please try again.');
    }
  };

  const handleToggleCompare = () => {
    const result = toggleCompareProduct(product);
    if (result.message.includes('up to 3')) {
      Alert.alert('Compare limit', result.message);
    }
  };

  const openQuickBuyModal = (event?: any) => {
    if (event) event.stopPropagation();
    setSelectedVariant(defaultVariant);
    setModalStep('variants');
    setIsQuickBuyOpen(true);
  };

  const handleSelectBuyNowVariant = (varItem: ProductVariant) => {
    setSelectedVariant(varItem);
    // Add item to cart immediately so it stays in cart even if user goes back/closes modal
    const existing = cartItems.find((i) => i.variantId === varItem.id);
    if (!existing) {
      addItem(product, varItem);
    }
    // Transition modal step to Quick Checkout
    setModalStep('checkout');
  };

  const handlePlaceOrder = (paymentMethod: 'razorpay' | 'cod') => {
    setIsQuickBuyOpen(false);
    // Navigate directly to Checkout / Order initiation with cart items
    router.push({
      pathname: '/checkout',
      params: { paymentMethod },
    });
  };

  const variantsList = product.variants && product.variants.length > 0 ? product.variants : (defaultVariant ? [defaultVariant] : []);
  const activePrice = activeVariant?.price || 0;
  const activeMrp = activeVariant?.mrp || activePrice;
  const activeQty = quantityInCart > 0 ? quantityInCart : 1;
  const totalPrice = activePrice * activeQty;
  const totalMrp = activeMrp * activeQty;
  const totalSavings = Math.max(0, totalMrp - totalPrice);

  return (
    <>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/product/[slug]',
            params: { slug: product.slug, image: primaryImage },
          })
        }
        className={
          compact
            ? 'mb-2.5 overflow-hidden rounded-[20px] border border-primary-100 bg-white active:scale-[0.98]'
            : 'mb-3 flex-1 overflow-hidden rounded-[22px] border border-primary-100 bg-white active:scale-[0.98]'
        }
      >
        <View className="relative bg-[#f4f7f6] pt-2 overflow-hidden">
          <Image
            source={{ uri: primaryImage }}
            placeholder={{ uri: 'https://placehold.co/400x400?text=Vaniki+Crop' }}
            style={{ width: '100%', height: compact ? 110 : 138 }}
            contentFit="contain"
            transition={500}
          />
          {isOutOfStock ? (
            <View className="absolute inset-0 z-30 items-center justify-center bg-white/60">
              <View className="rounded-full bg-rose-600 px-3 py-1 shadow-lg">
                <Text className="text-[10px] font-black uppercase tracking-[1px] text-white">
                  {t('mobile.actions.outOfStock')}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Action Buttons (Stacked Vertically on Top-Right to prevent overlap) */}
          <View className="absolute right-2 top-2 z-20 flex-col gap-1">
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                void handleToggleWishlist();
              }}
              className={`h-7 w-7 items-center justify-center rounded-full border active:scale-90 shadow-xs ${
                isWishlisted ? 'border-rose-200 bg-rose-50' : 'border-white/85 bg-white/90'
              }`}
            >
              <Feather name="heart" size={13} color={isWishlisted ? '#E11D48' : '#082018'} />
            </Pressable>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                handleToggleCompare();
              }}
              className={`h-7 w-7 items-center justify-center rounded-full border active:scale-90 shadow-xs ${
                isCompared ? 'border-primary-500 bg-primary-500' : 'border-white/85 bg-white/90'
              }`}
            >
              <Feather name="sliders" size={13} color={isCompared ? '#FFFFFF' : '#082018'} />
            </Pressable>
          </View>

          {/* Discount Badge on Top-Left */}
          {discount ? (
            <View className="absolute left-2 top-2 z-20 rounded-full bg-rose-600 px-2 py-0.5 shadow-xs">
              <Text className="text-[9px] font-black uppercase tracking-[0.5px] text-white">{discount}% OFF</Text>
            </View>
          ) : null}
        </View>

        <View className={compact ? 'p-2.5' : 'p-3'}>
          <Text className="text-[9px] font-black uppercase tracking-[1.5px] text-primary-400">
            {product.category?.name || 'Crop Care'}
          </Text>
          <Text
            numberOfLines={1}
            className={`mt-0.5 font-black leading-tight text-primary-900 ${compact ? 'text-[12px]' : 'text-xs'}`}
          >
            {product.name}
          </Text>
          {product.shortDescription ? (
            <Text
              numberOfLines={1}
              className="mt-0.5 text-[10px] font-semibold text-primary-900/60"
            >
              {product.shortDescription}
            </Text>
          ) : null}
          <View className="mt-2 flex-row items-center gap-1.5">
            {activeVariant ? (
              <>
                <Text className={`${compact ? 'text-sm' : 'text-base'} font-black text-primary-900`}>
                  {currencyFormatter.format(activeVariant.price)}
                </Text>
                {activeVariant.mrp > activeVariant.price ? (
                  <Text className="text-[11px] font-semibold text-primary-900/40 line-through">
                    {currencyFormatter.format(activeVariant.mrp)}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text className="text-xs font-semibold text-primary-500">Contact for price</Text>
            )}
          </View>

          {/* BUY NOW Button */}
          <Pressable
            onPress={openQuickBuyModal}
            disabled={isOutOfStock}
            style={{ backgroundColor: isOutOfStock ? '#E2E8F0' : '#166534' }}
            className={`mt-2.5 rounded-full px-3 active:scale-95 shadow-xs ${compact ? 'py-2' : 'py-2.5'}`}
          >
            <Text
              style={{ color: isOutOfStock ? '#94A3B8' : '#FFFFFF' }}
              className={`text-center font-black uppercase ${compact ? 'text-[10px] tracking-[1px]' : 'text-[11px] tracking-[1.5px]'}`}
            >
              {isOutOfStock ? t('mobile.actions.outOfStock') : t('mobile.actions.buyNow')}
            </Text>
          </Pressable>
        </View>
      </Pressable>

      {/* Select Variant / Quick Checkout Bottom Sheet Modal */}
      <Modal 
        visible={isQuickBuyOpen} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setIsQuickBuyOpen(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          {/* Backdrop Click Dismiss */}
          <Pressable 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
            onPress={() => setIsQuickBuyOpen(false)} 
          />

          <View
            onStartShouldSetResponder={() => true}
            className="w-full bg-white rounded-t-[32px] border-t-2 border-emerald-200 p-5 max-h-[90%] relative z-10"
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                {modalStep === 'checkout' ? (
                  <Pressable onPress={() => setModalStep('variants')} className="p-1 -ml-1">
                    <Feather name="arrow-left" size={20} color="#0B281E" />
                  </Pressable>
                ) : null}
                <Text className="text-base font-black text-slate-900">
                  {modalStep === 'variants'
                    ? (t('mobile.productDetail.packSize'))
                    : (t('mobile.cartPage.proceedBtn'))}
                </Text>
              </View>

              <Pressable onPress={() => setIsQuickBuyOpen(false)} className="p-1">
                <Feather name="x-circle" size={24} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="py-2">
              {modalStep === 'variants' ? (
                /* STEP 1: Select Variant Sheet (Matching Reference Screenshot 2) */
                <View className="py-2">
                  {/* Product Header */}
                  <View className="flex-row items-start gap-3 pb-4 border-b border-slate-100">
                    <Image
                      source={{ uri: primaryImage }}
                      style={{ width: 68, height: 68, borderRadius: 16 }}
                      contentFit="contain"
                      className="bg-slate-50 border border-slate-200"
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-black text-slate-900 leading-snug" numberOfLines={2}>
                        {product.name}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        {activeVariant ? (
                          <>
                            <Text className="text-base font-black text-emerald-700">
                              {currencyFormatter.format(activeVariant.price)}
                            </Text>
                            {activeVariant.mrp > activeVariant.price ? (
                              <Text className="text-xs font-semibold text-slate-400 line-through">
                                {currencyFormatter.format(activeVariant.mrp)}
                              </Text>
                            ) : null}
                          </>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Select Variant Divider Title */}
                  <View className="flex-row items-center justify-between my-4">
                    <View className="flex-1 h-[1px] bg-slate-200" />
                    <Text className="px-3 text-xs font-black uppercase tracking-[1.5px] text-[#2D6A4F]">
                      Select Variant
                    </Text>
                    <View className="flex-1 h-[1px] bg-slate-200" />
                  </View>

                  {/* Variants List */}
                  <View className="gap-3">
                    {variantsList.map((varItem) => {
                      const isItemInCart = cartItems.some((i) => i.variantId === varItem.id);
                      const varName = varItem.label || varItem.sku || 'Standard Package';

                      return (
                        <View
                          key={varItem.id}
                          className="rounded-2xl p-4 border border-slate-200 bg-white flex-row items-center justify-between shadow-xs"
                        >
                          <View className="flex-1 pr-3">
                            <Text className="text-sm font-black text-slate-900">
                              {varName}
                            </Text>
                            <View className="flex-row items-center gap-2 mt-1">
                              <Text className="text-sm font-black text-emerald-700">
                                {currencyFormatter.format(varItem.price)}
                              </Text>
                              {varItem.mrp > varItem.price ? (
                                <Text className="text-xs font-semibold text-slate-400 line-through">
                                  {currencyFormatter.format(varItem.mrp)}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          {/* Action Button: Go To Cart (Orange) OR Buy Now (Green) */}
                          {isItemInCart ? (
                            <Pressable
                              onPress={() => {
                                setIsQuickBuyOpen(false);
                                router.push('/(tabs)/cart');
                              }}
                              style={{ backgroundColor: '#FF9800' }}
                              className="h-9 px-4 rounded-xl items-center justify-center active:scale-95 shadow-xs"
                            >
                              <Text className="text-xs font-black text-white uppercase tracking-wider">
                                Go To Cart
                              </Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              onPress={() => handleSelectBuyNowVariant(varItem)}
                              style={{ backgroundColor: '#166534' }}
                              className="h-9 px-4 rounded-xl items-center justify-center active:scale-95 shadow-xs"
                            >
                              <Text className="text-xs font-black text-white uppercase tracking-wider">
                                Buy Now
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                /* STEP 2: Quick Checkout Sheet (Matching Reference Screenshot 1 & 3) */
                <View className="py-2 gap-4">
                  {/* 1. Deliver To Address Bar */}
                  <View className="rounded-2xl border border-slate-200 bg-white p-3.5 flex-row items-center justify-between shadow-xs">
                    <View className="flex-row items-center gap-2 flex-1 pr-2">
                      <Text className="text-base">🏡</Text>
                      <View className="flex-1">
                        <Text className="text-[11px] font-bold text-slate-500">Deliver To:</Text>
                        <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                          {user?.savedAddress ? `${user.savedAddress.city}, ${user.savedAddress.state} (${user.savedAddress.pincode})` : (user?.name || 'Default Delivery Address')}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => {
                        setIsQuickBuyOpen(false);
                        router.push('/account/profile');
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 active:scale-95"
                    >
                      <Text className="text-xs font-bold text-slate-700">Change</Text>
                    </Pressable>
                  </View>

                  {/* 2. Coupon Discount Banner */}
                  <View className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3 flex-1">
                      <View className="h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
                        <Feather name="percent" size={16} color="#D97706" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-black text-emerald-900">₹0.00 Coupon discount</Text>
                        <Text className="text-[11px] font-semibold text-emerald-700">₹0 Coin Discount</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color="#166534" />
                  </View>

                  {/* 3. Product Item Card with Quantity (- 1 +) */}
                  <View className="rounded-2xl border border-slate-200 bg-white p-4 flex-row items-center gap-3 shadow-xs">
                    <Image
                      source={{ uri: primaryImage }}
                      style={{ width: 60, height: 60, borderRadius: 12 }}
                      contentFit="contain"
                      className="bg-slate-50 border border-slate-200"
                    />
                    <View className="flex-1 pr-1">
                      <Text className="text-xs font-black text-slate-900 leading-snug" numberOfLines={2}>
                        {product.name}
                      </Text>
                      <Text className="text-[11px] font-bold text-slate-500 mt-0.5">
                        {activeVariant?.label || 'Standard Package'}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        {activeVariant?.mrp && activeVariant.mrp > activePrice ? (
                          <Text className="text-xs font-semibold text-slate-400 line-through">
                            {currencyFormatter.format(activeVariant.mrp)}
                          </Text>
                        ) : null}
                        <Text className="text-sm font-black text-emerald-700">
                          {currencyFormatter.format(activePrice)}
                        </Text>
                      </View>
                    </View>

                    {/* Quantity Control (- 1 +) */}
                    <View className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
                      <Pressable
                        onPress={() => {
                          if (activeVariant) decreaseQty(activeVariant.id);
                        }}
                        style={{ backgroundColor: '#166534' }}
                        className="h-7 w-7 items-center justify-center rounded-full active:scale-90"
                      >
                        <Feather name="minus" size={14} color="#FFFFFF" />
                      </Pressable>

                      <Text className="text-xs font-black text-slate-900 min-w-[18px] text-center">
                        {activeQty}
                      </Text>

                      <Pressable
                        onPress={() => {
                          if (activeVariant) increaseQty(activeVariant.id);
                        }}
                        style={{ backgroundColor: '#166534' }}
                        className="h-7 w-7 items-center justify-center rounded-full active:scale-90"
                      >
                        <Feather name="plus" size={14} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>

                  {/* 4. Payment Method Options (Pay Online & Cash On Delivery) */}
                  <View className="gap-3">
                    {/* Pay Online Card */}
                    <View className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm font-black text-slate-900">Pay Online</Text>
                        <View className="rounded-full bg-amber-400 px-2 py-0.5">
                          <Text className="text-[9px] font-black text-slate-900">Save ₹0</Text>
                        </View>
                      </View>
                      <Text className="text-lg font-black text-emerald-700 mb-3">
                        {currencyFormatter.format(totalPrice)}
                      </Text>
                      <Pressable
                        onPress={() => handlePlaceOrder('razorpay')}
                        style={{ backgroundColor: '#166534' }}
                        className="w-full rounded-2xl py-3.5 items-center justify-center active:scale-95 shadow-sm"
                      >
                        <Text className="text-xs font-black uppercase tracking-[1.5px] text-white">
                          Pay Online
                        </Text>
                      </Pressable>
                    </View>

                    {/* Cash On Delivery (COD) Card */}
                    <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                      <Text className="text-sm font-black text-slate-900 mb-1">Cash On Delivery</Text>
                      <Text className="text-base font-black text-slate-800 mb-3">
                        {currencyFormatter.format(totalPrice)}
                      </Text>
                      <Pressable
                        onPress={() => handlePlaceOrder('cod')}
                        className="w-full rounded-2xl border-2 border-emerald-700 bg-emerald-50/60 py-3.5 items-center justify-center active:scale-95"
                      >
                        <Text className="text-xs font-black uppercase tracking-[1.5px] text-emerald-900">
                          Cash On Delivery (COD)
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* 5. Price Details Breakdown Card (Matching Reference Screenshot 3) */}
                  <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs mt-1">
                    <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
                      <Text className="text-xs font-black uppercase tracking-[1px] text-slate-900">
                        Price Details
                      </Text>
                      <Feather name="chevron-up" size={16} color="#64748B" />
                    </View>

                    <View className="py-3 gap-2 border-b border-slate-100">
                      <View className="flex-row justify-between">
                        <Text className="text-xs font-semibold text-slate-600">Price ({activeQty} Item)</Text>
                        <Text className="text-xs font-bold text-slate-900">{currencyFormatter.format(totalMrp)}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-xs font-semibold text-slate-600">Delivery Charges</Text>
                        <Text className="text-xs font-black text-emerald-600">FREE</Text>
                      </View>
                      {totalSavings > 0 ? (
                        <View className="flex-row justify-between">
                          <Text className="text-xs font-semibold text-slate-600">Items Discount</Text>
                          <Text className="text-xs font-black text-emerald-600">- {currencyFormatter.format(totalSavings)}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View className="flex-row justify-between pt-3 pb-2">
                      <Text className="text-sm font-black text-slate-900">Total Amount</Text>
                      <Text className="text-base font-black text-slate-900">{currencyFormatter.format(totalPrice)}</Text>
                    </View>

                    {totalSavings > 0 ? (
                      <View className="mt-2 rounded-xl bg-emerald-50 p-2.5 items-center border border-emerald-200">
                        <Text className="text-xs font-black text-emerald-800 text-center">
                          🎉 You Will Save {currencyFormatter.format(totalSavings)} On This Order
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* 6. Trust Badges */}
                  <View className="py-4 items-center gap-3">
                    <View className="flex-row items-center justify-around w-full px-2">
                      <View className="items-center">
                        <Feather name="shield" size={20} color="#166534" />
                        <Text className="text-[10px] font-bold text-slate-600 mt-1">Made by Vaniki</Text>
                      </View>
                      <View className="items-center">
                        <Feather name="check-circle" size={20} color="#166534" />
                        <Text className="text-[10px] font-bold text-slate-600 mt-1">Sold by Vaniki</Text>
                      </View>
                      <View className="items-center">
                        <Feather name="truck" size={20} color="#166534" />
                        <Text className="text-[10px] font-bold text-slate-600 mt-1">Free Delivery</Text>
                      </View>
                    </View>
                    <Text className="text-xs font-black text-amber-800 text-center mt-1">
                      10 Lakhs + Happy Customers And Counting!
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
});
