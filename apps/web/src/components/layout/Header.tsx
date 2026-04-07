import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, MapPin, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCategories, useProductSearch } from '../../hooks/useProducts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
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
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [isCartBouncing, setIsCartBouncing] = useState(false);
  const [flyingCartItem, setFlyingCartItem] = useState<FlyingCartItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const debouncedSearch = useDebouncedValue(searchTerm.trim(), 280);
  const { data: categories = [] } = useCategories();
  const { data: searchData, isFetching: isSearchLoading } = useProductSearch(debouncedSearch, selectedStore?.id);

  const categorySuggestions = useMemo(() => {
    if (!debouncedSearch) return [];
    const term = debouncedSearch.toLowerCase();
    return categories
      .filter((category) => category.name.toLowerCase().includes(term) || category.slug.toLowerCase().includes(term))
      .slice(0, 3);
  }, [categories, debouncedSearch]);

  const productSuggestions = useMemo(() => searchData?.data.slice(0, 5) || [], [searchData?.data]);
  const hasSearchSuggestions = categorySuggestions.length > 0 || productSuggestions.length > 0;
  const shouldShowSearchDropdown = isSearchFocused && debouncedSearch.length > 0;

  const summaryText = selectedStore?.name || formatStoreAddress(address);
  const activeLanguage = i18n.resolvedLanguage?.startsWith('hi') ? 'hi' : 'en';
  const languageToggleLabel = activeLanguage === 'hi' ? 'En' : 'हिंदी';

  const buildProductsUrl = (query?: string, category?: string) => {
    const params = new URLSearchParams();
    const trimmedQuery = query?.trim();
    if (trimmedQuery) params.set('search', trimmedQuery);
    if (category) params.set('category', category);

    const suffix = params.toString();
    return suffix ? `/products?${suffix}` : '/products';
  };

  const submitSearch = () => {
    navigate(buildProductsUrl(searchTerm));
    setIsSearchFocused(false);
  };

  const focusMobileSearchInput = () => {
    setIsSearchFocused(true);
    mobileSearchInputRef.current?.focus();
  };

  const renderSearchDropdown = () => {
    if (!shouldShowSearchDropdown) return null;

    return (
      <div className="surface-card absolute left-0 right-0 top-[calc(100%+10px)] z-40 max-h-[430px] overflow-y-auto p-2">
        {isSearchLoading && (
          <p className="px-3 py-3 text-xs font-bold uppercase tracking-[0.18em] text-primary-500">{t('common.loading')}</p>
        )}

        {!isSearchLoading && !hasSearchSuggestions && (
          <p className="px-3 py-4 text-sm font-semibold text-primary-900/55">{t('productsPage.noMatchesTitle')}</p>
        )}

        {!isSearchLoading && categorySuggestions.length > 0 && (
          <div className="pb-2">
            <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">{t('nav.categories')}</p>
            {categorySuggestions.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  navigate(buildProductsUrl(searchTerm, category.slug));
                  setIsSearchFocused(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-primary-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {category.image?.url ? (
                    <img src={category.image.url} alt={category.name} className="h-11 w-11 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                      <Search size={16} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-primary-900">{category.name}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-primary-900/50">/{category.slug}</p>
                  </div>
                </div>
                <span className="rounded-full bg-primary-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary-700">
                  {t('productsPage.category')}
                </span>
              </button>
            ))}
          </div>
        )}

        {!isSearchLoading && productSuggestions.length > 0 && (
          <div className="pb-2">
            <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">{t('nav.shop')}</p>
            {productSuggestions.map((product) => {
              const primaryImage = product.images.find((image) => image.isPrimary)?.url || product.images[0]?.url;

              return (
                <button
                  key={product.id}
                  onClick={() => {
                    navigate(`/product/${product.slug}`);
                    setIsSearchFocused(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-primary-50"
                >
                  {primaryImage ? (
                    <img src={primaryImage} alt={product.name} className="h-11 w-11 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                      <Search size={16} />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-primary-900">{product.name}</p>
                    <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
                      {product.category?.name || t('productsPage.searchProduct')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={submitSearch}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-black text-primary-900 transition hover:border-primary-200"
        >
          <Search size={14} />
          <span>
            {t('nav.shop')} "{debouncedSearch}"
          </span>
        </button>
      </div>
    );
  };

  const handleLanguageToggle = () => {
    void i18n.changeLanguage(activeLanguage === 'hi' ? 'en' : 'hi');
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (desktopSearchRef.current?.contains(target) || mobileSearchRef.current?.contains(target)) {
        return;
      }
      setIsSearchFocused(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

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
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="group flex min-w-0 items-center">
          <div className="flex flex-col">
            <span className="font-heading text-[1.95rem] leading-[0.9] tracking-tight text-primary-900 sm:text-[2.1rem]">
              Vaniki Crop
            </span>
            <span className="mt-0.5 hidden text-[11px] font-semibold tracking-[0.08em] text-primary-500 lg:block">
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

          <div className="relative flex-1" ref={desktopSearchRef}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
              className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 transition focus-within:border-primary-200 focus-within:bg-white"
            >
              <Search size={18} className="text-primary-900/40" />
              <input
                value={searchTerm}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setIsSearchFocused(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setIsSearchFocused(false);
                }}
                placeholder={t('header.searchPlaceholder')}
                className="w-full bg-transparent text-sm font-semibold text-primary-900 placeholder:text-primary-900/45 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-primary-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-primary"
              >
                {t('nav.shop')}
              </button>
            </form>
            {renderSearchDropdown()}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleLanguageToggle}
            className="h-10 rounded-2xl border border-primary-100 px-3 text-xs font-black uppercase tracking-[0.18em] text-primary-900 transition hover:border-primary-200 hover:bg-primary-50"
          >
            {languageToggleLabel}
          </button>
          <button
            onClick={() => {
              if (searchTerm.trim()) {
                submitSearch();
                return;
              }
              focusMobileSearchInput();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-900 transition hover:bg-primary-100 lg:hidden"
          >
            <Search size={18} />
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
            className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-900 text-white shadow-lg shadow-primary-900/20 transition hover:-translate-y-0.5"
          >
            <ShoppingCart size={18} />
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
            className="flex h-10 items-center gap-2 rounded-2xl border border-primary-100 px-3.5 text-sm font-bold text-primary-900 transition hover:border-primary-200 hover:bg-primary-50"
          >
            <User size={18} className="text-primary" />
            <span className="hidden sm:inline">{isAuthenticated ? t('header.account') : t('header.login')}</span>
          </button>
        </div>

        <div className="relative w-full lg:hidden" ref={mobileSearchRef}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
            className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 transition focus-within:border-primary-200 focus-within:bg-white"
          >
            <Search size={18} className="text-primary-900/40" />
            <input
              ref={mobileSearchInputRef}
              value={searchTerm}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setIsSearchFocused(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setIsSearchFocused(false);
              }}
              placeholder={t('header.searchPlaceholder')}
              className="w-full bg-transparent text-sm font-semibold text-primary-900 placeholder:text-primary-900/45 focus:outline-none"
            />
            <button type="submit" className="text-primary-900" aria-label={t('nav.shop')}>
              <Search size={18} />
            </button>
          </form>
          {renderSearchDropdown()}
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
