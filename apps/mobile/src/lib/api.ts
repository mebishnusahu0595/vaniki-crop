import { useAuthStore } from '../store/useAuthStore';
import { useStoreStore } from '../store/useStoreStore';
import { API_BASE_URL } from '../config/api';
import { resolveMediaUrl } from '../utils/media';
import type {
  AuthUser,
  Category,
  CouponValidation,
  HomepageData,
  Order,
  OrderConfirmationResponse,
  OrderInitiationResponse,
  PaginationMeta,
  Product,
  ProductListResponse,
  SearchResult,
  ServiceMode,
  Store,
} from '../types/storefront';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

const REQUEST_TIMEOUT_MS = 25_000;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
  pagination?: PaginationMeta;
}

type VariantLike = Product['variants'][number] & {
  _id?: string;
};

type ReviewLike = NonNullable<Product['reviews']>[number] & {
  _id?: string;
};

type ProductLike = Product & {
  _id?: string;
  variants?: VariantLike[];
  reviews?: ReviewLike[];
  category?: CategoryLike;
};

type AuthUserLike = AuthUser & {
  _id?: string;
  wishlist?: Array<string | ProductLike>;
};

type CategoryLike = Category & {
  _id?: string;
};

const normalizeVariant = (variant: VariantLike, index: number): Product['variants'][number] => ({
  ...variant,
  id: variant.id || variant._id || variant.sku || `${variant.label || 'variant'}-${index}`,
});

const normalizeImageAsset = <T extends { url: string; publicId?: string; mobileUrl?: string }>(image: T): T => ({
  ...image,
  url: resolveMediaUrl(image.url, image.publicId),
  mobileUrl: image.mobileUrl ? resolveMediaUrl(image.mobileUrl, image.publicId) : image.mobileUrl,
});

const normalizeCategory = <T extends CategoryLike | null | undefined>(category: T): T => {
  if (!category) return category;

  return {
    ...category,
    id: category.id || category._id || category.slug,
    image: category.image ? normalizeImageAsset(category.image) : category.image,
  } as T;
};

const normalizeProduct = <T extends ProductLike | null | undefined>(product: T): T => {
  if (!product) return product;

  const normalizedReviews = (product.reviews || []).map((review, index) => {
    const reviewLike = review as ReviewLike;
    return {
      ...reviewLike,
      id: reviewLike.id || reviewLike._id || `review-${index}`,
    };
  });

  const variants = (product.variants || []).map((variant, index) => normalizeVariant(variant, index));

  return {
    ...product,
    id: product.id || product._id || product.slug,
    images: (product.images || []).map((image) => normalizeImageAsset(image)),
    category: normalizeCategory(product.category),
    variants,
    reviews: normalizedReviews,
  } as T;
};

const normalizeProducts = (products: ProductLike[] = []) => products.map((product) => normalizeProduct(product)!);

const normalizeAuthUser = (user: AuthUserLike): AuthUser => ({
  ...user,
  id: user.id || user._id || '',
  wishlist: (user.wishlist || []).map((entry) =>
    typeof entry === 'string' ? entry : normalizeProduct(entry as ProductLike)!,
  ),
});

const normalizeHomepageData = (homepage: HomepageData): HomepageData => ({
  ...homepage,
  saleProducts: normalizeProducts(homepage.saleProducts as ProductLike[]),
  bestSellers: normalizeProducts(homepage.bestSellers as ProductLike[]),
  featuredCategories: (homepage.featuredCategories || []).map((category) =>
    normalizeCategory(category as CategoryLike)!,
  ),
  banners: (homepage.banners || []).map((banner) => ({
    ...banner,
    image: normalizeImageAsset(banner.image),
    linkedProducts: (banner.linkedProducts || []).map((entry) => ({
      ...entry,
      productId: normalizeProduct(entry.productId as ProductLike)!,
    })),
  })),
  testimonials: (homepage.testimonials || []).map((testimonial) => ({
    ...testimonial,
    avatar: testimonial.avatar ? normalizeImageAsset(testimonial.avatar) : testimonial.avatar,
  })),
});

