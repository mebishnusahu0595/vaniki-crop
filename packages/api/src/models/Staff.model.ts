import mongoose, { Schema, type Document } from 'mongoose';

export interface IStaff extends Document {
  name: string;
  mobile: string;
  email?: string;
  referralCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const staffSchema = new Schema<IStaff>(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    referralCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Auto-generate unique referral code if not provided
staffSchema.pre('validate', function (next) {
  const staff = this as any;
  if (!staff.referralCode) {
    staff.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  (next as any)?.();
});

export const Staff = mongoose.model<IStaff>('Staff', staffSchema);
