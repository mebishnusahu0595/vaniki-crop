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
  },
  {
    timestamps: true,
  }
);

export const B2BInvoice = mongoose.model<IB2BInvoice>('B2BInvoice', B2BInvoiceSchema);
