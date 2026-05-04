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
      doc.text(`Contact: ${store.phone}`, 50, customerTop + 60);
      doc.text('IN', 50, customerTop + 75);
      
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

      doc.font('Helvetica-Bold').text('Billing Date:', 350, orderTop + 15);
      doc.font('Helvetica').text(order.createdAt.toLocaleDateString('en-IN'), 440, orderTop + 15);

      doc.font('Helvetica-Bold').text('Invoice Date:', 350, orderTop + 30);
      doc.font('Helvetica').text(new Date().toLocaleDateString('en-IN'), 440, orderTop + 30);

      // ─── Table ─────────────────────────────────────────────────────────────
      let i;
      const invoiceTableTop = 310;

      doc.font('Helvetica-Bold');
      generateTableRow(doc, invoiceTableTop, 'Sl. No', 'Description', 'Unit Price', 'Qty', 'Net Amount', 'Tax Rate', 'Tax Amount', 'Total');
      generateHr(doc, invoiceTableTop + 20);
      doc.font('Helvetica');

      let totalNetAmount = 0;
      let totalTaxAmount = 0;

      for (i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const position = invoiceTableTop + (i + 1) * 35;
        
        // Backward tax calculation: Price is inclusive of tax
        const taxRate = item.taxRate || 0;
        const netUnitPrice = item.price / (1 + taxRate / 100);
        const itemNetAmount = netUnitPrice * item.qty;
        const itemTaxAmount = (item.price * item.qty) - itemNetAmount;
        const cgst = itemTaxAmount / 2;
        const sgst = itemTaxAmount / 2;

        totalNetAmount += itemNetAmount;
        totalTaxAmount += itemTaxAmount;
        
        generateTableRow(
          doc,
          position,
          (i + 1).toString(),
          `${item.productName} (${item.variantLabel})${item.hsnCode ? '\nHSN: ' + item.hsnCode : ''}\nCGST 9%: ₹${cgst.toFixed(2)} | SGST 9%: ₹${sgst.toFixed(2)}`,
          `₹${netUnitPrice.toFixed(2)}`,
          item.qty.toString(),
          `₹${itemNetAmount.toFixed(2)}`,
          `${taxRate}%`,
          `₹${itemTaxAmount.toFixed(2)}`,
          `₹${(item.price * item.qty).toFixed(2)}`
        );

        generateHr(doc, position + 30);
      }

      const subtotalPosition = invoiceTableTop + (i + 1) * 35;
      
      // Totals
      doc.font('Helvetica-Bold');
      
      const summaryX = 350;
      let currentY = subtotalPosition + 10;

      doc.text('SUBTOTAL:', summaryX, currentY);
      doc.text(`₹${totalNetAmount.toFixed(2)}`, 500, currentY, { width: 50, align: 'right' });
      
      currentY += 15;
      doc.text('CGST (9%):', summaryX, currentY);
      doc.text(`₹${(totalTaxAmount / 2).toFixed(2)}`, 500, currentY, { width: 50, align: 'right' });
      
      currentY += 15;
      doc.text('SGST (9%):', summaryX, currentY);
      doc.text(`₹${(totalTaxAmount / 2).toFixed(2)}`, 500, currentY, { width: 50, align: 'right' });

      if (order.serviceMode === 'delivery') {
        currentY += 15;
        doc.text('DELIVERY CHARGE:', summaryX, currentY);
        doc.text(`₹${(order.deliveryCharge || 50).toFixed(2)}`, 500, currentY, { width: 50, align: 'right' });
      } else {
        currentY += 15;
        doc.text('MODE: PICKUP', summaryX, currentY);
        doc.text('₹0.00', 500, currentY, { width: 50, align: 'right' });
      }

      currentY += 20;
      doc.fontSize(12).text('TOTAL:', summaryX, currentY);
      doc.text(`₹${order.totalAmount.toFixed(2)}`, 480, currentY, { width: 70, align: 'right' });

      // Amount in words
      doc.fontSize(10).font('Helvetica-Bold').text('Amount in Words:', 50, currentY + 40);
      const words = converter.toWords(Math.floor(order.totalAmount)).replace(/^\w/, (c) => c.toUpperCase());
      doc.font('Helvetica').text(`${words} Rupees Only`, 50, currentY + 55);

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
      
      // Table Header with Pack Column
      const tableTop = 330;
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('Sl. No', 50, tableTop);
      doc.text('Description', 90, tableTop);
      doc.text('Pack', 220, tableTop);
      doc.text('Unit Price', 270, tableTop, { width: 60, align: 'right' });
      doc.text('Qty', 335, tableTop, { width: 30, align: 'right' });
      doc.text('Net Amt', 370, tableTop, { width: 60, align: 'right' });
      doc.text('Tax %', 435, tableTop, { width: 40, align: 'right' });
      doc.text('Tax Amt', 480, tableTop, { width: 50, align: 'right' });
      doc.text('Total', 535, tableTop, { width: 50, align: 'right' });

      doc.moveTo(50, tableTop + 15).lineTo(585, tableTop + 15).stroke();

      let currentTop = tableTop + 25;
      doc.font('Helvetica').fontSize(8);

      data.items.forEach((item: any, index: number) => {
        // Force 18% if tax is not set or 0
        const effectiveTaxRate = (item.taxRate && item.taxRate > 0) ? item.taxRate : 18;
        const totalPrice = item.price * item.qty;
        
        // Backward calculation from inclusive price
        const netAmount = totalPrice / (1 + effectiveTaxRate / 100);
        const taxAmount = totalPrice - netAmount;
        const unitPriceNet = netAmount / item.qty;

        const cgst = taxAmount / 2;
        const sgst = taxAmount / 2;

        // Clean name (remove pack size from name if it exists)
        const cleanName = item.productName.replace(/\(.*\)/, '').trim();
        const packSize = item.variantLabel || '';

        doc.text(`${index + 1}`, 50, currentTop);
        doc.text(cleanName, 90, currentTop, { width: 120 });
        doc.text(packSize, 220, currentTop, { width: 45 });
        doc.text(`${unitPriceNet.toFixed(2)}`, 270, currentTop, { width: 60, align: 'right' });
        doc.text(`${item.qty}`, 335, currentTop, { width: 30, align: 'right' });
        doc.text(`${netAmount.toFixed(2)}`, 370, currentTop, { width: 60, align: 'right' });
        doc.text(`${effectiveTaxRate}%`, 435, currentTop, { width: 40, align: 'right' });
        doc.text(`${taxAmount.toFixed(2)}`, 480, currentTop, { width: 50, align: 'right' });
        doc.text(`${totalPrice.toFixed(2)}`, 535, currentTop, { width: 50, align: 'right' });

        // Small tax break-up below name
        currentTop += 15;
        doc.fontSize(7).fillColor('#666666');
        doc.text(`CGST ${(effectiveTaxRate / 2).toFixed(1)}%: ${cgst.toFixed(2)} | SGST ${(effectiveTaxRate / 2).toFixed(1)}%: ${sgst.toFixed(2)}`, 90, currentTop);
        doc.fillColor('#000000').fontSize(8);

        currentTop += 20;
      });

      doc.font('Helvetica-Bold').text('Invoice Number:', 50, invTop);
      doc.font('Helvetica').text(data.invoiceNumber || `B2B-${Date.now()}`, 130, invTop);
      
      doc.font('Helvetica-Bold').text('Invoice Date:', 350, invTop);
      doc.font('Helvetica').text(data.invoiceDate || new Date().toLocaleDateString('en-IN'), 440, invTop);

      const totalNetAmount = data.items.reduce((sum: number, item: any) => {
        const effectiveTaxRate = (item.taxRate && item.taxRate > 0) ? item.taxRate : 18;
        return sum + (item.price * item.qty) / (1 + effectiveTaxRate / 100);
      }, 0);
      const totalTaxAmount = data.items.reduce((sum: number, item: any) => {
        const effectiveTaxRate = (item.taxRate && item.taxRate > 0) ? item.taxRate : 18;
        const total = item.price * item.qty;
        return sum + (total - total / (1 + effectiveTaxRate / 100));
      }, 0);
      const totalFinalAmount = data.items.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0);

      const summaryX = 350;
      let currentY = currentTop + 30;

      doc.text('SUBTOTAL:', summaryX, currentY);
      doc.text(`₹${totalNetAmount.toFixed(2)}`, 500, currentY, { width: 50, align: 'right' });
      
      currentY += 15;
      doc.text('CGST (9%):', summaryX, currentY);
      doc.text(`₹${(totalTaxAmount / 2).toFixed(2)}`, 500, currentY, { width: 50, align: 'right' });
      
      currentY += 15;
      doc.text('SGST (9%):', summaryX, currentY);
      doc.text(`₹${(totalTaxAmount / 2).toFixed(2)}`, 500, currentY, { width: 50, align: 'right' });

      currentY += 20;
      doc.fontSize(12).text('TOTAL:', summaryX, currentY);
      doc.text(`₹${totalFinalAmount.toFixed(2)}`, 480, currentY, { width: 70, align: 'right' });

      // Amount in words
      doc.fontSize(10).font('Helvetica-Bold').text('Amount in Words:', 50, currentY + 40);
      const words = converter.toWords(Math.floor(totalFinalAmount)).replace(/^\w/, (c) => c.toUpperCase());
      doc.font('Helvetica').text(`${words} Rupees Only`, 50, currentY + 55);

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
