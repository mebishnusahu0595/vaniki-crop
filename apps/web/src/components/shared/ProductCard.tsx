import React, { useRef, useState } from 'react';
import { Heart, Minus, Plus, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
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

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
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
      stock: variant.stock,
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
    <div
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-2xl border border-primary-100 bg-white transition-shadow hover:shadow-lg',
      )}
    >
      <Link to={`/product/${product.slug}`} className="relative block">
        <div className="relative aspect-square overflow-hidden bg-[#fafaf8]">
          {discountPercent > 0 && variant.stock > 0 && (
            <span className="absolute left-2 top-2 z-20 rounded-md bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
              {discountPercent}% Off
            </span>
          )}

          {variant.stock <= 0 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
              <span className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                {t('productCard.outOfStock')}
              </span>
            </div>
          )}

          {variant.stock > 0 && variant.stock < 10 && (
            <span className="absolute left-2 bottom-2 z-20 rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
              {t('productCard.onlyLeft', { count: variant.stock })}
            </span>
          )}

          <button
            type="button"
            onClick={handleToggleWishlist}
            className={cn(
              "absolute right-2 top-2 z-10 rounded-full border p-1.5 transition-all",
              isWishlisted
                ? "border-red-200 bg-red-50 text-red-500"
                : "border-primary-100 bg-white/90 text-primary-900/30 hover:text-red-500"
            )}
            aria-label={isWishlisted ? t('productCard.removeFromWishlist') : t('productCard.addToWishlist')}
          >
            <Heart size={12} fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>

          <div className="flex h-full items-center justify-center p-4">
            {image ? (
              <OptimizedImage
                ref={imageRef}
                src={image}
                alt={product.name}
                widthHint={400}
                heightHint={400}
                loading="lazy"
                containerClassName={cn("h-full w-full", variant.stock <= 0 && "grayscale-[0.5] opacity-50")}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary-200">
                <Sparkles size={24} />
              </div>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {product.category?.name && (
          <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-primary/60">
            {product.category.name}
          </span>
        )}
        <Link
          to={`/product/${product.slug}`}
          className="line-clamp-1 text-sm font-bold leading-snug text-primary-900 sm:text-base"
        >
          {product.name}
        </Link>

        {product.variants.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {product.variants.slice(0, 3).map((item, index) => (
              <button
                key={item.id}
                onClick={(event) => {
                  event.preventDefault();
                  setActiveVariantIndex(index);
                }}
                className={cn(
                  "rounded px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider transition-all sm:text-[9px]",
                  activeVariantIndex === index
                    ? "bg-primary-900 text-white"
                    : "bg-primary-50 text-primary-900/60"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-primary-900 sm:text-xl">{priceText}</span>
            {mrpText && (
              <span className="text-[10px] font-semibold text-primary-900/25 line-through sm:text-xs">{mrpText}</span>
            )}
          </div>

          {inCartQty > 0 ? (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-primary-100 p-0.5">
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
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-50 text-primary-900 transition hover:bg-primary-100"
                aria-label="Decrease quantity"
              >
                <Minus size={12} />
              </button>
              <span className="text-sm font-black text-primary-900">{inCartQty}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  if (variant.stock > 0 && inCartQty >= variant.stock) return;
                  updateQty(product.id, variant.id, inCartQty + 1);
                }}
                disabled={variant.stock > 0 && inCartQty >= variant.stock}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-50 text-primary-900 transition hover:bg-primary-100 disabled:opacity-40"
                aria-label="Increase quantity"
              >
                <Plus size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={variant.stock <= 0}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-900 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white transition-all hover:bg-primary disabled:bg-primary-200 disabled:text-primary-900/40"
            >
              <Plus size={12} />
              <span>{variant.stock > 0 ? t('productCard.addToCart') : t('productCard.outOfStock')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
