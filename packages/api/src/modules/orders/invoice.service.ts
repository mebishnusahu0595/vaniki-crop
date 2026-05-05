import PDFDocument from 'pdfkit';

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function formatAddress(address?: Record<string, any> | null) {
  if (!address) return '-';
  return [address.street, address.city, address.state, address.pincode].filter(Boolean).join(', ');
}

function getDocId(value: any) {
  return value?._id?.toString?.() || value?.id || value?.toString?.() || '';
}

function getLineItemTax(item: any) {
  const taxRate = item.taxRate && item.taxRate > 0 ? Number(item.taxRate) : 18;
  const grossAmount = Number(item.price || 0) * Number(item.qty || 0);
  const netAmount = item.netAmount && item.netAmount > 0
    ? Number(item.netAmount)
    : grossAmount / (1 + taxRate / 100);
  const taxAmount = item.taxAmount && item.taxAmount > 0
    ? Number(item.taxAmount)
    : grossAmount - netAmount;
  const halfTaxRate = taxRate / 2;
  const halfTaxAmount = taxAmount / 2;

  return {
    taxRate,
    grossAmount,
    netAmount,
    taxAmount,
    cgstRate: halfTaxRate,
    sgstRate: halfTaxRate,
    cgstAmount: halfTaxAmount,
    sgstAmount: halfTaxAmount,
  };
}

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

      const store = order.storeId || {};
      const customer = order.userId || {};
      const deliveryAddress = order.shippingAddress || customer.savedAddress;
      const serviceMode = order.serviceMode === 'pickup' ? 'Store pickup' : 'Delivery';
      const invoiceNumber = `INV-${String(order.orderNumber || getDocId(order)).replace(/^VNK-?/, '')}`;

      doc.rect(0, 0, 595.28, 96).fill('#143D2E');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24).text('TAX INVOICE', 50, 34);
      doc.font('Helvetica').fontSize(9).text('Original for Recipient', 50, 64);
      doc.font('Helvetica-Bold').fontSize(11).text('Vaniki Crop', 380, 34, { width: 165, align: 'right' });
      doc.font('Helvetica').fontSize(8).text('teams@vanikicrop.com | 9302228883', 330, 54, { width: 215, align: 'right' });

      const addressTop = 120;
      doc.fillColor('#143D2E').font('Helvetica-Bold').fontSize(10).text('Sold By', 50, addressTop);
      doc.fillColor('#1F2937').font('Helvetica').fontSize(9)
        .text(store.name || 'Vaniki Crop Store', 50, addressTop + 16, { width: 230 })
        .text(formatAddress(store.address), 50, addressTop + 31, { width: 230 })
        .text(`Contact: ${store.phone || '9302228883'}`, 50, addressTop + 58, { width: 230 })
        .text(`GSTIN: ${store.gstNumber || store.sgstNumber || '-'}`, 50, addressTop + 73, { width: 230 });

      doc.fillColor('#143D2E').font('Helvetica-Bold').fontSize(10).text('Bill To / Ship To', 330, addressTop);
      doc.fillColor('#1F2937').font('Helvetica').fontSize(9)
        .text(order.shippingAddress?.name || customer.name || 'Customer', 330, addressTop + 16, { width: 215 })
        .text(`Mobile: ${order.shippingAddress?.mobile || customer.mobile || '-'}`, 330, addressTop + 31, { width: 215 })
        .text(formatAddress(deliveryAddress), 330, addressTop + 46, { width: 215 });

      const infoTop = 230;
      const infoRows = [
        ['Order Number', order.orderNumber || '-'],
        ['Order Date', order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '-'],
        ['Invoice Number', invoiceNumber],
        ['Invoice Date', new Date().toLocaleDateString('en-IN')],
        ['Fulfillment', serviceMode],
        ['Payment', `${String(order.paymentMethod || '-').toUpperCase()} / ${order.paymentStatus || '-'}`],
      ];

      doc.roundedRect(50, infoTop - 10, 495, 66, 10).fillAndStroke('#F0F8F4', '#CDEBDD');
      infoRows.forEach(([label, value], index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const x = 68 + column * 160;
        const y = infoTop + row * 30;
        doc.fillColor('#2D6A4F').font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x, y);
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text(String(value), x, y + 11, { width: 145 });
      });

      const tableTop = 330;
      const columns = [
        { label: '#', x: 50, width: 18, align: 'left' as const },
        { label: 'Product', x: 72, width: 108, align: 'left' as const },
        { label: 'HSN', x: 184, width: 42, align: 'left' as const },
        { label: 'Pack', x: 230, width: 46, align: 'left' as const },
        { label: 'Qty', x: 280, width: 28, align: 'right' as const },
        { label: 'Taxable', x: 313, width: 58, align: 'right' as const },
        { label: 'CGST', x: 376, width: 48, align: 'right' as const },
        { label: 'SGST', x: 429, width: 48, align: 'right' as const },
        { label: 'Total', x: 482, width: 63, align: 'right' as const },
      ];

      doc.roundedRect(50, tableTop - 12, 495, 26, 8).fill('#143D2E');
      columns.forEach((column) => {
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7).text(column.label, column.x, tableTop - 3, {
          width: column.width,
          align: column.align,
        });
      });

      let currentTop = tableTop + 25;
      let subtotalNet = 0;
      let subtotalTax = 0;
      let subtotalGross = 0;

      order.items.forEach((item: any, index: number) => {
        if (currentTop > 675) {
          doc.addPage();
          currentTop = 60;
        }

        const tax = getLineItemTax(item);
        subtotalNet += tax.netAmount;
        subtotalTax += tax.taxAmount;
        subtotalGross += tax.grossAmount;

        const productName = String(item.productName || 'Product').replace(/\(.*\)/, '').trim();
        const rowHeight = 36;
        if (index % 2 === 0) {
          doc.roundedRect(50, currentTop - 8, 495, rowHeight, 6).fill('#F8FCFA');
        }

        const values = [
          String(index + 1),
          productName,
          item.hsnCode || '-',
          item.variantLabel || '-',
          String(item.qty || 0),
          tax.netAmount.toFixed(2),
          `${tax.cgstRate.toFixed(0)}% ${tax.cgstAmount.toFixed(2)}`,
          `${tax.sgstRate.toFixed(0)}% ${tax.sgstAmount.toFixed(2)}`,
          tax.grossAmount.toFixed(2),
        ];

        columns.forEach((column, columnIndex) => {
          doc.fillColor('#111827')
            .font(columnIndex === 1 ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(columnIndex === 1 ? 7.5 : 7)
            .text(values[columnIndex], column.x, currentTop, {
              width: column.width,
              align: column.align,
              ellipsis: true,
            });
        });

        currentTop += rowHeight;
      });

      doc.moveTo(50, currentTop).lineTo(545, currentTop).strokeColor('#CDEBDD').stroke();

      const deliveryCharge = order.serviceMode === 'pickup' ? 0 : Number(order.deliveryCharge || 0);
      const discount = Number(order.couponDiscount || 0) + Number(order.loyaltyDiscount || 0) + Number(order.discount || 0);
      const expectedTotal = Math.max(0, subtotalGross - discount + deliveryCharge);
      const payableTotal = Number(order.totalAmount || expectedTotal);
      const summaryTop = Math.min(currentTop + 18, 665);
      const summaryX = 345;
      const valueX = 465;
      const summaryRows = [
        ['Taxable Value', subtotalNet],
        ['CGST 9%', subtotalTax / 2],
        ['SGST 9%', subtotalTax / 2],
        ['Gross Item Total', subtotalGross],
        ['Discount', -discount],
        [order.serviceMode === 'pickup' ? 'Delivery Charge (Pickup)' : 'Delivery Charge', deliveryCharge],
      ];

      doc.fillColor('#111827').font('Helvetica').fontSize(8);
      summaryRows.forEach(([label, value], index) => {
        const y = summaryTop + index * 15;
        doc.text(String(label), summaryX, y, { width: 110 });
        doc.text(formatMoney(Number(value)), valueX, y, { width: 80, align: 'right' });
      });

      doc.roundedRect(summaryX - 8, summaryTop + 92, 208, 30, 8).fill('#143D2E');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text('TOTAL PAYABLE', summaryX, summaryTop + 102);
      doc.text(formatMoney(payableTotal), valueX - 8, summaryTop + 102, { width: 88, align: 'right' });

      const footerTop = 745;
      doc.moveTo(50, footerTop).lineTo(545, footerTop).stroke();
      
      doc.fontSize(8)
        .fillColor('#111827')
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
