import mongoose, { Schema, type Document } from 'mongoose';

export interface ISiteSetting extends Document {
  singletonKey: string;
  platformName: string;
  supportEmail?: string;
  supportPhone?: string;
  maintenanceMode: boolean;
  homepageHeadline?: string;
  defaultDeliveryRadius: number;
  freeDeliveryThreshold: number;
  standardDeliveryCharge: number;
  allowGuestCheckout: boolean;
  metaTitle?: string;
  metaDescription?: string;
  loyaltyPointRupeeValue: number;
  garageNames?: string[];
  address?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  panNumber?: string;
  gstNumber?: string;
  minLoyaltyPointsToRedeem: number;
  tallyConfig?: {
    tallyHost?: string;
    tallyPort?: number;
    companyName?: string;
    salesLedger?: string;
    cgstLedger?: string;
    sgstLedger?: string;
    igstLedger?: string;
    roundOffLedger?: string;
    companyState?: string;
    companyGstin?: string;
    agentSecretKey?: string;
    autoSyncEnabled?: boolean;
  };
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    branchName?: string;
    upiId?: string;
    qrCodeUrl?: string;
  };
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
    freeDeliveryThreshold: {
      type: Number,
      min: 0,
      default: 200,
    },
    standardDeliveryCharge: {
      type: Number,
      min: 0,
      default: 50,
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
    loyaltyPointRupeeValue: {
      type: Number,
      default: 1,
      min: 0,
    },
    minLoyaltyPointsToRedeem: {
      type: Number,
      default: 0,
      min: 0,
    },
    garageNames: {
      type: [String],
      default: [],
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },
    panNumber: { type: String, trim: true, uppercase: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    tallyConfig: {
      tallyHost: { type: String, default: '127.0.0.1' },
      tallyPort: { type: Number, default: 9000 },
      companyName: { type: String, default: 'Vaniki Crop Science Pvt Ltd' },
      salesLedger: { type: String, default: 'Sales - Agro Chemicals' },
      cgstLedger: { type: String, default: 'CGST Output' },
      sgstLedger: { type: String, default: 'SGST Output' },
      igstLedger: { type: String, default: 'IGST Output' },
      roundOffLedger: { type: String, default: 'Round Off' },
      companyState: { type: String, default: 'Chhattisgarh' },
      companyGstin: { type: String, default: '22AAAAA0000A1Z5' },
      agentSecretKey: { type: String, default: 'vaniki_tally_sec_2026_x9k' },
      autoSyncEnabled: { type: Boolean, default: true },
    },
    bankDetails: {
      accountName: { type: String, default: 'Vaniki Crop Science Pvt Ltd' },
      accountNumber: { type: String, default: '50200088991122' },
      ifscCode: { type: String, default: 'HDFC0001234' },
      bankName: { type: String, default: 'HDFC Bank' },
      branchName: { type: String, default: 'Ambagarh Chauki' },
      upiId: { type: String, default: 'vanikicrop@hdfcbank' },
      qrCodeUrl: { type: String, default: '' },
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
