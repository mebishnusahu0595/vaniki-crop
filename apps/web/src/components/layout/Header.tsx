import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, MapPin, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useStoreStore } from '../../store/useStoreStore';
import { useServiceModeStore } from '../../store/useServiceModeStore';
import type { ServiceMode } from '../../types/storefront';
import { formatStoreAddress } from '../../utils/format';
import { cn } from '../../utils/cn';
import { onCartFlyAnimation, type CartFlyRect } from '../../utils/cartAnimation';

interface HeaderProps {
  onOpenCart: () => void;
  onOpenStoreSelector: (mode?: ServiceMode) => void;
}

const desktopLinks = [
  { labelKey: 'nav.home', href: '/' },
  { labelKey: 'nav.shop', href: '/products' },
  { labelKey: 'nav.categories', href: '/categories' },
  { labelKey: 'nav.compare', href: '/compare' },
  { labelKey: 'nav.about', href: '/about' },
  { labelKey: 'nav.contact', href: '/contact' },
];

interface FlyingCartItem {
  id: number;
  imageUrl?: string;
  startRect: CartFlyRect;
  endRect: CartFlyRect;
}

const Header: React.FC<HeaderProps> = ({ onOpenCart, onOpenStoreSelector }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const totalItems = useCartStore((state) => state.getTotalItems());
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { selectedStore } = useStoreStore();
  const { mode, address } = useServiceModeStore();
  const cartButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isCartBouncing, setIsCartBouncing] = useState(false);
  const [flyingCartItem, setFlyingCartItem] = useState<FlyingCartItem | null>(null);

  const summaryText = selectedStore?.name || formatStoreAddress(address);
  const activeLanguage = i18n.resolvedLanguage?.startsWith('hi') ? 'hi' : 'en';
  const languageToggleLabel = activeLanguage === 'hi' ? 'English' : 'हिंदी';

  const handleLanguageToggle = () => {
    void i18n.changeLanguage(activeLanguage === 'hi' ? 'en' : 'hi');
  };

  useEffect(() => {
    return onCartFlyAnimation(({ startRect, imageUrl }) => {
      const cartButton = cartButtonRef.current;
      if (!cartButton) return;

      const targetRect = cartButton.getBoundingClientRect();
      const endSize = 26;

      setFlyingCartItem({
        id: Date.now(),
        imageUrl,
        startRect,
        endRect: {
          x: targetRect.left + targetRect.width / 2 - endSize / 2,
          y: targetRect.top + targetRect.height / 2 - endSize / 2,
          width: endSize,
          height: endSize,
        },
      });
      setIsCartBouncing(true);
    });
  }, []);

  useEffect(() => {
    if (!isCartBouncing) return undefined;

    const timer = window.setTimeout(() => {
      setIsCartBouncing(false);
    }, 420);

    return () => window.clearTimeout(timer);
  }, [isCartBouncing]);

  return (
    <header className="border-b border-primary-100 bg-white/95 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="group flex items-center space-x-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-900 text-lg font-black text-white shadow-lg shadow-primary-900/20 transition-transform group-hover:-rotate-6">
            V
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-2xl leading-none text-primary-900">Vaniki Crop</span>
            <span className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-primary-500">
              {t('header.brandTagline')}
            </span>
          </div>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center gap-4 px-6 lg:flex">
          <div className="rounded-full border border-primary-100 bg-primary-50 p-1">
            <div className="flex items-center gap-1">
              {(['delivery', 'pickup'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => onOpenStoreSelector(option)}
                  className={cn(
                    'rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition',
                    mode === option ? 'bg-primary text-white' : 'text-primary-900/55 hover:text-primary-900',
                  )}
                >
                  {option === 'delivery' ? t('header.delivery') : t('header.pickup')}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onOpenStoreSelector(mode)}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-primary-100 bg-white px-4 py-2.5 transition hover:border-primary-200 hover:bg-primary-50"
          >
            <MapPin size={18} className="shrink-0 text-primary" />
            <div className="min-w-0 text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary-500">
                {mode === 'delivery' ? t('header.deliveringTo') : t('header.pickupFrom')}
              </p>
              <p className="truncate text-sm font-bold text-primary-900">{summaryText}</p>
            </div>
            <ChevronDown size={16} className="shrink-0 text-primary-900/40" />
          </button>

          <button
            onClick={() => navigate('/products')}
            className="flex flex-1 items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-left transition hover:border-primary-200 hover:bg-white"
          >
            <Search size={18} className="text-primary-900/40" />
            <span className="text-sm font-semibold text-primary-900/50">
              {t('header.searchPlaceholder')}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleLanguageToggle}
            className="h-11 rounded-2xl border border-primary-100 px-3 text-xs font-black uppercase tracking-[0.18em] text-primary-900 transition hover:border-primary-200 hover:bg-primary-50"
          >
            {languageToggleLabel}
          </button>
          <button
            onClick={() => navigate('/products')}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-900 transition hover:bg-primary-100 lg:hidden"
          >
            <Search size={20} />
          </button>
          <motion.button
            onClick={onOpenCart}
            ref={cartButtonRef}
            animate={
              isCartBouncing
                ? { scale: [1, 1.18, 1], rotate: [0, -10, 8, 0] }
                : { scale: 1, rotate: 0 }
            }
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-900 text-white shadow-lg shadow-primary-900/20 transition hover:-translate-y-0.5"
          >
            <ShoppingCart size={20} />
            <AnimatePresence initial={false} mode="popLayout">
              {totalItems > 0 && (
                <motion.span
                  key={totalItems}
                  initial={{ y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[10px] font-black text-white"
                >
                  {totalItems}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          <button
            onClick={() => navigate(isAuthenticated ? '/account' : '/login')}
            className="flex h-11 items-center gap-2 rounded-2xl border border-primary-100 px-4 text-sm font-bold text-primary-900 transition hover:border-primary-200 hover:bg-primary-50"
          >
            <User size={18} className="text-primary" />
            <span className="hidden sm:inline">{isAuthenticated ? t('header.account') : t('header.login')}</span>
          </button>
        </div>
      </div>

      <div className="hidden border-t border-primary-100 bg-white lg:block">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-8 py-3">
            {desktopLinks.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'text-xs font-black uppercase tracking-[0.22em] text-primary-900/55 transition hover:text-primary',
                    isActive && 'text-primary',
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <AnimatePresence>
        {flyingCartItem && (
          <motion.div
            key={flyingCartItem.id}
            initial={{
              x: flyingCartItem.startRect.x,
              y: flyingCartItem.startRect.y,
              width: flyingCartItem.startRect.width,
              height: flyingCartItem.startRect.height,
              opacity: 0.96,
              scale: 1,
              rotate: 0,
            }}
            animate={{
              x: flyingCartItem.endRect.x,
              y: flyingCartItem.endRect.y,
              width: flyingCartItem.endRect.width,
              height: flyingCartItem.endRect.height,
              opacity: 0.12,
              scale: 0.3,
              rotate: 24,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => setFlyingCartItem(null)}
            style={{
              position: 'fixed',
              zIndex: 450,
              pointerEvents: 'none',
            }}
            className="overflow-hidden rounded-xl border border-white/90 bg-primary-50/95 shadow-[0_16px_40px_rgba(8,32,24,0.2)]"
          >
            {flyingCartItem.imageUrl ? (
              <img src={flyingCartItem.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary">
                <ShoppingCart size={16} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
