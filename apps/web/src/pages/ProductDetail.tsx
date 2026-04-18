import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingCart, ChevronRight, Share2 } from 'lucide-react';
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
  const activeImage = normalizedImages[activeImageIndex]?.url || normalizedImages[0]?.url;
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

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
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
      <div className="mb-6 flex items-center gap-2 overflow-x-auto text-xs font-black uppercase tracking-[0.18em] text-primary-500">
        <Link to="/">{t('productDetail.home')}</Link>
        <ChevronRight size={14} />
        <Link to={`/products?category=${product.category?.slug}`}>{product.category?.name || t('productDetail.products')}</Link>
        <ChevronRight size={14} />
        <span className="text-primary-900">{product.name}</span>
      </div>

      <section className="mx-auto max-w-2xl space-y-8">
        <div className="mx-auto max-w-lg space-y-4">
          <div className="surface-card flex items-center justify-center p-6">
            <div className="relative flex h-[350px] w-full max-w-[350px] items-center justify-center overflow-hidden rounded-[2rem] bg-primary-50 sm:h-[420px] sm:max-w-[420px]">
              {activeImage ? (
                <OptimizedImage
                  src={activeImage}
                  alt={product.name}
                  widthHint={1000}
                  heightHint={1000}
                  loading="lazy"
                  containerClassName="h-full w-full"
                  className="h-full w-full object-contain p-4 transition duration-500 hover:scale-105"
                />
              ) : null}
            </div>
          </div>
          <div className="no-scrollbar flex justify-center gap-3 overflow-x-auto pb-2">
            {normalizedImages.map((image, index) => (
              <button
                key={`${image.url}-${index}`}
                onClick={() => setActiveImageIndex(index)}
                className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 ${
                  activeImageIndex === index ? 'border-primary' : 'border-primary-100'
                }`}
              >
                <OptimizedImage
                  src={image.url}
                  alt={`${product.name} ${index + 1}`}
                  widthHint={140}
                  heightHint={140}
                  loading="lazy"
                  containerClassName="h-full w-full"
                  className="h-full w-full object-contain p-1"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="section-kicker">{product.category?.name || t('productDetail.cropProtection')}</p>
            <h1 className="mt-3 font-heading text-5xl text-primary-900">{product.name}</h1>
            <p className="mt-4 text-base font-medium leading-8 text-primary-900/60">
              {product.shortDescription || t('productDetail.shortDescriptionFallback')}
            </p>
          </div>

          <div className="surface-card p-6">
            {pricing?.mrpText && <p className="text-lg font-bold text-primary-900/35 line-through">{pricing.mrpText}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-4xl font-black text-primary-900">{pricing?.priceText}</p>
              {pricing?.fullSavingsLabel && (
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary">
                  {pricing.fullSavingsLabel}
                </span>
              )}
            </div>

            <div className="mt-6">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary-500">{t('productDetail.chooseVariant')}</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${
                      selectedVariant.id === variant.id ? 'bg-primary text-white' : 'bg-primary-50 text-primary-900/60'
                    }`}
                  >
                    {variant.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm font-bold text-primary-900/60">
                {selectedVariant.stock > 0 ? t('productDetail.stockUnits', { count: selectedVariant.stock }) : t('productDetail.outOfStock')}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-[52px] w-full items-center justify-between rounded-full border border-primary-100 bg-white px-2 sm:w-auto sm:justify-start">
                <button onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="flex h-10 w-12 items-center justify-center font-black">
                  -
                </button>
                <span className="w-12 text-center text-lg font-black text-primary-900">{quantity}</span>
                <button onClick={() => setQuantity((current) => current + 1)} className="flex h-10 w-12 items-center justify-center font-black">
                  +
                </button>
              </div>
              <div className="flex w-full gap-3 sm:w-auto sm:flex-1">
                <button
                  onClick={handleAddToCart}
                  disabled={selectedVariant.stock <= 0}
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-primary-900 px-6 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-primary-100 disabled:text-primary-900/30"
                >
                  <ShoppingCart size={18} />
                  <span>{t('productDetail.addToCart')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-900 transition hover:bg-primary-50 sm:w-auto sm:px-6"
                >
                  <Share2 size={16} />
                  <span className="hidden sm:inline-block sm:ml-2 text-sm font-black uppercase tracking-[0.2em]">{t('productDetail.share')}</span>
                </button>
              </div>
            </div>
          </div>

          <div
            className="surface-card prose max-w-none p-6 prose-p:text-primary-900/70 prose-li:text-primary-900/70"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
          />
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-2xl space-y-6">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker mb-2">{t('productDetail.reviews')}</p>
              <h2 className="text-2xl font-black text-primary-900">{t('productDetail.approvedFeedback')}</h2>
            </div>
            <ReviewStars rating={Math.round(product.averageRating || 0)} />
          </div>

          <div className="mt-6 space-y-4">
            {(product.reviews || []).length ? (
              product.reviews?.map((review) => (
                <article key={review.id} className="rounded-[1.5rem] border border-primary-100 bg-primary-50/50 p-4">
                  <ReviewStars rating={review.rating} />
                  <p className="mt-3 text-sm font-medium leading-7 text-primary-900/65">{review.comment}</p>
                  <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-primary-500">
                    {review.userId?.name || t('productDetail.verifiedCustomer')}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm font-medium text-primary-900/60">{t('productDetail.noApprovedReviews')}</p>
            )}
          </div>
        </div>

        <div className="surface-card p-6">
          <p className="section-kicker mb-2">{t('productDetail.leaveReview')}</p>
          {isAuthenticated ? (
            <form onSubmit={submitReview} className="space-y-4">
              <ReviewStars rating={reviewRating} interactive onChange={setReviewRating} size={20} />
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={6}
                placeholder={t('productDetail.reviewPlaceholder')}
                className="w-full rounded-[1.5rem] border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
              />
              <button
                disabled={isSubmittingReview}
                className="rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white"
              >
                {isSubmittingReview ? t('productDetail.submitting') : t('productDetail.submitReview')}
              </button>
            </form>
          ) : (
            <p className="text-sm font-medium text-primary-900/60">
              <Link to="/login" className="font-black text-primary">
                {t('productDetail.logIn')}
              </Link>{' '}
              {t('productDetail.loginToReview')}
            </p>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-10">
          <div className="mb-6">
            <p className="section-kicker mb-2">{t('productDetail.relatedProducts')}</p>
            <h2 className="section-title">{t('productDetail.moreFromCategory')}</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      {recentlyViewed.length > 0 && (
        <section className="mt-10">
          <div className="mb-6">
            <p className="section-kicker mb-2">{t('productDetail.recentlyViewed')}</p>
            <h2 className="section-title">{t('productDetail.continueExploring')}</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {recentlyViewed.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetail;
