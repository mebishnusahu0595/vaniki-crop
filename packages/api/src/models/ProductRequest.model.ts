import mongoose, { Schema, type Document } from 'mongoose';

export type ProductRequestStatus = 'pending' | 'contacted' | 'fulfilled' | 'rejected';

export interface IProductRequest extends Document {
  storeId: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  productName: string;
  requestedQuantity: number;
  requestedPack?: string;
  notes?: string;
  status: ProductRequestStatus;
  superAdminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const productRequestSchema = new Schema<IProductRequest>(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: undefined,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [180, 'Product name cannot exceed 180 characters'],
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: [1, 'Requested quantity must be at least 1'],
    },
    requestedPack: {
      type: String,
      trim: true,
      maxlength: [80, 'Requested pack cannot exceed 80 characters'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [400, 'Notes cannot exceed 400 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'fulfilled', 'rejected'],
      default: 'pending',
      index: true,
    },
    superAdminNote: {
      type: String,
      trim: true,
      maxlength: [400, 'Super admin note cannot exceed 400 characters'],
    },
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

productRequestSchema.index({ status: 1, createdAt: -1 });

export const ProductRequest = mongoose.model<IProductRequest>('ProductRequest', productRequestSchema);
