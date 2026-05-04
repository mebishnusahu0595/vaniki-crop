import mongoose, { Schema, type Document, type Model } from 'mongoose';

// ─── Interfaces ──────────────────────────────────────────────────────────

/** Order item sub-document */
export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  productName: string;
  variantLabel: string;
  price: number;
  mrp: number;
  qty: number;
  image?: string;
  hsnCode?: string;
  taxRate?: number;
  taxAmount?: number;
  taxType?: 'IGST' | 'CGST' | 'SGST' | 'CGST/SGST';
  netAmount?: number;
}

/** Shipping address for delivery orders */
export interface IShippingAddress {
  name: string;
  mobile: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

/** Status history entry for order tracking */
export interface IStatusHistoryEntry {
  status: string;
  note?: string;
  updatedBy?: mongoose.Types.ObjectId;
  timestamp: Date;
}

/** Order status enum */
export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

/** Payment status enum */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/** Payment method enum */
export type PaymentMethod = 'razorpay' | 'cod';

/** Service mode enum */
export type OrderServiceMode = 'delivery' | 'pickup';

/** Order document interface */
export interface IOrder extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  serviceMode: OrderServiceMode;
  items: IOrderItem[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  couponDiscount: number;
  loyaltyPointsApplied: number;
  loyaltyDiscount: number;
  deliveryCharge: number;
  totalAmount: number;
  totalTaxAmount: number;
  shippingAddress?: IShippingAddress;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status: OrderStatus;
  statusHistory: IStatusHistoryEntry[];
  adminNote?: string;
  isSettlementRequested?: boolean;
  settlementBatchId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Order model static methods */
export interface IOrderModel extends Model<IOrder> {
  /**
   * Generates a unique order number in the format VNK-YYYYMMDD-XXXX.
   * XXXX is a zero-padded sequential counter based on today's order count.
   * @returns The generated order number string
   */
  generateOrderNumber(): Promise<string>;
}

// ─── Schema ──────────────────────────────────────────────────────────────

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    variantLabel: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    image: { type: String },
    hsnCode: { type: String },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    taxType: { type: String, enum: ['IGST', 'CGST', 'SGST', 'CGST/SGST'] },
    netAmount: { type: Number, default: 0 },
  },
  { _id: false },
);

const shippingAddressSchema = new Schema<IShippingAddress>(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const statusHistorySchema = new Schema<IStatusHistoryEntry>(
  {
    status: { type: String, required: true },
    note: { type: String },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder, IOrderModel>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required for an order'],
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store is required for an order'],
    },
    serviceMode: {
      type: String,
      enum: ['delivery', 'pickup'],
      required: true,
      default: 'delivery',
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items: IOrderItem[]) => items.length >= 1,
        message: 'An order must have at least one item',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, uppercase: true, trim: true },
    couponDiscount: { type: Number, default: 0, min: 0 },
    loyaltyPointsApplied: { type: Number, default: 0, min: 0 },
    loyaltyDiscount: { type: Number, default: 0, min: 0 },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    totalTaxAmount: { type: Number, default: 0, min: 0 },
    shippingAddress: shippingAddressSchema,
    paymentStatus: {
      type: String,
      enum: {
        values: ['pending', 'paid', 'failed', 'refunded'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['razorpay', 'cod'],
        message: '{VALUE} is not a valid payment method',
      },
      required: [true, 'Payment method is required'],
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    status: {
      type: String,
      enum: {
        values: ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        message: '{VALUE} is not a valid order status',
      },
      default: 'placed',
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
    adminNote: { type: String, trim: true },
    isSettlementRequested: { type: Boolean, default: false },
    settlementBatchId: { type: String },
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
orderSchema.index({ userId: 1 });
orderSchema.index({ storeId: 1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });

// ─── Pre-save Hook ───────────────────────────────────────────────────────

/**
 * Pre-save hook: pushes the initial status into statusHistory on creation.
 */
orderSchema.pre('save', function (this: any) {
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({
      status: this.status,
      note: 'Order placed by customer',
      timestamp: new Date(),
    });
  }
});

// ─── Static Methods ──────────────────────────────────────────────────────

/**
 * Generates a unique order number in the format VNK-YYYYMMDD-XXXX.
 * Uses today's order count + 1 to create the sequence number.
 * Example: VNK-20260405-0023
 * @returns {Promise<string>} The generated order number
 */
orderSchema.statics.generateOrderNumber = async function (): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Count today's orders to determine the next sequence number
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const todayCount = await this.countDocuments({
    createdAt: { $gte: startOfDay, $lt: endOfDay },
  });

  const sequence = String(todayCount + 1).padStart(4, '0');
  return `VNK-${dateStr}-${sequence}`;
};

// ─── Export ──────────────────────────────────────────────────────────────
export const Order = mongoose.model<IOrder, IOrderModel>('Order', orderSchema);
