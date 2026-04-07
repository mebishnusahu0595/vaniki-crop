import React, { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Link } from 'react-router-dom';
import { ChevronRight, Leaf } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Category } from '../../types/storefront';

interface CategoryStripProps {
  categories: Category[];
}

gsap.registerPlugin(ScrollTrigger, useGSAP);

const CategoryStrip: React.FC<CategoryStripProps> = ({ categories }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const safeCategories = categories.length ? categories : [];

  useGSAP(
    () => {
      gsap.from('.category-circle', {
        x: -60,
        opacity: 0,
        stagger: 0.15,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.category-section',
          start: 'top 80%',
        },
      });
    },
    {
      scope: containerRef,
      dependencies: [safeCategories.length],
      revertOnUpdate: true,
    },
  );

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
                  <img src={category.image.url} alt={category.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <Leaf size={24} className="text-primary" />
                )}
              </div>
              <span className="mt-3 text-center text-xs font-black uppercase tracking-[0.16em] text-primary-900/70 group-hover:text-primary">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryStrip;
