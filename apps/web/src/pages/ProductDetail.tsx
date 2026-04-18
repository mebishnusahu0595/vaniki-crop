import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingCart, ChevronRight, Share2, Truck, ShieldCheck, RotateCcw } from 'lucide-react';
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

  const trustSignals = [
    { icon: <Truck size={18} />, text: t('productDetail.freeDelivery', 'Free Delivery over ₹1,000') },
    { icon: <ShieldCheck size={18} />, text: t('productDetail.genuineProduct', '100% Genuine Product') },
    { icon: <RotateCcw size={18} />, text: t('productDetail.easyReturns', '7 Days Easy Returns') },
  ];

  return (
    <div className="relative min-h-screen bg-[#fafafa] pb-24 lg:pb-8">
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
      {/* Desktop Breadcrumb */}
      <div className="container mx-auto hidden px-4 py-8 lg:block">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary-900/40">
          <Link to="/" className="hover:text-primary transition-colors">{t('productDetail.home')}</Link>
          <ChevronRight size={10} />
          <Link to={`/products?category=${product.category?.slug}`} className="hover:text-primary transition-colors">
            {product.category?.name || t('productDetail.products')}
          </Link>
          <ChevronRight size={10} />
          <span className="text-primary-900">{product.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-0 sm:px-4 lg:px-6">
        <div className="grid gap-0 lg:grid-cols-12 lg:gap-12">
          {/* Left: Image Gallery */}
          <div className="lg:col-span-7 xl:col-span-8">
            <div className="relative overflow-hidden bg-white lg:rounded-[2.5rem] lg:shadow-sm lg:border lg:border-primary-50">
              {/* Image Display */}
              <div className="relative">
                {normalizedImages.map((image, index) => (
                  <div 
                    key={`main-${index}`}
                    className={cn(
                      "w-full transition-opacity duration-500",
                      activeImageIndex === index ? "block" : "hidden"
                    )}
                  >
                    <div className="relative aspect-square w-full sm:aspect-[4/3] lg:aspect-square">
                      <OptimizedImage
                        src={image.url}
                        alt={`${product.name} ${index + 1}`}
                        widthHint={1200}
                        heightHint={1200}
                        containerClassName="h-full w-full"
                        className="h-full w-full object-contain p-6 transition-transform duration-700 hover:scale-110 sm:p-12"
                      />
                    </div>
                  </div>
                ))}

                {/* Mobile Indicators */}
                <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2 lg:hidden">
                  {normalizedImages.map((_, index) => (
                    <button
                      key={`dot-${index}`}
                      onClick={() => setActiveImageIndex(index)}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        activeImageIndex === index ? "w-6 bg-primary" : "w-1.5 bg-black/10"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Desktop Thumbnails */}
              <div className="hidden justify-center gap-4 pb-8 lg:flex">
                {normalizedImages.map((image, index) => (
                  <button
                    key={`thumb-${index}`}
                    onClick={() => setActiveImageIndex(index)}
                    className={cn(
                      "group relative h-20 w-20 overflow-hidden rounded-2xl border-2 transition-all duration-300",
                      activeImageIndex === index 
                        ? "border-primary shadow-lg shadow-primary/10 ring-4 ring-primary/5" 
                        : "border-transparent bg-primary-50/50 hover:border-primary/30"
                    )}
                  >
                    <img src={image.url} alt="thumbnail" className="h-full w-full object-contain p-3 transition-transform group-hover:scale-110" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Product Info */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="sticky top-24 space-y-8 px-4 py-8 lg:p-0">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    {product.category?.name || t('productDetail.cropProtection')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <ReviewStars rating={Math.round(product.averageRating || 0)} size={12} />
                    <span className="text-[10px] font-bold text-primary-900/40 tracking-wider uppercase">
                      ({product.reviewCount || 0} reviews)
                    </span>
                  </div>
                </div>
                
                <h1 className="font-heading text-4xl font-black leading-[1.1] text-primary-900 lg:text-5xl xl:text-6xl">
                  {product.name}
                </h1>
                
                <p className="text-sm font-medium leading-relaxed text-primary-900/50 max-w-md">
                  {product.shortDescription || t('productDetail.shortDescriptionFallback')}
                </p>
              </div>

              <div className="space-y-8">
                {/* Price Card */}
                <div className="rounded-[2.5rem] border border-primary-50 bg-white p-8 shadow-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-5xl font-black tracking-tight text-primary-900">{pricing?.priceText}</span>
                    <div className="flex flex-col">
                      {pricing?.mrpText && (
                        <span className="text-base font-bold text-primary-900/20 line-through decoration-2">{pricing.mrpText}</span>
                      )}
                      {pricing?.fullSavingsLabel && (
                        <span className="text-[11px] font-black uppercase tracking-widest text-red-500">
                          Save {pricing.fullSavingsLabel.replace(/[^0-9%]/g, '')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-10 space-y-8">
                    {/* Variants */}
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-primary-900/30">
                          {t('productDetail.chooseVariant')}
                        </label>
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          selectedVariant.stock > 0 ? "text-primary" : "text-red-500"
                        )}>
                          {selectedVariant.stock > 0 
                            ? `${selectedVariant.stock} in stock` 
                            : t('productDetail.outOfStock')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {product.variants.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setSelectedVariantId(v.id)}
                            className={cn(
                              "min-w-[100px] rounded-2xl border-2 px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all duration-300",
                              selectedVariant.id === v.id 
                                ? "border-primary-900 bg-primary-900 text-white shadow-xl shadow-primary/20 scale-[1.05]" 
                                : "border-primary-100 bg-primary-50/30 text-primary-900/40 hover:border-primary/40"
                            )}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Desktop Actions */}
                    <div className="hidden space-y-4 lg:block">
                      <div className="flex gap-4">
                        <div className="flex items-center rounded-2xl bg-primary-50/50 p-1.5 ring-1 ring-primary-100/50">
                          <button 
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            className="flex h-12 w-12 items-center justify-center rounded-xl font-black text-primary-900 transition-colors hover:bg-white hover:shadow-sm"
                          >
                            -
                          </button>
                          <span className="w-12 text-center text-lg font-black text-primary-900">{quantity}</span>
                          <button 
                            onClick={() => setQuantity(q => q + 1)}
                            className="flex h-12 w-12 items-center justify-center rounded-xl font-black text-primary-900 transition-colors hover:bg-white hover:shadow-sm"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={handleAddToCart}
                          disabled={selectedVariant.stock <= 0}
                          className="flex-1 rounded-2xl bg-primary-900 py-5 text-sm font-black uppercase tracking-[0.25em] text-white shadow-2xl shadow-primary-900/20 transition-all hover:bg-primary hover:translate-y-[-2px] active:translate-y-[0px] disabled:opacity-30 disabled:translate-y-0"
                        >
                          {t('productDetail.addToCart')}
                        </button>
                      </div>
                      <button
                        onClick={handleShare}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary-50 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-primary-900/40 transition-all hover:bg-primary-50 hover:text-primary-900"
                      >
                        <Share2 size={14} />
                        {t('productDetail.shareProduct', 'Share this product')}
                      </button>
                    </div>
                  </div>

                  {/* Trust Signals */}
                  <div className="mt-10 grid grid-cols-1 gap-4 border-t border-primary-50 pt-8 sm:grid-cols-3 lg:grid-cols-1">
                    {trustSignals.map((signal, i) => (
                      <div key={i} className="flex items-center gap-4 rounded-2xl bg-[#fafafa] p-4 transition-transform hover:scale-[1.02]">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                          {signal.icon}
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-primary-900/60 leading-tight">
                          {signal.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Content Tabs Area */}
        <div className="mt-16 space-y-16 px-4 lg:mt-32 lg:px-0">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.4fr]">
            <div className="space-y-8">
              <div className="inline-block border-b-4 border-primary pb-2">
                <h2 className="text-2xl font-black uppercase tracking-[0.1em] text-primary-900">
                  {t('productDetail.description')}
                </h2>
              </div>
              <div 
                className="prose prose-lg max-w-none rounded-[3rem] bg-white p-10 shadow-sm border border-primary-50 text-primary-900/70 font-medium leading-relaxed prose-headings:text-primary-900 prose-strong:text-primary-900 lg:p-16"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
              />
            </div>

            <div className="space-y-8">
               <div className="inline-block border-b-4 border-primary pb-2">
                <h2 className="text-2xl font-black uppercase tracking-[0.1em] text-primary-900">
                  {t('productDetail.reviews')}
                </h2>
              </div>
              
              <div className="space-y-6">
                {(product.reviews || []).length > 0 ? (
                  product.reviews?.map((r) => (
                    <div key={r.id} className="rounded-3xl border border-primary-50 bg-white p-8 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <ReviewStars rating={r.rating} size={14} />
                      </div>
                      <p className="text-base font-medium leading-relaxed text-primary-900/60 italic">"{r.comment}"</p>
                      <div className="mt-6 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                          {r.userId?.name?.charAt(0) || 'V'}
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[11px] font-black uppercase tracking-widest text-primary-900">
                            {r.userId?.name || 'Verified Buyer'}
                          </span>
                           <span className="text-[9px] font-bold uppercase tracking-widest text-primary-500">Verified Purchase</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-primary-100 py-16 text-center bg-white/50">
                    <p className="text-sm font-black uppercase tracking-widest text-primary-900/20">{t('productDetail.noApprovedReviews')}</p>
                  </div>
                )}

                <div className="rounded-[2.5rem] border border-primary-50 bg-primary-900 p-8 text-white shadow-2xl">
                   <h3 className="mb-6 text-xl font-black uppercase tracking-widest leading-tight">
                     {t('productDetail.shareYourExperience', 'Share your experience')}
                   </h3>
                   {isAuthenticated ? (
                     <form onSubmit={submitReview} className="space-y-6">
                        <div className="flex justify-center p-4 bg-white/10 rounded-2xl">
                          <ReviewStars rating={reviewRating} interactive onChange={setReviewRating} size={32} />
                        </div>
                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          rows={4}
                          className="w-full rounded-2xl border-none bg-white/10 p-5 text-sm font-bold placeholder:text-white/30 focus:ring-2 focus:ring-white/20 transition-all outline-none"
                          placeholder={t('productDetail.reviewPlaceholder')}
                        />
                        <button
                          disabled={isSubmittingReview}
                          className="w-full rounded-2xl bg-white py-5 text-[11px] font-black uppercase tracking-[0.2em] text-primary-900 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-xl"
                        >
                          {isSubmittingReview ? t('productDetail.submitting') : t('productDetail.submitReview')}
                        </button>
                     </form>
                   ) : (
                     <Link to="/login" className="block rounded-2xl bg-white/10 p-8 text-center text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-white/20">
                        {t('productDetail.loginToReview')}
                     </Link>
                   )}
                </div>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {related.length > 0 && (
            <div className="space-y-12">
              <div className="flex items-end justify-between border-b-4 border-primary-50 pb-6">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary mb-2">Recommended</p>
                  <h2 className="text-3xl font-black uppercase tracking-tight text-primary-900 lg:text-4xl">
                    {t('productDetail.relatedProducts')}
                  </h2>
                </div>
                <Link to="/products" className="hidden lg:block text-xs font-black uppercase tracking-widest text-primary-900/40 hover:text-primary transition-colors">
                  View All Products →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-10">
                {related.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sticky CTA */}
      <div className="fixed bottom-0 left-0 z-50 flex w-full items-center gap-4 border-t border-primary-50 bg-white/80 backdrop-blur-xl p-5 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] lg:hidden">
        <div className="flex items-center rounded-2xl bg-primary-50/50 p-1 ring-1 ring-primary-100/50">
          <button 
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
            className="flex h-12 w-12 items-center justify-center rounded-xl font-black text-primary-900"
          >
            -
          </button>
          <span className="w-10 text-center font-black text-primary-900">{quantity}</span>
          <button 
            onClick={() => setQuantity(q => q + 1)}
            className="flex h-12 w-12 items-center justify-center rounded-xl font-black text-primary-900"
          >
            +
          </button>
        </div>
        <button
          onClick={handleAddToCart}
          disabled={selectedVariant.stock <= 0}
          className="flex-1 rounded-2xl bg-primary-900 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-primary-900/30 active:scale-95 disabled:opacity-40 transition-all"
        >
          {t('productDetail.addToCart')}
        </button>
      </div>
    </div>
  );
};

export default ProductDetail;
