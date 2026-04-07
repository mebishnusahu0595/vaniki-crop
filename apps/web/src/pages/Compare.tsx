import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCompareStore } from '../store/useCompareStore';
import { formatPrice } from '../utils/format';
import OptimizedImage from '../components/common/OptimizedImage';

const Compare: React.FC = () => {
  const { t } = useTranslation();
  const comparedProducts = useCompareStore((state) => state.products);
  const toggleProduct = useCompareStore((state) => state.toggleProduct);
  const clearAll = useCompareStore((state) => state.clearAll);

  if (!comparedProducts.length) {
    return (
      <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-10 sm:px-6">
        <div className="surface-card max-w-2xl p-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-primary">
            <Scale size={30} />
          </div>
          <h1 className="mt-5 text-3xl font-black text-primary-900">{t('comparePage.emptyTitle')}</h1>
          <p className="mt-3 text-sm font-medium text-primary-900/65">
            {t('comparePage.emptyDescription')}
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white"
          >
            {t('comparePage.browseProducts')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <section className="surface-card overflow-hidden bg-[linear-gradient(135deg,_rgba(20,61,46,1),_rgba(8,32,24,0.95))] px-6 py-8 text-white sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="section-kicker text-primary-200">{t('comparePage.compare')}</p>
            <h1 className="mt-3 font-heading text-5xl">{t('comparePage.title')}</h1>
            <p className="mt-3 text-sm font-medium text-white/75">
              {t('comparePage.description')}
            </p>
          </div>
          <button
            onClick={clearAll}
            className="rounded-full border border-white/25 bg-white/10 px-5 py-2 text-xs font-black uppercase tracking-[0.2em] text-white"
          >
            {t('comparePage.clearAll')}
          </button>
        </div>
      </section>

      <section className="mt-8 overflow-x-auto">
        <div className="min-w-[860px] rounded-[1.8rem] border border-primary-100 bg-white">
          <div className="grid grid-cols-[220px_repeat(3,minmax(0,1fr))] border-b border-primary-100">
            <div className="p-5 text-xs font-black uppercase tracking-[0.2em] text-primary-500">{t('comparePage.field')}</div>
            {[0, 1, 2].map((index) => {
              const product = comparedProducts[index];
              return (
                <div key={index} className="border-l border-primary-100 p-5">
                  {product ? (
                    <div>
                      <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-2xl bg-primary-50">
                        {product.images[0]?.url ? (
                          <OptimizedImage
                            src={product.images[0].url}
                            alt={product.name}
                            widthHint={480}
                            heightHint={360}
                            loading="lazy"
                            containerClassName="h-full w-full"
                            className="h-full w-full object-contain"
                          />
                        ) : null}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/product/${product.slug}`} className="line-clamp-2 text-sm font-black text-primary-900">
                          {product.name}
                        </Link>
                        <button
                          onClick={() => toggleProduct(product)}
                          className="rounded-lg border border-primary-100 p-1.5 text-primary-500"
                          aria-label={t('comparePage.removeFromCompare')}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-28 items-center justify-center rounded-2xl border border-dashed border-primary-100 text-xs font-bold uppercase tracking-[0.18em] text-primary-400">
                      {t('comparePage.emptySlot')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <CompareRow
            label={t('comparePage.category')}
            values={comparedProducts.map((product) => product.category?.name || '-')}
          />
          <CompareRow
            label={t('comparePage.startingPrice')}
            values={comparedProducts.map((product) => {
              const firstVariant = product.variants[0];
              return firstVariant ? formatPrice(firstVariant.mrp, firstVariant.price).priceText : '-';
            })}
          />
          <CompareRow
            label={t('comparePage.topVariant')}
            values={comparedProducts.map((product) => product.variants[0]?.label || '-')}
          />
          <CompareRow
            label={t('comparePage.stock')}
            values={comparedProducts.map((product) => {
              const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
              return stock > 0 ? t('comparePage.units', { count: stock }) : t('comparePage.outOfStock');
            })}
          />
          <CompareRow
            label={t('comparePage.averageRating')}
            values={comparedProducts.map((product) =>
              product.averageRating ? `${product.averageRating.toFixed(1)} / 5 (${product.reviewCount || 0})` : t('comparePage.noRatings'),
            )}
          />
        </div>
      </section>
    </div>
  );
};

const CompareRow: React.FC<{ label: string; values: string[] }> = ({ label, values }) => {
  return (
    <div className="grid grid-cols-[220px_repeat(3,minmax(0,1fr))] border-b border-primary-100 last:border-none">
      <div className="bg-primary-50/60 p-5 text-xs font-black uppercase tracking-[0.2em] text-primary-500">{label}</div>
      {[0, 1, 2].map((index) => (
        <div key={`${label}-${index}`} className="border-l border-primary-100 p-5 text-sm font-semibold text-primary-900/75">
          {values[index] || '-'}
        </div>
      ))}
    </div>
  );
};

export default Compare;
