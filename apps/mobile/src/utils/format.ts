import type { Address, Product } from '../types/storefront';

export const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatStoreAddress(address?: Partial<Address> | null) {
  if (!address) return '';

  return [address.street, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');
}

export function getPrimaryImage(product?: Product | null) {
  return product?.images?.[0]?.url || 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=80';
}

export function getDefaultVariant(product?: Product | null) {
  return product?.variants?.[0] || null;
}

export function getDiscountPercent(price?: number, mrp?: number) {
  if (!price || !mrp || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
