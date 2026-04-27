import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

function AlternativeStoresList({
  productId,
  variantId,
  onSelect,
}: {
  productId: string;
  variantId: string;
  onSelect: (store: any) => void;
}) {
  const { data: availability = [], isLoading } = useQuery({
    queryKey: ['mobile-product-availability', productId, variantId],
    queryFn: () => storefrontApi.productAvailability(productId, variantId),
  });

  if (isLoading) {
    return (
      <View className="py-4 items-center">
        <ActivityIndicator color="#2D6A4F" size="small" />
      </View>
    );
  }

  if (availability.length === 0) {
    return (
      <View className="py-3 items-center">
        <Text className="text-[10px] font-black text-rose-300 uppercase tracking-widest">Not available in any store</Text>
      </View>
    );
  }

  return (
    <View className="mt-3 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <View className="max-h-[200px]">
        {availability.map((store) => (
          <Pressable
            key={store.id}
            onPress={() => onSelect(store)}
            className="flex-row items-start gap-3 border-b border-white/5 p-3 active:bg-white/10"
          >
            <Feather name="home" size={14} color="#A7D7C5" style={{ marginTop: 2 }} />
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] font-black text-white">{store.name}</Text>
                <View className="rounded-full bg-primary-500/30 px-2 py-0.5">
                  <Text className="text-[9px] font-black text-primary-200">{store.quantity} units</Text>
                </View>
              </View>
              <Text className="mt-1 text-[9px] font-medium text-white/50" numberOfLines={1}>
                {formatStoreAddress(store.address)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function CheckoutScreen() {
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
  const [checkingAvailabilityFor, setCheckingAvailabilityFor] = useState<{ productId: string; variantId: string } | null>(null);
  const [paying, setPaying] = useState(false);
  
  const { scrollRef, onInputFocus } = useFocusAwareScroll(120);
  const lastSavedAddressSignature = useRef('');

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items]);
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

  const storesQuery = useQuery({
    queryKey: ['mobile-checkout-stores'],
    queryFn: storefrontApi.stores,
    enabled: Boolean(token),
  });

  const allStores = useMemo(() => {
    const raw = storesQuery.data || [];
    return raw.filter((store) => {
      const city = (store.address.city || '').trim().toLowerCase();
      const state = (store.address.state || '').trim().toLowerCase();
      const street = (store.address.street || '').trim().toLowerCase();
      const placeholders = new Set(['pending', 'na', 'n/a', 'none', 'null', 'undefined']);
      if (!street || !city || !state) return false;
      if (placeholders.has(city) || placeholders.has(state)) return false;
      return true;
    });
  }, [storesQuery.data]);

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
    setActiveStoreId(store.id);
    try {
      await storefrontApi.selectStore(store.id);
      setStore(store);
      setCheckingAvailabilityFor(null);
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
          {allStores.length > 0 ? (
            <View className="rounded-[20px] border border-primary-100 bg-primary-50 overflow-hidden">
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ padding: 12, gap: 12 }}
              >
                {allStores.map((store) => {
                  const isActive = activeStoreId === store.id;
                  return (
                    <Pressable
                      key={store.id}
                      onPress={() => handleStoreChange(store)}
                      className={`min-w-[200px] rounded-[18px] border p-4 ${isActive ? 'border-primary-500 bg-white' : 'border-primary-100 bg-primary-50'}`}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className={`text-sm font-black ${isActive ? 'text-primary-900' : 'text-primary-900/60'}`}>{store.name}</Text>
                        {isActive && <Feather name="check-circle" size={14} color="#2D6A4F" />}
                      </View>
                      <Text className="mt-1 text-[11px] text-primary-900/50" numberOfLines={1}>{store.address.city}, {store.address.state}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <Text className="text-sm text-primary-900/60 italic">Loading stores...</Text>
          )}

          {selectedStore ? (
            <View className="mt-2 rounded-[20px] bg-primary-50/50 p-4 border border-primary-100/30">
              <View className="flex-row items-start gap-3">
                <Feather name="map-pin" size={16} color="#2D6A4F" style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-sm font-black text-primary-900">{selectedStore.name}</Text>
                  <Text className="mt-1 text-xs text-primary-900/60 leading-5">{formatStoreAddress(selectedStore.address)}</Text>
                  {selectedStore.phone && (
                    <Text className="mt-2 text-xs font-black text-primary-700">{selectedStore.phone}</Text>
                  )}
                </View>
              </View>
            </View>
          ) : (
            <Text className="text-xs font-bold text-rose-500 italic mt-1">Please select a store to fulfill your order</Text>
          )}
        </View>
      </View>

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
          {items.map((item) => {
            const isOutOfStock = item.stock !== undefined && item.stock < item.qty;
            const isCheckingAlt = checkingAvailabilityFor?.productId === item.productId && checkingAvailabilityFor?.variantId === item.variantId;

            return (
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
                
                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-white/60">{item.qty} units</Text>
                  {isOutOfStock && (
                    <Pressable 
                      onPress={() => setCheckingAvailabilityFor(isCheckingAlt ? null : { productId: item.productId, variantId: item.variantId })}
                      className="rounded-full bg-rose-500/20 px-3 py-1 border border-rose-500/30"
                    >
                      <Text className="text-[10px] font-black text-rose-300 uppercase tracking-widest">
                        {isCheckingAlt ? 'Hide Stores' : 'Check Other Stores'}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {isOutOfStock && !isCheckingAlt && (
                  <Text className="mt-2 text-[10px] font-bold text-rose-300 flex-row items-center">
                    ⚠️ Only {item.stock || 0} units available in {selectedStore?.name || 'this store'}
                  </Text>
                )}

                {isCheckingAlt && (
                  <AlternativeStoresList
                    productId={item.productId}
                    variantId={item.variantId}
                    onSelect={handleStoreChange}
                  />
                )}
              </View>
            );
          })}
          
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
              <Text className="text-sm font-bold text-white">{subtotal > 1000 ? 'FREE' : currencyFormatter.format(50)}</Text>
            </View>
            <View className="mt-2 flex-row justify-between items-center">
              <Text className="text-xl font-black text-white">Total</Text>
              <Text className="text-2xl font-black text-white">
                {currencyFormatter.format(subtotal - couponDiscount + (subtotal > 1000 ? 0 : 50))}
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
        <Text className="mt-3 text-sm text-primary-900/70">
          {paymentMethod === 'razorpay'
            ? 'Secure online payment.'
            : 'Pay in cash on delivery/pickup.'}
        </Text>
      </View>

      <Pressable
        disabled={paying || !selectedStore}
        onPress={async () => {
          if (!token) {
            Alert.alert('Login required', 'Please login again to place your order.');
            router.replace('/(auth)/login');
            return;
          }

          if (!selectedStore) {
            Alert.alert('Select a store', 'Please choose a fulfillment store before checkout.');
            return;
          }

          if (mode === 'delivery' && (!name || !mobile || !street || !city || !state || !pincode)) {
            Alert.alert('Complete address', 'Please complete the delivery form.');
            return;
          }

          const unavailableItem = items.find(item => item.stock !== undefined && item.stock < item.qty);
          if (unavailableItem) {
            Alert.alert('Stock unavailable', 'Some items are not available in the selected store. Please update your cart or choose another store.');
            setCheckingAvailabilityFor({ productId: unavailableItem.productId, variantId: unavailableItem.variantId });
            return;
          }

          if (!items.length) {
            Alert.alert('Cart is empty', 'Add products to cart before checkout.');
            router.replace('/(tabs)');
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
            if (!initiated.razorpayKeyId || !initiated.razorpayOrderId) {
              throw new Error('Razorpay configuration error. Please contact support.');
            }

            const payment = await RazorpayCheckout.open({
              key: initiated.razorpayKeyId,
              amount: Math.round(initiated.amount * 100),
              currency: initiated.currency,
              name: 'Vaniki Crop',
              description: 'Crop protection order',
              order_id: initiated.razorpayOrderId,
              prefill: {
                name: user?.name,
                email: user?.email,
                contact: user?.mobile,
              },
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
            if (
              caughtError instanceof Error &&
              /(access denied|no token|unauthorized|jwt|token)/i.test(caughtError.message)
            ) {
              Alert.alert('Session expired', 'Please login again to continue checkout.');
              router.replace('/(auth)/login');
              return;
            }

            Alert.alert(
              'Checkout failed',
              getCheckoutErrorMessage(caughtError),
            );
          } finally {
            setPaying(false);
          }
        }}
        className={`mb-10 mt-8 rounded-full px-5 py-5 shadow-lg ${!selectedStore || paying ? 'bg-primary-200' : 'bg-primary-500'}`}
      >
        <Text className="text-center text-base font-black uppercase tracking-[2px] text-white">
          {paying
            ? 'Processing...'
            : paymentMethod === 'razorpay'
              ? 'Pay with Razorpay'
              : 'Place COD Order'}
        </Text>
      </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
