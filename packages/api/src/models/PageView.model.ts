import mongoose, { Schema, type Document } from 'mongoose';

export interface IPageView extends Document {
  url: string;
  visitorId: string;
  productId?: mongoose.Types.ObjectId | null;
  userAgent?: string;
  device: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  ip?: string;
  createdAt: Date;
}

const pageViewSchema = new Schema<IPageView>(
  {
    url: {
      type: String,
      required: [true, 'URL is required'],
      trim: true,
    },
    visitorId: {
      type: String,
      required: [true, 'Visitor ID is required'],
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    device: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet', 'unknown'],
      default: 'unknown',
      index: true,
    },
    ip: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// High speed indexes for fast dashboard reporting
pageViewSchema.index({ createdAt: -1 });
pageViewSchema.index({ url: 1 });

export const PageView = mongoose.model<IPageView>('PageView', pageViewSchema);
