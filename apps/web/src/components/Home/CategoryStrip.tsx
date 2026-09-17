import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Leaf } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Category } from '../../types/storefront';
import { resolveMediaUrl } from '../../utils/media';

interface CategoryStripProps {
  categories: Category[];
}

const CATEGORY_MAP_HI: Record<string, string> = {
  insecticides: 'कीटनाशक',
  insecticide: 'कीटनाशक',
  herbicides: 'खरपतवार नाशक',
  herbicide: 'खरपतवार नाशक',
  weedicides: 'खरपतवार नाशक',
  fungicides: 'फफूंदनाशक',
  fungicide: 'फफूंदनाशक',
  'bio pesticides': 'जैविक कीटनाशक',
  'bio pesticide': 'जैविक कीटनाशक',
  'bio-pesticides': 'जैविक कीटनाशक',
  biopesticides: 'जैविक कीटनाशक',
  'plant-growth-promoters': 'पौध वृद्धि टॉनिक',
  pgp: 'पौध वृद्धि टॉनिक',
  tonics: 'फसल टॉनिक',
  seeds: 'उन्नत बीज',
  fertilizers: 'खाद एवं पोषण',
  'crop care': 'फसल सुरक्षा',
};

const getCategoryDisplayName = (name: string, isHindi: boolean): string => {
  if (!isHindi) return name;
  const key = name.toLowerCase().trim();
  if (CATEGORY_MAP_HI[key]) return CATEGORY_MAP_HI[key];
  for (const [k, v] of Object.entries(CATEGORY_MAP_HI)) {
    if (key.includes(k)) return v;
  }
  return name;
};

const CategoryStrip: React.FC<CategoryStripProps> = ({ categories }) => {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.resolvedLanguage?.startsWith('hi') ?? false;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const safeCategories = categories.length ? categories : [];


  return (
    <section className="category-section bg-white py-10 sm:py-14">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="section-kicker mb-2">{t('home.categoryKicker')}</p>
            <h2 className="section-title">{t('home.categoryTitle')}</h2>
          </div>
          <Link
            to="/categories"
            className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.2em] text-primary transition hover:text-primary-600"
          >
            <span>{t('home.viewAll')}</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div ref={containerRef} className="no-scrollbar flex gap-4 overflow-x-auto pb-3">
          {safeCategories.map((category) => (
            <Link
              key={category.id}
              to={`/products?category=${category.slug}`}
              className="category-circle group flex min-w-[92px] flex-col items-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,_rgba(82,183,136,0.25),_rgba(45,106,79,0.1))] ring-1 ring-primary-100 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                {category.image?.url ? (
                  <img
                    src={resolveMediaUrl(category.image.url, category.image.publicId)}
                    alt={category.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <Leaf size={24} className="text-primary" />
                )}
              </div>
              <span className="mt-3 text-center text-xs font-black uppercase tracking-[0.16em] text-primary-900/70 group-hover:text-primary">
                {getCategoryDisplayName(category.name, isHindi)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryStrip;
