import PDFDocument from 'pdfkit';
import { type IOrder } from '../../models/Order.model.js';
import { type IStore } from '../../models/Store.model.js';
import { type IUser } from '../../models/User.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import converter from 'number-to-words';

export async function generateOrderInvoice(order: IOrder, user: IUser, store: IStore): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: any[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const siteSettings = await SiteSetting.findOne({ singletonKey: 'default' });

      // ─── Header ────────────────────────────────────────────────────────────
      // Logo (Placeholder text if logo fails, but we use text for branding)
      doc.fillColor('#2D6A4F').fontSize(24).font('Helvetica-Bold').text('Vaniki Crop', 50, 45);
      doc.fillColor('#444444').fontSize(10).font('Helvetica').text('Tax Invoice/Bill of Supply/Cash Memo', 200, 50, { align: 'right' });
      doc.text('(Original for Recipient)', 200, 65, { align: 'right' });

      doc.moveDown();
      generateHr(doc, 90);

      // ─── Addresses ─────────────────────────────────────────────────────────
      const customerTop = 100;
      doc.fontSize(10).font('Helvetica-Bold').text('Sold By:', 50, customerTop);
      doc.font('Helvetica').text(store.name, 50, customerTop + 15);
      doc.text(`${store.address.street},`, 50, customerTop + 30);
      doc.text(`${store.address.city}, ${store.address.state}, ${store.address.pincode}`, 50, customerTop + 45);
      doc.text('IN', 50, customerTop + 60);
      
      if (store.panNumber) {
        doc.font('Helvetica-Bold').text('PAN No:', 50, customerTop + 80);
        doc.font('Helvetica').text(store.panNumber, 100, customerTop + 80);
      }
      
      if (store.gstNumber) {
        doc.font('Helvetica-Bold').text('GST Registration No:', 50, customerTop + 95);
        doc.font('Helvetica').text(store.gstNumber, 155, customerTop + 95);
      }

      // Billing Address
      doc.font('Helvetica-Bold').text('Billing Address:', 350, customerTop);
      doc.font('Helvetica').text(order.shippingAddress?.name || user.name || 'Customer', 350, customerTop + 15);
      if (order.shippingAddress) {
        doc.text(`${order.shippingAddress.street},`, 350, customerTop + 30);
        doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.pincode}`, 350, customerTop + 45);
        doc.text('IN', 350, customerTop + 60);
      }

      // Shipping Address
      doc.font('Helvetica-Bold').text('Shipping Address:', 350, customerTop + 80);
      doc.font('Helvetica').text(order.shippingAddress?.name || user.name || 'Customer', 350, customerTop + 95);
      if (order.shippingAddress) {
        doc.text(`${order.shippingAddress.street},`, 350, customerTop + 110);
        doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.pincode}`, 350, customerTop + 125);
        doc.text('IN', 350, customerTop + 140);
      }

      // ─── Order Details ─────────────────────────────────────────────────────
      const orderTop = 260;
      doc.font('Helvetica-Bold').text('Order Number:', 50, orderTop);
      doc.font('Helvetica').text(order.orderNumber, 130, orderTop);
      
      doc.font('Helvetica-Bold').text('Invoice Number:', 350, orderTop);
      doc.font('Helvetica').text(`INV-${order.orderNumber.split('-').slice(1).join('-')}`, 440, orderTop);

      doc.font('Helvetica-Bold').text('Order Date:', 50, orderTop + 15);
      doc.font('Helvetica').text(order.createdAt.toLocaleDateString('en-IN'), 130, orderTop + 15);

      doc.font('Helvetica-Bold').text('Invoice Date:', 350, orderTop + 15);
      doc.font('Helvetica').text(new Date().toLocaleDateString('en-IN'), 440, orderTop + 15);

      // ─── Table ─────────────────────────────────────────────────────────────
      let i;
      const invoiceTableTop = 310;

      doc.font('Helvetica-Bold');
      generateTableRow(doc, invoiceTableTop, 'Sl. No', 'Description', 'Unit Price', 'Qty', 'Net Amount', 'Tax Rate', 'Tax Amount', 'Total');
      generateHr(doc, invoiceTableTop + 20);
      doc.font('Helvetica');

      for (i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const position = invoiceTableTop + (i + 1) * 35;
        
        generateTableRow(
          doc,
          position,
          (i + 1).toString(),
          `${item.productName} (${item.variantLabel})${item.hsnCode ? '\nHSN:' + item.hsnCode : ''}`,
          `₹${(item.price - (item.taxAmount || 0) / item.qty).toFixed(2)}`,
          item.qty.toString(),
          `₹${(item.netAmount || 0).toFixed(2)}`,
          `${item.taxRate || 0}%`,
          `₹${(item.taxAmount || 0).toFixed(2)}`,
          `₹${(item.price * item.qty).toFixed(2)}`
        );

        generateHr(doc, position + 30);
      }

      const subtotalPosition = invoiceTableTop + (i + 1) * 35;
      
      // Totals
      doc.font('Helvetica-Bold');
      doc.text('TOTAL:', 350, subtotalPosition + 10);
      doc.text(`₹${order.totalTaxAmount.toFixed(2)}`, 450, subtotalPosition + 10, { width: 50, align: 'right' });
      doc.text(`₹${order.totalAmount.toFixed(2)}`, 500, subtotalPosition + 10, { width: 50, align: 'right' });

      // Amount in words
      doc.fontSize(10).font('Helvetica-Bold').text('Amount in Words:', 50, subtotalPosition + 40);
      const words = converter.toWords(Math.floor(order.totalAmount)).replace(/^\w/, (c) => c.toUpperCase());
      doc.font('Helvetica').text(`${words} Rupees Only`, 50, subtotalPosition + 55);

      // ─── Footer ────────────────────────────────────────────────────────────
      const footerTop = 750;
      doc.fontSize(8).font('Helvetica').text('This is a computer generated invoice and does not require a physical signature.', 50, footerTop, { align: 'center', width: 500 });
      doc.text('Store Contact: 9302228883 | teams@vanikicrop.com', 50, footerTop + 15, { align: 'center', width: 500 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function generateB2BInvoice(data: any, siteSettings: any, store: IStore): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: any[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // ─── Header ────────────────────────────────────────────────────────────
      doc.fillColor('#2D6A4F').fontSize(24).font('Helvetica-Bold').text(siteSettings.platformName || 'Vaniki Crop', 50, 45);
      doc.fillColor('#444444').fontSize(10).font('Helvetica').text('Tax Invoice (B2B)', 200, 50, { align: 'right' });
      doc.text('(Original for Recipient)', 200, 65, { align: 'right' });

      doc.moveDown();
      generateHr(doc, 90);

      // ─── Addresses ─────────────────────────────────────────────────────────
      const addressTop = 100;
      doc.fontSize(10).font('Helvetica-Bold').text('Sold By (Platform):', 50, addressTop);
      doc.font('Helvetica').text(siteSettings.platformName || 'Vaniki Crop', 50, addressTop + 15);
      if (siteSettings.address) {
        doc.text(`${siteSettings.address.street},`, 50, addressTop + 30);
        doc.text(`${siteSettings.address.city}, ${siteSettings.address.state}, ${siteSettings.address.pincode}`, 50, addressTop + 45);
      }
      doc.text('IN', 50, addressTop + 60);
      
      if (siteSettings.panNumber) {
        doc.font('Helvetica-Bold').text('PAN No:', 50, addressTop + 80);
        doc.font('Helvetica').text(siteSettings.panNumber, 100, addressTop + 80);
      }
      
      if (siteSettings.gstNumber) {
        doc.font('Helvetica-Bold').text('GST Registration No:', 50, addressTop + 95);
        doc.font('Helvetica').text(siteSettings.gstNumber, 155, addressTop + 95);
      }

      // Customer (Store Admin) Address
      doc.font('Helvetica-Bold').text('Bill To (Store):', 350, addressTop);
      doc.font('Helvetica').text(store.name, 350, addressTop + 15);
      doc.text(`${store.address.street},`, 350, addressTop + 30);
      doc.text(`${store.address.city}, ${store.address.state}, ${store.address.pincode}`, 350, addressTop + 45);
      doc.text('IN', 350, addressTop + 60);

      if (store.gstNumber) {
        doc.font('Helvetica-Bold').text('GSTIN:', 350, addressTop + 80);
        doc.font('Helvetica').text(store.gstNumber, 400, addressTop + 80);
      }

      // ─── Invoice Details ───────────────────────────────────────────────────
      const invTop = 260;
      doc.font('Helvetica-Bold').text('Invoice Number:', 50, invTop);
      doc.font('Helvetica').text(data.invoiceNumber || `B2B-${Date.now()}`, 130, invTop);
      
      doc.font('Helvetica-Bold').text('Invoice Date:', 350, invTop);
      doc.font('Helvetica').text(data.invoiceDate || new Date().toLocaleDateString('en-IN'), 440, invTop);

      // ─── Table ─────────────────────────────────────────────────────────────
      let i;
      const tableTop = 310;

      doc.font('Helvetica-Bold');
      generateTableRow(doc, tableTop, 'Sl. No', 'Description', 'Unit Price', 'Qty', 'Net Amount', 'Tax Rate', 'Tax Amount', 'Total');
      generateHr(doc, tableTop + 20);
      doc.font('Helvetica');

      let totalTaxAmount = 0;
      let totalAmount = 0;

      for (i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const position = tableTop + (i + 1) * 35;
        
        const taxRate = item.taxRate || 0;
        const taxAmount = (item.price * item.qty * taxRate) / 100;
        const itemTotal = (item.price * item.qty) + taxAmount;
        
        totalTaxAmount += taxAmount;
        totalAmount += itemTotal;

        generateTableRow(
          doc,
          position,
          (i + 1).toString(),
          `${item.productName}${item.hsnCode ? '\nHSN:' + item.hsnCode : ''}`,
          `₹${item.price.toFixed(2)}`,
          item.qty.toString(),
          `₹${(item.price * item.qty).toFixed(2)}`,
          `${taxRate}%`,
          `₹${taxAmount.toFixed(2)}`,
          `₹${itemTotal.toFixed(2)}`
        );

        generateHr(doc, position + 30);
      }

      const totalPosition = tableTop + (i + 1) * 35;
      
      doc.font('Helvetica-Bold');
      doc.text('TOTAL:', 350, totalPosition + 10);
      doc.text(`₹${totalTaxAmount.toFixed(2)}`, 450, totalPosition + 10, { width: 50, align: 'right' });
      doc.text(`₹${totalAmount.toFixed(2)}`, 500, totalPosition + 10, { width: 50, align: 'right' });

      // Amount in words
      doc.fontSize(10).font('Helvetica-Bold').text('Amount in Words:', 50, totalPosition + 40);
      const words = converter.toWords(Math.floor(totalAmount)).replace(/^\w/, (c) => c.toUpperCase());
      doc.font('Helvetica').text(`${words} Rupees Only`, 50, totalPosition + 55);

      // ─── Footer ────────────────────────────────────────────────────────────
      const footerTop = 750;
      doc.fontSize(8).font('Helvetica').text('This is a computer generated invoice and does not require a physical signature.', 50, footerTop, { align: 'center', width: 500 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function generateHr(doc: any, y: number) {
  doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

function generateTableRow(
  doc: any,
  y: number,
  slNo: string,
  desc: string,
  unitPrice: string,
  qty: string,
  netAmt: string,
  taxRate: string,
  taxAmt: string,
  total: string
) {
  doc.fontSize(8)
    .text(slNo, 50, y, { width: 30, align: 'left' })
    .text(desc, 80, y, { width: 140, align: 'left' })
    .text(unitPrice, 220, y, { width: 50, align: 'right' })
    .text(qty, 270, y, { width: 30, align: 'right' })
    .text(netAmt, 300, y, { width: 60, align: 'right' })
    .text(taxRate, 360, y, { width: 40, align: 'right' })
    .text(taxAmt, 400, y, { width: 60, align: 'right' })
    .text(total, 470, y, { width: 80, align: 'right' });
}