async function request<T>(path: string, options: RequestOptions = {}) {
  const token = useAuthStore.getState().token;
  const storeId = useStoreStore.getState().selectedStore?.id;
  const url = new URL(`${API_BASE_URL}${path}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  try {
    const response = await fetch(url.toString(), {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(storeId ? { 'X-Store-Id': storeId } : {}),
        ...(options.headers || {}),
      },
    });

    const json = (await response.json().catch(() => ({}))) as ApiResponse<T> & { error?: string };
    if (!response.ok) {
      if (response.status === 401) {
        useAuthStore.getState().logout();
      }
      throw new Error(json.error || json.message || 'Something went wrong.');
    }

    return json;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const storefrontApi = {
  homepage: async (storeId?: string) => {
    const response = await request<HomepageData>('/homepage', {
      params: storeId ? { storeId } : undefined,
    });
    return normalizeHomepageData(response.data);
  },
  categories: async () => {
    const response = await request<Category[]>('/categories');
    return (response.data || []).map((category) => normalizeCategory(category as CategoryLike)!);
  },
  products: async (params?: Record<string, string | number | undefined>) => {
    const response = await request<Product[]>('/products', { params });
    return {
      data: normalizeProducts(response.data as ProductLike[]),
      pagination: response.pagination!,
    } satisfies ProductListResponse;
  },
  searchProducts: async (query: string, storeId?: string) => {
    const response = await request<Product[]>('/products/search', {
      params: { q: query, storeId, limit: 12 },
    });
    return {
      data: normalizeProducts(response.data as ProductLike[]),
      total: response.total || response.data.length,
    } satisfies SearchResult;
  },
  productDetail: async (slug: string) => {
    const response = await request<Product>(`/products/${slug}`);
    return normalizeProduct(response.data as ProductLike)!;
  },
  stores: async () => {
    const response = await request<Store[]>('/stores');
    return response.data;
  },
  validateCoupon: async (payload: { code: string; storeId: string; cartTotal: number }) => {
    const response = await request<CouponValidation>('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  initiateOrder: async (payload: Record<string, unknown>) => {
    const response = await request<OrderInitiationResponse>('/orders/initiate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  confirmOrder: async (payload: Record<string, unknown>) => {
    const response = await request<OrderConfirmationResponse>('/orders/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  placeCodOrder: async (payload: Record<string, unknown>) => {
    const response = await request<OrderConfirmationResponse>('/orders/place-cod', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  orders: async (page = 1) => {
    const response = await request<Order[]>('/orders/my', {
      params: { page, limit: 10 },
    });
    return {
      data: response.data,
      pagination: response.pagination!,
    };
  },
  orderDetail: async (id: string) => {
    const response = await request<Order>(`/orders/${id}`);
    return response.data;
  },
  submitReview: async (payload: { productId: string; rating: number; comment?: string }) => {
    return request<unknown>('/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  contact: async (payload: { name: string; email: string; mobile?: string; subject: string; message: string }) => {
    return request<{ success: boolean; message: string }>('/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  login: async (payload: { mobile: string; password: string }) => {
    const response = await request<{ user: AuthUser; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      ...response.data,
      user: normalizeAuthUser(response.data.user as AuthUserLike),
    };
  },
  signup: async (payload: { name: string; email?: string; mobile: string; password: string; referralCode?: string }) => {
    const response = await request<{ user: AuthUser; accessToken: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      ...response.data,
      user: normalizeAuthUser(response.data.user as AuthUserLike),
    };
  },
  me: async () => {
    const response = await request<AuthUser>('/auth/me');
    return normalizeAuthUser(response.data as AuthUserLike);
  },
  updateMe: async (payload: Partial<AuthUser> & { savedAddress?: AuthUser['savedAddress'] }) => {
    const response = await request<AuthUser>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return normalizeAuthUser(response.data as AuthUserLike);
  },
  changePassword: async (payload: { currentPassword: string; newPassword: string }) => {
    return request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  updateServiceMode: async (serviceMode: ServiceMode) => {
    const response = await request<AuthUser>('/auth/service-mode', {
      method: 'PATCH',
      body: JSON.stringify({ serviceMode }),
    });
    return normalizeAuthUser(response.data as AuthUserLike);
  },
  toggleWishlist: async (productId: string) => {
    const response = await request<AuthUser>('/auth/wishlist/toggle', {
      method: 'PATCH',
      body: JSON.stringify({ productId }),
    });
    return normalizeAuthUser(response.data as AuthUserLike);
  },
  updateSelectedStore: async (storeId: string) => {
    const response = await request<AuthUser>('/auth/selected-store', {
      method: 'PATCH',
      body: JSON.stringify({ storeId }),
    });
    return normalizeAuthUser(response.data as AuthUserLike);
  },
  updatePushToken: async (pushToken: string) => {
    const response = await request<AuthUser>('/auth/push-token', {
      method: 'PATCH',
      body: JSON.stringify({ pushToken }),
    });
    return normalizeAuthUser(response.data as AuthUserLike);
  },
  selectStore: async (storeId: string) => {
    return request<{ success: boolean; message: string }>('/stores/select', {
      method: 'POST',
      body: JSON.stringify({ storeId }),
    });
  },
  logout: async () => {
    return request<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST',
    });
  },
};
