import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Minus, Plus, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Product } from '../../types/storefront';
import { formatPrice, getDiscountPercent } from '../../utils/format';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);

  const wishlistIds = (user?.wishlist || []).map((entry) => (typeof entry === 'string' ? entry : entry.id));
  const isWishlisted = wishlistIds.includes(product.id);

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

  if (!variant) return null;

  return (
    <motion.div
      whileHover={{ y: -8 }}
      className={cn(
        'product-card group flex h-full flex-col overflow-hidden bg-white transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 border border-primary-50',
        compact ? 'rounded-[2rem]' : 'rounded-[2.5rem]',
      )}
    >
      <Link to={`/product/${product.slug}`} className="relative block">
        <div
          className={cn(
            'relative overflow-hidden bg-[#fafafa]',
            compact ? 'p-2' : 'p-3',
          )}
        >
          <div
            className={cn(
              'relative mx-auto aspect-square w-full overflow-hidden bg-white shadow-sm ring-1 ring-primary-50',
              compact ? 'rounded-[1.5rem]' : 'rounded-[2rem]',
            )}
          >
            {discountPercent > 0 && (
              <span className="absolute left-3 top-3 z-20 inline-flex items-center rounded-lg bg-red-500 px-2 py-1 text-[9px] font-black uppercase leading-none tracking-widest text-white shadow-lg shadow-red-500/20">
                {discountPercent}% Off
              </span>
            )}
            
            <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2 opacity-0 transition-all duration-300 group-hover:translate-y-[-4px] group-hover:opacity-100 lg:group-hover:flex">
              <button
                type="button"
                onClick={handleToggleWishlist}
                className={cn(
                  "rounded-xl border p-2.5 transition-all shadow-sm",
                  isWishlisted
                    ? "border-red-100 bg-red-50 text-red-500"
                    : "border-primary-50 bg-white text-primary-900/40 hover:bg-primary-900 hover:text-white"
                )}
                aria-label={isWishlisted ? t('productCard.removeFromWishlist') : t('productCard.addToWishlist')}
              >
                <Heart size={14} fill={isWishlisted ? 'currentColor' : 'none'} />
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
                  className="h-full w-full object-contain p-4 transition-transform duration-700 group-hover:scale-110"
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

      <div className={cn('flex flex-1 flex-col', compact ? 'p-5' : 'p-6')}>
        <div className="mb-2">
           <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">{product.category?.name}</span>
        </div>
        <Link
          to={`/product/${product.slug}`}
          className={cn('line-clamp-2 font-black leading-tight text-primary-900 transition-colors hover:text-primary', compact ? 'text-lg' : 'text-xl')}
        >
          {product.name}
        </Link>
        
        <div className="mt-4 flex flex-wrap gap-2">
          {product.variants.slice(0, 3).map((item, index) => (
            <button
              key={item.id}
              onClick={(event) => {
                event.preventDefault();
                setActiveVariantIndex(index);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all",
                activeVariantIndex === index
                  ? "bg-primary-900 text-white shadow-md shadow-primary-900/10"
                  : "bg-primary-50 text-primary-900/60 hover:bg-primary-100"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={cn('mt-auto', compact ? 'pt-6' : 'pt-8')}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <p className={cn('font-black leading-none text-primary-900', compact ? 'text-2xl' : 'text-3xl')}>
                {priceText}
              </p>
              {mrpText && <p className="mt-1 text-xs font-bold text-primary-900/20 line-through tracking-tight">{mrpText}</p>}
            </div>
          </div>

          {inCartQty > 0 ? (
            <div
              className={cn(
                'mt-5 flex items-center justify-between rounded-xl bg-primary-50/50 p-1 ring-1 ring-primary-100/50',
                compact ? 'h-11' : 'h-12',
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
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary-900 shadow-sm transition-all hover:bg-primary-900 hover:text-white"
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className={cn('font-black text-primary-900', compact ? 'text-sm' : 'text-base')}>{inCartQty}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  if (variant.stock > 0 && inCartQty >= variant.stock) return;
                  updateQty(product.id, variant.id, inCartQty + 1);
                }}
                disabled={variant.stock > 0 && inCartQty >= variant.stock}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary-900 shadow-sm transition-all hover:bg-primary-900 hover:text-white disabled:opacity-30"
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
                'mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-900 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-primary-900/10 transition-all hover:bg-primary hover:translate-y-[-2px] active:translate-y-0 disabled:bg-primary-900/40 disabled:shadow-none disabled:translate-y-0',
                compact ? 'h-11' : 'h-12',
              )}
            >
              <Plus size={14} />
              <span>{variant.stock > 0 ? t('productCard.addToCart') : t('productCard.outOfStock')}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
