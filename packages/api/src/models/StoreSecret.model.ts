import mongoose, { Schema, type Document } from 'mongoose';

export interface IStoreSecret extends Document {
  storeId: mongoose.Types.ObjectId;
  secrets: Map<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const storeSecretSchema = new Schema<IStoreSecret>(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      unique: true,
    },
    secrets: {
      type: Map,
      of: String,
      default: {},
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

storeSecretSchema.index({ storeId: 1 }, { unique: true });

export const StoreSecret = mongoose.model<IStoreSecret>('StoreSecret', storeSecretSchema);
