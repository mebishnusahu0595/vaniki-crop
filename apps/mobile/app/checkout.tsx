import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import RazorpayCheckout from 'react-native-razorpay';
import { Screen } from '../src/components/Screen';
import { useAuthStore } from '../src/store/useAuthStore';
import { useCartStore } from '../src/store/useCartStore';
import { useServiceModeStore } from '../src/store/useServiceModeStore';
import { useStoreStore } from '../src/store/useStoreStore';
import { storefrontApi } from '../src/lib/api';
import { currencyFormatter, formatStoreAddress } from '../src/utils/format';

export default function CheckoutScreen() {
  const user = useAuthStore((state) => state.user);
  const { items, couponCode, couponDiscount, clearCart } = useCartStore();
  const { mode, address, openSelector } = useServiceModeStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [street, setStreet] = useState(address?.street || user?.savedAddress?.street || '');
  const [city, setCity] = useState(address?.city || user?.savedAddress?.city || '');
  const [state, setState] = useState(address?.state || user?.savedAddress?.state || '');
  const [pincode, setPincode] = useState(address?.pincode || user?.savedAddress?.pincode || '');
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [paying, setPaying] = useState(false);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items]);

  const shippingAddress =
    mode === 'delivery'
      ? {
          name,
          mobile,
          street,
          city,
          state,
          pincode,
        }
      : undefined;

  return (
    <Screen>
      <Text className="text-3xl font-black text-primary-900">Checkout</Text>

      <View className="mt-5 rounded-[28px] bg-white p-5">
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

      {mode === 'delivery' ? (
        <View className="mt-5 rounded-[28px] bg-white p-5">
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
              <TextInput
                key={placeholder}
                value={value}
                onChangeText={setter}
                placeholder={placeholder}
                className="rounded-[20px] border border-primary-100 bg-primary-50 px-4 py-4 text-base text-primary-900"
                placeholderTextColor="#7a978b"
              />
            ))}
          </View>
        </View>
      ) : (
        <View className="mt-5 rounded-[28px] bg-white p-5">
          <Text className="text-lg font-black text-primary-900">Pickup Store</Text>
          <Text className="mt-2 text-sm leading-6 text-primary-900/70">
            {selectedStore ? formatStoreAddress(selectedStore.address) : 'No store selected.'}
          </Text>
        </View>
      )}

      <View className="mt-5 rounded-[28px] bg-primary-900 p-5">
        <Text className="text-lg font-black text-white">Order Summary</Text>
        <View className="mt-4 gap-3">
          {items.map((item) => (
            <View key={item.variantId} className="flex-row justify-between">
              <Text className="flex-1 pr-4 text-sm text-white/75">{item.productName}</Text>
              <Text className="text-sm font-bold text-white">
                {item.qty} x {currencyFormatter.format(item.price)}
              </Text>
            </View>
          ))}
          <View className="mt-3 flex-row justify-between border-t border-white/10 pt-3">
            <Text className="text-base font-black text-white">Total</Text>
            <Text className="text-base font-black text-white">
              {currencyFormatter.format(subtotal - couponDiscount + (subtotal > 1000 ? 0 : 50))}
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-5 rounded-[28px] bg-white p-5">
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
            ? 'Pay now using Razorpay.'
            : 'Pay in cash when the order is delivered or picked up.'}
        </Text>
      </View>

      <Pressable
        disabled={paying}
        onPress={async () => {
          if (!selectedStore) {
            Alert.alert('Select a store', 'Please choose a store before checkout.');
            return;
          }

          if (mode === 'delivery' && (!name || !mobile || !street || !city || !state || !pincode)) {
            Alert.alert('Complete address', 'Please complete the delivery form.');
            return;
          }

          setPaying(true);
          try {
            const orderPayload = {
              storeId: selectedStore.id,
              serviceMode: mode,
              couponCode: couponCode || undefined,
              items: items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                qty: item.qty,
              })),
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
            Alert.alert(
              'Checkout failed',
              caughtError instanceof Error ? caughtError.message : 'Unable to complete payment.',
            );
          } finally {
            setPaying(false);
          }
        }}
        className="mt-6 rounded-full bg-primary-500 px-5 py-4"
      >
        <Text className="text-center text-sm font-black uppercase tracking-[2px] text-white">
          {paying
            ? paymentMethod === 'razorpay'
              ? 'Opening Razorpay...'
              : 'Placing COD Order...'
            : paymentMethod === 'razorpay'
              ? 'Pay with Razorpay'
              : 'Place COD Order'}
        </Text>
      </Pressable>
    </Screen>
  );
}
