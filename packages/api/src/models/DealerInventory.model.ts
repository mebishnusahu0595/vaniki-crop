import mongoose, { Schema, type Document } from 'mongoose';

export interface IDealerInventory extends Document {
  storeId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  quantity: number;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dealerInventorySchema = new Schema<IDealerInventory>(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

dealerInventorySchema.index(
  { storeId: 1, productId: 1, variantId: 1 },
  { unique: true, name: 'unique_store_product_variant_inventory' },
);

export const DealerInventory = mongoose.model<IDealerInventory>('DealerInventory', dealerInventorySchema);
