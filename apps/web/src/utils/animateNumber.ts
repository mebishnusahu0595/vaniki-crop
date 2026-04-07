import gsap from 'gsap';

export function animateNumber(target: HTMLElement, endValue: number, duration = 2, suffix = '') {
  const counter = { value: 0 };

  gsap.to(counter, {
    value: endValue,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      target.textContent = `${Math.ceil(counter.value).toLocaleString('en-IN')}${suffix}`;
    },
  });
}
