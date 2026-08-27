import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IVisitorCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface IVisitorLocation {
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  country?: string;
  formattedAddress?: string;
}

export interface IVisitorDevice {
  platform?: string;
  os?: string;
  browser?: string;
  appVariant?: string;
  userAgent?: string;
}

export interface IVisitor extends Document {
  visitorId: string;
  userId?: mongoose.Types.ObjectId;
  userName?: string;
  userMobile?: string;
  isRegistered: boolean;
  ip: string;
  coordinates?: IVisitorCoordinates;
  location?: IVisitorLocation;
  device?: IVisitorDevice;
  firstSeen: Date;
  lastSeen: Date;
  visitCount: number;
  recentPages: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IVisitorModel extends Model<IVisitor> {}

const visitorCoordinatesSchema = new Schema<IVisitorCoordinates>(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number },
  },
  { _id: false }
);

const visitorLocationSchema = new Schema<IVisitorLocation>(
  {
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    formattedAddress: { type: String, trim: true },
  },
  { _id: false }
);

const visitorDeviceSchema = new Schema<IVisitorDevice>(
  {
    platform: { type: String, trim: true },
    os: { type: String, trim: true },
    browser: { type: String, trim: true },
    appVariant: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { _id: false }
);

const visitorSchema = new Schema<IVisitor>(
  {
    visitorId: {
      type: String,
      required: [true, 'Visitor ID is required'],
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    userName: {
      type: String,
      trim: true,
    },
    userMobile: {
      type: String,
      trim: true,
      index: true,
    },
    isRegistered: {
      type: Boolean,
      default: false,
      index: true,
    },
    ip: {
      type: String,
      trim: true,
      index: true,
    },
    coordinates: {
      type: visitorCoordinatesSchema,
    },
    location: {
      type: visitorLocationSchema,
    },
    device: {
      type: visitorDeviceSchema,
    },
    firstSeen: {
      type: Date,
      default: Date.now,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true,
    },
    visitCount: {
      type: Number,
      default: 1,
    },
    recentPages: [
      {
        type: String,
        trim: true,
      },
    ],
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
  }
);

// High speed indexes for fast querying & sorting
visitorSchema.index({ lastSeen: -1 });
visitorSchema.index({ isRegistered: 1, lastSeen: -1 });
visitorSchema.index({ 'location.city': 1, 'location.state': 1 });

export const Visitor = mongoose.model<IVisitor, IVisitorModel>('Visitor', visitorSchema);
