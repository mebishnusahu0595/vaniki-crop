import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../types/storefront';
import ProductCard from '../shared/ProductCard';

interface BestSellersProps {
  products: Product[];
}

const tabs = [
  { labelKey: 'home.tabInsecticides', slug: 'insecticides' },
  { labelKey: 'home.tabHerbicides', slug: 'herbicides' },
  { labelKey: 'home.tabFungicides', slug: 'fungicides' },
];

const BestSellers: React.FC<BestSellersProps> = ({ products }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(tabs[0].slug);

  const filteredProducts = useMemo(() => {
    const matches = products.filter((product) => product.category?.slug === activeTab);
    return matches.length ? matches : products.slice(0, 8);
  }, [activeTab, products]);

  return (
    <section className="bg-primary-50/35 py-14 sm:py-18">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker mb-2">{t('home.bestSellersKicker')}</p>
            <h2 className="section-title">{t('home.bestSellersTitle')}</h2>
          </div>

          <div className="flex flex-wrap gap-2 rounded-full bg-white p-1.5 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.slug}
                onClick={() => setActiveTab(tab.slug)}
                className={`relative rounded-full px-5 py-2.5 text-sm font-black uppercase tracking-[0.18em] transition ${
                  activeTab === tab.slug ? 'text-white' : 'text-primary-900/60'
                }`}
              >
                {activeTab === tab.slug && (
                  <motion.span
                    layoutId="best-seller-tab"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.55 }}
                  />
                )}
                <span className="relative z-10">{t(tab.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
          >
            {filteredProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default BestSellers;
