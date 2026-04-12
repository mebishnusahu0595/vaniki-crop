import React, { useEffect, useRef, useState } from 'react';
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
  const mobileTrackRef = useRef<HTMLDivElement | null>(null);
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

  const scrollToTestimonial = (index: number) => {
    if (isDesktop) return;
    const track = mobileTrackRef.current;
    if (!track) return;

    const targetCard = track.children.item(index) as HTMLElement | null;
    if (!targetCard) return;

    track.scrollTo({
      left: Math.max(0, targetCard.offsetLeft - 16),
      behavior: 'smooth',
    });
  };

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
    }, 3500);

    return () => window.clearInterval(timer);
  }, [isDesktop, items.length]);

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(0);
      return;
    }

    scrollToTestimonial(activeIndex);
  }, [activeIndex, items.length, isDesktop]);

  const renderCard = (testimonial: Testimonial, index: number) => (
    <motion.article
      key={testimonial.id}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      animate={{
        opacity: index === activeIndex || isDesktop ? 1 : 0.45,
      }}
      className="surface-card w-[82%] shrink-0 snap-start p-5 md:w-auto md:p-6"
    >
      <ReviewStars rating={testimonial.rating} />
      <p className="mt-4 text-sm font-medium leading-7 text-primary-900/70 md:mt-5 md:text-base">
        "{testimonial.message}"
      </p>
      <div className="mt-5 border-t border-primary-100 pt-4 md:mt-6">
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
  );

  return (
    <section className="bg-white py-14 sm:py-18">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <p className="section-kicker mb-2">{t('home.testimonialsKicker')}</p>
          <h2 className="section-title">{t('home.testimonialsTitle')}</h2>
        </div>

        {isDesktop ? (
          <div className="grid gap-5 md:grid-cols-3">
            {items.map((testimonial, index) => renderCard(testimonial, index))}
          </div>
        ) : (
          <>
            <div ref={mobileTrackRef} className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
              {items.map((testimonial, index) => renderCard(testimonial, index))}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setActiveIndex(index)}
                  className={`h-2 rounded-full transition ${activeIndex === index ? 'w-7 bg-primary' : 'w-2 bg-primary-200'}`}
                  aria-label={`Show testimonial ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default Testimonials;
