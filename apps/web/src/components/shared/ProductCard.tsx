import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Minus, Plus, Scale, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Product } from '../../types/storefront';
import { formatPrice, getDiscountPercent } from '../../utils/format';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCompareStore } from '../../store/useCompareStore';
import { storefrontApi } from '../../utils/api';
import { emitCartFlyAnimation } from '../../utils/cartAnimation';
import { resolveMediaUrl } from '../../utils/media';
import { cn } from '../../utils/cn';
import OptimizedImage from '../common/OptimizedImage';

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

gsap.registerPlugin(ScrollTrigger);

let productCardBatchTriggers: ScrollTrigger[] = [];
let productCardBatchTimeout: number | null = null;

const scheduleProductCardBatch = () => {
  if (typeof window === 'undefined') return;

  if (productCardBatchTimeout) {
    window.clearTimeout(productCardBatchTimeout);
  }

  productCardBatchTimeout = window.setTimeout(() => {
    productCardBatchTriggers.forEach((trigger) => trigger.kill());
    productCardBatchTriggers = ScrollTrigger.batch('.product-card', {
      start: 'top 85%',
      once: true,
      onEnter: (elements) => {
        gsap.from(elements, {
          y: 40,
          opacity: 0,
          stagger: 0.15,
          duration: 0.8,
          ease: 'power3.out',
        });
      },
    });
    ScrollTrigger.refresh();
  }, 50);
};

