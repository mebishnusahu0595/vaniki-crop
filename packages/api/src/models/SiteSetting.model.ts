import mongoose, { Schema, type Document } from 'mongoose';

export interface ISiteSetting extends Document {
  singletonKey: string;
  platformName: string;
  supportEmail?: string;
  supportPhone?: string;
  maintenanceMode: boolean;
  homepageHeadline?: string;
  defaultDeliveryRadius: number;
  allowGuestCheckout: boolean;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const siteSettingSchema = new Schema<ISiteSetting>(
  {
    singletonKey: {
      type: String,
      default: 'default',
      unique: true,
      immutable: true,
    },
    platformName: {
      type: String,
      default: 'Vaniki Crop',
      trim: true,
      maxlength: 120,
    },
    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    supportPhone: {
      type: String,
      trim: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    homepageHeadline: {
      type: String,
      trim: true,
      maxlength: 220,
    },
    defaultDeliveryRadius: {
      type: Number,
      min: 0,
      default: 10,
    },
    allowGuestCheckout: {
      type: Boolean,
      default: false,
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: 300,
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

siteSettingSchema.index({ singletonKey: 1 }, { unique: true });

export const SiteSetting = mongoose.model<ISiteSetting>('SiteSetting', siteSettingSchema);
