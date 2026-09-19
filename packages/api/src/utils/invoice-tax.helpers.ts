import { B2BInvoice } from '../models/B2BInvoice.model.js';
import { Order } from '../models/Order.model.js';
import { Product } from '../models/Product.model.js';

/**
 * Backfills missing HSN codes, tax rates, and tax amounts for all existing B2B invoices and orders.
 * Runs safely on server startup or when triggered.
 */
export async function backfillInvoiceGstAndHsn(): Promise<{ updatedInvoices: number; updatedOrders: number }> {
  let updatedInvoices = 0;
  let updatedOrders = 0;

  try {
    // 1. Check all B2B Invoices
    const invoices = await B2BInvoice.find();
    for (const inv of invoices) {
      let modified = false;
      let totalTax = 0;
      let subtotal = 0;

      for (const item of inv.items) {
        let changed = false;
        if (!item.hsnCode || item.hsnCode.trim() === '') {
          // Try matching product
          const prod = await Product.findOne({ name: item.productName }).select('hsnCode taxRate variants');
          item.hsnCode = prod?.hsnCode || prod?.variants?.[0]?.hsnCode || '38089190';
          changed = true;
        }

        if (item.taxRate === undefined || item.taxRate === null) {
          const prod = await Product.findOne({ name: item.productName }).select('taxRate');
          item.taxRate = prod?.taxRate !== undefined ? prod.taxRate : 18;
          changed = true;
        }

        const lineGross = (item.price || 0) * (item.qty || 1);
        subtotal += lineGross;

        if (item.taxAmount === undefined || item.taxAmount === null || item.taxAmount === 0) {
          item.taxAmount = (lineGross * (item.taxRate || 18)) / 100;
          changed = true;
        }
        totalTax += item.taxAmount;

        if (!item.total || item.total === lineGross) {
          item.total = lineGross + item.taxAmount;
          changed = true;
        }

        if (changed) modified = true;
      }

      if (!inv.subtotal || inv.subtotal === 0) {
        inv.subtotal = subtotal;
        modified = true;
      }

      if (!inv.totalTaxAmount || inv.totalTaxAmount === 0) {
        inv.totalTaxAmount = totalTax;
        modified = true;
      }

      if (!inv.totalAmount || inv.totalAmount === inv.subtotal) {
        inv.totalAmount = inv.subtotal + inv.totalTaxAmount;
        modified = true;
      }

      if (modified) {
        await inv.save();
        updatedInvoices++;
      }
    }

    // 2. Check Orders
    const orders = await Order.find();
    for (const order of orders) {
      let orderModified = false;
      for (const item of order.items) {
        if (!item.hsnCode || item.hsnCode.trim() === '') {
          const prod = await Product.findById(item.productId).select('hsnCode taxRate variants');
          item.hsnCode = prod?.hsnCode || prod?.variants?.[0]?.hsnCode || '38089190';
          if (item.taxRate === undefined || item.taxRate === null) {
            item.taxRate = prod?.taxRate !== undefined ? prod.taxRate : 18;
          }
          orderModified = true;
        }
      }

      if (orderModified) {
        await order.save();
        updatedOrders++;
      }
    }

    if (updatedInvoices > 0 || updatedOrders > 0) {
      console.log(`✅ Backfilled GST/HSN for ${updatedInvoices} B2B invoices and ${updatedOrders} retail orders.`);
    }
  } catch (error) {
    console.error('⚠️ Error during invoice GST/HSN backfill:', error);
  }

  return { updatedInvoices, updatedOrders };
}
