import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import RazorpayCheckout from 'react-native-razorpay';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../src/components/Screen';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { useFocusAwareScroll } from '../src/hooks/useFocusAwareScroll';
import { useAuthStore } from '../src/store/useAuthStore';
import { useCartStore } from '../src/store/useCartStore';
import { useServiceModeStore } from '../src/store/useServiceModeStore';
import { useStoreStore } from '../src/store/useStoreStore';
import { storefrontApi } from '../src/lib/api';
import { currencyFormatter, formatStoreAddress } from '../src/utils/format';

function getCheckoutErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const nestedError = record.error as Record<string, unknown> | undefined;
    const code = record.code || nestedError?.code;
    const message = record.description || record.message || nestedError?.description || nestedError?.message;
    if (code === 0 || (typeof message === 'string' && /cancel/i.test(message))) {
      return 'Payment cancelled. Your cart is unchanged.';
    }
    if (typeof message === 'string' && message.trim()) return message;
  }

  return 'Unable to complete payment.';
}

import { useSettingsStore } from '../src/store/useSettingsStore';

export default function CheckoutScreen() {
  const { settings } = useSettingsStore();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const token = useAuthStore((state) => state.token);
  const { items, couponCode, couponDiscount, clearCart } = useCartStore();
  const { mode, address, openSelector, setAddress } = useServiceModeStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const setStore = useStoreStore((state) => state.setStore);
  
  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [street, setStreet] = useState(address?.street || user?.savedAddress?.street || '');
  const [city, setCity] = useState(address?.city || user?.savedAddress?.city || '');
  const [state, setState] = useState(address?.state || user?.savedAddress?.state || '');
  const [pincode, setPincode] = useState(address?.pincode || user?.savedAddress?.pincode || '');
  
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [activeStoreId, setActiveStoreId] = useState(selectedStore?.id || '');
  const [paying, setPaying] = useState(false);
  const [isStorePickerVisible, setIsStorePickerVisible] = useState(false);
  
  const { scrollRef, onInputFocus } = useFocusAwareScroll(120);
  const lastSavedAddressSignature = useRef('');

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items]);
  const deliveryCharge = useMemo(() => {
    if (mode !== 'delivery') return 0;
    return subtotal >= settings.freeDeliveryThreshold ? 0 : settings.standardDeliveryCharge;
  }, [mode, subtotal, settings.freeDeliveryThreshold, settings.standardDeliveryCharge]);
  const total = subtotal - couponDiscount + deliveryCharge;
  const addressDraft = useMemo(
    () => ({
      street: street,
      city: city,
      state: state,
      pincode: pincode,
      landmark: address?.landmark || user?.savedAddress?.landmark || '',
    }),
    [street, city, state, pincode, address?.landmark, user?.savedAddress?.landmark],
  );
  const debouncedAddressSignature = useDebouncedValue(
    `${addressDraft.street}|${addressDraft.city}|${addressDraft.state}|${addressDraft.pincode}|${addressDraft.landmark || ''}`,
    700,
  );

  const { data: storeAvailability = [], isLoading: isLoadingStores } = useQuery({
    queryKey: ['mobile-cart-availability', items],
    queryFn: () => storefrontApi.cartAvailability(items.map(i => ({ productId: i.productId, variantId: i.variantId, qty: i.qty }))),
    enabled: Boolean(token) && items.length > 0,
  });

  useEffect(() => {
    if (mode !== 'delivery' || !address) return;
    if (address.street !== street) setStreet(address.street || '');
    if (address.city !== city) setCity(address.city || '');
    if (address.state !== state) setState(address.state || '');
    if (address.pincode !== pincode) setPincode(address.pincode || '');
  }, [address?.street, address?.city, address?.state, address?.pincode, mode]);

  useEffect(() => {
    setActiveStoreId(selectedStore?.id || '');
  }, [selectedStore?.id]);

  useEffect(() => {
    if (mode !== 'delivery' || !token || !user?.id) return;
    if (!addressDraft.street || !addressDraft.city || !addressDraft.state || !addressDraft.pincode) return;
    if (debouncedAddressSignature === lastSavedAddressSignature.current) return;

    let cancelled = false;

    void storefrontApi
      .updateMe({ savedAddress: addressDraft })
      .then((updatedUser) => {
        if (cancelled) return;
        setUser(updatedUser);
        lastSavedAddressSignature.current = debouncedAddressSignature;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [mode, token, user?.id, addressDraft, debouncedAddressSignature, setUser]);

  const handleStoreChange = async (store: any) => {
    if (!store.isFullyAvailable) {
      Alert.alert('Items unavailable', 'This store does not have enough stock for all items in your cart.');
      return;
    }

    setActiveStoreId(store.id);
    try {
      await storefrontApi.selectStore(store.id);
      setStore(store);
      setIsStorePickerVisible(false);
    } catch (caughtError) {
      Alert.alert('Store selection failed', caughtError instanceof Error ? caughtError.message : 'Please try again.');
    }
  };

  const shippingAddress =
    mode === 'delivery'
      ? {
          name: name.trim(),
          mobile: mobile.trim(),
          street: addressDraft.street.trim(),
          city: addressDraft.city.trim(),
          state: addressDraft.state.trim(),
          pincode: addressDraft.pincode.trim(),
          landmark: addressDraft.landmark,
        }
      : undefined;

  return (
    <Screen scroll={false} keyboardAware={false}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          contentContainerStyle={{ paddingBottom: 40 }}
          scrollEnabled={!isStorePickerVisible}
        >
      <View className="mb-4 mt-6 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <Feather name="arrow-left" size={20} color="#082018" />
        </Pressable>
        <Text className="text-3xl font-black text-primary-900">Checkout</Text>
      </View>

      <View className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
        <Text className="text-lg font-black text-primary-900">Service Mode</Text>
        <Text className="mt-2 text-sm text-primary-900/70">
          {mode === 'delivery' ? 'Delivery to your saved address' : 'Pickup from your chosen store'}
        </Text>
        <Pressable onPress={openSelector} className="mt-4 rounded-full bg-primary-50 px-4 py-3">
          <Text className="text-center text-xs font-black uppercase tracking-[2px] text-primary-500">
            Change Service Mode
          </Text>
        </Pressable>
      </View>

      <View className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
        <Text className="text-lg font-black text-primary-900">Fulfillment Store</Text>
        <View className="mt-4 gap-3">
          <Pressable 
            onPress={() => setIsStorePickerVisible(true)}
            className="flex-row items-center justify-between rounded-[22px] border border-primary-100 bg-primary-50 px-5 py-4 active:bg-primary-100"
          >
            <View className="flex-row items-center gap-3">
              <Feather name="home" size={18} color="#2D6A4F" />
              <Text className="text-sm font-black text-primary-900">
                {selectedStore ? selectedStore.name : 'Choose a store'}
              </Text>
            </View>
            <Feather name="chevron-down" size={18} color="#2D6A4F" />
          </Pressable>

          {selectedStore && (
            <View className="mt-1 rounded-[20px] bg-primary-50/30 p-4 border border-primary-100/30">
              <View className="flex-row items-start gap-3">
                <Feather name="map-pin" size={16} color="#2D6A4F" style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-sm font-black text-primary-900">{selectedStore.name}</Text>
                  <Text className="mt-1 text-xs text-primary-900/60 leading-5">{formatStoreAddress(selectedStore.address)}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      <Modal
        visible={isStorePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStorePickerVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="h-[70%] rounded-t-[40px] bg-white p-6 shadow-2xl">
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="text-xl font-black text-primary-900">Select Store</Text>
              <Pressable onPress={() => setIsStorePickerVisible(false)} className="h-10 w-10 items-center justify-center rounded-full bg-primary-50">
                <Feather name="x" size={20} color="#2D6A4F" />
              </Pressable>
            </View>

            <View className="flex-1">
              {isLoadingStores ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator color="#2D6A4F" size="large" />
                  <Text className="mt-4 text-xs font-black uppercase tracking-widest text-primary-900/40">Fetching stores...</Text>
                </View>
              ) : (
                <ScrollView 
                  showsVerticalScrollIndicator={false} 
                  contentContainerStyle={{ paddingBottom: 60 }}
                  className="flex-1"
                >
                  <View className="gap-3">
                    {storeAvailability.map((store) => {
                      const isActive = activeStoreId === store.id;
                      const isAvailable = store.isFullyAvailable;
                      return (
                        <Pressable
                          key={store.id}
                          disabled={!isAvailable}
                          onPress={() => handleStoreChange(store)}
                          className={`rounded-[28px] border-2 p-5 transition-all ${
                            isActive 
                              ? 'border-primary-500 bg-primary-50 shadow-md scale-[0.98]' 
                              : 'border-primary-100 bg-white'
                          } ${!isAvailable ? 'opacity-30 grayscale' : 'active:scale-[0.96]'}`}
                        >
                          <View className="flex-row items-center justify-between">
                            <View className="flex-1">
                              <View className="flex-row items-center gap-2">
                                <Text className={`text-base font-black tracking-tight ${isActive ? 'text-primary-900' : 'text-primary-900/80'}`}>
                                  {store.name}
                                </Text>
                                {!isAvailable && (
                                  <View className="rounded-full bg-rose-500/10 px-2 py-0.5">
                                    <Text className="text-[9px] font-black uppercase tracking-wider text-rose-500">Out of Stock</Text>
                                  </View>
                                )}
                              </View>
                              <View className="mt-2 flex-row items-center gap-1.5">
                                <Feather name="map-pin" size={12} color={isActive ? "#2D6A4F" : "#94A3B8"} />
                                <Text className={`text-xs font-medium ${isActive ? 'text-primary-900/60' : 'text-slate-400'}`}>
                                  {store.address.city}, {store.address.state}
                                </Text>
                              </View>
                            </View>
                            {isActive && (
                              <View className="h-6 w-6 items-center justify-center rounded-full bg-primary-500">
                                <Feather name="check" size={14} color="white" />
                              </View>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {mode === 'delivery' && (
        <View className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
          <Text className="text-lg font-black text-primary-900">Delivery Address</Text>
          <View className="mt-4 gap-3">
            {([
              [name, setName, 'Full Name'],
              [mobile, setMobile, 'Mobile Number'],
              [street, setStreet, 'Street Address'],
              [city, setCity, 'City'],
              [state, setState, 'State'],
              [pincode, setPincode, 'Pincode'],
            ] as const).map(([value, setter, placeholder]) => (
              <View key={placeholder}>
                <Text className="mb-2 ml-1 text-[11px] font-black uppercase tracking-[1px] text-primary-900/60">{placeholder}</Text>
                <TextInput
                  value={value}
                  onChangeText={setter}
                  onFocus={onInputFocus}
                  placeholder={placeholder}
                  className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                  placeholderTextColor="#7a978b"
                />
              </View>
            ))}
          </View>
        </View>
      )}

      <View className="mt-5 rounded-[28px] bg-primary-900 p-6 shadow-lg">
        <Text className="text-xl font-black text-white">Order Summary</Text>
        <View className="mt-6 gap-5">
          {items.map((item) => (
            <View key={item.variantId} className="border-b border-white/10 pb-5 last:border-0 last:pb-0">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-4">
                  <Text className="text-base font-bold text-white">{item.productName}</Text>
                  <Text className="mt-1 text-xs font-black uppercase tracking-widest text-white/40">{item.variantLabel}</Text>
                </View>
                <Text className="text-base font-black text-white">
                  {currencyFormatter.format(item.qty * item.price)}
                </Text>
              </View>
              <View className="mt-3">
                <Text className="text-xs font-bold text-white/60">{item.qty} units</Text>
              </View>
            </View>
          ))}
          
          <View className="mt-4 gap-2 border-t border-white/10 pt-5">
            <View className="flex-row justify-between">
              <Text className="text-sm font-medium text-white/60">Subtotal</Text>
              <Text className="text-sm font-bold text-white">{currencyFormatter.format(subtotal)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm font-medium text-white/60">Discount</Text>
              <Text className="text-sm font-bold text-white">-{currencyFormatter.format(couponDiscount)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm font-medium text-white/60">Delivery</Text>
              <Text className="text-sm font-bold text-white">
                {deliveryCharge === 0 ? 'FREE' : currencyFormatter.format(deliveryCharge)}
              </Text>
            </View>
            <View className="mt-2 flex-row justify-between items-center">
              <Text className="text-xl font-black text-white">Total</Text>
              <Text className="text-2xl font-black text-white">
                {currencyFormatter.format(total)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
        <Text className="text-lg font-black text-primary-900">Payment Method</Text>
        <View className="mt-4 flex-row gap-3">
          <Pressable
            onPress={() => setPaymentMethod('razorpay')}
            className={`flex-1 rounded-full px-4 py-3 ${paymentMethod === 'razorpay' ? 'bg-primary-500' : 'bg-primary-50'}`}
          >
            <Text className={`text-center text-xs font-black uppercase tracking-[2px] ${paymentMethod === 'razorpay' ? 'text-white' : 'text-primary-500'}`}>
              Razorpay
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPaymentMethod('cod')}
            className={`flex-1 rounded-full px-4 py-3 ${paymentMethod === 'cod' ? 'bg-primary-500' : 'bg-primary-50'}`}
          >
            <Text className={`text-center text-xs font-black uppercase tracking-[2px] ${paymentMethod === 'cod' ? 'text-white' : 'text-primary-500'}`}>
              COD
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        disabled={paying || !selectedStore}
        onPress={async () => {
          if (!token) {
            Alert.alert('Login required', 'Please login again to continue.');
            router.replace('/(auth)/login');
            return;
          }

          if (!selectedStore) {
            Alert.alert('Select a store', 'Please choose a fulfillment store before checkout.');
            setIsStorePickerVisible(true);
            return;
          }

          const currentStoreAvailability = storeAvailability.find(s => s.id === selectedStore.id);
          if (!currentStoreAvailability || !currentStoreAvailability.isFullyAvailable) {
            Alert.alert('Stock unavailable', 'Some items are not available in the selected store. Please choose another store or update your cart.');
            setIsStorePickerVisible(true);
            return;
          }

          if (mode === 'delivery' && (!name || !mobile || !street || !city || !state || !pincode)) {
            Alert.alert('Complete address', 'Please complete the delivery form.');
            return;
          }

          setPaying(true);
          try {
            const orderPayload = {
              serviceMode: mode,
              couponCode: couponCode || undefined,
              items: items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                qty: item.qty,
              })),
              storeId: selectedStore.id,
              shippingAddress,
            };

            if (paymentMethod === 'cod') {
              const confirmed = await storefrontApi.placeCodOrder(orderPayload);
              clearCart();
              router.replace({ pathname: '/order-success/[id]', params: { id: confirmed.orderId } });
              return;
            }

            const initiated = await storefrontApi.initiateOrder(orderPayload);
            const payment = await RazorpayCheckout.open({
              key: initiated.razorpayKeyId,
              amount: Math.round(initiated.amount * 100),
              currency: initiated.currency,
              name: 'Vaniki Crop',
              description: 'Order Payment',
              order_id: initiated.razorpayOrderId,
              prefill: { name: user?.name, email: user?.email, contact: user?.mobile },
              theme: { color: '#2D6A4F' },
            });

            const confirmed = await storefrontApi.confirmOrder({
              ...orderPayload,
              razorpayOrderId: payment.razorpay_order_id,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySignature: payment.razorpay_signature,
            });

            clearCart();
            router.replace({ pathname: '/order-success/[id]', params: { id: confirmed.orderId } });
          } catch (caughtError) {
            Alert.alert('Checkout failed', getCheckoutErrorMessage(caughtError));
          } finally {
            setPaying(false);
          }
        }}
        className={`mb-10 mt-8 rounded-full px-5 py-5 shadow-lg ${!selectedStore || paying ? 'bg-primary-200' : 'bg-primary-500'}`}
      >
        <Text className="text-center text-base font-black uppercase tracking-[2px] text-white">
          {paying ? 'Processing...' : paymentMethod === 'razorpay' ? 'Pay with Razorpay' : 'Place COD Order'}
        </Text>
      </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
