import mongoose, { Schema, type Document } from 'mongoose';

// ─── Interfaces ──────────────────────────────────────────────────────────

/** Category image with Cloudinary metadata */
export interface ICategoryImage {
  url: string;
  publicId: string;
}

/** Category document interface */
export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  image?: ICategoryImage;
  parentCategory?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────

const categoryImageSchema = new Schema<ICategoryImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    image: categoryImageSchema,
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
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
categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ sortOrder: 1 });

// ─── Export ──────────────────────────────────────────────────────────────
export const Category = mongoose.model<ICategory>('Category', categorySchema);
