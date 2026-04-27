import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, MapPin, Store as StoreIcon, ShieldCheck, Wallet, Plus, Minus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useStoreStore } from '../store/useStoreStore';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { storefrontApi } from '../utils/api';
import { getApiErrorMessage } from '../utils/error';
import { currencyFormatter, formatStoreAddress } from '../utils/format';



declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

const AlternativeStoresList: React.FC<{
  productId: string;
  variantId: string;
  onSelect: (storeId: string) => void;
}> = ({ productId, variantId, onSelect }) => {
  const { t } = useTranslation();
  const { data: availability = [], isLoading } = useQuery({
    queryKey: ['product-availability', productId, variantId],
    queryFn: () => storefrontApi.productAvailability(productId, variantId),
  });

  if (isLoading) return <div className="animate-pulse py-4 text-center text-xs font-bold text-primary-900/40 uppercase tracking-widest">{t('common.loading')}</div>;

  if (availability.length === 0) return <div className="py-4 text-center text-xs font-bold text-rose-500 uppercase tracking-widest">{t('checkoutPage.notAvailableAnywhere', 'Not available in any store')}</div>;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-primary-100 bg-primary-50/30">
      <div className="max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary-200">
        {availability.map((store) => (
          <button
            key={store.id}
            type="button"
            onClick={() => onSelect(store.id)}
            className="flex w-full items-start gap-3 border-b border-primary-100/50 p-3 text-left transition hover:bg-primary-50 last:border-0"
          >
            <StoreIcon size={14} className="mt-0.5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black text-primary-900">{store.name}</p>
                <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[9px] font-black text-primary-700">
                  {store.quantity} {t('common.units', 'units')}
                </span>
              </div>
              <p className="mt-0.5 text-[9px] font-medium text-primary-900/60 line-clamp-1">
                {formatStoreAddress(store.address)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const Checkout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, couponCode, couponDiscount, getSubtotal, clearCart, updateQty, removeItem } = useCartStore();
  const { user, token } = useAuthStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const setStore = useStoreStore((state) => state.setStore);
  const { mode, address, setMode, setAddress } = useServiceModeStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [activeStoreId, setActiveStoreId] = useState(selectedStore?.id || '');
  const [checkingAvailabilityFor, setCheckingAvailabilityFor] = useState<{ productId: string; variantId: string } | null>(null);
  
  const hasPlacedOrderRef = useRef(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    mobile: user?.mobile || '',
    street: address?.street || user?.savedAddress?.street || '',
    city: address?.city || user?.savedAddress?.city || '',
    state: address?.state || user?.savedAddress?.state || '',
    pincode: address?.pincode || user?.savedAddress?.pincode || '',
  });

  const subtotal = getSubtotal();
  const deliveryCharge = mode === 'delivery' ? (subtotal > 1000 ? 0 : 50) : 0;
  const total = subtotal - couponDiscount + deliveryCharge;

  const { data: allStores = [] } = useQuery({
    queryKey: ['checkout-stores'],
    queryFn: storefrontApi.stores,
    enabled: !!token,
    staleTime: 300000,
  });

  useEffect(() => {
    if (!items.length && !hasPlacedOrderRef.current) {
      navigate('/cart');
    }
    if (!token) navigate('/login?redirect=/checkout');
  }, [items.length, navigate, token]);

  useEffect(() => {
    setActiveStoreId(selectedStore?.id || '');
  }, [selectedStore?.id]);

  const loadRazorpay = async () => {
    if (window.Razorpay) return true;

    return new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleModeChange = async (nextMode: 'delivery' | 'pickup') => {
    if (nextMode === mode) return;

    const previousMode = mode;
    setMode(nextMode);

    if (!token) return;

    try {
      await storefrontApi.updateServiceMode(nextMode);
    } catch (error) {
      setMode(previousMode);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        toast.error(t('checkoutPage.sessionExpired'));
        navigate('/login?redirect=/checkout');
        return;
      }
      toast.error(getApiErrorMessage(error, t('checkoutPage.couldNotUpdateServiceMode')));
    }
  };

  const handleStoreChange = async (nextStoreId: string) => {
    setActiveStoreId(nextStoreId);

    if (!nextStoreId) {
      setStore(null);
      return;
    }

    try {
      await storefrontApi.selectStore(nextStoreId);
      const matchedStore = allStores.find((store) => store.id === nextStoreId) || null;
      if (matchedStore) {
        setStore(matchedStore);
      }
      setCheckingAvailabilityFor(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('checkoutPage.chooseStoreFirst')));
    }
  };

  const handlePayment = async () => {
    if (!selectedStore) {
      toast.error(t('checkoutPage.chooseStoreFirst'));
      return;
    }

    if (mode === 'delivery' && (!formData.name || !formData.mobile || !formData.street || !formData.city || !formData.state || !formData.pincode)) {
      toast.error(t('checkoutPage.completeDeliveryAddress'));
      return;
    }

    // Double check stock for all items
    const unavailableItem = items.find(item => item.stock !== undefined && item.stock < item.qty);
    if (unavailableItem) {
      toast.error(t('checkoutPage.someItemsUnavailable', 'Some items are unavailable in the selected store'));
      setCheckingAvailabilityFor({ productId: unavailableItem.productId, variantId: unavailableItem.variantId });
      return;
    }

    try {
      const shippingAddress =
        mode === 'delivery'
          ? {
              name: formData.name,
              mobile: formData.mobile,
              street: formData.street,
              city: formData.city,
              state: formData.state,
              pincode: formData.pincode,
            }
          : undefined;

      const orderPayload = {
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          qty: item.qty,
        })),
        serviceMode: mode,
        couponCode: couponCode || undefined,
        storeId: selectedStore.id,
        shippingAddress,
      };

      if (shippingAddress) {
        setAddress({
          street: shippingAddress.street,
          city: shippingAddress.city,
          state: shippingAddress.state,
          pincode: shippingAddress.pincode,
        });
      }

      setIsProcessing(true);

      if (paymentMethod === 'cod') {
        const confirmation = await storefrontApi.placeCodOrder(orderPayload);
        hasPlacedOrderRef.current = true;
        clearCart();
        toast.success(t('checkoutPage.codOrderSuccess'));
        navigate(`/order-success/${confirmation.orderId}`);
        return;
      }

      const hasRazorpay = await loadRazorpay();
      if (!hasRazorpay || !window.Razorpay) {
        toast.error(t('checkoutPage.razorpayLoadFailed'));
        return;
      }

      const initiation = await storefrontApi.initiateOrder(orderPayload);
      const paymentObject = new window.Razorpay({
        key: initiation.razorpayKeyId,
        amount: initiation.amount * 100,
        currency: initiation.currency,
        name: 'Vaniki Crop',
        description: 'Crop protection storefront order',
        order_id: initiation.razorpayOrderId,
        prefill: {
          name: formData.name || user?.name,
          email: user?.email,
          contact: formData.mobile || user?.mobile,
        },
        theme: {
          color: '#2D6A4F',
        },
        handler: async (response: Record<string, string>) => {
          try {
            const confirmation = await storefrontApi.confirmOrder({
              ...orderPayload,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            hasPlacedOrderRef.current = true;
            clearCart();
            toast.success('Order placed successfully.');
            navigate(`/order-success/${confirmation.orderId}`);
          } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
              toast.error(t('checkoutPage.sessionExpired'));
              navigate('/login?redirect=/checkout');
              return;
            }
            toast.error(getApiErrorMessage(error, t('checkoutPage.paymentVerificationFailed')));
          }
        },
      });

      paymentObject.open();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        toast.error(t('checkoutPage.sessionExpired'));
        navigate('/login?redirect=/checkout');
        return;
      }
      toast.error(getApiErrorMessage(error, t('checkoutPage.initiateOrderFailed')));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="surface-card p-6">
            <p className="section-kicker mb-2">{t('checkoutPage.serviceMode')}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => handleModeChange('delivery')}
                className={`rounded-[1.5rem] border p-4 text-left transition ${mode === 'delivery' ? 'border-primary bg-primary-50' : 'border-primary-100 hover:border-primary-300'}`}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="text-primary" size={18} />
                  <div>
                    <p className="text-sm font-black text-primary-900">{t('checkoutPage.delivery')}</p>
                    <p className="mt-1 text-[11px] font-medium text-primary-900/60 leading-relaxed">
                      {t('checkoutPage.deliveringTo', { address: formatStoreAddress(address || user?.savedAddress || null) })}
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('pickup')}
                className={`rounded-[1.5rem] border p-4 text-left transition ${mode === 'pickup' ? 'border-primary bg-primary-50' : 'border-primary-100 hover:border-primary-300'}`}
              >
                <div className="flex items-center gap-3">
                  <StoreIcon className="text-primary" size={18} />
                  <div>
                    <p className="text-sm font-black text-primary-900">{t('checkoutPage.pickup')}</p>
                    <p className="mt-1 text-[11px] font-medium text-primary-900/60 leading-relaxed">
                      {selectedStore?.name || t('checkoutPage.selectStoreFromHeader')}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          <section className="surface-card p-6">
            <p className="section-kicker mb-2">{t('checkoutPage.selectStore', 'Fulfillment Store')}</p>
            <div className="space-y-4">
              <select
                value={activeStoreId}
                onChange={(event) => handleStoreChange(event.target.value)}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
              >
                <option value="">{t('storeSelector.chooseStore', 'Choose a store for fulfillment')}</option>
                {allStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} — {store.address.city}, {store.address.state}
                  </option>
                ))}
              </select>
              
              {selectedStore ? (
                <div className="flex items-start gap-3 rounded-2xl bg-primary-50/50 p-4 border border-primary-100/50">
                  <MapPin className="text-primary mt-0.5 shrink-0" size={16} />
                  <div>
                    <h3 className="text-sm font-black text-primary-900">{selectedStore.name}</h3>
                    <p className="mt-1 text-xs font-medium text-primary-900/60 leading-relaxed">
                      {formatStoreAddress(selectedStore.address)}
                    </p>
                    {selectedStore.phone && (
                      <p className="mt-2 text-xs font-black text-primary-700">{selectedStore.phone}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-primary-200 p-4 justify-center">
                  <StoreIcon className="text-primary-300" size={20} />
                  <p className="text-sm font-bold text-primary-300 italic">
                    {t('checkoutPage.mustSelectStore', 'Please select a store to see availability and place order')}
                  </p>
                </div>
              )}
            </div>
          </section>

          {mode === 'delivery' && (
            <section key="delivery-section" className="surface-card p-6">
              <p className="section-kicker mb-2">{t('checkoutPage.deliveryAddress')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder={t('checkoutPage.fullName')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40"
                />
                <input
                  value={formData.mobile}
                  onChange={(event) => setFormData((current) => ({ ...current, mobile: event.target.value }))}
                  placeholder={t('checkoutPage.mobileNumber')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40"
                />
                <input
                  value={formData.street}
                  onChange={(event) => setFormData((current) => ({ ...current, street: event.target.value }))}
                  placeholder={t('checkoutPage.streetVillage')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40 sm:col-span-2"
                />
                <input
                  value={formData.city}
                  onChange={(event) => setFormData((current) => ({ ...current, city: event.target.value }))}
                  placeholder={t('checkoutPage.city')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40"
                />
                <input
                  value={formData.state}
                  onChange={(event) => setFormData((current) => ({ ...current, state: event.target.value }))}
                  placeholder={t('checkoutPage.state')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40"
                />
                <input
                  value={formData.pincode}
                  onChange={(event) => setFormData((current) => ({ ...current, pincode: event.target.value }))}
                  placeholder={t('checkoutPage.pincode')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40"
                />
              </div>
            </section>
          )}

          <section className="surface-card p-6">
            <p className="section-kicker mb-2">{t('checkoutPage.orderSummary')}</p>
            <div className="space-y-5">
              {items.map((item) => {
                const isOutOfStock = item.stock !== undefined && item.stock < item.qty;
                const isCheckingAlt = checkingAvailabilityFor?.productId === item.productId && checkingAvailabilityFor?.variantId === item.variantId;

                return (
                  <div key={`${item.productId}-${item.variantId}`} className="group">
                    <div className="flex gap-4">
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-primary-50 border border-primary-100/50">
                        {item.image ? (
                          <img src={item.image} alt={item.productName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-primary-200">
                            <StoreIcon size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-black text-primary-900 line-clamp-1">{item.productName}</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary-500">
                              {item.variantLabel}
                            </p>
                          </div>
                          <p className="text-sm font-black text-primary-900">{currencyFormatter.format(item.qty * item.price)}</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 rounded-full bg-primary-50 p-1 border border-primary-100/30">
                            <button
                              type="button"
                              onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-primary-900 shadow-sm transition hover:bg-primary-100"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="min-w-[20px] text-center text-xs font-black text-primary-900">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-sm transition hover:bg-primary-600"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId, item.variantId)}
                            className="text-primary-300 transition hover:text-rose-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {isOutOfStock && (
                          <div className="mt-2 space-y-2">
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                              {t('checkoutPage.insufficientStock', 'Only {{count}} units available in this store', { count: item.stock || 0 })}
                            </p>
                            <button
                              type="button"
                              onClick={() => setCheckingAvailabilityFor(isCheckingAlt ? null : { productId: item.productId, variantId: item.variantId })}
                              className="text-[10px] font-black text-primary uppercase tracking-widest underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
                            >
                              {isCheckingAlt ? t('checkoutPage.hideOtherStores', 'Hide Alternative Stores') : t('checkoutPage.checkOtherStores', 'Check Availability in Other Stores')}
                            </button>
                          </div>
                        )}
                        
                        {isCheckingAlt && (
                          <AlternativeStoresList
                            productId={item.productId}
                            variantId={item.variantId}
                            onSelect={handleStoreChange}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="surface-card h-fit p-6 sticky top-8">
          <p className="section-kicker mb-2">{t('checkoutPage.payment')}</p>
          <h2 className="text-2xl font-black text-primary-900">{t('checkoutPage.choosePaymentMethod')}</h2>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('razorpay')}
              className={`flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.15em] transition ${
                paymentMethod === 'razorpay'
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary-100 bg-white text-primary-900'
              }`}
            >
              <CreditCard size={16} />
              <span>Razorpay</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('cod')}
              className={`flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.15em] transition ${
                paymentMethod === 'cod'
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary-100 bg-white text-primary-900'
              }`}
            >
              <Wallet size={16} />
              <span>{t('checkoutPage.cashOnDelivery')}</span>
            </button>
          </div>

          <p className="mt-4 text-sm font-medium text-primary-900/65">
            {paymentMethod === 'razorpay'
              ? t('checkoutPage.payNowSecurely')
              : t('checkoutPage.payCashLater')}
          </p>

          <div className="mt-6 space-y-3 text-sm font-semibold text-primary-900/65">
            <div className="flex justify-between">
              <span>{t('common.subtotal')}</span>
              <span>{currencyFormatter.format(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('common.couponDiscount')}</span>
              <span>{couponDiscount ? `-${currencyFormatter.format(couponDiscount)}` : currencyFormatter.format(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('common.delivery')}</span>
              <span>{deliveryCharge === 0 ? t('common.free') : currencyFormatter.format(deliveryCharge)}</span>
            </div>
          </div>
          <div className="mt-6 border-t border-primary-100 pt-5">
            <div className="flex items-end justify-between">
              <span className="text-sm font-black uppercase tracking-[0.2em] text-primary-500">{t('common.total')}</span>
              <span className="text-3xl font-black text-primary-900">{currencyFormatter.format(total)}</span>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={isProcessing || !selectedStore}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-100"
          >
            {paymentMethod === 'razorpay' ? <CreditCard size={18} /> : <Wallet size={18} />}
            <span>
              {isProcessing
                ? t('checkoutPage.processing')
                : paymentMethod === 'razorpay'
                  ? t('checkoutPage.payWithRazorpay')
                  : t('checkoutPage.placeCodOrder')}
            </span>
          </button>

          <div className="mt-5 flex items-center gap-3 rounded-[1.5rem] bg-primary-50 px-4 py-4 text-sm font-medium text-primary-900/65">
            <ShieldCheck size={18} className="text-primary" />
            <p>{t('checkoutPage.securePaymentHint')}</p>
          </div>

          <Link to="/cart" className="mt-5 inline-flex text-sm font-black uppercase tracking-[0.2em] text-primary-500">
            {t('checkoutPage.backToCart')}
          </Link>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
