import i18n from '../i18n';

/**
 * Formats pricing data for display.
 */
export function formatPrice(mrp: number, price: number) {
  const savings = mrp - price;
  const hasSavings = savings > 0;
  
  const discountPercent = hasSavings 
    ? Math.round((savings / mrp) * 100) 
    : 0;

  return {
    mrpText: hasSavings ? `₹${mrp.toLocaleString('en-IN')}` : null,
    priceText: `₹${price.toLocaleString('en-IN')}`,
    savings,
    discountPercent,
    fullSavingsLabel: hasSavings 
      ? i18n.t('pricing.saveAmountLabel', {
          amount: savings.toLocaleString('en-IN'),
          percent: discountPercent,
        })
      : null
  };
}

export const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatStoreAddress(
  address?:
    | {
        street?: string;
        city?: string;
        state?: string;
        pincode?: string;
      }
    | null,
) {
  if (!address) return i18n.t('storeSelector.chooseStore');

  return [address.street, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');
}

export function getDiscountPercent(mrp: number, price: number) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function formatCompactNumber(value = 0) {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
