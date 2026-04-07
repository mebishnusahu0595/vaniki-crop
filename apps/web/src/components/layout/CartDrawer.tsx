import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../../store/useCartStore';
import { currencyFormatter } from '../../utils/format';
import OptimizedImage from '../common/OptimizedImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, removeItem, getSubtotal } = useCartStore();
  const subtotal = getSubtotal();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[300] bg-primary-900/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 z-[301] flex w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-primary-100 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary">
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-primary-900">{t('cartDrawer.cart')}</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-500">
                    {t('cartDrawer.lineItems', { count: items.length })}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-full p-2 transition hover:bg-primary-50">
                <X size={22} />
              </button>
            </div>

            <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto p-6">
              {items.length ? (
                items.map((item) => (
                  <div
                    key={`${item.productId}-${item.variantId}`}
                    className="surface-card flex items-center gap-4 rounded-[1.5rem] p-4 shadow-none"
                  >
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary-50">
                      {item.image ? (
                        <OptimizedImage
                          src={item.image}
                          alt={item.productName}
                          widthHint={120}
                          heightHint={120}
                          loading="lazy"
                          containerClassName="h-full w-full rounded-2xl"
                          className="h-full w-full rounded-2xl object-cover"
                        />
                      ) : (
                        <ShoppingBag size={20} className="text-primary-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-black text-primary-900">{item.productName}</h3>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">
                        {item.qty} x {item.variantLabel}
                      </p>
                      <p className="mt-2 text-sm font-black text-primary">
                        {currencyFormatter.format(item.qty * item.price)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId, item.variantId)}
                      className="rounded-xl p-2 text-red-500 transition hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-primary">
                    <ShoppingBag size={32} />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-primary-900">{t('cartDrawer.emptyTitle')}</h3>
                  <p className="mt-2 max-w-xs text-sm font-medium text-primary-900/55">
                    {t('cartDrawer.emptyDescription')}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-primary-100 bg-primary-50/40 p-6">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-500">{t('cartDrawer.estimatedTotal')}</p>
                  <p className="mt-1 text-3xl font-black text-primary-900">{currencyFormatter.format(subtotal)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    onClose();
                    navigate('/cart');
                  }}
                  className="rounded-2xl border border-primary-100 bg-white px-4 py-3 text-sm font-bold text-primary-900 transition hover:bg-primary-50"
                >
                    {t('cartDrawer.viewCart')}
                </button>
                <button
                  onClick={() => {
                    onClose();
                    navigate('/checkout');
                  }}
                  disabled={!items.length}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-100"
                >
                  <span>{t('cartDrawer.checkout')}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
