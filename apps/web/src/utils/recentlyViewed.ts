import type { Product } from '../types/storefront';

const STORAGE_KEY = 'vaniki-recently-viewed';
const MAX_ITEMS = 10;

export const getRecentlyViewedProducts = (): Product[] => {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as Product[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addRecentlyViewedProduct = (product: Product): Product[] => {
  if (typeof window === 'undefined') return [];

  const existing = getRecentlyViewedProducts().filter((item) => item.id !== product.id);
  const next = [product, ...existing].slice(0, MAX_ITEMS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};
