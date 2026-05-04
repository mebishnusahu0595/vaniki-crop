import PDFDocument from 'pdfkit';

/**
 * Generates a professional tax invoice PDF for an order.
 * @param order Order document with populated items and store
 * @returns Buffer containing the PDF data
 */
export async function generateInvoicePdf(order: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const store = order.storeId;
      const customer = order.userId;

      // ─── Header ────────────────────────────────────────────────────────────
      // Logo (if available)
      // doc.image('path/to/logo.png', 50, 45, { width: 50 });
      
      doc.fillColor('#444444')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('TAX INVOICE', 50, 50, { align: 'right' });
        
      doc.fontSize(10)
        .font('Helvetica')
        .text('(Original for Recipient)', 50, 75, { align: 'right' });

      // ─── Addresses ─────────────────────────────────────────────────────────
      const addressTop = 100;
      
      // Sold By
      doc.fontSize(10).font('Helvetica-Bold').text('Sold By:', 50, addressTop);
      doc.font('Helvetica').text(store.name, 50, addressTop + 15);
      doc.text(`${store.address.street},`, 50, addressTop + 30);
      doc.text(`${store.address.city}, ${store.address.state}, ${store.address.pincode}`, 50, addressTop + 45);
      doc.text(`Contact: ${store.phone || '9302228883'}`, 50, addressTop + 60);
      doc.text('IN', 50, addressTop + 75);
      
      if (store.gstNumber) {
        doc.font('Helvetica-Bold').text('GSTIN:', 50, addressTop + 95);
        doc.font('Helvetica').text(store.gstNumber, 100, addressTop + 95);
      }

      // Billing/Shipping
      doc.font('Helvetica-Bold').text('Billing Address:', 350, addressTop);
      doc.font('Helvetica').text(order.shippingAddress?.name || customer?.name || 'Customer', 350, addressTop + 15);
      if (order.shippingAddress) {
        doc.text(order.shippingAddress.street, 350, addressTop + 30);
        doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.pincode}`, 350, addressTop + 45);
      } else if (customer?.savedAddress) {
        doc.text(customer.savedAddress.street, 350, addressTop + 30);
        doc.text(`${customer.savedAddress.city}, ${customer.savedAddress.state}, ${customer.savedAddress.pincode}`, 350, addressTop + 45);
      }
      doc.text('IN', 350, addressTop + 60);

      // ─── Order Info ────────────────────────────────────────────────────────
      const infoTop = 220;
      doc.font('Helvetica-Bold').text('Order Number:', 50, infoTop);
      doc.font('Helvetica').text(order.orderNumber, 130, infoTop);
      
      doc.font('Helvetica-Bold').text('Order Date:', 50, infoTop + 15);
      doc.font('Helvetica').text(new Date(order.createdAt).toLocaleDateString('en-IN'), 130, infoTop + 15);

      doc.font('Helvetica-Bold').text('Invoice Number:', 350, infoTop);
      doc.font('Helvetica').text(`INV-${order.orderNumber.split('-').slice(1).join('-')}`, 440, infoTop);
      
      doc.font('Helvetica-Bold').text('Billing Date:', 350, infoTop + 15);
      doc.font('Helvetica').text(new Date().toLocaleDateString('en-IN'), 440, infoTop + 15);

      // ─── Table ─────────────────────────────────────────────────────────────
      const tableTop = 280;
      doc.font('Helvetica-Bold').fontSize(9);
      
      // Header
      doc.text('Sl.', 50, tableTop, { width: 20 });
      doc.text('Description', 80, tableTop, { width: 120 });
      doc.text('Pack', 210, tableTop, { width: 50 });
      doc.text('Unit Price', 270, tableTop, { width: 60, align: 'right' });
      doc.text('Qty', 340, tableTop, { width: 30, align: 'right' });
      doc.text('Net Amt', 380, tableTop, { width: 60, align: 'right' });
      doc.text('Tax %', 450, tableTop, { width: 30, align: 'right' });
      doc.text('Tax Amt', 490, tableTop, { width: 50, align: 'right' });
      doc.text('Total', 550, tableTop, { width: 40, align: 'right' });

      doc.moveTo(50, tableTop + 15).lineTo(590, tableTop + 15).stroke();

      let currentTop = tableTop + 25;
      let subtotalNet = 0;
      let subtotalTax = 0;

      doc.font('Helvetica').fontSize(8);

      order.items.forEach((item: any, index: number) => {
        // FORCE 18% if 0 or missing
        const taxRate = (item.taxRate && item.taxRate > 0) ? item.taxRate : 18;
        const total = item.price * item.qty;
        const netAmt = total / (1 + taxRate / 100);
        const taxAmt = total - netAmt;
        const unitPriceNet = netAmt / item.qty;

        subtotalNet += netAmt;
        subtotalTax += taxAmt;

        const cleanName = item.productName.replace(/\(.*\)/, '').trim();
        const packSize = item.variantLabel || '';

        doc.text(`${index + 1}`, 50, currentTop, { width: 20 });
        doc.text(cleanName, 80, currentTop, { width: 120 });
        doc.text(packSize, 210, currentTop, { width: 50 });
        doc.text(unitPriceNet.toFixed(2), 270, currentTop, { width: 60, align: 'right' });
        doc.text(item.qty.toString(), 340, currentTop, { width: 30, align: 'right' });
        doc.text(netAmt.toFixed(2), 380, currentTop, { width: 60, align: 'right' });
        doc.text(`${taxRate}%`, 450, currentTop, { width: 30, align: 'right' });
        doc.text(taxAmt.toFixed(2), 490, currentTop, { width: 50, align: 'right' });
        doc.text(total.toFixed(2), 550, currentTop, { width: 40, align: 'right' });

        // Tax split row
        currentTop += 12;
        doc.fontSize(7).fillColor('#777777');
        doc.text(`CGST ${(taxRate/2).toFixed(1)}%: ${(taxAmt/2).toFixed(2)} | SGST ${(taxRate/2).toFixed(1)}%: ${(taxAmt/2).toFixed(2)}`, 80, currentTop);
        doc.fillColor('#000000').fontSize(8);

        currentTop += 20;
      });

      doc.moveTo(50, currentTop).lineTo(590, currentTop).stroke();

      // ─── Summary ───────────────────────────────────────────────────────────
      const summaryTop = currentTop + 20;
      const summaryX = 380;
      const valueX = 520;

      doc.font('Helvetica-Bold');
      doc.text('SUBTOTAL:', summaryX, summaryTop);
      doc.text(`₹${subtotalNet.toFixed(2)}`, valueX, summaryTop, { width: 70, align: 'right' });

      doc.text(`CGST (9%):`, summaryX, summaryTop + 15);
      doc.text(`₹${(subtotalTax / 2).toFixed(2)}`, valueX, summaryTop + 15, { width: 70, align: 'right' });

      doc.text(`SGST (9%):`, summaryX, summaryTop + 30);
      doc.text(`₹${(subtotalTax / 2).toFixed(2)}`, valueX, summaryTop + 30, { width: 70, align: 'right' });

      const deliveryCharge = (order.serviceMode === 'pickup') ? 0 : (order.deliveryCharge || 0);
      doc.text('DELIVERY CHARGE:', summaryX, summaryTop + 45);
      doc.text(`₹${deliveryCharge.toFixed(2)}`, valueX, summaryTop + 45, { width: 70, align: 'right' });

      if (order.serviceMode === 'pickup') {
        doc.fontSize(7).font('Helvetica-Oblique').text('(MODE: STORE PICKUP)', summaryX, summaryTop + 55);
      }

      const grandTotal = subtotalNet + subtotalTax + deliveryCharge;
      doc.fontSize(14).text('TOTAL:', summaryX, summaryTop + 70);
      doc.text(`₹${grandTotal.toFixed(2)}`, valueX - 10, summaryTop + 70, { width: 80, align: 'right' });

      // ─── Footer ────────────────────────────────────────────────────────────
      const footerTop = 730;
      doc.moveTo(50, footerTop).lineTo(545, footerTop).stroke();
      
      doc.fontSize(8)
        .font('Helvetica')
        .text('This is a computer generated invoice and does not require a physical signature.', 50, footerTop + 15, { align: 'center', width: 500 });
        
      doc.font('Helvetica-Bold')
        .text('Store Contact: 9302228883 | teams@vanikicrop.com', 50, footerTop + 30, { align: 'center', width: 500 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates B2B invoice (same logic, adapted for B2B data structure)
 */
export async function generateB2BInvoicePdf(data: any): Promise<Buffer> {
  // Adaptation of above logic for B2B invoices generated manually by admin
  const orderMock = {
    orderNumber: data.invoiceNumber || `B2B-${Date.now()}`,
    createdAt: data.invoiceDate || new Date(),
    storeId: data.storeId || { name: 'VANIKI CROP', address: { street: 'Main Road', city: 'Bhilai', state: 'CG', pincode: '490001' } },
    userId: data.customerId || { name: 'Business Partner' },
    items: data.items.map((i: any) => ({
      productName: i.productName,
      variantLabel: i.variantLabel,
      price: i.price,
      qty: i.qty,
      taxRate: i.taxRate || 18,
      hsnCode: i.hsnCode
    })),
    serviceMode: 'delivery',
    deliveryCharge: 0,
    totalAmount: data.totalAmount
  };
  
  return generateInvoicePdf(orderMock);
}
