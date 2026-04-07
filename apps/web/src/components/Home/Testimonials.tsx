import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Testimonial } from '../../types/storefront';
import ReviewStars from '../ui/ReviewStars';

interface TestimonialsProps {
  testimonials: Testimonial[];
}

const Testimonials: React.FC<TestimonialsProps> = ({ testimonials }) => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);

  const fallbackTestimonials: Testimonial[] = [
    {
      id: 't-1',
      name: 'Ramesh Patel',
      designation: t('home.fallbackDesignation1'),
      message: t('home.fallbackMessage1'),
      rating: 5,
    },
    {
      id: 't-2',
      name: 'Suresh Yadav',
      designation: t('home.fallbackDesignation2'),
      message: t('home.fallbackMessage2'),
      rating: 5,
    },
    {
      id: 't-3',
      name: 'Mahesh Singh',
      designation: t('home.fallbackDesignation3'),
      message: t('home.fallbackMessage3'),
      rating: 5,
    },
  ];

  const items = testimonials.length ? testimonials : fallbackTestimonials;

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile || items.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [items.length]);

  return (
    <section className="bg-white py-14 sm:py-18">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <p className="section-kicker mb-2">{t('home.testimonialsKicker')}</p>
          <h2 className="section-title">{t('home.testimonialsTitle')}</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {items.map((testimonial, index) => (
            <motion.article
              key={testimonial.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              animate={{
                opacity: index === activeIndex || window.matchMedia('(min-width: 768px)').matches ? 1 : 0.4,
              }}
              className={`surface-card p-6 ${index !== activeIndex ? 'md:opacity-100' : ''}`}
            >
              <ReviewStars rating={testimonial.rating} />
              <p className="mt-5 text-base font-medium leading-7 text-primary-900/70">
                "{testimonial.message}"
              </p>
              <div className="mt-6 border-t border-primary-100 pt-4">
                <p className="text-sm font-black text-primary-900">{testimonial.name}</p>
                {testimonial.designation && (
                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-primary-500">
                    {testimonial.designation}
                  </p>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
