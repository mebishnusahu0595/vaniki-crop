import mongoose, { Schema, type Document } from 'mongoose';

export interface IAiCampaignLog extends Document {
  date: string;
  seasonContext: string;
  targetCrop: string;
  targetIssue: string;
  productId?: mongoose.Types.ObjectId;
  productTitle: string;
  productImage: string;
  productLink: string;
  pushTitle: string;
  pushBody: string;
  whatsappMessage: string;
  pushSentCount: number;
  waSentCount: number;
  triggerType: 'scheduled' | 'manual';
  status: 'completed' | 'failed' | 'partial';
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiCampaignLogSchema = new Schema<IAiCampaignLog>(
  {
    date: {
      type: String,
      required: true,
      index: true,
    },
    seasonContext: {
      type: String,
      default: '',
    },
    targetCrop: {
      type: String,
      default: '',
    },
    targetIssue: {
      type: String,
      default: '',
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
    },
    productTitle: {
      type: String,
      required: true,
    },
    productImage: {
      type: String,
      default: '',
    },
    productLink: {
      type: String,
      default: '',
    },
    pushTitle: {
      type: String,
      required: true,
    },
    pushBody: {
      type: String,
      required: true,
    },
    whatsappMessage: {
      type: String,
      required: true,
    },
    pushSentCount: {
      type: Number,
      default: 0,
    },
    waSentCount: {
      type: Number,
      default: 0,
    },
    triggerType: {
      type: String,
      enum: ['scheduled', 'manual'],
      default: 'manual',
    },
    status: {
      type: String,
      enum: ['completed', 'failed', 'partial'],
      default: 'completed',
    },
    errorDetails: {
      type: String,
      default: '',
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

aiCampaignLogSchema.index({ createdAt: -1 });

export const AiCampaignLog = mongoose.model<IAiCampaignLog>('AiCampaignLog', aiCampaignLogSchema);
