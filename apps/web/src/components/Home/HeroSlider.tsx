import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Plus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { HomepageBanner } from '../../types/storefront';
import { formatPrice, getDiscountPercent } from '../../utils/format';
import { useCartStore } from '../../store/useCartStore';
import OptimizedImage from '../common/OptimizedImage';

interface HeroSliderProps {
  banners: HomepageBanner[];
}

const sliderVariants = {
  enter: { opacity: 0, scale: 1.04 },
  center: { opacity: 1, scale: 1, transition: { duration: 0.55 } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.35 } },
};

gsap.registerPlugin(useGSAP);

const HeroSlider: React.FC<HeroSliderProps> = ({ banners }) => {
  const { t, i18n } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const textScopeRef = useRef<HTMLDivElement | null>(null);

  const safeBanners = useMemo(
    () =>
      banners.length
        ? banners
        : [
            {
              id: 'fallback-banner',
              title: t('home.heroFallbackTitle'),
              subtitle: t('home.heroFallbackSubtitle'),
              ctaText: t('home.heroFallbackCta'),
              ctaLink: '/products',
              image: {
                url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
                mobileUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80',
              },
              linkedProducts: [],
            },
          ],
    [banners, t],
  );

  useEffect(() => {
    if (safeBanners.length <= 1 || isPaused) return undefined;

    const timer = window.setInterval(() => {
      setCurrent((previous) => (previous + 1) % safeBanners.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isPaused, safeBanners.length]);

  useGSAP(
    () => {
      const timeline = gsap.timeline();

      timeline
        .from('.hero-title span', {
          yPercent: 100,
          opacity: 0,
          stagger: 0.05,
          duration: 0.82,
          ease: 'power4.out',
        })
        .from(
          '.hero-subtitle',
          {
            y: 20,
            opacity: 0,
            duration: 0.6,
            ease: 'power3.out',
          },
          '-=0.38',
        )
        .from(
          '.hero-cta',
          {
            y: 20,
            opacity: 0,
            duration: 0.6,
            ease: 'power3.out',
          },
          '-=0.35',
        );
    },
    {
      scope: textScopeRef,
      dependencies: [current],
      revertOnUpdate: true,
    },
  );

  const activeBanner = safeBanners[current];
  const isHindi = i18n.resolvedLanguage?.startsWith('hi');
  const displayTitle = isHindi ? t('home.heroFallbackTitle') : activeBanner.title;
  const displaySubtitle = isHindi ? t('home.heroFallbackSubtitle') : activeBanner.subtitle;
  const displayCta = isHindi ? t('home.heroFallbackCta') : activeBanner.ctaText || t('home.shopNow');
  const heroWords = displayTitle.split(' ');
  const featuredProducts = activeBanner.linkedProducts
    .sort((left, right) => left.position - right.position)
    .map((entry) => entry.productId)
    .filter(Boolean);
  const currentProduct = featuredProducts.length
    ? featuredProducts[activeProductIndex % featuredProducts.length]
    : null;
  const currentVariant = currentProduct?.variants?.[0];
  const currentImage =
    currentProduct?.images.find((image) => image.isPrimary)?.url ||
    currentProduct?.images[0]?.url;
  const discountPercent = currentVariant
    ? getDiscountPercent(currentVariant.mrp || 0, currentVariant.price || 0)
    : 0;
  const { mrpText, priceText } = currentVariant
    ? formatPrice(currentVariant.mrp || 0, currentVariant.price || 0)
    : { mrpText: '', priceText: '' };

  useEffect(() => {
    setActiveProductIndex(0);
  }, [current]);

  const goToPrevious = () => {
    setCurrent((previous) => (previous - 1 + safeBanners.length) % safeBanners.length);
  };

  const goToNext = () => {
    setCurrent((previous) => (previous + 1) % safeBanners.length);
  };

  const goToPreviousProduct = () => {
    if (featuredProducts.length <= 1) return;
    setActiveProductIndex((previous) => (previous - 1 + featuredProducts.length) % featuredProducts.length);
  };

  const goToNextProduct = () => {
    if (featuredProducts.length <= 1) return;
    setActiveProductIndex((previous) => (previous + 1) % featuredProducts.length);
  };

  const handleAddFeaturedProductToCart = () => {
    if (!currentProduct || !currentVariant) return;

    addItem({
      productId: currentProduct.id,
      productSlug: currentProduct.slug,
      variantId: currentVariant.id,
      productName: currentProduct.name,
      variantLabel: currentVariant.label,
      price: currentVariant.price,
      mrp: currentVariant.mrp,
      qty: 1,
      image: currentImage,
    });

    toast.success(t('productCard.addedToCart', { name: currentProduct.name }));
  };

  return (
    <section
      className="relative min-h-[520px] overflow-hidden bg-primary-900 lg:min-h-[600px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeBanner.id}
          variants={sliderVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0"
        >
          <img
            src={activeBanner.image.url}
            alt={activeBanner.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(8,32,24,0.92)_0%,_rgba(8,32,24,0.72)_45%,_rgba(8,32,24,0.55)_100%)]" />
        </motion.div>
      </AnimatePresence>

      <div className="container relative z-10 mx-auto px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div ref={textScopeRef} className="max-w-3xl text-white">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.26em] text-primary-100">
              <Sparkles size={12} className="text-primary-300" />
              {t('home.trustedByGrowers')}
            </div>

            <h1 className="hero-title font-heading text-4xl leading-[0.95] sm:text-5xl lg:text-6xl xl:text-[4.2rem]">
              {heroWords.map((word, index) => (
                <span key={`${word}-${index}`} className="mr-3 inline-block">
                  {word}
                </span>
              ))}
            </h1>

            <p className="hero-subtitle mt-4 max-w-2xl text-base font-medium leading-7 text-primary-50/80 sm:text-lg">
              {displaySubtitle}
            </p>

            <div className="hero-cta mt-6 flex flex-wrap items-center gap-4">
              <Link
                to={activeBanner.ctaLink || '/products'}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-primary-900 transition hover:bg-primary-50"
              >
                <span>{displayCta}</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/categories"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-white/15"
              >
                {t('home.viewCategories')}
              </Link>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={goToPrevious}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex items-center gap-2">
                {safeBanners.map((banner, index) => (
                  <button
                    key={banner.id}
                    onClick={() => setCurrent(index)}
                    className={`h-2.5 rounded-full transition ${
                      current === index ? 'w-10 bg-white' : 'w-2.5 bg-white/35'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={goToNext}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          <div className="w-full lg:max-w-[520px] lg:justify-self-end">
            {currentProduct && currentVariant ? (
              <div className="surface-card overflow-hidden rounded-[1.8rem] p-4 sm:p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentProduct.id}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.32, ease: 'easeOut' }}
                  >
                    <Link to={`/product/${currentProduct.slug}`} className="block rounded-[1.3rem] bg-primary-50 p-3">
                      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-[1rem] bg-white ring-1 ring-primary-100">
                        {discountPercent > 0 ? (
                          <span className="absolute left-2.5 top-2.5 z-10 inline-flex max-w-[48%] items-center rounded-full bg-[#ff6b6b] px-2.5 py-1 text-[10px] font-black uppercase leading-none tracking-[0.14em] text-white shadow-sm">
                            {discountPercent}%
                          </span>
                        ) : null}

                        {currentImage ? (
                          <OptimizedImage
                            src={currentImage}
                            alt={currentProduct.name}
                            widthHint={560}
                            heightHint={560}
                            loading="lazy"
                            containerClassName="h-full w-full"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-primary-300">
                            <Sparkles size={24} />
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="mt-4">
                      <Link
                        to={`/product/${currentProduct.slug}`}
                        className="line-clamp-1 text-[1.75rem] font-black leading-tight text-primary-900"
                      >
                        {currentProduct.name}
                      </Link>
                      <p className="mt-2 line-clamp-2 text-sm font-medium text-primary-900/55">
                        {currentProduct.shortDescription || t('home.featuredDescriptionFallback')}
                      </p>

                      <div className="mt-4 flex items-center gap-2">
                        <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                          {currentVariant.label}
                        </span>
                      </div>

                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          {mrpText ? <p className="text-sm font-bold text-primary-900/35 line-through">{mrpText}</p> : null}
                          <p className="text-4xl font-black leading-none text-primary-900">{priceText}</p>
                        </div>
                        {discountPercent > 0 ? (
                          <span className="rounded-full bg-primary-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                            {t('home.savePercent', { percent: discountPercent })}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                        <button
                          onClick={handleAddFeaturedProductToCart}
                          disabled={currentVariant.stock <= 0}
                          className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-900 px-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-primary-100 disabled:text-primary-900/35"
                        >
                          <Plus size={15} />
                          <span>{currentVariant.stock > 0 ? t('home.addToCart') : t('home.outOfStock')}</span>
                        </button>
                        <Link
                          to={`/product/${currentProduct.slug}`}
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-primary-100 px-4 text-xs font-black uppercase tracking-[0.16em] text-primary-900 transition hover:bg-primary-50"
                        >
                          {t('home.view')}
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {featuredProducts.length > 1 ? (
                  <div className="mt-4 flex items-center justify-between border-t border-primary-100 pt-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary-500">
                      {t('home.productCounter', {
                        current: activeProductIndex + 1,
                        total: featuredProducts.length,
                      })}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={goToPreviousProduct}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-100 bg-white text-primary-900 transition hover:bg-primary-50"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <button
                        onClick={goToNextProduct}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-100 bg-white text-primary-900 transition hover:bg-primary-50"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="glass-card hidden rounded-[1.8rem] p-6 text-white lg:block">
                <p className="section-kicker text-primary-200">{t('home.bestSeller')}</p>
                <h3 className="mt-3 font-heading text-3xl">{t('home.bestSellerTitle')}</h3>
                <p className="mt-4 text-sm font-medium leading-7 text-white/75">
                  {t('home.bestSellerDescription')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSlider;
