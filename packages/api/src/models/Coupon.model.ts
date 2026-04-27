import mongoose, { Schema, type Document } from 'mongoose';

// ─── Interfaces ──────────────────────────────────────────────────────────

/** Coupon type: percent-based or flat discount */
export type CouponType = 'percent' | 'flat';

/** Coupon document interface */
export interface ICoupon extends Document {
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxDiscount?: number;
  usageLimit: number;
  perUserLimit: number;
  usedCount: number;
  expiryDate: Date;
  isActive: boolean;
  applicableStores: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [30, 'Coupon code cannot exceed 30 characters'],
    },
    type: {
      type: String,
      enum: {
        values: ['percent', 'flat'],
        message: '{VALUE} is not a valid coupon type',
      },
      required: [true, 'Coupon type is required'],
    },
    value: {
      type: Number,
      required: [true, 'Coupon value is required'],
      min: [0, 'Coupon value cannot be negative'],
      validate: {
        validator: function (this: any, val: number) {
          // For percent type, value should be between 0 and 100
          if (this.type === 'percent' && val > 100) return false;
          return true;
        },
        message: 'Percent coupon value cannot exceed 100',
      },
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative'],
    },
    maxDiscount: {
      type: Number,
      min: [0, 'Maximum discount cannot be negative'],
    },
      usageLimit: {
        type: Number,
        required: [true, 'Usage limit is required'],
        min: [1, 'Usage limit must be at least 1'],
      },
      perUserLimit: {
        type: Number,
        default: 1,
        min: [1, 'Per-user limit must be at least 1'],
      },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    isActive: { type: Boolean, default: true },
    applicableStores: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Store',
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Coupon creator is required'],
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

// ─── Indexes ─────────────────────────────────────────────────────────────
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ expiryDate: 1 });
couponSchema.index({ isActive: 1 });

// ─── Export ──────────────────────────────────────────────────────────────
export const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);
