import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface RevealOptions {
  y?: number;
  scale?: number;
  start?: string;
}

export function useGsapReveal<T extends HTMLElement>(options?: RevealOptions) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!ref.current) return undefined;

    const element = ref.current;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        element,
        {
          opacity: 0,
          y: options?.y ?? 26,
          scale: options?.scale ?? 0.98,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: options?.start ?? 'top 86%',
          },
        },
      );
    }, element);

    return () => ctx.revert();
  }, [options?.scale, options?.start, options?.y]);

  return ref;
}
