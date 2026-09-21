import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ICartItem {
  productId?: mongoose.Types.ObjectId | string;
  variantId: string;
  productSlug?: string;
  productName: string;
  variantLabel?: string;
  price: number;
  mrp: number;
  qty: number;
  image?: string;
  stock?: number;
  hsnCode?: string;
}

export type CartUserType = 'user' | 'dealer' | 'guest';
export type CartSource = 'user_app' | 'dealer_app' | 'user_web';
export type CartStatus = 'active' | 'converted' | 'cleared';

export interface ICart extends Document {
  userId?: mongoose.Types.ObjectId;
  sessionId?: string; // For guest visitors
  userType: CartUserType;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  storeId?: mongoose.Types.ObjectId;
  dealerBusinessName?: string;
  source: CartSource;
  items: ICartItem[];
  subtotal: number;
  totalItems: number;
  couponCode?: string;
  couponDiscount?: number;
  status: CartStatus;
  convertedOrderId?: mongoose.Types.ObjectId;
  lastActiveAt: Date;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: Schema.Types.Mixed, ref: 'Product', required: false },
    variantId: { type: String, required: true },
    productSlug: { type: String, default: '' },
    productName: { type: String, required: true },
    variantLabel: { type: String, default: '' },
    price: { type: Number, required: true, default: 0 },
    mrp: { type: Number, required: true, default: 0 },
    qty: { type: Number, required: true, default: 1, min: 1 },
    image: { type: String, default: '' },
    stock: { type: Number, default: 0 },
    hsnCode: { type: String, default: '' },
  },
  { _id: false },
);

const CartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, index: true },
    userType: {
      type: String,
      enum: ['user', 'dealer', 'guest'],
      default: 'guest',
      index: true,
    },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store' },
    dealerBusinessName: { type: String, default: '' },
    source: {
      type: String,
      enum: ['user_app', 'dealer_app', 'user_web'],
      default: 'user_web',
      index: true,
    },
    items: { type: [CartItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    totalItems: { type: Number, default: 0 },
    couponCode: { type: String, default: '' },
    couponDiscount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'converted', 'cleared'],
      default: 'active',
      index: true,
    },
    convertedOrderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    lastActiveAt: { type: Date, default: Date.now, index: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for querying active carts sorted by recent activity
CartSchema.index({ status: 1, lastActiveAt: -1 });
CartSchema.index({ status: 1, userType: 1, lastActiveAt: -1 });
CartSchema.index({ status: 1, source: 1, lastActiveAt: -1 });
CartSchema.index({ sessionId: 1, status: 1 });
CartSchema.index({ userId: 1, status: 1 });

export const Cart: Model<ICart> =
  mongoose.models.Cart || mongoose.model<ICart>('Cart', CartSchema);
