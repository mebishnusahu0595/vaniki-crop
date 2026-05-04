import mongoose, { Schema, type Document } from 'mongoose';

const LOCAL_PUBLIC_ID_PREFIX = 'local:';

function toUploadPathFromPublicId(publicId?: string): string | null {
  if (!publicId?.startsWith(LOCAL_PUBLIC_ID_PREFIX)) {
    return null;
  }

  const relativePath = publicId.slice(LOCAL_PUBLIC_ID_PREFIX.length).replace(/^\/+/, '');
  if (!relativePath) return null;

  const encoded = relativePath
    .split('/')
    .map((segment) => {
      if (!segment) return segment;

      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');

  return `/uploads/${encoded}`;
}

// ─── Interfaces ──────────────────────────────────────────────────────────

/** Product image with Cloudinary metadata */
export interface IProductImage {
  url: string;
  publicId: string;
  isPrimary: boolean;
}

/** Product variant (size/packaging options) */
export interface IProductVariant {
  label: string;
  price: number;
  adminPrice?: number;
  mrp: number;
  stock: number;
  sku: string;
}

/** Product document interface */
export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  images: IProductImage[];
  category: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId[];
  variants: IProductVariant[];
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  metaTitle?: string;
  metaDescription?: string;
  totalSold: number;
  averageRating: number;
  reviewCount: number;
  loyaltyPointEligible: boolean;
  maxLoyaltyPoints: number;
  petiSize: number;
  petiUnit: 'Liter' | 'Kg';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────

const productImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

const productVariantSchema = new Schema<IProductVariant>(
  {
    label: {
      type: String,
      required: [true, 'Variant label is required (e.g. "1 Liter", "500ml")'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Variant price is required'],
      min: [0, 'Price cannot be negative'],
    },
    adminPrice: {
      type: Number,
      min: [0, 'Admin price cannot be negative'],
    },
    mrp: {
      type: Number,
      required: [true, 'Variant MRP is required'],
      min: [0, 'MRP cannot be negative'],
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      uppercase: true,
      trim: true,
    },
  },
  { _id: true },
);

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
    },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      maxlength: [300, 'Short description cannot exceed 300 characters'],
    },
    images: {
      type: [productImageSchema],
      default: [],
      validate: {
        validator: (images: IProductImage[]) => images.length <= 10,
        message: 'A product can have at most 10 images',
      },
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
    },
    storeId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Store',
      },
    ],
    variants: {
      type: [productVariantSchema],
      validate: {
        validator: (variants: IProductVariant[]) => variants.length >= 1,
        message: 'A product must have at least one variant',
      },
    },
    tags: [{ type: String, trim: true, lowercase: true }],
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    metaTitle: { type: String, maxlength: 70 },
    metaDescription: { type: String, maxlength: 160 },
    totalSold: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    loyaltyPointEligible: { type: Boolean, default: false },
    maxLoyaltyPoints: { type: Number, default: 0 },
    petiSize: { type: Number, default: 12 },
    petiUnit: { type: String, enum: ['Liter', 'Kg'], default: 'Liter' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc: any, ret: any) {
        if (Array.isArray(ret.images)) {
          ret.images = ret.images.map((image: any) => {
            const localUploadPath = toUploadPathFromPublicId(image?.publicId);
            if (!localUploadPath) return image;

            return {
              ...image,
              url: localUploadPath,
            };
          });
        }

        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ─── Indexes ─────────────────────────────────────────────────────────────
productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ category: 1 });
productSchema.index({ storeId: 1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index(
  { name: 'text', description: 'text', tags: 'text' },
  { weights: { name: 10, tags: 5, description: 1 }, name: 'product_text_search' },
);

// ─── Export ──────────────────────────────────────────────────────────────
export const Product = mongoose.model<IProduct>('Product', productSchema);
