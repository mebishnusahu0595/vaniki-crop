import mongoose, { Schema, type Document } from 'mongoose';

export type ProductRequestStatus = 'pending' | 'contacted' | 'fulfilled' | 'rejected';

export interface IProductRequest extends Document {
  storeId: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  productName: string;
  requestedQuantity: number;
  requestedPack?: string;
  garageName: string;
  petiQuantity: number;
  petiSize: number;
  petiUnit: 'Liter' | 'Kg';
  notes?: string;
  status: ProductRequestStatus;
  dealerPrice?: number;
  offerPrice?: number;
  hsnCode?: string;
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
    garageName: {
      type: String,
      required: [true, 'Garage name is required'],
      trim: true,
      maxlength: [180, 'Garage name cannot exceed 180 characters'],
    },
    petiQuantity: {
      type: Number,
      default: 1,
      min: [1, 'Peti quantity must be at least 1'],
    },
    petiSize: {
      type: Number,
      required: [true, 'Peti size is required'],
      min: [0.1, 'Peti size must be at least 0.1'],
    },
    petiUnit: {
      type: String,
      enum: ['Liter', 'Kg'],
      default: 'Liter',
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
    dealerPrice: { type: Number },
    offerPrice: { type: Number },
    hsnCode: { type: String, trim: true },
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
