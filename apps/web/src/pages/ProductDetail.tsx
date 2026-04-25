import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Share2, Truck, ShieldCheck, RotateCcw, ShoppingCart, Minus, Plus } from 'lucide-react';
import DOMPurify from 'dompurify';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import ProductCard from '../components/shared/ProductCard';
import OptimizedImage from '../components/common/OptimizedImage';
import ReviewStars from '../components/ui/ReviewStars';
import { useProductDetail, useProducts } from '../hooks/useProducts';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useStoreStore } from '../store/useStoreStore';
import { storefrontApi } from '../utils/api';
import { addRecentlyViewedProduct } from '../utils/recentlyViewed';
import { formatPrice } from '../utils/format';
import { resolveMediaUrl } from '../utils/media';
import { cn } from '../utils/cn';
import type { Product } from '../types/storefront';

const ProductDetail: React.FC = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const addItem = useCartStore((state) => state.addItem);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const selectedStore = useStoreStore((state) => state.selectedStore);

  const { data: product, isLoading } = useProductDetail(slug || '');
  const { data: relatedProducts } = useProducts({
    category: product?.category?.slug,
    limit: 4,
    store: selectedStore?.id,
  });

  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://vanikicrop.com').replace(/\/$/, '');

  const selectedVariant = useMemo(
    () => product?.variants.find((variant) => variant.id === selectedVariantId) || product?.variants[0],
    [product?.variants, selectedVariantId],
  );
  const normalizedImages = useMemo(
    () => (product?.images || []).map((image) => ({ ...image, url: resolveMediaUrl(image.url, image.publicId) })),
    [product?.images],
  );
  const pricing = selectedVariant ? formatPrice(selectedVariant.mrp, selectedVariant.price) : null;
  const related = (relatedProducts?.data || []).filter((item) => item.id !== product?.id).slice(0, 4);
  const canonicalUrl = product ? `${siteUrl}/product/${product.slug}` : `${siteUrl}/products`;

  useEffect(() => {
    if (!product) return;

    const nextViewed = addRecentlyViewedProduct(product)
      .filter((entry) => entry.id !== product.id)
      .slice(0, 4);
    setRecentlyViewed(nextViewed);
  }, [product]);

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return;

    addItem({
      productId: product.id,
      productSlug: product.slug,
      variantId: selectedVariant.id,
      productName: product.name,
      variantLabel: selectedVariant.label,
      price: selectedVariant.price,
      mrp: selectedVariant.mrp,
      qty: quantity,
      image: normalizedImages[0]?.url,
      stock: selectedVariant.stock,
    });
    toast.success(t('productDetail.addedToCart', { name: product.name }));
  };

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!product) return;

    setIsSubmittingReview(true);
    try {
      await storefrontApi.submitReview({
        productId: product.id,
        rating: reviewRating,
        comment: reviewComment,
      });
      toast.success(t('productDetail.reviewSubmitted'));
      setReviewComment('');
      setReviewRating(5);
    } catch {
      toast.error(t('productDetail.reviewSubmitFailed'));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleShare = async () => {
    if (!product) return;

    const shareUrl = `${siteUrl}/product/${product.slug}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: product.shortDescription || t('productDetail.checkProductText'),
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t('productDetail.linkCopied'));
      }
    } catch {
      toast.error(t('productDetail.shareFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!product || !selectedVariant) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-black text-primary-900">{t('productDetail.productNotFound')}</h1>
        <Link to="/products" className="mt-4 inline-flex font-black text-primary">
          {t('productDetail.backToProducts')}
        </Link>
      </div>
    );
  }

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription || product.description.replace(/<[^>]*>/g, '').slice(0, 160),
    image: normalizedImages.map((image) => image.url),
    sku: selectedVariant.sku || product.sku,
    brand: product.brand || 'Vaniki Crop',
    category: product.category?.name,
    aggregateRating:
      product.reviewCount && product.averageRating
        ? {
            '@type': 'AggregateRating',
            ratingValue: Number(product.averageRating.toFixed(2)),
            reviewCount: product.reviewCount,
          }
        : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: selectedVariant.price,
      availability: selectedVariant.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: t('productDetail.home'),
        item: `${siteUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: product.category?.name || t('productDetail.products'),
        item: `${siteUrl}/products${product.category?.slug ? `?category=${product.category.slug}` : ''}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: canonicalUrl,
      },
    ],
  };

  const trustSignals = [
    { icon: <Truck size={16} />, label: t('productDetail.freeDelivery', 'Free Delivery over ₹1,000') },
    { icon: <ShieldCheck size={16} />, label: t('productDetail.genuineProduct', '100% Genuine Product') },
    { icon: <RotateCcw size={16} />, label: t('productDetail.easyReturns', '7 Days Easy Returns') },
  ];

  return (
    <div className="bg-white pb-28 lg:pb-12">
      <Helmet>
        <title>{`${product.name} | Vaniki Crop`}</title>
        <meta
          name="description"
          content={product.shortDescription || 'Buy genuine crop-protection products with fast delivery and pickup options.'}
        />
        <meta property="og:title" content={`${product.name} | Vaniki Crop`} />
        <meta
          property="og:description"
          content={product.shortDescription || 'Trusted crop-protection input available on Vaniki Crop.'}
        />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={canonicalUrl} />
        {normalizedImages[0]?.url && <meta property="og:image" content={normalizedImages[0].url} />}
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold uppercase tracking-widest text-primary-900/40">
          <Link to="/" className="shrink-0 transition-colors hover:text-primary">{t('productDetail.home')}</Link>
          <ChevronRight size={10} className="shrink-0" />
          <Link to={`/products?category=${product.category?.slug}`} className="shrink-0 transition-colors hover:text-primary">
            {product.category?.name || t('productDetail.products')}
          </Link>
          <ChevronRight size={10} className="shrink-0" />
          <span className="truncate text-primary-900">{product.name}</span>
        </div>
      </div>

      {/* Main Product Section */}
      <div className="container mx-auto px-4">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">

          {/* Image Gallery */}
          <div>
            <div className="overflow-hidden rounded-2xl border border-primary-100 bg-[#fafaf8]">
              <div className="relative aspect-square">
                {normalizedImages.map((image, index) => (
                  <div
                    key={`main-${index}`}
                    className={cn(
                      "absolute inset-0 transition-opacity duration-300",
                      activeImageIndex === index ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}
                  >
                    <OptimizedImage
                      src={image.url}
                      alt={`${product.name} ${index + 1}`}
                      widthHint={800}
                      heightHint={800}
                      containerClassName="h-full w-full"
                      className="h-full w-full object-contain p-8 sm:p-12 transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Thumbnails */}
            {normalizedImages.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {normalizedImages.map((image, index) => (
                  <button
                    key={`thumb-${index}`}
                    onClick={() => setActiveImageIndex(index)}
                    className={cn(
                      "h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-[#fafaf8] transition-all sm:h-20 sm:w-20",
                      activeImageIndex === index
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-primary-100 hover:border-primary/40"
                    )}
                  >
                    <img src={image.url} alt="" className="h-full w-full object-contain p-2" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-6">
              {/* Category + Rating */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                  {product.category?.name || t('productDetail.cropProtection')}
                </span>
                <div className="flex items-center gap-1.5">
                  <ReviewStars rating={Math.round(product.averageRating || 0)} size={12} />
                  <span className="text-[11px] font-semibold text-primary-900/40">
                    ({product.reviewCount || 0})
                  </span>
                </div>
              </div>

              {/* Title */}
              <h1 className="font-heading text-3xl font-black leading-tight text-primary-900 sm:text-4xl lg:text-5xl">
                {product.name}
              </h1>

              {/* Short Description */}
              {(product.shortDescription) && (
                <p className="text-sm leading-relaxed text-primary-900/50">
                  {product.shortDescription}
                </p>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-3 pt-2">
                <span className="text-4xl font-black text-primary-900 sm:text-5xl">{pricing?.priceText}</span>
                {pricing?.mrpText && (
                  <span className="text-lg font-semibold text-primary-900/25 line-through">{pricing.mrpText}</span>
                )}
                {pricing?.fullSavingsLabel && (
                  <span className="rounded-lg bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-600">
                    {pricing.fullSavingsLabel}
                  </span>
                )}
              </div>

              {/* Variants */}
              <div className="space-y-3 border-t border-primary-50 pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-primary-900/40">
                    {t('productDetail.chooseVariant')}
                  </span>
                  <span className={cn(
                    "text-[11px] font-bold",
                    selectedVariant.stock > 0 ? "text-green-600" : "text-red-500"
                  )}>
                    {selectedVariant.stock > 0
                      ? t('productDetail.stockUnits', { count: selectedVariant.stock })
                      : t('productDetail.outOfStock')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={cn(
                        "rounded-xl border-2 px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all",
                        selectedVariant.id === v.id
                          ? "border-primary-900 bg-primary-900 text-white"
                          : "border-primary-100 text-primary-900/50 hover:border-primary-900/30"
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity + Add to Cart (Desktop) */}
              <div className="hidden items-center gap-4 border-t border-primary-50 pt-6 lg:flex">
                <div className="flex items-center rounded-xl border border-primary-100">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-12 w-12 items-center justify-center text-primary-900/60 transition-colors hover:bg-primary-50"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center text-base font-black text-primary-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex h-12 w-12 items-center justify-center text-primary-900/60 transition-colors hover:bg-primary-50"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={selectedVariant.stock <= 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-900 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-primary active:scale-[0.98] disabled:opacity-30"
                >
                  <ShoppingCart size={18} />
                  {t('productDetail.addToCart')}
                </button>
              </div>

              {/* Share */}
              <button
                onClick={handleShare}
                className="hidden w-full items-center justify-center gap-2 rounded-xl border border-primary-100 py-3 text-xs font-bold uppercase tracking-widest text-primary-900/40 transition-all hover:bg-primary-50 lg:flex"
              >
                <Share2 size={14} />
                {t('productDetail.share')}
              </button>

              {/* Trust Signals */}
              <div className="grid gap-3 border-t border-primary-50 pt-6 sm:grid-cols-3 lg:grid-cols-1">
                {trustSignals.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-[#fafaf8] p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                      {s.icon}
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary-900/50">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-12 lg:mt-20">
          <h2 className="mb-6 text-xl font-black uppercase tracking-widest text-primary-900">
            Description
          </h2>
          <div
            className="prose max-w-none overflow-hidden break-words rounded-2xl border border-primary-50 bg-[#fafaf8] p-6 text-sm leading-relaxed text-primary-900/70 prose-headings:text-primary-900 prose-strong:text-primary-900 sm:p-8 lg:p-10 [overflow-wrap:anywhere]"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
          />
        </div>

        {/* Reviews */}
        <div className="mt-12 lg:mt-20">
          <h2 className="mb-6 text-xl font-black uppercase tracking-widest text-primary-900">
            {t('productDetail.reviews')}
          </h2>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Review List */}
            <div className="space-y-4">
              {(product.reviews || []).length > 0 ? (
                product.reviews?.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-primary-50 bg-[#fafaf8] p-6">
                    <ReviewStars rating={r.rating} size={14} />
                    <p className="mt-3 text-sm leading-relaxed text-primary-900/60">{r.comment}</p>
                    <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-primary-500">
                      {r.userId?.name || t('productDetail.verifiedCustomer')}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-primary-100 bg-[#fafaf8] py-12">
                  <p className="text-sm font-semibold text-primary-900/25">{t('productDetail.noApprovedReviews')}</p>
                </div>
              )}
            </div>

            {/* Write Review */}
            <div className="rounded-2xl bg-primary-900 p-6 text-white sm:p-8">
              <h3 className="mb-6 text-lg font-black uppercase tracking-widest">
                {t('productDetail.leaveReview')}
              </h3>
              {isAuthenticated ? (
                <form onSubmit={submitReview} className="space-y-5">
                  <div className="flex justify-center rounded-xl bg-white/10 p-4">
                    <ReviewStars rating={reviewRating} interactive onChange={setReviewRating} size={28} />
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border-none bg-white/10 p-4 text-sm font-medium outline-none placeholder:text-white/30 focus:ring-2 focus:ring-white/20"
                    placeholder={t('productDetail.reviewPlaceholder')}
                  />
                  <button
                    disabled={isSubmittingReview}
                    className="w-full rounded-xl bg-white py-4 text-xs font-black uppercase tracking-widest text-primary-900 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    {isSubmittingReview ? t('productDetail.submitting') : t('productDetail.submitReview')}
                  </button>
                </form>
              ) : (
                <div className="rounded-xl bg-white/10 p-6 text-center">
                  <Link to="/login" className="text-xs font-black uppercase tracking-widest text-white underline">
                    {t('productDetail.logIn')}
                  </Link>
                  <span className="ml-1 text-xs font-medium text-white/60">{t('productDetail.loginToReview')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <div className="mt-12 lg:mt-20">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-xl font-black uppercase tracking-widest text-primary-900">
                {t('productDetail.relatedProducts')}
              </h2>
              <Link to="/products" className="text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:text-primary-900">
                {t('productDetail.moreFromCategory')} →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <div className="mt-12 lg:mt-20">
            <h2 className="mb-6 text-xl font-black uppercase tracking-widest text-primary-900">
              {t('productDetail.recentlyViewed')}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {recentlyViewed.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sticky CTA */}
      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-primary-100 bg-white/95 px-4 py-3 backdrop-blur-lg lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-primary-100">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center text-sm font-black">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-11 w-11 items-center justify-center"
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={selectedVariant.stock <= 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-900 py-3.5 text-xs font-black uppercase tracking-widest text-white active:scale-[0.98] disabled:opacity-30"
          >
            <ShoppingCart size={16} />
            {t('productDetail.addToCart')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
