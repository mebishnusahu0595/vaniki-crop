/** Standard API success response wrapper */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: string;
  stack?: string;
}

/** Pagination metadata returned by list endpoints */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}
