import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isImage?: boolean;
  imageCaption?: string;
  matchedProductSlug?: string;
  matchedProductName?: string;
}

export interface IActiveContext {
  lastProductName?: string;
  lastProductSlug?: string;
  lastProductPrice?: number;
  lastVariantsSummary?: string;
  lastCropIssue?: string;
  lastImageDiagnosis?: string;
  lastAction?: string;
  updatedAt?: Date;
}

export interface IWhatsAppChatSession extends Document {
  mobile: string; // Normalized full number e.g. '916266838334'
  userId?: mongoose.Types.ObjectId;
  userName?: string;
  isDealer: boolean;
  messages: IChatMessage[];
  activeContext: IActiveContext;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'model'],
      required: true,
    },
    text: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    isImage: {
      type: Boolean,
      default: false,
    },
    imageCaption: {
      type: String,
      default: '',
    },
    matchedProductSlug: {
      type: String,
      default: '',
    },
    matchedProductName: {
      type: String,
      default: '',
    },
  },
  { _id: false },
);

const activeContextSchema = new Schema<IActiveContext>(
  {
    lastProductName: { type: String, default: '' },
    lastProductSlug: { type: String, default: '' },
    lastProductPrice: { type: Number },
    lastVariantsSummary: { type: String, default: '' },
    lastCropIssue: { type: String, default: '' },
    lastImageDiagnosis: { type: String, default: '' },
    lastAction: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const whatsAppChatSessionSchema = new Schema<IWhatsAppChatSession>(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userName: {
      type: String,
      default: '',
    },
    isDealer: {
      type: Boolean,
      default: false,
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
    },
    activeContext: {
      type: activeContextSchema,
      default: () => ({}),
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Auto-expire sessions inactive for 30 days to keep DB lean
whatsAppChatSessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const WhatsAppChatSession: Model<IWhatsAppChatSession> =
  mongoose.models.WhatsAppChatSession ||
  mongoose.model<IWhatsAppChatSession>('WhatsAppChatSession', whatsAppChatSessionSchema);
