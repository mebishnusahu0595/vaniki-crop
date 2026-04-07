/** Product as returned by the API */
export interface ProductPublic {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: number;
  mrp: number;
  discount: number;
  category: string;
  subcategory?: string;
  brand: string;
  images: string[];
  stock: number;
  unit: string;
  weight: string;
  isActive: boolean;
  isFeatured: boolean;
  tags: string[];
  specifications: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** Payload for creating/updating a product */
export interface ProductInput {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: number;
  mrp: number;
  discount?: number;
  category: string;
  subcategory?: string;
  brand: string;
  images?: string[];
  stock: number;
  unit: string;
  weight?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  tags?: string[];
  specifications?: Record<string, string>;
}
