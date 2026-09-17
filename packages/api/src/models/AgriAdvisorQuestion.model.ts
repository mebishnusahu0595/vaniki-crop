import mongoose, { Schema, type Document } from 'mongoose';

export interface IAgriAdvisorQuestion extends Document {
  questionEn: string;
  questionHi: string;
  answerEn: string;
  answerHi: string;
  recommendedProductIds: mongoose.Types.ObjectId[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const agriAdvisorQuestionSchema = new Schema<IAgriAdvisorQuestion>(
  {
    questionEn: {
      type: String,
      required: [true, 'English question is required'],
      trim: true,
    },
    questionHi: {
      type: String,
      required: [true, 'Hindi question is required'],
      trim: true,
    },
    answerEn: {
      type: String,
      required: [true, 'English answer is required'],
      trim: true,
    },
    answerHi: {
      type: String,
      required: [true, 'Hindi answer is required'],
      trim: true,
    },
    recommendedProductIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
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

agriAdvisorQuestionSchema.index({ isActive: 1, sortOrder: 1 });

export const AgriAdvisorQuestion = mongoose.model<IAgriAdvisorQuestion>(
  'AgriAdvisorQuestion',
  agriAdvisorQuestionSchema,
);
