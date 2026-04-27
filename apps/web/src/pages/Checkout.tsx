import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Store } from '../types/storefront';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, MapPin, Store as StoreIcon, ShieldCheck, Wallet, Plus, Minus, Trash2, ChevronDown, Check, ArrowLeft } from 'lucide-react';
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

const Checkout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettingsStore();
  const { items, couponCode, couponDiscount, getSubtotal, clearCart, updateQty, removeItem } = useCartStore();
  const { user, token } = useAuthStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const setStore = useStoreStore((state) => state.setStore);
  const { mode, address, setMode, setAddress } = useServiceModeStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [activeStoreId, setActiveStoreId] = useState(selectedStore?.id || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
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
  const deliveryCharge = mode === 'delivery' ? (subtotal >= settings.freeDeliveryThreshold ? 0 : settings.standardDeliveryCharge) : 0;
  const total = subtotal - couponDiscount + deliveryCharge;

  const { data: storeAvailability = [], isLoading: isLoadingAvailability } = useQuery({
    queryKey: ['cart-availability', items],
    queryFn: () => storefrontApi.cartAvailability(items.map(i => ({ productId: i.productId, variantId: i.variantId, qty: i.qty }))),
    enabled: !!token && items.length > 0,
  });

  useEffect(() => {
    if (!items.length && !hasPlacedOrderRef.current) {
      navigate('/cart');
    }
    if (!token) navigate('/login?redirect=/checkout');
  }, [items.length, navigate, token]);

  useEffect(() => {
    if (selectedStore?.id) {
      setActiveStoreId(selectedStore.id);
    }
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
      toast.error(getApiErrorMessage(error, t('checkoutPage.couldNotUpdateServiceMode')));
    }
  };

  const handleStoreChange = async (nextStoreId: string) => {
    if (nextStoreId === activeStoreId) return;

    if (!nextStoreId) {
      setStore(null);
      setActiveStoreId('');
      return;
    }

    const availability = (storeAvailability as any[]).find(s => s.id === nextStoreId);
    if (availability && !availability.isFullyAvailable) {
      toast.error(t('checkoutPage.storeUnavailableItems', 'Some items are not available in the selected store'));
      return;
    }

    try {
      await storefrontApi.selectStore(nextStoreId);
      const matchedStore = (storeAvailability as any[]).find((s: any) => s.id === nextStoreId) || null;
      if (matchedStore) {
        setStore(matchedStore as Store);
        setActiveStoreId(nextStoreId);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('checkoutPage.chooseStoreFirst')));
    }
  };

  const handlePayment = async () => {
    if (!selectedStore) {
      toast.error(t('checkoutPage.chooseStoreFirst'));
      return;
    }

    const availability = storeAvailability.find(s => s.id === selectedStore.id);
    if (!availability || !availability.isFullyAvailable) {
      toast.error(t('checkoutPage.someItemsUnavailable', 'Some items are unavailable in the selected store'));
      return;
    }

    if (mode === 'delivery' && (!formData.name || !formData.mobile || !formData.street || !formData.city || !formData.state || !formData.pincode)) {
      toast.error(t('checkoutPage.completeDeliveryAddress'));
      return;
    }

    try {
      const shippingAddress = mode === 'delivery' ? {
              name: formData.name,
              mobile: formData.mobile,
              street: formData.street,
              city: formData.city,
              state: formData.state,
              pincode: formData.pincode,
            } : undefined;

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
        setAddress({ street: shippingAddress.street, city: shippingAddress.city, state: shippingAddress.state, pincode: shippingAddress.pincode });
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
        setIsProcessing(false);
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
        theme: { color: '#2D6A4F' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const confirmed = await storefrontApi.confirmOrder({
              ...orderPayload,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            hasPlacedOrderRef.current = true;
            clearCart();
            toast.success(t('checkoutPage.paymentSuccess'));
            navigate(`/order-success/${confirmed.orderId}`);
          } catch (error) {
            toast.error(getApiErrorMessage(error, t('checkoutPage.paymentConfirmationFailed')));
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => setIsProcessing(false),
        },
      });

      paymentObject.open();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('checkoutPage.orderInitiationFailed')));
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-50/30 pb-20 pt-8 sm:pb-32">
      <div className="container mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <header className="flex items-center gap-4">
            <button onClick={() => navigate('/cart')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary-900 shadow-sm transition hover:bg-primary-50">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-3xl font-black text-primary-900">{t('checkoutPage.checkout')}</h1>
          </header>

          <section className="surface-card p-6">
            <p className="section-kicker mb-2">{t('checkoutPage.serviceMode')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
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
                      {selectedStore?.name || t('checkoutPage.chooseFulfillmentStore')}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          <section className="surface-card p-6">
            <p className="section-kicker mb-2">{t('checkoutPage.selectStore', 'Fulfillment Store')}</p>
            <div className="relative space-y-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex w-full items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-5 py-4 font-black text-primary-900 shadow-sm transition hover:bg-primary-100/50"
                >
                  <div className="flex items-center gap-3">
                    <StoreIcon size={20} className="text-primary" />
                    <span>
                      {selectedStore ? selectedStore.name : t('storeSelector.chooseStore', 'Choose a store for fulfillment')}
                    </span>
                  </div>
                  <ChevronDown className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} size={20} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-full animate-in fade-in slide-in-from-top-2 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-primary-900/5 overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      {isLoadingAvailability ? (
                        <div className="p-8 text-center text-primary-900/40">
                          <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <p className="text-xs font-black uppercase tracking-widest">{t('common.loading')}</p>
                        </div>
                      ) : storeAvailability.length > 0 ? (
                        storeAvailability.map((store) => (
                          <button
                            key={store.id}
                            disabled={!store.isFullyAvailable}
                            onClick={() => {
                              handleStoreChange(store.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`flex w-full flex-col gap-1 rounded-xl p-4 text-left transition ${
                              !store.isFullyAvailable 
                                ? 'opacity-40 grayscale cursor-not-allowed' 
                                : activeStoreId === store.id 
                                  ? 'bg-primary text-white' 
                                  : 'hover:bg-primary-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black">{store.name}</span>
                              {!store.isFullyAvailable && (
                                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-500">
                                  {t('checkoutPage.noStock', 'No Stock')}
                                </span>
                              )}
                              {store.isFullyAvailable && activeStoreId === store.id && (
                                <Check size={16} />
                              )}
                            </div>
                            <span className={`text-[11px] font-medium ${activeStoreId === store.id ? 'text-white/70' : 'text-primary-900/50'}`}>
                              {store.address.city}, {store.address.state}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-8 text-center text-primary-900/40 italic">
                          {t('checkoutPage.noStoresAvailable', 'No stores available in your area')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {selectedStore && (
                <div className="flex items-start gap-4 rounded-2xl bg-primary-50/50 p-5 border border-primary-100/50">
                  <MapPin className="text-primary mt-1 shrink-0" size={18} />
                  <div className="flex-1">
                    <h3 className="text-base font-black text-primary-900">{selectedStore.name}</h3>
                    <p className="mt-1 text-sm font-medium text-primary-900/60 leading-relaxed">
                      {formatStoreAddress(selectedStore.address)}
                    </p>
                    {selectedStore.phone && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="rounded-full bg-primary/10 p-1">
                          <StoreIcon size={12} className="text-primary" />
                        </div>
                        <p className="text-xs font-black text-primary">{selectedStore.phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {mode === 'delivery' && (
            <section className="surface-card p-6">
              <p className="section-kicker mb-2">{t('checkoutPage.deliveryAddress')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <input value={formData.name} onChange={(e) => setFormData(c => ({...c, name: e.target.value}))} placeholder={t('checkoutPage.fullName')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40" />
                <input value={formData.mobile} onChange={(e) => setFormData(c => ({...c, mobile: e.target.value}))} placeholder={t('checkoutPage.mobileNumber')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40" />
                <input value={formData.street} onChange={(e) => setFormData(c => ({...c, street: e.target.value}))} placeholder={t('checkoutPage.streetVillage')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40 sm:col-span-2" />
                <input value={formData.city} onChange={(e) => setFormData(c => ({...c, city: e.target.value}))} placeholder={t('checkoutPage.city')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40" />
                <input value={formData.state} onChange={(e) => setFormData(c => ({...c, state: e.target.value}))} placeholder={t('checkoutPage.state')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40" />
                <input value={formData.pincode} onChange={(e) => setFormData(c => ({...c, pincode: e.target.value}))} placeholder={t('checkoutPage.pincode')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900 placeholder:text-primary-900/40" />
              </div>
            </section>
          )}

          <section className="surface-card p-6">
            <p className="section-kicker mb-2">{t('checkoutPage.orderSummary')}</p>
            <div className="space-y-5">
              {items.map((item) => (
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
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary-500">{item.variantLabel}</p>
                        </div>
                        <p className="text-sm font-black text-primary-900">{currencyFormatter.format(item.qty * item.price)}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 rounded-full bg-primary-50 p-1 border border-primary-100/30">
                          <button type="button" onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-primary-900 shadow-sm transition hover:bg-primary-100"><Minus size={12} /></button>
                          <span className="min-w-[20px] text-center text-xs font-black text-primary-900">{item.qty}</span>
                          <button type="button" onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-sm transition hover:bg-primary-600"><Plus size={12} /></button>
                        </div>
                        <button type="button" onClick={() => removeItem(item.productId, item.variantId)} className="text-primary-300 transition hover:text-rose-500"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="surface-card h-fit p-6 sticky top-8">
          <p className="section-kicker mb-2">{t('checkoutPage.payment')}</p>
          <h2 className="text-2xl font-black text-primary-900">{t('checkoutPage.choosePaymentMethod')}</h2>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPaymentMethod('razorpay')} className={`flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.15em] transition ${paymentMethod === 'razorpay' ? 'border-primary bg-primary text-white' : 'border-primary-100 bg-white text-primary-900'}`}><CreditCard size={16} /> <span>Razorpay</span></button>
            <button type="button" onClick={() => setPaymentMethod('cod')} className={`flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.15em] transition ${paymentMethod === 'cod' ? 'border-primary bg-primary text-white' : 'border-primary-100 bg-white text-primary-900'}`}><Wallet size={16} /> <span>{t('checkoutPage.cashOnDelivery')}</span></button>
          </div>

          <p className="mt-4 text-sm font-medium text-primary-900/65">{paymentMethod === 'razorpay' ? t('checkoutPage.payNowSecurely') : t('checkoutPage.payCashLater')}</p>

          <div className="mt-6 space-y-3 text-sm font-semibold text-primary-900/65">
            <div className="flex justify-between"><span>{t('common.subtotal')}</span><span>{currencyFormatter.format(subtotal)}</span></div>
            <div className="flex justify-between"><span>{t('common.couponDiscount')}</span><span>{couponDiscount ? `-${currencyFormatter.format(couponDiscount)}` : currencyFormatter.format(0)}</span></div>
            <div className="flex justify-between"><span>{t('common.delivery')}</span><span>{deliveryCharge === 0 ? t('common.free') : currencyFormatter.format(deliveryCharge)}</span></div>
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
            <span>{isProcessing ? t('checkoutPage.processing') : paymentMethod === 'razorpay' ? t('checkoutPage.payWithRazorpay') : t('checkoutPage.placeCodOrder')}</span>
          </button>

          <div className="mt-5 flex items-center gap-3 rounded-[1.5rem] bg-primary-50 px-4 py-4 text-sm font-medium text-primary-900/65">
            <ShieldCheck size={18} className="text-primary" />
            <p>{t('checkoutPage.securePaymentHint')}</p>
          </div>

          <Link to="/cart" className="mt-5 inline-flex text-sm font-black uppercase tracking-[0.2em] text-primary-500">{t('checkoutPage.backToCart')}</Link>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
