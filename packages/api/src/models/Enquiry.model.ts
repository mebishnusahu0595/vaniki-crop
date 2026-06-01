import mongoose, { Schema, type Document } from 'mongoose';

export interface IEnquiry extends Document {
  name: string;
  mobile: string;
  category: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<IEnquiry>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
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
  }
);

enquirySchema.index({ createdAt: -1 });

export const Enquiry = mongoose.model<IEnquiry>('Enquiry', enquirySchema);
