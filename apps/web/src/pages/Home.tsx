import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HeroBanner from '../components/HeroBanner';
import CategoryStrip from '../components/Home/CategoryStrip';
import BestSellers from '../components/Home/BestSellers';
import Testimonials from '../components/Home/Testimonials';
import ProductCard from '../components/shared/ProductCard';
import { useHomepage } from '../hooks/useHomepage';
import { useStoreStore } from '../store/useStoreStore';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const selectedStore = useStoreStore((state) => state.selectedStore);
  const { data, isLoading } = useHomepage(selectedStore?.id);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-500">
            {t('home.loadingStorefront')}
          </p>
        </div>
      </div>
    );
  }

  const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://vanikicrop.com').replace(/\/$/, '');
  const ogImage = `${siteUrl}/favicon.svg`;

  return (
    <div className="pb-10">
      <Helmet>
        <title>Vaniki Crop | Buy Pesticides & Crop Protection Inputs Online</title>
        <meta
          name="description"
          content="Shop insecticides, fungicides, herbicides, and bio-pesticides with store-aware pricing, fast delivery, and pickup options across Vaniki Crop stores."
        />
        <meta property="og:title" content="Vaniki Crop | Buy Pesticides & Crop Protection Inputs Online" />
        <meta
          property="og:description"
          content="Crop-protection catalog with real store inventory, smart pricing, and smooth checkout."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${siteUrl}/`} />
        <meta property="og:image" content={ogImage} />
        <link rel="canonical" href={`${siteUrl}/`} />
      </Helmet>
      <HeroBanner banners={data?.banners || []} />
      <CategoryStrip categories={data?.featuredCategories || []} />

      <section className="bg-white py-14 sm:py-18">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker mb-2">{t('home.saleProducts')}</p>
              <h2 className="section-title">{t('home.bestDeals')}</h2>
            </div>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary transition hover:text-primary-600"
            >
              <span>{t('home.exploreAllProducts')}</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {(data?.saleProducts || []).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <BestSellers products={data?.bestSellers || []} />

      <section className="px-4 py-10 sm:px-6">
        <div className="container mx-auto">
          <div className="surface-card overflow-hidden bg-[linear-gradient(135deg,_#143d2e,_#082018)] px-6 py-10 text-white sm:px-10">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary-200">
                  <Flame size={12} />
                  {t('home.seasonalProtection')}
                </div>
                <h2 className="mt-5 font-heading text-4xl sm:text-5xl">{t('home.seasonalTitle')}</h2>
                <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-white/75">
                  {t('home.seasonalDescription')}
                </p>
              </div>
              <Link
                to="/products"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-primary-900 transition hover:bg-primary-50"
              >
                {t('home.shopNow')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Testimonials testimonials={data?.testimonials || []} />
    </div>
  );
};

export default Home;
