import mongoose, { Schema, type Document } from 'mongoose';

// 'customers' -> app users (role: customer); 'dealers' -> store admins on the
// Vaniki Dealers app (role: storeAdmin); 'both' -> both. 'allCustomers' is the
// legacy value, kept for backwards compatibility with existing campaigns.
export type NotificationTargetAudience = 'customers' | 'dealers' | 'both' | 'allCustomers';

export interface INotificationCampaign extends Document {
  title: string;
  body: string;
  link?: string;
  targetAudience: NotificationTargetAudience;
  sentCount: number;
  failedCount: number;
  totalRecipients: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const notificationCampaignSchema = new Schema<INotificationCampaign>(
  {
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [80, 'Notification title cannot exceed 80 characters'],
    },
    body: {
      type: String,
      required: [true, 'Notification body is required'],
      trim: true,
      maxlength: [220, 'Notification body cannot exceed 220 characters'],
    },
    link: {
      type: String,
      trim: true,
      maxlength: [500, 'Notification link cannot exceed 500 characters'],
    },
    targetAudience: {
      type: String,
      enum: ['customers', 'dealers', 'both', 'allCustomers'],
      default: 'customers',
    },
    sentCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    totalRecipients: { type: Number, default: 0, min: 0 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

notificationCampaignSchema.index({ createdAt: -1 });

export const NotificationCampaign = mongoose.model<INotificationCampaign>(
  'NotificationCampaign',
  notificationCampaignSchema,
);
