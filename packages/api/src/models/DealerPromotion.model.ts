import mongoose, { Schema, type Document } from 'mongoose';

// ─── Interfaces ──────────────────────────────────────────────────────────

export interface IDealerPromotionImage {
  url: string;
  publicId: string;
}

export interface IDealerPromotion extends Document {
  title: string;
  description: string;
  image?: IDealerPromotionImage;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────

const dealerPromotionImageSchema = new Schema<IDealerPromotionImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

const dealerPromotionSchema = new Schema<IDealerPromotion>(
  {
    title: {
      type: String,
      required: [true, 'Promotion title is required'],
      trim: true,
      maxlength: [150, 'Promotion title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Promotion description is required'],
      trim: true,
    },
    image: {
      type: dealerPromotionImageSchema,
      default: undefined,
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
dealerPromotionSchema.index({ isActive: 1, sortOrder: 1 });

// ─── Export ──────────────────────────────────────────────────────────────
export const DealerPromotion = mongoose.model<IDealerPromotion>('DealerPromotion', dealerPromotionSchema);
