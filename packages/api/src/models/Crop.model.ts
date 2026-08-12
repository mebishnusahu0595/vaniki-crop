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

export interface ICropImage {
  url: string;
  publicId: string;
}

export interface ICropSection {
  title: string;
  body: string;
  sortOrder: number;
}

export interface ICrop extends Document {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  image: ICropImage;
  sections: ICropSection[];
  suggestedProductIds: mongoose.Types.ObjectId[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────

const cropImageSchema = new Schema<ICropImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

const cropSectionSchema = new Schema<ICropSection>(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true },
);

const cropSchema = new Schema<ICrop>(
  {
    name: {
      type: String,
      required: [true, 'Crop name is required'],
      trim: true,
      maxlength: [150, 'Crop name cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Crop slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      maxlength: [400, 'Short description cannot exceed 400 characters'],
    },
    description: {
      type: String,
      default: '',
    },
    image: {
      type: cropImageSchema,
      required: [true, 'Crop image is required'],
    },
    sections: {
      type: [cropSectionSchema],
      default: [],
    },
    suggestedProductIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc: any, ret: any) {
        if (ret.image?.publicId) {
          const localPath = toUploadPathFromPublicId(ret.image.publicId);
          if (localPath) {
            ret.image = { ...ret.image, url: localPath };
          }
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
cropSchema.index({ slug: 1 }, { unique: true });
cropSchema.index({ isActive: 1, sortOrder: 1 });

// ─── Export ──────────────────────────────────────────────────────────────
export const Crop = mongoose.model<ICrop>('Crop', cropSchema);
