import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { CreditCard, MapPin, Store as StoreIcon, ShieldCheck, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useStoreStore } from '../store/useStoreStore';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { storefrontApi } from '../utils/api';
import { currencyFormatter, formatStoreAddress } from '../utils/format';

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError(error)) return fallback;
  const payload = error.response?.data as { message?: string; error?: string } | undefined;
  return payload?.message || payload?.error || fallback;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

const Checkout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, couponCode, couponDiscount, getSubtotal, clearCart } = useCartStore();
  const { user, token } = useAuthStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const { mode, address, setMode, setAddress } = useServiceModeStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
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

  useEffect(() => {
    if (!items.length) navigate('/cart');
    if (!token) navigate('/login?redirect=/checkout');
  }, [items.length, navigate, token]);

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

  const handlePayment = async () => {
    if (!selectedStore) {
      toast.error(t('checkoutPage.chooseStoreFirst'));
      return;
    }

    if (mode === 'delivery' && (!formData.name || !formData.mobile || !formData.street || !formData.city || !formData.state || !formData.pincode)) {
      toast.error(t('checkoutPage.completeDeliveryAddress'));
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
        storeId: selectedStore.id,
        serviceMode: mode,
        couponCode: couponCode || undefined,
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
                    <p className="mt-1 text-sm font-medium text-primary-900/60">
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
                    <p className="mt-1 text-sm font-medium text-primary-900/60">
                      {selectedStore?.name || t('checkoutPage.selectStoreFromHeader')}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {mode === 'delivery' ? (
            <section className="surface-card p-6">
              <p className="section-kicker mb-2">{t('checkoutPage.deliveryAddress')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder={t('checkoutPage.fullName')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                />
                <input
                  value={formData.mobile}
                  onChange={(event) => setFormData((current) => ({ ...current, mobile: event.target.value }))}
                  placeholder={t('checkoutPage.mobileNumber')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                />
                <input
                  value={formData.street}
                  onChange={(event) => setFormData((current) => ({ ...current, street: event.target.value }))}
                  placeholder={t('checkoutPage.streetVillage')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 sm:col-span-2"
                />
                <input
                  value={formData.city}
                  onChange={(event) => setFormData((current) => ({ ...current, city: event.target.value }))}
                  placeholder={t('checkoutPage.city')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                />
                <input
                  value={formData.state}
                  onChange={(event) => setFormData((current) => ({ ...current, state: event.target.value }))}
                  placeholder={t('checkoutPage.state')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                />
                <input
                  value={formData.pincode}
                  onChange={(event) => setFormData((current) => ({ ...current, pincode: event.target.value }))}
                  placeholder={t('checkoutPage.pincode')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                />
              </div>
            </section>
          ) : (
            <section className="surface-card p-6">
              <p className="section-kicker mb-2">{t('checkoutPage.pickupStore')}</p>
              <h2 className="text-2xl font-black text-primary-900">{selectedStore?.name || t('checkoutPage.noStoreSelected')}</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-primary-900/60">
                {selectedStore ? formatStoreAddress(selectedStore.address) : t('checkoutPage.choosePickupHint')}
              </p>
            </section>
          )}

          <section className="surface-card p-6">
            <p className="section-kicker mb-2">{t('checkoutPage.orderSummary')}</p>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId}`} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-primary-900">{item.productName}</p>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary-500">
                      {item.qty} x {item.variantLabel}
                    </p>
                  </div>
                  <p className="text-sm font-black text-primary-900">{currencyFormatter.format(item.qty * item.price)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="surface-card h-fit p-6">
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
            disabled={isProcessing}
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
