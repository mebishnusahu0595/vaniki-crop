import mongoose, { Schema, type Document } from 'mongoose';

// ─── Interfaces ──────────────────────────────────────────────────────────

/** Review document interface */
export interface IReview extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  isApproved: boolean;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────

const reviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    isApproved: { type: Boolean, default: false },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: { type: Date },
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

/** Compound unique index: one review per product per user */
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, isApproved: 1 });

// ─── Post-save Hook ─────────────────────────────────────────────────────

/**
 * Post-save hook: recalculates and updates the product's averageRating
 * and reviewCount whenever a review is saved (created or updated).
 */
reviewSchema.post('save', async function () {
  const Product = mongoose.model('Product');

  const stats = await mongoose.model('Review').aggregate([
    { $match: { productId: this.productId, isApproved: true } },
    {
      $group: {
        _id: '$productId',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(this.productId, {
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
      reviewCount: stats[0].reviewCount,
    });
  } else {
    await Product.findByIdAndUpdate(this.productId, {
      averageRating: 0,
      reviewCount: 0,
    });
  }
});

/**
 * Post-findOneAndDelete hook: recalculates product stats after review removal.
 */
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (!doc) return;

  const Product = mongoose.model('Product');

  const stats = await mongoose.model('Review').aggregate([
    { $match: { productId: doc.productId, isApproved: true } },
    {
      $group: {
        _id: '$productId',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(doc.productId, {
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
      reviewCount: stats[0].reviewCount,
    });
  } else {
    await Product.findByIdAndUpdate(doc.productId, {
      averageRating: 0,
      reviewCount: 0,
    });
  }
});

// ─── Export ──────────────────────────────────────────────────────────────
export const Review = mongoose.model<IReview>('Review', reviewSchema);
