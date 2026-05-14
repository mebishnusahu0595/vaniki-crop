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

function getLineItemTax(item: any, storeTax?: { cgst: number; sgst: number }, isB2B: boolean = false) {
  // For B2B (Platform to Store), we always use the tax rate specified in the item
  // For regular orders, we might fallback to store's default tax rates
  const taxRate = (isB2B || !storeTax)
    ? (Number(item.taxRate || 0) || 18)
    : (Number(storeTax.cgst || 0) + Number(storeTax.sgst || 0));

  const grossAmount = Number(item.price || 0) * Number(item.qty || 0);
  
  if (taxRate <= 0) {
    return {
      taxRate: 0,
      grossAmount,
      netAmount: grossAmount,
      taxAmount: 0,
      cgstRate: 0,
      sgstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
    };
  }

  const netAmount = grossAmount / (1 + taxRate / 100);
  const taxAmount = grossAmount - netAmount;

  // Split tax equally for CGST/SGST if not specified
  let cgstRate = taxRate / 2;
  let sgstRate = taxRate / 2;

  if (!isB2B && storeTax) {
    const totalStoreTax = Number(storeTax.cgst || 0) + Number(storeTax.sgst || 0);
    if (totalStoreTax > 0) {
      cgstRate = Number(storeTax.cgst || 0);
      sgstRate = Number(storeTax.sgst || 0);
    }
  }

  const cgstAmount = taxAmount * (cgstRate / taxRate);
  const sgstAmount = taxAmount * (sgstRate / taxRate);

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
 * @param options PDF generation options (size, etc.)
 * @returns Buffer containing the PDF data
 */
export async function generateInvoicePdf(order: any, options: { size?: string } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const isA5 = (options.size || 'A5') === 'A5';
      console.log(`[PDF] Generating invoice in ${isA5 ? 'A5' : 'A4'} format for order: ${order.orderNumber}`);
      
      // Optimization: Smaller margins for A5 to maximize horizontal space
      const pageMargin = isA5 ? 20 : 36;
      const doc = new PDFDocument({ margin: pageMargin, size: isA5 ? 'A5' : 'A4', layout: 'portrait' });
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
      const invoiceNumber = order.isB2B 
        ? order.orderNumber 
        : `INV-${String(order.orderNumber || getDocId(order)).replace(/^VNK-?/, '')}`;
      
      const storeTax = Number(store.cgst || 0) + Number(store.sgst || 0) > 0
        ? { cgst: Number(store.cgst || 0), sgst: Number(store.sgst || 0) }
        : undefined;

      // Header - Compact for A5
      const headerHeight = isA5 ? 45 : 70;
      doc.rect(0, 0, pageWidth, headerHeight).fill('#143D2E');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(isA5 ? 12 : 18).text('TAX INVOICE', pageMargin, isA5 ? 12 : 20);
      doc.font('Helvetica').fontSize(isA5 ? 6 : 8).text('Original for Recipient', pageMargin, isA5 ? 28 : 42);
      
      const sellerName = order.isB2B ? 'Vaniki Crop' : (store.name || 'Vaniki Crop Store');
      const sellerEmail = order.isB2B ? 'teams@vanikicrop.com' : (store.email || 'teams@vanikicrop.com');
      const sellerPhone = order.isB2B ? '9406160185' : (store.phone || '9406160185');

      doc.font('Helvetica-Bold').fontSize(isA5 ? 8 : 10).text('Vaniki Crop', pageWidth - pageMargin - 150, isA5 ? 15 : 22, { width: 150, align: 'right' });
      doc.font('Helvetica').fontSize(isA5 ? 6 : 7.5).text(`${sellerEmail} | ${sellerPhone}`, pageWidth - pageMargin - 150, isA5 ? 26 : 36, { width: 150, align: 'right' });

      // Addresses - Reduced vertical gap
      const addressTop = isA5 ? 58 : 85;
      const columnGap = isA5 ? 12 : 20;
      const detailColumnWidth = (contentWidth - columnGap) / 2;
      const detailRightX = pageMargin + detailColumnWidth + columnGap;

      // Sold By
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(isA5 ? 7.5 : 9).text('Sold By', pageMargin, addressTop);
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(isA5 ? 7 : 8.5)
        .text(sellerName, pageMargin, addressTop + (isA5 ? 11 : 13), { width: detailColumnWidth });
      doc.font('Helvetica').fontSize(isA5 ? 6.5 : 8)
        .text(formatAddress(store.address), pageMargin, addressTop + (isA5 ? 21 : 24), { width: detailColumnWidth })
        .text(`Contact: ${sellerPhone}`, pageMargin, addressTop + (isA5 ? 38 : 46), { width: detailColumnWidth })
        .text(`GSTIN: ${store.gstNumber || store.sgstNumber || '-'}`, pageMargin, addressTop + (isA5 ? 47 : 57), { width: detailColumnWidth });

      // Bill To
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(isA5 ? 7.5 : 9).text(order.isB2B ? 'Bill To' : 'Bill To / Ship To', detailRightX, addressTop);
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(isA5 ? 7 : 8.5)
        .text(order.shippingAddress?.name || customer.name || 'Customer', detailRightX, addressTop + (isA5 ? 11 : 13), { width: detailColumnWidth });
      doc.font('Helvetica').fontSize(isA5 ? 6.5 : 8)
        .text(`Mobile: ${order.shippingAddress?.mobile || customer.mobile || '-'}`, detailRightX, addressTop + (isA5 ? 21 : 24), { width: detailColumnWidth })
        .text(formatAddress(deliveryAddress), detailRightX, addressTop + (isA5 ? 31 : 35), { width: detailColumnWidth });

      // Order Info Box - Optimized height
      const infoTop = addressTop + (isA5 ? 65 : 85);
      const infoRows = order.isB2B ? [
        ['Invoice Number', invoiceNumber],
        ['Invoice Date', order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '-'],
        ['Place of Supply', store.address?.state || '-'],
      ] : [
        ['Order Number', order.orderNumber || '-'],
        ['Order Date', order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '-'],
        ['Invoice Number', invoiceNumber],
        ['Invoice Date', new Date().toLocaleDateString('en-IN')],
        ['Fulfillment', serviceMode],
        ['Payment', `${String(order.paymentMethod || '-').toUpperCase()} / ${order.paymentStatus || '-'}`],
      ];

      const infoBoxHeight = isA5 ? 32 : 50;
      doc.roundedRect(pageMargin, infoTop - 6, contentWidth, infoBoxHeight, 4).lineWidth(0.5).strokeColor('#E5E7EB').stroke();
      
      const columnsCount = 3;
      const colWidth = contentWidth / columnsCount;
      infoRows.forEach(([label, value], index) => {
        const column = index % columnsCount;
        const row = Math.floor(index / columnsCount);
        const x = pageMargin + 10 + column * colWidth;
        const y = infoTop + row * (isA5 ? 14 : 22);
        doc.fillColor('#6B7280').font('Helvetica').fontSize(isA5 ? 5 : 6).text(label.toUpperCase(), x, y);
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(isA5 ? 6.5 : 8).text(String(value), x, y + (isA5 ? 6 : 9), { width: colWidth - 15 });
      });

      // Table - Dynamic Column Sizing
      const tableTop = infoTop + infoBoxHeight + (isA5 ? 12 : 25);
      
      // Column Weights (Total = 100)
      const colWeights = {
        idx: 4,
        product: 26,
        hsn: 9,
        pack: 12,
        qty: 6,
        taxable: 9,
        taxP: 6,
        taxAmt: 9,
        total: 10
      };

      const getColX = (index: number) => {
        const weights = [colWeights.idx, colWeights.product, colWeights.hsn, colWeights.pack, colWeights.qty, colWeights.taxable, colWeights.taxP, colWeights.taxAmt, colWeights.taxP, colWeights.taxAmt, colWeights.total];
        let x = pageMargin;
        for (let i = 0; i < index; i++) {
          x += (weights[i] / 100) * contentWidth;
        }
        return x;
      };

      const getColWidth = (index: number) => {
        const weights = [colWeights.idx, colWeights.product, colWeights.hsn, colWeights.pack, colWeights.qty, colWeights.taxable, colWeights.taxP, colWeights.taxAmt, colWeights.taxP, colWeights.taxAmt, colWeights.total];
        return (weights[index] / 100) * contentWidth;
      };

      const columns = [
        { label: '#', x: getColX(0), width: getColWidth(0), align: 'left' as const },
        { label: 'Product', x: getColX(1), width: getColWidth(1), align: 'left' as const },
        { label: 'HSN', x: getColX(2), width: getColWidth(2), align: 'left' as const },
        { label: 'Pack', x: getColX(3), width: getColWidth(3), align: 'left' as const },
        { label: 'Qty', x: getColX(4), width: getColWidth(4), align: 'right' as const },
        { label: 'Taxable', x: getColX(5), width: getColWidth(5), align: 'right' as const },
        { label: 'CGST%', x: getColX(6), width: getColWidth(6), align: 'right' as const },
        { label: 'CGST', x: getColX(7), width: getColWidth(7), align: 'right' as const },
        { label: 'SGST%', x: getColX(8), width: getColWidth(8), align: 'right' as const },
        { label: 'SGST', x: getColX(9), width: getColWidth(9), align: 'right' as const },
        { label: 'Total', x: getColX(10), width: getColWidth(10), align: 'right' as const },
      ];

      const drawTableHeader = (headerTop: number) => {
        doc.moveTo(pageMargin, headerTop - 8).lineTo(rightEdge, headerTop - 8).lineWidth(0.8).strokeColor('#111827').stroke();
        columns.forEach((column) => {
          doc.fillColor('#111827').font('Helvetica-Bold').fontSize(isA5 ? 5.5 : 7.5).text(column.label, column.x, headerTop - 2, {
            width: column.width,
            align: column.align,
          });
        });
        doc.moveTo(pageMargin, headerTop + (isA5 ? 8 : 14)).lineTo(rightEdge, headerTop + (isA5 ? 8 : 14)).lineWidth(0.4).strokeColor('#111827').stroke();
      };

      drawTableHeader(tableTop);

      let currentTop = tableTop + (isA5 ? 12 : 20);
      let subtotalNet = 0;
      let subtotalTax = 0;
      let subtotalGross = 0;
      let subtotalCgst = 0;
      let subtotalSgst = 0;
      let summaryCgstRate = storeTax?.cgst || 0;
      let summarySgstRate = storeTax?.sgst || 0;

      order.items.forEach((item: any, index: number) => {
        if (currentTop > pageHeight - 80) {
          doc.addPage();
          drawTableHeader(pageMargin + 12);
          currentTop = pageMargin + 28;
        }

        const tax = getLineItemTax(item, storeTax, order.isB2B);
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
        const rowHeight = isA5 ? 12 : 18;

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
            .fontSize(columnIndex === 1 ? (isA5 ? 6 : 7.5) : (isA5 ? 5.5 : 7))
            .text(values[columnIndex], column.x, currentTop, {
              width: column.width,
              align: column.align,
              ellipsis: true,
            });
        });

        currentTop += rowHeight;
        doc.moveTo(pageMargin, currentTop - 1).lineTo(rightEdge, currentTop - 1).lineWidth(0.1).strokeColor('#E5E7EB').stroke();
      });

      // Summary Section
      const deliveryCharge = order.isB2B ? 0 : (order.serviceMode === 'pickup' ? 0 : Number(order.deliveryCharge || 0));
      const discount = order.isB2B ? 0 : (Number(order.couponDiscount || 0) + Number(order.loyaltyDiscount || 0) + Number(order.discount || 0));
      const expectedTotal = Math.max(0, subtotalGross - discount + deliveryCharge);
      const payableTotal = Number(order.totalAmount || expectedTotal);
      
      const footerTop = pageHeight - pageMargin - (isA5 ? 12 : 24);
      const summaryReservedHeight = isA5 ? 70 : 112;
      let summaryTop = currentTop + 8;
      
      if (summaryTop > footerTop - summaryReservedHeight) {
        doc.addPage();
        summaryTop = pageMargin + 12;
      }

      const summaryWidth = isA5 ? 180 : 260;
      const summaryX = pageWidth - pageMargin - summaryWidth;
      const valueX = pageWidth - pageMargin - (isA5 ? 70 : 100);
      const summaryRows = [
        ['Taxable Value', subtotalNet],
        [`CGST ${formatRate(summaryCgstRate)}%`, subtotalCgst],
        [`SGST ${formatRate(summarySgstRate)}%`, subtotalSgst],
        ['Gross Item Total', subtotalGross],
      ];
      
      if (!order.isB2B) {
        if (order.couponDiscount > 0) summaryRows.push(['Coupon Discount', -order.couponDiscount]);
        if (order.loyaltyDiscount > 0) summaryRows.push(['Loyalty Discount', -order.loyaltyDiscount]);
        if (order.discount > 0 && !(order.couponDiscount || order.loyaltyDiscount)) summaryRows.push(['Other Discount', -order.discount]);
        summaryRows.push([order.serviceMode === 'pickup' ? 'Delivery Charge (Pickup)' : 'Delivery Charge', deliveryCharge]);
      }

      doc.fillColor('#111827').font('Helvetica').fontSize(isA5 ? 6.5 : 8);
      summaryRows.forEach(([label, value], index) => {
        const y = summaryTop + index * (isA5 ? 9 : 12);
        doc.text(String(label), summaryX, y, { width: isA5 ? 110 : 160 });
        doc.text(formatMoney(Number(value)), valueX, y, { width: isA5 ? 70 : 100, align: 'right' });
      });

      const totalLineY = summaryTop + summaryRows.length * (isA5 ? 9 : 12) + 2;
      doc.moveTo(summaryX, totalLineY).lineTo(rightEdge, totalLineY).lineWidth(1).strokeColor('#111827').stroke();
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(isA5 ? 8 : 10.5).text('TOTAL PAYABLE', summaryX, totalLineY + 5);
      doc.text(formatMoney(payableTotal), valueX - 5, totalLineY + 5, { width: isA5 ? 75 : 105, align: 'right' });
      doc.moveTo(summaryX, totalLineY + (isA5 ? 15 : 22)).lineTo(rightEdge, totalLineY + (isA5 ? 15 : 22)).lineWidth(1).strokeColor('#111827').stroke();

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates B2B invoice using actual invoice document and forced A5 size.
 */
export async function generateB2BInvoicePdf(data: any): Promise<Buffer> {
  const { invoice, store } = data;
  
  const orderData = {
    isB2B: true,
    orderNumber: invoice.invoiceNumber,
    createdAt: invoice.invoiceDate,
    storeId: store,
    shippingAddress: {
      name: store.name,
      mobile: store.phone,
      street: store.address?.street || '',
      city: store.address?.city || '',
      state: store.address?.state || '',
      pincode: store.address?.pincode || '',
    },
    items: invoice.items.map((i: any) => ({
      productName: i.productName,
      variantLabel: i.variantLabel || 'Bulk Supply',
      price: i.price,
      qty: i.qty,
      taxRate: i.taxRate,
      hsnCode: i.hsnCode,
      taxAmount: i.taxAmount,
      total: i.total
    })),
    totalAmount: invoice.totalAmount,
    totalTaxAmount: invoice.totalTaxAmount,
    subtotal: invoice.subtotal,
  };
  
  return generateInvoicePdf(orderData, { size: 'A5' });
}
