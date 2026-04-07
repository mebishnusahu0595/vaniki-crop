import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Store as StoreIcon, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import ProductCard from '../components/shared/ProductCard';
import { useCategories, useProducts, useProductSearch } from '../hooks/useProducts';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useStoreStore } from '../store/useStoreStore';
import { cn } from '../utils/cn';

const Products: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedStore = useStoreStore((state) => state.selectedStore);

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const category = searchParams.get('category') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const sort = (searchParams.get('sort') as 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'rating' | 'name') || 'newest';
  const page = searchParams.get('page') || '1';

  const { data: categories = [] } = useCategories();
  const { data, isLoading } = useProducts({
    search: debouncedSearch || undefined,
    category: category || undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    sort,
    page,
    limit: 12,
    store: selectedStore?.id,
  });
  const { data: suggestions } = useProductSearch(debouncedSearch, selectedStore?.id);

  const updateFilters = (next: Record<string, string | undefined>) => {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    });
    if (!('page' in next)) nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const activeProducts = data?.data || [];
  const pagination = data?.pagination;
  const searchSuggestions = useMemo(() => suggestions?.data.slice(0, 4) || [], [suggestions?.data]);
  const selectedCategoryName = useMemo(
    () => categories.find((item) => item.slug === category)?.name,
    [categories, category],
  );

  const totalProducts = pagination?.total || activeProducts.length;
  const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://vanikicrop.com').replace(/\/$/, '');
  const title = selectedCategoryName
    ? `${selectedCategoryName} - ${totalProducts} Products | Vaniki Crop`
    : `${t('nav.shop')} | Vaniki Crop`;
  const description = selectedCategoryName
    ? `Explore ${totalProducts} ${selectedCategoryName} products available at Vaniki Crop stores with real-time pricing and quick checkout.`
    : t('productsPage.description');

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${siteUrl}/products${category ? `?category=${category}` : ''}`} />
        <link rel="canonical" href={`${siteUrl}/products${category ? `?category=${category}` : ''}`} />
      </Helmet>
      <section className="surface-card overflow-hidden bg-[linear-gradient(135deg,_rgba(20,61,46,1),_rgba(8,32,24,0.96))] px-6 py-8 text-white sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="section-kicker text-primary-200">{t('productsPage.kicker')}</p>
            <h1 className="mt-3 font-heading text-5xl">{t('productsPage.title')}</h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-white/78">
              {t('productsPage.description')}
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <StoreIcon size={18} className="text-primary-200" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">{t('productsPage.activeStore')}</p>
                <p className="text-sm font-bold text-white">{selectedStore?.name || t('productsPage.allAvailableStores')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="surface-card h-fit p-5">
          <div className="mb-5 flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-primary" />
            <h2 className="text-lg font-black text-primary-900">{t('productsPage.filters')}</h2>
          </div>

          <div className="space-y-6">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-primary-500">{t('productsPage.category')}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateFilters({ category: undefined })}
                  className={cn(
                    'rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em]',
                    !category ? 'bg-primary text-white' : 'bg-primary-50 text-primary-900/60',
                  )}
                >
                  {t('productsPage.all')}
                </button>
                {categories.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateFilters({ category: item.slug })}
                    className={cn(
                      'rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em]',
                      category === item.slug ? 'bg-primary text-white' : 'bg-primary-50 text-primary-900/60',
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-primary-500">{t('productsPage.priceRange')}</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={minPrice}
                  onChange={(event) => updateFilters({ minPrice: event.target.value || undefined })}
                  placeholder={t('productsPage.min')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                />
                <input
                  value={maxPrice}
                  onChange={(event) => updateFilters({ maxPrice: event.target.value || undefined })}
                  placeholder={t('productsPage.max')}
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
                />
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-primary-500">{t('productsPage.store')}</p>
              <div className="rounded-[1.5rem] border border-primary-100 bg-primary-50 p-4">
                <p className="text-sm font-bold text-primary-900">{selectedStore?.name || t('productsPage.allStores')}</p>
                <p className="mt-1 text-sm font-medium text-primary-900/55">
                  {t('productsPage.storeHint')}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="space-y-5">
          <div className="surface-card p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-900/30" size={18} />
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    updateFilters({ search: event.target.value || undefined });
                  }}
                  placeholder={t('productsPage.searchPlaceholder')}
                  className="w-full rounded-[1.6rem] border border-primary-100 bg-primary-50 py-3 pl-11 pr-4 font-semibold text-primary-900"
                />

                {debouncedSearch && searchSuggestions.length > 0 && (
                  <div className="surface-card absolute left-0 right-0 top-[calc(100%+12px)] z-20 p-3">
                    {searchSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        onClick={() => (window.location.href = `/product/${suggestion.slug}`)}
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition hover:bg-primary-50"
                      >
                        <div>
                          <p className="text-sm font-black text-primary-900">{suggestion.name}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-primary-500">
                            {suggestion.category?.name || t('productsPage.searchProduct')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <select
                  value={sort}
                  onChange={(event) => updateFilters({ sort: event.target.value })}
                  className="appearance-none rounded-2xl border border-primary-100 bg-white py-3 pl-4 pr-10 text-sm font-bold text-primary-900"
                >
                  <option value="newest">{t('productsPage.sortNewest')}</option>
                  <option value="price_asc">{t('productsPage.sortPriceAsc')}</option>
                  <option value="price_desc">{t('productsPage.sortPriceDesc')}</option>
                  <option value="rating">{t('productsPage.sortRating')}</option>
                  <option value="popular">{t('productsPage.sortPopular')}</option>
                  <option value="name">{t('productsPage.sortName')}</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary-900/40" />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-[340px] animate-pulse rounded-[2rem] bg-primary-50" />
              ))}
            </div>
          ) : activeProducts.length ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {activeProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {pagination && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => updateFilters({ page: String(pagination.page - 1) })}
                    className="rounded-full border border-primary-100 bg-white px-5 py-3 text-sm font-bold text-primary-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                      {t('common.previous')}
                  </button>
                  <span className="text-sm font-black uppercase tracking-[0.18em] text-primary-500">
                      {t('productsPage.pageOf', { page: pagination.page, total: pagination.totalPages })}
                  </span>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => updateFilters({ page: String(pagination.page + 1) })}
                    className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                      {t('common.next')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="surface-card p-10 text-center">
                <h3 className="text-2xl font-black text-primary-900">{t('productsPage.noMatchesTitle')}</h3>
              <p className="mt-3 text-sm font-medium text-primary-900/60">
                  {t('productsPage.noMatchesDescription')}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Products;
