import mongoose, { Schema, type Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IStaff extends Document {
  name: string;
  mobile: string;
  email?: string;
  password: string;
  referralCode: string;
  role: 'delivery' | 'referral' | 'dealer-staff';
  storeId?: mongoose.Types.ObjectId;
  upiId?: string;
  upiQrCode?: string;
  fcmToken?: string;
  expoPushToken?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const staffSchema = new Schema<IStaff>(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 6, select: false },
    referralCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    role: { type: String, enum: ['delivery', 'referral', 'dealer-staff'], default: 'delivery' },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', default: null },
    upiId: { type: String, trim: true },
    upiQrCode: { type: String, trim: true },
    fcmToken: { type: String, trim: true },
    expoPushToken: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  },
);

import { generateUniqueReferralCode } from '../utils/referral.helpers.js';

// Auto-generate unique referral code if not provided
staffSchema.pre('validate', async function (this: any) {
  if (!this.referralCode) {
    try {
      this.referralCode = await generateUniqueReferralCode(this.name, this.mobile);
    } catch (error) {
      console.error('Error generating referral code:', error);
    }
  }
});

staffSchema.pre('save', async function (this: any) {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

staffSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const Staff = mongoose.model<IStaff>('Staff', staffSchema);
