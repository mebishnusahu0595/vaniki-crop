import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCategories } from '../hooks/useProducts';
import { resolveMediaUrl } from '../utils/media';

const Categories: React.FC = () => {
  const { t } = useTranslation();
  const { data: categories = [], isLoading } = useCategories();

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <section className="surface-card overflow-hidden bg-[linear-gradient(135deg,_rgba(20,61,46,1),_rgba(8,32,24,0.96))] px-6 py-8 text-white sm:px-8">
        <p className="section-kicker text-primary-200">{t('nav.categories')}</p>
        <h1 className="mt-3 font-heading text-5xl">{t('home.categoryTitle')}</h1>
      </section>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? [...Array(8)].map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-[2rem] bg-primary-50" />
            ))
          : categories.map((category) => (
              <Link
                key={category.id}
                to={`/products?category=${category.slug}`}
                className="surface-card group flex min-h-[220px] flex-col justify-between p-6 transition hover:-translate-y-1"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary">
                  {category.image?.url ? (
                    <img
                      src={resolveMediaUrl(category.image.url, category.image.publicId)}
                      alt={category.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <Leaf size={24} />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-primary-900">{category.name}</h2>
                  <p className="mt-3 text-sm font-medium leading-6 text-primary-900/60">
                    {category.description || t('productsPage.description')}
                  </p>
                </div>
              </Link>
            ))}
      </div>
    </div>
  );
};

export default Categories;
