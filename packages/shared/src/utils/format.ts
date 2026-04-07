/**
 * Formats pricing data for display on product cards and order summaries.
 * Calculates savings and discount percentage from MRP and Selling Price.
 * 
 * @param mrp - Maximum Retail Price (Original)
 * @param price - Current Selling Price (Discounted)
 * @returns Object with formatted strings and calculation metadata
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
    savingsText: hasSavings ? `Save ₹${savings.toLocaleString('en-IN')}` : null,
    savings,
    discountPercent,
    discountText: hasSavings ? `${discountPercent}% off` : null,
    fullSavingsLabel: hasSavings 
      ? `(Save ₹${savings.toLocaleString('en-IN')} · ${discountPercent}% off)` 
      : null
  };
}

/**
 * Currency formatter for Indian Rupees.
 */
export const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
