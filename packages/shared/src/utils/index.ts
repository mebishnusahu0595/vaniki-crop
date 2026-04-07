/**
 * Formats a number as Indian Rupees (₹).
 * @param amount - The numeric amount to format
 * @returns Formatted currency string (e.g., "₹1,299.00")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generates a URL-friendly slug from a string.
 * @param text - The input string to slugify
 * @returns Lowercase hyphenated slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Calculates the discount percentage between MRP and selling price.
 * @param mrp - Maximum Retail Price
 * @param price - Selling price
 * @returns Discount percentage (0–100)
 */
export function calculateDiscount(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/**
 * Truncates a string to a maximum length and appends ellipsis.
 * @param text - String to truncate
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns Truncated string
 */
export function truncateText(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '…';
}

/**
 * Formats a date string to a human-readable Indian date format.
 * @param dateStr - ISO date string
 * @returns Formatted date (e.g., "5 Apr 2026")
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
