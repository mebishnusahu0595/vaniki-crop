import mongoose, { Schema, type Document } from 'mongoose';

// ─── Interfaces ──────────────────────────────────────────────────────────

/** Store address */
export interface IStoreAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
}

/** GeoJSON Point for store location */
export interface IStoreLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

/** Open hours per day */
export interface IOpenHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

/** Store document interface */
export interface IStore extends Document {
  name: string;
  address: IStoreAddress;
  phone: string;
  email?: string;
  adminId: mongoose.Types.ObjectId;
  isActive: boolean;
  location: IStoreLocation;
  openHours?: IOpenHours;
  deliveryRadius: number;
  gstNumber?: string;
  sgstNumber?: string;
  cgst?: number;
  sgst?: number;
  igst?: number;
  panNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────

const storeAddressSchema = new Schema<IStoreAddress>(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const openHoursSchema = new Schema<IOpenHours>(
  {
    monday: { type: String },
    tuesday: { type: String },
    wednesday: { type: String },
    thursday: { type: String },
    friday: { type: String },
    saturday: { type: String },
    sunday: { type: String },
  },
  { _id: false },
);

const storeSchema = new Schema<IStore>(
  {
    name: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      maxlength: [150, 'Store name cannot exceed 150 characters'],
    },
    address: {
      type: storeAddressSchema,
      required: [true, 'Store address is required'],
    },
    phone: {
      type: String,
      required: [true, 'Store phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Store admin is required'],
    },
    isActive: { type: Boolean, default: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (val: number[]) => val.length === 2,
          message: 'Coordinates must be [longitude, latitude]',
        },
      },
    },
    openHours: openHoursSchema,
    deliveryRadius: {
      type: Number,
      default: 10,
      min: [0, 'Delivery radius cannot be negative'],
      comment: 'Delivery radius in kilometers',
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    sgstNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    cgst: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    sgst: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    igst: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
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
storeSchema.index({ location: '2dsphere' });
storeSchema.index({ adminId: 1 });

// ─── Export ──────────────────────────────────────────────────────────────
export const Store = mongoose.model<IStore>('Store', storeSchema);
