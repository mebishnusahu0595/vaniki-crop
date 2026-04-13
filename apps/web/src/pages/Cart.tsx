import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../store/useCartStore';
import { useStoreStore } from '../store/useStoreStore';
import { currencyFormatter } from '../utils/format';
import { storefrontApi } from '../utils/api';
import { resolveMediaUrl } from '../utils/media';
import OptimizedImage from '../components/common/OptimizedImage';

const Cart: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    items,
    couponCode,
    couponDiscount,
    removeItem,
    updateQty,
    clearCart,
    setCoupon,
    clearCoupon,
    getSubtotal,
  } = useCartStore();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const subtotal = getSubtotal();

  const [couponInput, setCouponInput] = useState(couponCode);
  const [couponMessage, setCouponMessage] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  useEffect(() => {
    setCouponInput(couponCode);
  }, [couponCode]);

  const deliveryCharge = subtotal > 1000 || subtotal === 0 ? 0 : 50;
  const total = subtotal - couponDiscount + deliveryCharge;

  const validateCoupon = async () => {
    if (!couponInput || !selectedStore) {
      toast.error(t('cartPage.chooseStoreCoupon'));
      return;
    }

    setIsValidatingCoupon(true);
    try {
      const response = await storefrontApi.validateCoupon({
        code: couponInput.toUpperCase(),
        storeId: selectedStore.id,
        cartTotal: subtotal,
      });
      setCoupon(couponInput.toUpperCase(), response.discount || 0);
      setCouponMessage(response.message);
      toast.success(response.message);
    } catch {
      clearCoupon();
      setCouponMessage(t('cartPage.couponCouldNotApply'));
      toast.error(t('cartPage.couponCouldNotApply'));
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  if (!items.length) {
    return (
      <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-12 sm:px-6">
        <div className="surface-card max-w-xl p-10 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary-50 text-primary">
            <ShoppingCart size={34} />
          </div>
          <h1 className="mt-6 text-3xl font-black text-primary-900">{t('cartPage.emptyTitle')}</h1>
          <p className="mt-3 text-sm font-medium leading-7 text-primary-900/60">
            {t('cartPage.emptyDescription')}
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white"
          >
            {t('cartPage.shopNow')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {items.map((item) => (
            <div key={`${item.productId}-${item.variantId}`} className="surface-card flex gap-4 p-4 sm:p-5">
              <Link
                to={item.productSlug ? `/product/${item.productSlug}` : '/products'}
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[1.5rem] bg-primary-50"
              >
                {item.image ? (
                  <OptimizedImage
                    src={resolveMediaUrl(item.image)}
                    alt={item.productName}
                    widthHint={160}
                    heightHint={160}
                    loading="lazy"
                    containerClassName="h-full w-full rounded-[1.5rem]"
                    className="h-full w-full rounded-[1.5rem] object-cover"
                  />
                ) : (
                  <ShoppingCart size={20} className="text-primary-400" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-primary-900">{item.productName}</h2>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-primary-500">{item.variantLabel}</p>
                <p className="mt-3 text-sm font-bold text-primary-900">{currencyFormatter.format(item.price)} {t('common.each')}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-full border border-primary-100 bg-white px-2 py-1">
                    <button onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)} className="px-3 py-2 font-black">
                      -
                    </button>
                    <span className="w-10 text-center text-lg font-black text-primary-900">{item.qty}</span>
                    <button onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)} className="px-3 py-2 font-black">
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId, item.variantId)}
                    className="inline-flex items-center gap-2 rounded-full border border-red-100 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-red-500"
                  >
                    <Trash2 size={14} />
                    {t('cartPage.remove')}
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-primary">{currencyFormatter.format(item.price * item.qty)}</p>
              </div>
            </div>
          ))}

          <button onClick={clearCart} className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">
            {t('cartPage.clearCart')}
          </button>
        </div>

        <aside className="surface-card h-fit p-6">
          <p className="section-kicker mb-2">{t('cartPage.orderSummary')}</p>
          <h2 className="text-2xl font-black text-primary-900">{t('cartPage.reviewTotals')}</h2>

          <div className="mt-6 space-y-3 text-sm font-semibold text-primary-900/65">
            <div className="flex items-center justify-between">
              <span>{t('common.subtotal')}</span>
              <span>{currencyFormatter.format(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('common.couponDiscount')}</span>
              <span>{couponDiscount ? `-${currencyFormatter.format(couponDiscount)}` : currencyFormatter.format(0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('checkoutPage.delivery')}</span>
              <span>{deliveryCharge === 0 ? t('common.free') : currencyFormatter.format(deliveryCharge)}</span>
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] bg-primary-50 p-4">
            <div className="flex items-center gap-3">
              <input
                value={couponInput}
                onChange={(event) => {
                  const value = event.target.value.toUpperCase();
                  setCouponInput(value);
                  if (value !== couponCode) {
                    clearCoupon();
                  }
                }}
                placeholder={t('cartPage.couponCode')}
                className="w-full rounded-xl border border-primary-100 bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] text-primary-900"
              />
              <button
                onClick={validateCoupon}
                disabled={isValidatingCoupon}
                className="rounded-xl bg-primary-900 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white"
              >
                {t('common.apply')}
              </button>
            </div>
            {couponMessage && <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-primary">{couponMessage}</p>}
          </div>

          <div className="mt-6 border-t border-primary-100 pt-5">
            <div className="flex items-end justify-between">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-primary-500">{t('common.total')}</p>
              <p className="text-3xl font-black text-primary-900">{currencyFormatter.format(total)}</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            className="mt-6 w-full rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white"
          >
            {t('cartPage.proceedToCheckout')}
          </button>
        </aside>
      </section>
    </div>
  );
};

export default Cart;
