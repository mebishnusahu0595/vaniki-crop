import mongoose, { Schema, type Document } from 'mongoose';

// ─── Interfaces ──────────────────────────────────────────────────────────

/** Banner image with Cloudinary metadata */
export interface IBannerImage {
  url: string;
  mobileUrl: string;
  publicId: string;
}

/** Linked product with display position */
export interface ILinkedProduct {
  productId: mongoose.Types.ObjectId;
  position: number;
}

/** Banner document interface */
export interface IBanner extends Document {
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  image: IBannerImage;
  linkedProducts: ILinkedProduct[];
  storeId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  sortOrder: number;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────

const bannerImageSchema = new Schema<IBannerImage>(
  {
    url: { type: String, required: true },
    mobileUrl: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

const linkedProductSchema = new Schema<ILinkedProduct>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    position: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const bannerSchema = new Schema<IBanner>(
  {
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
      maxlength: [150, 'Banner title cannot exceed 150 characters'],
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: [300, 'Subtitle cannot exceed 300 characters'],
    },
    ctaText: {
      type: String,
      trim: true,
      maxlength: [50, 'CTA text cannot exceed 50 characters'],
    },
    ctaLink: {
      type: String,
      trim: true,
    },
    image: {
      type: bannerImageSchema,
      required: [true, 'Banner image is required'],
    },
    linkedProducts: {
      type: [linkedProductSchema],
      default: [],
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ─── Indexes ─────────────────────────────────────────────────────────────
bannerSchema.index({ isActive: 1, sortOrder: 1 });
bannerSchema.index({ storeId: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });

// ─── Export ──────────────────────────────────────────────────────────────
export const Banner = mongoose.model<IBanner>('Banner', bannerSchema);
