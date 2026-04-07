import mongoose, { Schema, type Document } from 'mongoose';

// ─── Interfaces ──────────────────────────────────────────────────────────

/** Testimonial avatar with Cloudinary metadata */
export interface ITestimonialAvatar {
  url: string;
  publicId: string;
}

/** Testimonial document interface */
export interface ITestimonial extends Document {
  name: string;
  designation?: string;
  avatar?: ITestimonialAvatar;
  message: string;
  rating: number;
  storeId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────

const testimonialAvatarSchema = new Schema<ITestimonialAvatar>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

const testimonialSchema = new Schema<ITestimonial>(
  {
    name: {
      type: String,
      required: [true, 'Testimonial name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    designation: {
      type: String,
      trim: true,
      maxlength: [100, 'Designation cannot exceed 100 characters'],
    },
    avatar: testimonialAvatarSchema,
    message: {
      type: String,
      required: [true, 'Testimonial message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
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
testimonialSchema.index({ isActive: 1, sortOrder: 1 });
testimonialSchema.index({ storeId: 1 });

// ─── Export ──────────────────────────────────────────────────────────────
export const Testimonial = mongoose.model<ITestimonial>('Testimonial', testimonialSchema);
