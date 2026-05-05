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
      const doc = new PDFDocument({ margin: pageMargin, size: 'A4', layout: 'landscape' });
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
      const columnGap = 28;
      const detailColumnWidth = (contentWidth - columnGap) / 2;
      const detailRightX = pageMargin + detailColumnWidth + columnGap;

      doc.rect(0, 0, pageWidth, 88).fill('#143D2E');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24).text('TAX INVOICE', pageMargin, 28);
      doc.font('Helvetica').fontSize(9).text('Original for Recipient', pageMargin, 58);
      doc.font('Helvetica-Bold').fontSize(11).text('Vaniki Crop', pageWidth - pageMargin - 240, 30, { width: 240, align: 'right' });
      doc.font('Helvetica').fontSize(8).text('teams@vanikicrop.com | 9302228883', pageWidth - pageMargin - 260, 50, { width: 260, align: 'right' });

      const addressTop = 108;
      doc.fillColor('#143D2E').font('Helvetica-Bold').fontSize(10).text('Sold By', pageMargin, addressTop);
      doc.fillColor('#1F2937').font('Helvetica').fontSize(9)
        .text(store.name || 'Vaniki Crop Store', pageMargin, addressTop + 16, { width: detailColumnWidth })
        .text(formatAddress(store.address), pageMargin, addressTop + 31, { width: detailColumnWidth })
        .text(`Contact: ${store.phone || '9302228883'}`, pageMargin, addressTop + 58, { width: detailColumnWidth })
        .text(`GSTIN: ${store.gstNumber || store.sgstNumber || '-'}`, pageMargin, addressTop + 73, { width: detailColumnWidth });

      doc.fillColor('#143D2E').font('Helvetica-Bold').fontSize(10).text('Bill To / Ship To', detailRightX, addressTop);
      doc.fillColor('#1F2937').font('Helvetica').fontSize(9)
        .text(order.shippingAddress?.name || customer.name || 'Customer', detailRightX, addressTop + 16, { width: detailColumnWidth })
        .text(`Mobile: ${order.shippingAddress?.mobile || customer.mobile || '-'}`, detailRightX, addressTop + 31, { width: detailColumnWidth })
        .text(formatAddress(deliveryAddress), detailRightX, addressTop + 46, { width: detailColumnWidth });

      const infoTop = 212;
      const infoRows = [
        ['Order Number', order.orderNumber || '-'],
        ['Order Date', order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '-'],
        ['Invoice Number', invoiceNumber],
        ['Invoice Date', new Date().toLocaleDateString('en-IN')],
        ['Fulfillment', serviceMode],
        ['Payment', `${String(order.paymentMethod || '-').toUpperCase()} / ${order.paymentStatus || '-'}`],
      ];

      doc.roundedRect(pageMargin, infoTop - 10, contentWidth, 62, 10).fillAndStroke('#F0F8F4', '#CDEBDD');
      infoRows.forEach(([label, value], index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const columnWidth = contentWidth / 3;
        const x = pageMargin + 18 + column * columnWidth;
        const y = infoTop + row * 28;
        doc.fillColor('#2D6A4F').font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x, y);
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text(String(value), x, y + 11, { width: columnWidth - 24 });
      });

      const tableTop = 296;
      const columns = [
        { label: '#', x: pageMargin, width: 22, align: 'left' as const },
        { label: 'Product', x: pageMargin + 28, width: 160, align: 'left' as const },
        { label: 'HSN', x: pageMargin + 194, width: 50, align: 'left' as const },
        { label: 'Pack', x: pageMargin + 250, width: 58, align: 'left' as const },
        { label: 'Qty', x: pageMargin + 314, width: 34, align: 'right' as const },
        { label: 'Taxable', x: pageMargin + 354, width: 70, align: 'right' as const },
        { label: 'CGST %', x: pageMargin + 430, width: 48, align: 'right' as const },
        { label: 'CGST Amt', x: pageMargin + 484, width: 70, align: 'right' as const },
        { label: 'SGST %', x: pageMargin + 560, width: 48, align: 'right' as const },
        { label: 'SGST Amt', x: pageMargin + 614, width: 70, align: 'right' as const },
        { label: 'Total', x: pageMargin + 690, width: 80, align: 'right' as const },
      ];

      const drawTableHeader = (headerTop: number) => {
        doc.roundedRect(pageMargin, headerTop - 12, contentWidth, 30, 8).fill('#143D2E');
        columns.forEach((column) => {
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8).text(column.label, column.x, headerTop - 2, {
            width: column.width,
            align: column.align,
          });
        });
      };

      drawTableHeader(tableTop);

      let currentTop = tableTop + 28;
      let subtotalNet = 0;
      let subtotalTax = 0;
      let subtotalGross = 0;
      let subtotalCgst = 0;
      let subtotalSgst = 0;
      let summaryCgstRate = storeTax?.cgst || 0;
      let summarySgstRate = storeTax?.sgst || 0;

      order.items.forEach((item: any, index: number) => {
        if (currentTop > pageHeight - 145) {
          doc.addPage();
          drawTableHeader(pageMargin + 18);
          currentTop = pageMargin + 46;
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
        const rowHeight = 38;
        if (index % 2 === 0) {
          doc.roundedRect(pageMargin, currentTop - 8, contentWidth, rowHeight, 6).fill('#F8FCFA');
        }

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
            .fontSize(columnIndex === 1 ? 8 : 7.5)
            .text(values[columnIndex], column.x, currentTop, {
              width: column.width,
              align: column.align,
              ellipsis: true,
            });
        });

        currentTop += rowHeight;
      });

      doc.moveTo(pageMargin, currentTop).lineTo(rightEdge, currentTop).strokeColor('#CDEBDD').stroke();

      const deliveryCharge = order.serviceMode === 'pickup' ? 0 : Number(order.deliveryCharge || 0);
      const discount = Number(order.couponDiscount || 0) + Number(order.loyaltyDiscount || 0) + Number(order.discount || 0);
      const expectedTotal = Math.max(0, subtotalGross - discount + deliveryCharge);
      const payableTotal = Number(order.totalAmount || expectedTotal);
      let summaryTop = currentTop + 18;
      if (summaryTop > pageHeight - 190) {
        doc.addPage();
        summaryTop = pageMargin + 20;
      }
      const summaryX = pageWidth - pageMargin - 310;
      const valueX = pageWidth - pageMargin - 115;
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
        const y = summaryTop + index * 15;
        doc.text(String(label), summaryX, y, { width: 180 });
        doc.text(formatMoney(Number(value)), valueX, y, { width: 115, align: 'right' });
      });

      doc.roundedRect(summaryX - 8, summaryTop + 92, 318, 30, 8).fill('#143D2E');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text('TOTAL PAYABLE', summaryX, summaryTop + 102);
      doc.text(formatMoney(payableTotal), valueX - 8, summaryTop + 102, { width: 123, align: 'right' });

      const footerTop = pageHeight - 66;
      doc.moveTo(pageMargin, footerTop).lineTo(rightEdge, footerTop).stroke();
      
      doc.fontSize(8)
        .fillColor('#111827')
        .font('Helvetica')
        .text('This is a computer generated invoice and does not require a physical signature.', pageMargin, footerTop + 15, { align: 'center', width: contentWidth });
        
      doc.font('Helvetica-Bold')
        .text('Store Contact: 9302228883 | teams@vanikicrop.com', pageMargin, footerTop + 30, { align: 'center', width: contentWidth });

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
