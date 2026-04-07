import { useQuery } from '@tanstack/react-query';
import { storefrontApi } from '../utils/api';

export type ProductQueryParams = Record<string, string | number | undefined> & {
  category?: string;
  store?: string;
  storeId?: string;
  search?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  page?: string | number;
  limit?: string | number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'rating' | 'name';
  isFeatured?: string;
};

export const useProducts = (params: ProductQueryParams) => {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => storefrontApi.products(params),
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: storefrontApi.categories,
  });
};

export const useProductDetail = (slug: string) => {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => storefrontApi.productDetail(slug),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });
};

export const useProductSearch = (query: string, storeId?: string) => {
  return useQuery({
    queryKey: ['product-search', query, storeId],
    queryFn: () => storefrontApi.searchProducts(query, storeId),
    enabled: !!query,
  });
};