const ProductCard: React.FC<ProductCardProps> = ({ product, compact = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const updateUser = useAuthStore((state) => state.updateUser);
  const comparedProducts = useCompareStore((state) => state.products);
  const toggleCompareProduct = useCompareStore((state) => state.toggleProduct);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);

  const wishlistIds = (user?.wishlist || []).map((entry) => (typeof entry === 'string' ? entry : entry.id));
  const isWishlisted = wishlistIds.includes(product.id);
  const isCompared = comparedProducts.some((entry) => entry.id === product.id);

  useEffect(() => {
    scheduleProductCardBatch();

    return () => {
      scheduleProductCardBatch();
    };
  }, []);

  const variant = product.variants[activeVariantIndex] || product.variants[0];
  const image = resolveMediaUrl(product.images[0]?.url, product.images[0]?.publicId);
  const discountPercent = getDiscountPercent(variant?.mrp || 0, variant?.price || 0);
  const { mrpText, priceText } = formatPrice(variant?.mrp || 0, variant?.price || 0);
  const cartItem = variant
    ? cartItems.find((item) => item.productId === product.id && item.variantId === variant.id)
    : undefined;
  const inCartQty = cartItem?.qty || 0;

  const handleAddToCart = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!variant) return;

    const sourceElement = imageRef.current ?? (event.currentTarget as HTMLElement);
    const sourceRect = sourceElement.getBoundingClientRect();

    emitCartFlyAnimation({
      startRect: {
        x: sourceRect.left,
        y: sourceRect.top,
        width: sourceRect.width,
        height: sourceRect.height,
      },
      imageUrl: image,
    });

    addItem({
      productId: product.id,
      productSlug: product.slug,
      variantId: variant.id,
      productName: product.name,
      variantLabel: variant.label,
      price: variant.price,
      mrp: variant.mrp,
      qty: 1,
      image,
    });

    toast.success(t('productCard.addedToCart', { name: product.name }));
  };

  const handleToggleWishlist = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      toast(t('productCard.loginWishlist'));
      navigate('/login?redirect=/products');
      return;
    }

    try {
      const updatedUser = await storefrontApi.toggleWishlist(product.id);
      updateUser(updatedUser);
      toast.success(isWishlisted ? t('productCard.removedFromWishlist') : t('productCard.addedToWishlist'));
    } catch {
      toast.error(t('productCard.wishlistFailed'));
    }
  };

  const handleToggleCompare = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const result = toggleCompareProduct(product);
    if (result.message.includes('up to 3')) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
  };

  if (!variant) return null;

  return (
    <motion.div
      whileHover={{ y: -6 }}
      className={cn(
        'product-card surface-card group flex h-full flex-col overflow-hidden',
        compact ? 'rounded-[1.5rem]' : 'rounded-[2rem]',
      )}
    >
      <Link to={`/product/${product.slug}`} className="relative block">
        <div
          className={cn(
            'relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(82,183,136,0.18),_transparent_28%),linear-gradient(180deg,_rgba(240,250,245,0.8),_rgba(255,255,255,0.98))]',
            compact ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5',
          )}
        >
          <div
            className={cn(
              'relative mx-auto aspect-square w-full overflow-hidden bg-white ring-1 ring-primary-100',
              compact ? 'rounded-[1.05rem]' : 'rounded-[1.35rem]',
            )}
          >
            {discountPercent > 0 && (
              <span className="absolute left-2.5 top-2.5 z-20 inline-flex max-w-[46%] items-center rounded-full bg-[#ff6b6b] px-2.5 py-1 text-[10px] font-black uppercase leading-none tracking-[0.14em] text-white shadow-sm">
                {discountPercent}% Off
              </span>
            )}
            {product.category?.name && (
              <span className="absolute right-2.5 top-2.5 z-20 max-w-[46%] truncate rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase leading-none tracking-[0.14em] text-primary-500 shadow-sm">
                {product.category.name}
              </span>
            )}
            <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleWishlist}
                className={`rounded-full border px-2.5 py-2 transition ${
                  isWishlisted
                    ? 'border-red-200 bg-red-50 text-red-500'
                    : 'border-white/85 bg-white/90 text-primary-900 hover:bg-white'
                }`}
                aria-label={isWishlisted ? t('productCard.removeFromWishlist') : t('productCard.addToWishlist')}
              >
                <Heart size={14} fill={isWishlisted ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={handleToggleCompare}
                className={`rounded-full border px-2.5 py-2 transition ${
                  isCompared
                    ? 'border-primary bg-primary text-white'
                    : 'border-white/85 bg-white/90 text-primary-900 hover:bg-white'
                }`}
                aria-label={isCompared ? t('productCard.removeFromCompare') : t('productCard.addToCompare')}
              >
                <Scale size={14} />
              </button>
            </div>
            <div className="flex h-full items-center justify-center">
              {image ? (
                <OptimizedImage
                  ref={imageRef}
                  src={image}
                  alt={product.name}
                  widthHint={560}
                  heightHint={560}
                  loading="lazy"
                  containerClassName="h-full w-full"
                  className="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary-50 text-primary-400">
                  <Sparkles size={28} />
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>

      <div className={cn('flex flex-1 flex-col', compact ? 'p-4' : 'p-5')}>
        <Link
          to={`/product/${product.slug}`}
          className={cn('line-clamp-2 font-black leading-tight text-primary-900', compact ? 'text-base' : 'text-lg')}
        >
          {product.name}
        </Link>
        <p className={cn('mt-2 line-clamp-2 font-medium text-primary-900/55', compact ? 'text-xs' : 'text-sm')}>
          {product.shortDescription || t('productCard.shortDescriptionFallback')}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {product.variants.map((item, index) => (
            <button
              key={item.id}
              onClick={(event) => {
                event.preventDefault();
                setActiveVariantIndex(index);
              }}
              className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                activeVariantIndex === index
                  ? 'bg-primary text-white'
                  : 'bg-primary-50 text-primary-900/55 hover:bg-primary-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={cn('mt-auto', compact ? 'pt-4' : 'pt-5')}>
          <div className="flex items-end justify-between gap-3">
            <div>
              {mrpText && <p className="text-sm font-bold text-primary-900/35 line-through">{mrpText}</p>}
              <p className={cn('font-black leading-none text-primary-900', compact ? 'text-2xl' : 'text-3xl')}>{priceText}</p>
            </div>
            {discountPercent > 0 && (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                {t('productCard.savePercent', { percent: discountPercent })}
              </span>
            )}
          </div>

          {inCartQty > 0 ? (
            <div
              className={cn(
                'mt-5 flex items-center justify-between rounded-2xl border border-primary-200 bg-primary-50 px-2',
                compact ? 'h-10' : 'h-12',
              )}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  if (inCartQty <= 1) {
                    removeItem(product.id, variant.id);
                    return;
                  }
                  updateQty(product.id, variant.id, inCartQty - 1);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary-200 bg-white text-primary-900 transition hover:bg-primary-100"
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary-500">Qty</p>
                <p className={cn('font-black text-primary-900', compact ? 'text-sm' : 'text-base')}>{inCartQty}</p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  if (variant.stock > 0 && inCartQty >= variant.stock) return;
                  updateQty(product.id, variant.id, inCartQty + 1);
                }}
                disabled={variant.stock > 0 && inCartQty >= variant.stock}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary-200 bg-white text-primary-900 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={variant.stock <= 0}
              className={cn(
                'mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-900 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-primary-100 disabled:text-primary-900/30',
                compact ? 'h-10' : 'h-12',
              )}
            >
              <Plus size={16} />
              <span>{variant.stock > 0 ? t('productCard.addToCart') : t('productCard.outOfStock')}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
