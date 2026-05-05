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

function formatRate(value: number) {
  const rate = Number(value || 0);
  return Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(2);
}

function getLineItemTax(item: any, storeTax?: { cgst: number; sgst: number }) {
  const configuredTaxRate = Number(storeTax?.cgst || 0) + Number(storeTax?.sgst || 0);
  const taxRate = configuredTaxRate > 0
    ? configuredTaxRate
    : item.taxRate && item.taxRate > 0
      ? Number(item.taxRate)
      : 18;
  const grossAmount = Number(item.price || 0) * Number(item.qty || 0);
  const netAmount = configuredTaxRate > 0
    ? grossAmount / (1 + taxRate / 100)
    : item.netAmount && item.netAmount > 0
    ? Number(item.netAmount)
    : grossAmount / (1 + taxRate / 100);
  const taxAmount = configuredTaxRate > 0
    ? grossAmount - netAmount
    : item.taxAmount && item.taxAmount > 0
    ? Number(item.taxAmount)
    : grossAmount - netAmount;
  const cgstRate = configuredTaxRate > 0 ? Number(storeTax?.cgst || 0) : taxRate / 2;
  const sgstRate = configuredTaxRate > 0 ? Number(storeTax?.sgst || 0) : taxRate / 2;
  const cgstAmount = configuredTaxRate > 0 ? taxAmount * (cgstRate / configuredTaxRate) : taxAmount / 2;
  const sgstAmount = configuredTaxRate > 0 ? taxAmount * (sgstRate / configuredTaxRate) : taxAmount / 2;

  return {
    taxRate,
    grossAmount,
    netAmount,
    taxAmount,
    cgstRate,
    sgstRate,
    cgstAmount,
    sgstAmount,
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
      const pageMargin = 36;
      const doc = new PDFDocument({ margin: pageMargin, size: 'A4', layout: 'portrait' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const rightEdge = pageWidth - pageMargin;
      const contentWidth = pageWidth - pageMargin * 2;
      const store = order.storeId || {};
      const customer = order.userId || {};
      const deliveryAddress = order.shippingAddress || customer.savedAddress;
      const serviceMode = order.serviceMode === 'pickup' ? 'Store pickup' : 'Delivery';
      const invoiceNumber = `INV-${String(order.orderNumber || getDocId(order)).replace(/^VNK-?/, '')}`;
      const storeTax = Number(store.cgst || 0) + Number(store.sgst || 0) > 0
        ? { cgst: Number(store.cgst || 0), sgst: Number(store.sgst || 0) }
        : undefined;
      const columnGap = 20;
      const detailColumnWidth = (contentWidth - columnGap) / 2;
      const detailRightX = pageMargin + detailColumnWidth + columnGap;

      doc.rect(0, 0, pageWidth, 70).fill('#143D2E');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('TAX INVOICE', pageMargin, 20);
      doc.font('Helvetica').fontSize(8).text('Original for Recipient', pageMargin, 42);
      doc.font('Helvetica-Bold').fontSize(10).text('Vaniki Crop', pageWidth - pageMargin - 200, 22, { width: 200, align: 'right' });
      doc.font('Helvetica').fontSize(7.5).text('teams@vanikicrop.com | 9302228883', pageWidth - pageMargin - 200, 36, { width: 200, align: 'right' });

      const addressTop = 85;
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text('Sold By', pageMargin, addressTop);
      doc.fillColor('#111827').font('Helvetica').fontSize(8)
        .text(store.name || 'Vaniki Crop Store', pageMargin, addressTop + 13, { width: detailColumnWidth })
        .text(formatAddress(store.address), pageMargin, addressTop + 24, { width: detailColumnWidth })
        .text(`Contact: ${store.phone || '9302228883'}`, pageMargin, addressTop + 46, { width: detailColumnWidth })
        .text(`GSTIN: ${store.gstNumber || store.sgstNumber || '-'}`, pageMargin, addressTop + 57, { width: detailColumnWidth });

      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text('Bill To / Ship To', detailRightX, addressTop);
      doc.fillColor('#111827').font('Helvetica').fontSize(8)
        .text(order.shippingAddress?.name || customer.name || 'Customer', detailRightX, addressTop + 13, { width: detailColumnWidth })
        .text(`Mobile: ${order.shippingAddress?.mobile || customer.mobile || '-'}`, detailRightX, addressTop + 24, { width: detailColumnWidth })
        .text(formatAddress(deliveryAddress), detailRightX, addressTop + 35, { width: detailColumnWidth });

      const infoTop = 165;
      const infoRows = [
        ['Order Number', order.orderNumber || '-'],
        ['Order Date', order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '-'],
        ['Invoice Number', invoiceNumber],
        ['Invoice Date', new Date().toLocaleDateString('en-IN')],
        ['Fulfillment', serviceMode],
        ['Payment', `${String(order.paymentMethod || '-').toUpperCase()} / ${order.paymentStatus || '-'}`],
      ];

      doc.roundedRect(pageMargin, infoTop - 8, contentWidth, 50, 4).lineWidth(0.5).strokeColor('#E5E7EB').stroke();
      infoRows.forEach(([label, value], index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const columnWidth = contentWidth / 3;
        const x = pageMargin + 12 + column * columnWidth;
        const y = infoTop + row * 22;
        doc.fillColor('#6B7280').font('Helvetica').fontSize(6).text(label.toUpperCase(), x, y);
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8).text(String(value), x, y + 9, { width: columnWidth - 18 });
      });

      const tableTop = 235;
      const columns = [
        { label: '#', x: pageMargin, width: 14, align: 'left' as const },
        { label: 'Product', x: pageMargin + 14, width: 105, align: 'left' as const },
        { label: 'HSN', x: pageMargin + 120, width: 38, align: 'left' as const },
        { label: 'Pack', x: pageMargin + 160, width: 48, align: 'left' as const },
        { label: 'Qty', x: pageMargin + 210, width: 22, align: 'right' as const },
        { label: 'Taxable', x: pageMargin + 238, width: 50, align: 'right' as const },
        { label: 'CGST %', x: pageMargin + 294, width: 30, align: 'right' as const },
        { label: 'CGST Amt', x: pageMargin + 328, width: 44, align: 'right' as const },
        { label: 'SGST %', x: pageMargin + 378, width: 30, align: 'right' as const },
        { label: 'SGST Amt', x: pageMargin + 412, width: 44, align: 'right' as const },
        { label: 'Total', x: pageMargin + 462, width: 60, align: 'right' as const },
      ];

      const drawTableHeader = (headerTop: number) => {
        doc.moveTo(pageMargin, headerTop - 10).lineTo(rightEdge, headerTop - 10).lineWidth(1).strokeColor('#111827').stroke();
        columns.forEach((column) => {
          doc.fillColor('#111827').font('Helvetica-Bold').fontSize(7.5).text(column.label, column.x, headerTop - 2, {
            width: column.width,
            align: column.align,
          });
        });
        doc.moveTo(pageMargin, headerTop + 14).lineTo(rightEdge, headerTop + 14).lineWidth(0.5).strokeColor('#111827').stroke();
      };

      drawTableHeader(tableTop);

      let currentTop = tableTop + 20;
      let subtotalNet = 0;
      let subtotalTax = 0;
      let subtotalGross = 0;
      let subtotalCgst = 0;
      let subtotalSgst = 0;
      let summaryCgstRate = storeTax?.cgst || 0;
      let summarySgstRate = storeTax?.sgst || 0;

      order.items.forEach((item: any, index: number) => {
        if (currentTop > pageHeight - 100) {
          doc.addPage();
          drawTableHeader(pageMargin + 15);
          currentTop = pageMargin + 35;
        }

        const tax = getLineItemTax(item, storeTax);
        if (!storeTax && index === 0) {
          summaryCgstRate = tax.cgstRate;
          summarySgstRate = tax.sgstRate;
        }
        subtotalNet += tax.netAmount;
        subtotalTax += tax.taxAmount;
        subtotalGross += tax.grossAmount;
        subtotalCgst += tax.cgstAmount;
        subtotalSgst += tax.sgstAmount;

        const productName = String(item.productName || 'Product').replace(/\(.*\)/, '').trim();
        const rowHeight = 18;

        const values = [
          String(index + 1),
          productName,
          item.hsnCode || '-',
          item.variantLabel || '-',
          String(item.qty || 0),
          tax.netAmount.toFixed(2),
          `${formatRate(tax.cgstRate)}%`,
          tax.cgstAmount.toFixed(2),
          `${formatRate(tax.sgstRate)}%`,
          tax.sgstAmount.toFixed(2),
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
        doc.moveTo(pageMargin, currentTop - 2).lineTo(rightEdge, currentTop - 2).lineWidth(0.2).strokeColor('#E5E7EB').stroke();
      });

      const deliveryCharge = order.serviceMode === 'pickup' ? 0 : Number(order.deliveryCharge || 0);
      const discount = Number(order.couponDiscount || 0) + Number(order.loyaltyDiscount || 0) + Number(order.discount || 0);
      const expectedTotal = Math.max(0, subtotalGross - discount + deliveryCharge);
      const payableTotal = Number(order.totalAmount || expectedTotal);
      let summaryTop = currentTop + 6;
      if (summaryTop > pageHeight - 140) {
        doc.addPage();
        summaryTop = pageMargin + 15;
      }
      const summaryX = pageWidth - pageMargin - 260;
      const valueX = pageWidth - pageMargin - 100;
      const summaryRows = [
        ['Taxable Value', subtotalNet],
        [`CGST ${formatRate(summaryCgstRate)}%`, subtotalCgst],
        [`SGST ${formatRate(summarySgstRate)}%`, subtotalSgst],
        ['Gross Item Total', subtotalGross],
        ['Discount', -discount],
        [order.serviceMode === 'pickup' ? 'Delivery Charge (Pickup)' : 'Delivery Charge', deliveryCharge],
      ];

      doc.fillColor('#111827').font('Helvetica').fontSize(8);
      summaryRows.forEach(([label, value], index) => {
        const y = summaryTop + index * 12;
        doc.text(String(label), summaryX, y, { width: 160 });
        doc.text(formatMoney(Number(value)), valueX, y, { width: 100, align: 'right' });
      });

      const totalLineY = summaryTop + summaryRows.length * 12 + 4;
      doc.moveTo(summaryX, totalLineY).lineTo(rightEdge, totalLineY).lineWidth(1).strokeColor('#111827').stroke();
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10.5).text('TOTAL PAYABLE', summaryX, totalLineY + 6);
      doc.text(formatMoney(payableTotal), valueX - 5, totalLineY + 6, { width: 105, align: 'right' });
      doc.moveTo(summaryX, totalLineY + 22).lineTo(rightEdge, totalLineY + 22).lineWidth(1).strokeColor('#111827').stroke();

      const footerTop = pageHeight - 50;
      doc.moveTo(pageMargin, footerTop).lineTo(rightEdge, footerTop).lineWidth(0.5).strokeColor('#E5E7EB').stroke();
      
      doc.fontSize(6.5)
        .fillColor('#6B7280')
        .font('Helvetica')
        .text('This is a computer generated invoice and does not require a physical signature.', pageMargin, footerTop + 10, { align: 'left', width: contentWidth / 2 + 50 });
        
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(6.5)
        .text('Store Contact: 9302228883 | teams@vanikicrop.com', pageMargin + contentWidth / 2 - 50, footerTop + 10, { align: 'right', width: contentWidth / 2 + 50 });

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
