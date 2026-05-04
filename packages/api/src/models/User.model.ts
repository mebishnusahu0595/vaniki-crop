import mongoose, { Schema, type Document, type Model } from 'mongoose';
import bcrypt from 'bcrypt';

// ─── Interfaces ──────────────────────────────────────────────────────────

/** User's saved address */
export interface ISavedAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

/** User role enum */
export type UserRole = 'customer' | 'storeAdmin' | 'superAdmin';

/** Dealer approval status enum */
export type DealerApprovalStatus = 'pending' | 'approved' | 'rejected';

/** Dealer profile captured during registration */
export interface IDealerProfile {
  storeName: string;
  storeLocation: string;
  latitude: number;
  longitude: number;
  gstNumber: string;
  sgstNumber: string;
}

/** User profile image stored in Cloudinary */
export interface IUserProfileImage {
  url: string;
  publicId: string;
}

/** Service mode enum */
export type ServiceMode = 'delivery' | 'pickup';

/** User document interface */
export interface IUser extends Document {
  name: string;
  email: string;
  mobile: string;
  password: string;
  profileImage?: IUserProfileImage;
  role: UserRole;
  approvalStatus: DealerApprovalStatus;
  dealerProfile?: IDealerProfile;
  selectedStore?: mongoose.Types.ObjectId;
  serviceMode: ServiceMode;
  savedAddress?: ISavedAddress;
  wishlist: mongoose.Types.ObjectId[];
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId | null;
  referredByStaff?: mongoose.Types.ObjectId | null;
  referralCount: number;
  isActive: boolean;
  otp?: string;
  otpExpiry?: Date;
  refreshToken?: string;
  expoPushToken?: string;
  loyaltyPoints: number;
  lastCheckIn?: Date;
  checkInHistory: string[];
  createdAt: Date;
  updatedAt: Date;

  /** Compares a candidate password against the hashed password */
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/** User model static methods */
export interface IUserModel extends Model<IUser> {}

// ─── Schema ──────────────────────────────────────────────────────────────

const savedAddressSchema = new Schema<ISavedAddress>(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    landmark: { type: String, trim: true },
  },
  { _id: false },
);

const dealerProfileSchema = new Schema<IDealerProfile>(
  {
    storeName: { type: String, trim: true },
    storeLocation: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    gstNumber: { type: String, trim: true, uppercase: true },
    sgstNumber: { type: String, trim: true, uppercase: true },
  },
  { _id: false },
);

const userProfileImageSchema = new Schema<IUserProfileImage>(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    profileImage: userProfileImageSchema,
    role: {
      type: String,
      enum: {
        values: ['customer', 'storeAdmin', 'superAdmin'],
        message: '{VALUE} is not a valid role',
      },
      default: 'customer',
    },
    approvalStatus: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid approval status',
      },
      default: 'approved',
    },
    dealerProfile: dealerProfileSchema,
    selectedStore: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
    },
    serviceMode: {
      type: String,
      enum: ['delivery', 'pickup'],
      default: 'delivery',
    },
    savedAddress: savedAddressSchema,
    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    referralCode: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    referredByStaff: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    referralCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: { type: Boolean, default: true },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    refreshToken: { type: String, select: false },
    expoPushToken: { type: String, trim: true },
    loyaltyPoints: { type: Number, default: 0 },
    lastCheckIn: { type: Date },
    checkInHistory: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.otp;
        delete ret.otpExpiry;
        delete ret.refreshToken;
        return ret;
      },
    },
  },
);

// ─── Indexes ─────────────────────────────────────────────────────────────
userSchema.index({ mobile: 1 }, { unique: true });
userSchema.index({ email: 1 });
userSchema.index({ referralCode: 1 }, { unique: true, sparse: true });

// ─── Hooks ───────────────────────────────────────────────────────────────

/**
 * Pre-save hook: hashes the password with bcrypt (12 salt rounds)
 * only when the password field has been modified.
 */
userSchema.pre('save', async function (this: any) {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── Methods ─────────────────────────────────────────────────────────────

/**
 * Compares a plain-text candidate password against the stored hash.
 * @param candidatePassword - The plain-text password to verify
 * @returns True if the password matches, false otherwise
 */
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Export ──────────────────────────────────────────────────────────────
export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
