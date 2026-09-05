import mongoose, { Schema, Document } from 'mongoose';

export interface IB2BInvoiceItem {
  productName: string;
  hsnCode?: string;
  qty: number;
  price: number; // Unit price before tax
  taxRate: number; // Percentage
  taxAmount: number;
  total: number; // (Price * Qty) + TaxAmount
}

export interface IB2BInvoice extends Document {
  storeId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  invoiceDate: Date;
  items: IB2BInvoiceItem[];
  subtotal: number; // Sum of (Price * Qty)
  totalTaxAmount: number;
  totalAmount: number;
  tallySyncStatus: 'pending' | 'synced' | 'failed' | 'manual';
  tallyVoucherNumber?: string;
  tallyVoucherGuid?: string;
  tallySyncAt?: Date;
  tallySyncError?: string;
  tallyXmlPayload?: string;
  buyerOrderNo?: string;
  buyerOrderDate?: Date;
  dispatchDocNo?: string;
  dispatchDate?: Date;
  despatchedThrough?: string;
  destination?: string;
  termsOfDelivery?: string;
  paymentTerms?: string;
  paymentStatus: 'unpaid' | 'verification_pending' | 'paid';
  paymentUtr?: string;
  paymentScreenshots?: string[];
  paymentSubmittedAt?: Date;
  paymentVerifiedAt?: Date;
  paymentVerifiedBy?: mongoose.Types.ObjectId;
  paymentNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const B2BInvoiceSchema: Schema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    invoiceDate: { type: Date, required: true, default: Date.now },
    items: [
      {
        productName: { type: String, required: true },
        hsnCode: { type: String },
        qty: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
        taxRate: { type: Number, required: true, min: 0 },
        taxAmount: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    totalTaxAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    tallySyncStatus: {
      type: String,
      enum: ['pending', 'synced', 'failed', 'manual'],
      default: 'pending',
      index: true,
    },
    tallyVoucherNumber: { type: String },
    tallyVoucherGuid: { type: String },
    tallySyncAt: { type: Date },
    tallySyncError: { type: String },
    tallyXmlPayload: { type: String },
    buyerOrderNo: { type: String },
    buyerOrderDate: { type: Date },
    dispatchDocNo: { type: String },
    dispatchDate: { type: Date },
    despatchedThrough: { type: String },
    destination: { type: String },
    termsOfDelivery: { type: String },
    paymentTerms: { type: String },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'verification_pending', 'paid'],
      default: 'unpaid',
      index: true,
    },
    paymentUtr: { type: String, trim: true },
    paymentScreenshots: [{ type: String }],
    paymentSubmittedAt: { type: Date },
    paymentVerifiedAt: { type: Date },
    paymentVerifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paymentNotes: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

export const B2BInvoice = mongoose.model<IB2BInvoice>('B2BInvoice', B2BInvoiceSchema);
