import type { Address, Product, Store } from '../types/storefront';
import { resolveMediaUrl } from './media';

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

export function buildStoreDirectionsUrl(store: Pick<Store, 'location' | 'address'>) {
  const coordinates = store.location?.coordinates;
  if (coordinates && coordinates.length === 2) {
    // GeoJSON stores coordinates as [longitude, latitude]
    return `https://www.google.com/maps/search/?api=1&query=${coordinates[1]},${coordinates[0]}`;
  }

  const query = encodeURIComponent(formatStoreAddress(store.address) || '');
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function getPrimaryImage(product?: Product | null, fallbackUrl?: string) {
  const primary = product?.images?.find((image) => image.isPrimary) || product?.images?.[0];
  if (primary?.url) return resolveMediaUrl(primary.url, primary.publicId);
  if (fallbackUrl) return resolveMediaUrl(fallbackUrl);
  return 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=80';
}

export function getDefaultVariant(product?: Product | null) {
  if (!product?.variants || product.variants.length === 0) return null;
  return product.variants[0];
}

export function getDiscountPercent(price?: number, mrp?: number) {
  if (!price || !mrp || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
