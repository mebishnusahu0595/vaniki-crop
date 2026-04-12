import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Testimonial } from '../../types/storefront';
import ReviewStars from '../ui/ReviewStars';
import { resolveMediaUrl } from '../../utils/media';

interface TestimonialsProps {
  testimonials: Testimonial[];
}

const Testimonials: React.FC<TestimonialsProps> = ({ testimonials }) => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });

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
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const updateViewportMode = () => setIsDesktop(mediaQuery.matches);
    updateViewportMode();

    mediaQuery.addEventListener('change', updateViewportMode);

    return () => {
      mediaQuery.removeEventListener('change', updateViewportMode);
    };
  }, []);

  useEffect(() => {
    if (isDesktop || items.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isDesktop, items.length]);

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
                opacity: index === activeIndex || isDesktop ? 1 : 0.4,
              }}
              className={`surface-card p-6 ${index !== activeIndex ? 'md:opacity-100' : ''}`}
            >
              <ReviewStars rating={testimonial.rating} />
              <p className="mt-5 text-base font-medium leading-7 text-primary-900/70">
                "{testimonial.message}"
              </p>
              <div className="mt-6 border-t border-primary-100 pt-4">
                <div className="flex items-center gap-3">
                  {testimonial.avatar?.url ? (
                    <img
                      src={resolveMediaUrl(testimonial.avatar.url, testimonial.avatar.publicId)}
                      alt={testimonial.name}
                      className="h-10 w-10 rounded-full border border-primary-100 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-[11px] font-black uppercase text-primary-700">
                      {testimonial.name.slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-black text-primary-900">{testimonial.name}</p>
                    {testimonial.designation && (
                      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-primary-500">
                        {testimonial.designation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
