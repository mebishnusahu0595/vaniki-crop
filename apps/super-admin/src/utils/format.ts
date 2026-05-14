import type { Address } from '../types/admin';

export const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAddress(address?: Partial<Address> | null) {
  if (!address) return '-';
  return [address.street, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');
}

export function parseVariantLabel(label: string) {
  const match = label.match(/^(\d+(?:\.\d+)?)\s*(ml|liter|litre|gm|gram|kg|kilogram|packet|piece|l|g|pkt|pc|pcs)?$/i);
  if (!match) {
    return { quantity: '', unit: 'piece' };
  }

  const unit = (match[2] || 'piece').toLowerCase();
  return {
    quantity: match[1],
    unit:
      unit === 'l' || unit === 'liter' || unit === 'litre'
        ? 'Liter'
        : unit === 'g' || unit === 'gm' || unit === 'gram'
          ? 'gm'
          : unit === 'kg' || unit === 'kilogram'
            ? 'KG'
            : unit === 'ml'
              ? 'ml'
              : unit === 'packet' || unit === 'pkt'
                ? 'Packet'
                : unit === 'piece' || unit === 'pc' || unit === 'pcs'
                  ? 'piece'
                  : 'Liter',
  };
}

export function buildVariantLabel(quantity: string, unit: string) {
  return `${quantity} ${unit}`.trim();
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
