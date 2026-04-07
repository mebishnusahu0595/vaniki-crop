/** Vaniki Crop brand color palette */
export const COLORS = {
  /** Primary green */
  PRIMARY: '#2D6A4F',
  /** Accent green */
  ACCENT: '#52B788',
  /** Background white */
  WHITE: '#FFFFFF',
  /** Off-white background */
  OFF_WHITE: '#F8FAF9',
  /** Text color */
  TEXT_DARK: '#1B1B1B',
  /** Muted text */
  TEXT_MUTED: '#6B7280',
  /** Error red */
  ERROR: '#DC2626',
  /** Warning amber */
  WARNING: '#F59E0B',
  /** Success green */
  SUCCESS: '#10B981',
} as const;

/** Product category enumeration */
export const PRODUCT_CATEGORIES = [
  'Insecticides',
  'Herbicides',
  'Fungicides',
  'Bio Pesticides',
  'Plant Growth Regulators',
  'Seeds',
  'Fertilizers',
  'Equipment',
  'Others',
] as const;

/** Order status labels for UI display */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  placed: 'Order Placed',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** API base URL path; frontend apps should resolve host via environment */
export const API_BASE_URL = '/api';

/** Pagination defaults */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 12,
  ADMIN_LIMIT: 20,
} as const;
