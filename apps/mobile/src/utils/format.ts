import type { Address, Product } from '../types/storefront';
import { API_BASE_URL } from '../config/api';

const PLACEHOLDER_ADDRESS_VALUES = new Set(['pending', 'na', 'n/a', 'none', 'null', 'undefined']);

export const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatStoreAddress(address?: Partial<Address> | null) {
  if (!address) return '';

  return [address.street, address.city, address.state, address.pincode]
    .filter((value) => {
      const normalized = (value || '').trim().toLowerCase();
      return Boolean(normalized) && !PLACEHOLDER_ADDRESS_VALUES.has(normalized) && normalized !== '000000';
    })
    .join(', ');
}

export function getPrimaryImage(product?: Product | null) {
  const url = product?.images?.[0]?.url;
  if (!url) return 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=80';
  if (url.startsWith('http')) return url;
  const baseUrl = API_BASE_URL.replace(/\/api$/, '');
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function getDefaultVariant(product?: Product | null) {
  return product?.variants?.[0] || null;
}

export function getDiscountPercent(price?: number, mrp?: number) {
  if (!price || !mrp || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
