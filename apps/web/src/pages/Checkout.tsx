import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Store } from '../types/storefront';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Store as StoreIcon,
  ShieldCheck,
  Wallet,
  Plus,
  Minus,
  Trash2,
  ChevronDown,
  Check,
  ArrowLeft,
  Truck,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useStoreStore } from '../store/useStoreStore';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { storefrontApi } from '../utils/api';
import { getApiErrorMessage } from '../utils/error';
import { currencyFormatter } from '../utils/format';
import { useSettingsStore } from '../store/useSettingsStore';
import { INDIAN_STATES, STATE_DISTRICTS } from '@vaniki/shared';
import { lookupPincode } from '../utils/pincode';

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
  const { items, couponCode, couponDiscount, getSubtotal, clearCart, updateQty, removeItem, setCouponCode } = useCartStore();
  const { user, token } = useAuthStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const setStore = useStoreStore((state) => state.setStore);
  const { mode, address, setMode, setAddress } = useServiceModeStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [activeStoreId, setActiveStoreId] = useState(selectedStore?.id || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [loyaltyPointsInput, setLoyaltyPointsInput] = useState(0);
  const [appliedLoyaltyPoints, setAppliedLoyaltyPoints] = useState(0);

  const hasPlacedOrderRef = useRef(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    mobile: user?.mobile || '',
    street: address?.street || user?.savedAddress?.street || '',
    city: address?.city || user?.savedAddress?.city || '',
    district: address?.district || user?.savedAddress?.district || '',
    state: address?.state || user?.savedAddress?.state || '',
    pincode: address?.pincode || user?.savedAddress?.pincode || '',
  });

  const subtotal = getSubtotal();
  const deliveryCharge = mode === 'delivery' ? (subtotal >= settings.freeDeliveryThreshold ? 0 : settings.standardDeliveryCharge) : 0;
  const loyaltyDiscount = appliedLoyaltyPoints * (settings.loyaltyPointRupeeValue || 1);
  const total = Math.max(0, subtotal - couponDiscount - loyaltyDiscount + deliveryCharge);

  const { data: storeAvailability = [], isLoading: isLoadingAvailability } = useQuery({
    queryKey: ['cart-availability', items],
    queryFn: () => storefrontApi.cartAvailability(items.map(i => ({ productId: i.productId, variantId: i.variantId, qty: i.qty }))),
    enabled: !!token && items.length > 0,
  });

  // Auto-assign default store if none selected
  useEffect(() => {
    if (!selectedStore && storeAvailability.length > 0) {
      setStore(storeAvailability[0] as Store);
      setActiveStoreId(storeAvailability[0].id);
    }
  }, [selectedStore, storeAvailability, setStore]);

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

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    const storeIdToUse = selectedStore?.id || storeAvailability[0]?.id;
    setIsApplyingCoupon(true);
    try {
      const result = await storefrontApi.validateCoupon({
        code: couponInput.trim(),
        storeId: storeIdToUse,
        cartTotal: subtotal,
      });
      if (result.valid) {
        setCouponCode(couponInput.trim(), result.discount || 0);
        toast.success(t('checkoutPage.couponApplied'));
      } else {
        toast.error(result.message || 'Invalid coupon code');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to apply coupon'));
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handlePayment = async () => {
    if (mode === 'pickup' && !selectedStore) {
      toast.error('Please choose a store for pickup');
      return;
    }

    if (mode === 'delivery' && (!formData.name || !formData.mobile || !formData.street || !formData.city || !formData.state || !formData.pincode)) {
      toast.error(t('checkoutPage.completeDeliveryAddress'));
      return;
    }

    const effectiveStoreId = selectedStore?.id || storeAvailability[0]?.id;

    try {
      const shippingAddress = mode === 'delivery' ? {
        name: formData.name,
        mobile: formData.mobile,
        street: formData.street,
        city: formData.city,
        district: formData.district,
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
        loyaltyPoints: appliedLoyaltyPoints,
        storeId: effectiveStoreId,
        shippingAddress,
      };

      if (shippingAddress) {
        setAddress({
          street: shippingAddress.street,
          city: shippingAddress.city,
          district: shippingAddress.district,
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
    <div className="min-h-screen bg-slate-50/60 pb-20 pt-8 sm:pb-32 font-sans">
      <div className="container mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[1fr_380px]">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Header */}
          <header className="flex items-center gap-3">
            <button
              onClick={() => navigate('/cart')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm border border-slate-200/80 transition hover:bg-slate-50"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Checkout</h1>
              <p className="text-xs text-slate-500 font-medium">Review your items and complete your order</p>
            </div>
          </header>

          {/* SERVICE MODE (DELIVERY vs STORE PICKUP) */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Service Mode</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleModeChange('delivery')}
                className={`rounded-2xl border p-4 text-left transition ${
                  mode === 'delivery'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2.5 ${mode === 'delivery' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Truck size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">Doorstep Delivery</p>
                      {mode === 'delivery' && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {address?.street || user?.savedAddress?.street
                        ? `${address?.street || user?.savedAddress?.street}, ${address?.city || user?.savedAddress?.city || ''}`
                        : 'Deliver to your home/farm address'}
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('pickup')}
                className={`rounded-2xl border p-4 text-left transition ${
                  mode === 'pickup'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2.5 ${mode === 'pickup' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <StoreIcon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">Store Pickup</p>
                      {mode === 'pickup' && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {selectedStore?.name || 'Pick up directly from nearest dealer'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* STORE SELECTION (ONLY SHOWN FOR STORE PICKUP) */}
          {mode === 'pickup' && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm animate-fade-in">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Choose Pickup Store</p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-100/60"
                >
                  <div className="flex items-center gap-3">
                    <StoreIcon size={18} className="text-emerald-700" />
                    <span className="font-semibold">
                      {selectedStore ? selectedStore.name : 'Select a dealer store for pickup'}
                    </span>
                  </div>
                  <ChevronDown className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} size={18} />
                </button>

                {isDropdownOpen && (
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-xl p-2 z-20">
                    <div className="max-h-[260px] overflow-y-auto space-y-1 p-1">
                      {isLoadingAvailability ? (
                        <div className="py-8 text-center text-xs text-slate-400 font-medium">Loading stores...</div>
                      ) : storeAvailability.length > 0 ? (
                        storeAvailability.map((store) => (
                          <button
                            key={store.id}
                            type="button"
                            onClick={() => {
                              handleStoreChange(store.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full rounded-xl p-3 text-left transition flex items-center justify-between ${
                              activeStoreId === store.id
                                ? 'bg-emerald-600 text-white'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div>
                              <p className="text-sm font-bold">{store.name}</p>
                              <p className={`text-xs ${activeStoreId === store.id ? 'text-emerald-100' : 'text-slate-500'}`}>
                                {store.address?.city}, {store.address?.state}
                              </p>
                            </div>
                            {activeStoreId === store.id && <Check size={16} />}
                          </button>
                        ))
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400">No stores available</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* DELIVERY ADDRESS FORM (SHOWN FOR DELIVERY) */}
          {mode === 'delivery' && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery Address</p>
                <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-full">
                  🚚 Free Delivery over ₹{settings.freeDeliveryThreshold || 2000}
                </span>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <input
                  value={formData.name}
                  onChange={(e) => setFormData((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Full Name *"
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-600 focus:bg-white transition"
                />
                <input
                  value={formData.mobile}
                  onChange={(e) => setFormData((c) => ({ ...c, mobile: e.target.value }))}
                  placeholder="Mobile Number *"
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-600 focus:bg-white transition"
                />
                <input
                  value={formData.street}
                  onChange={(e) => setFormData((c) => ({ ...c, street: e.target.value }))}
                  placeholder="House No, Street, Village / Area *"
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-600 focus:bg-white transition sm:col-span-2"
                />
                <input
                  value={formData.city}
                  onChange={(e) => setFormData((c) => ({ ...c, city: e.target.value }))}
                  placeholder="City / Town *"
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-600 focus:bg-white transition"
                />
                <input
                  value={formData.pincode}
                  onChange={async (e) => {
                    const pincode = e.target.value.replace(/\D/g, '');
                    setFormData((c) => ({ ...c, pincode }));
                    if (pincode.length === 6) {
                      const result = await lookupPincode(pincode);
                      if (result) {
                        setFormData((c) => ({
                          ...c,
                          state: result.state,
                          district: result.district,
                          city: result.block || result.district,
                        }));
                      }
                    }
                  }}
                  placeholder="6-digit Pincode *"
                  maxLength={6}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-600 focus:bg-white transition"
                />
                <select
                  value={formData.state}
                  onChange={(e) => setFormData((c) => ({ ...c, state: e.target.value, district: '' }))}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-600 focus:bg-white transition"
                >
                  <option value="">Select State *</option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>

                <div className="sm:col-span-1">
                  {STATE_DISTRICTS[formData.state] ? (
                    <select
                      value={formData.district}
                      onChange={(e) => setFormData((c) => ({ ...c, district: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-600 focus:bg-white transition"
                    >
                      <option value="">Select District</option>
                      {STATE_DISTRICTS[formData.state].map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={formData.district}
                      onChange={(e) => setFormData((c) => ({ ...c, district: e.target.value }))}
                      placeholder="District"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-600 focus:bg-white transition"
                    />
                  )}
                </div>
              </div>
            </section>
          )}

          {/* OFFERS & REWARDS */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Offers & Rewards</p>
            <div className="space-y-3.5">
              {/* Coupon Section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={15} className="text-emerald-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Apply Promo Coupon</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code (e.g. MONSOON20)"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold uppercase text-slate-900 outline-none focus:border-emerald-600"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={isApplyingCoupon || !couponInput}
                    className="rounded-xl bg-emerald-800 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-emerald-900 disabled:opacity-50"
                  >
                    {isApplyingCoupon ? 'Checking...' : 'Apply'}
                  </button>
                </div>
                {couponCode && (
                  <div className="mt-2.5 flex items-center justify-between rounded-lg bg-emerald-100/70 px-3 py-1.5 text-emerald-800">
                    <span className="text-xs font-semibold">✓ Applied: {couponCode} (-{currencyFormatter.format(couponDiscount)})</span>
                    <button onClick={() => setCouponCode('', 0)} className="text-[11px] font-bold text-rose-700 hover:underline">
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Loyalty Points Section */}
              {user && (user.loyaltyPoints || 0) > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-700" />
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                        {user.loyaltyPoints} Loyalty Coins Available
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      max={user.loyaltyPoints}
                      value={loyaltyPointsInput || ''}
                      onChange={(e) => setLoyaltyPointsInput(Math.min(user.loyaltyPoints || 0, parseInt(e.target.value) || 0))}
                      placeholder="Coins to redeem"
                      className="flex-1 rounded-xl border border-amber-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 outline-none"
                    />
                    <button
                      onClick={() => {
                        const minPoints = settings.minLoyaltyPointsToRedeem || 0;
                        if ((user.loyaltyPoints || 0) < minPoints) {
                          toast.error(`You need at least ${minPoints} loyalty points to redeem them.`);
                          return;
                        }
                        if (loyaltyPointsInput > 0 && loyaltyPointsInput < minPoints) {
                          toast.error(`You must redeem at least ${minPoints} points.`);
                          return;
                        }
                        setAppliedLoyaltyPoints(loyaltyPointsInput);
                      }}
                      className="rounded-xl bg-amber-700 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-amber-800"
                    >
                      Redeem
                    </button>
                  </div>
                  {appliedLoyaltyPoints > 0 && (
                    <div className="mt-2.5 flex items-center justify-between rounded-lg bg-amber-100 px-3 py-1.5 text-amber-900">
                      <span className="text-xs font-semibold">Using {appliedLoyaltyPoints} coins (-{currencyFormatter.format(loyaltyDiscount)})</span>
                      <button onClick={() => { setAppliedLoyaltyPoints(0); setLoyaltyPointsInput(0); }} className="text-[11px] font-bold text-rose-700 hover:underline">
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ORDER ITEMS SUMMARY */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Cart Items ({items.length})</p>
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId}`} className="py-3.5 first:pt-0 last:pb-0 flex items-center gap-4">
                  <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1">
                    {item.image ? (
                      <img src={item.image} alt={item.productName} className="h-full w-full object-contain" />
                    ) : (
                      <StoreIcon size={20} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900 truncate">{item.productName}</p>
                        <p className="text-xs font-medium text-slate-500">{item.variantLabel}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {currencyFormatter.format(item.qty * item.price)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                        <button
                          type="button"
                          onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)}
                          className="flex h-5 w-5 items-center justify-center rounded bg-white text-slate-700 shadow-xs hover:bg-slate-100"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="min-w-[18px] text-center text-xs font-bold text-slate-900">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)}
                          className="flex h-5 w-5 items-center justify-center rounded bg-emerald-700 text-white shadow-xs hover:bg-emerald-800"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="text-slate-400 hover:text-rose-600 transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (PAYMENT SUMMARY) */}
        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sticky top-8">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Payment Method</p>
            <h2 className="text-xl font-bold text-slate-900">Choose payment option</h2>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('razorpay')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${
                  paymentMethod === 'razorpay'
                    ? 'border-emerald-700 bg-emerald-800 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard size={15} />
                <span>Razorpay / UPI</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${
                  paymentMethod === 'cod'
                    ? 'border-emerald-700 bg-emerald-800 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Wallet size={15} />
                <span>Cash on Delivery</span>
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500 font-medium">
              {paymentMethod === 'razorpay'
                ? 'Pay securely via UPI, Cards, NetBanking, or Wallets.'
                : 'Pay with cash upon delivery of items at your doorstep.'}
            </p>

            {/* Price Breakdown */}
            <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-4 text-xs font-medium text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">{currencyFormatter.format(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Coupon Discount</span>
                  <span>-{currencyFormatter.format(couponDiscount)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Loyalty Coins Discount</span>
                  <span>-{currencyFormatter.format(loyaltyDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery Charges</span>
                <span className="font-semibold text-slate-900">
                  {deliveryCharge === 0 ? <span className="text-emerald-700">Free</span> : currencyFormatter.format(deliveryCharge)}
                </span>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Amount</span>
                <span className="text-2xl font-black text-slate-900">{currencyFormatter.format(total)}</span>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paymentMethod === 'razorpay' ? <CreditCard size={17} /> : <Wallet size={17} />}
              <span>
                {isProcessing
                  ? 'Processing Order...'
                  : paymentMethod === 'razorpay'
                  ? `Pay ${currencyFormatter.format(total)}`
                  : 'Place COD Order'}
              </span>
            </button>

            <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 font-medium border border-slate-100">
              <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
              <p>100% Secure Checkout & Verified Delivery</p>
            </div>

            <div className="mt-4 text-center">
              <Link to="/cart" className="text-xs font-bold text-slate-500 hover:text-slate-800 transition">
                ← Back to Cart
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
