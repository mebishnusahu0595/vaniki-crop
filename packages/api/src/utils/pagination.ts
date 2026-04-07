/**
 * Standardized pagination response interface.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Creates a standardized paginated response object.
 *
 * @param data - Array of documents for the current page
 * @param total - Total number of matching documents
 * @param page - Current page number (1-indexed)
 * @param limit - Number of items per page
 * @returns Structured pagination response
 *
 * @example
 * const products = await Product.find().skip(skip).limit(limit);
 * const total = await Product.countDocuments();
 * return createPaginationResponse(products, total, 1, 20);
 */
export function createPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Parses page and limit from query parameters with defaults and bounds.
 *
 * @param query - Express request query object
 * @returns Parsed { page, limit, skip } values
 */
export function parsePagination(query: Record<string, any>): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
