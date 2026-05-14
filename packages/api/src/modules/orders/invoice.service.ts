import PDFDocument from 'pdfkit';
import Product from '../../models/Product.model';
import SiteSetting from '../../models/SiteSetting.model';

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
// Layout Configuration
interface InvoiceLayout {
  margin: number;
  headerHeight: number;
  titleSize: number;
  subtitleSize: number;
  sellerTitleSize: number;
  baseSize: number;
  smallSize: number;
  infoSize: number;
  tableHeaderSize: number;
  tableRowSize: number;
  totalSize: number;
  rowHeight: number;
  infoBoxHeight: number;
  summaryWidth: number;
  weights: number[];
}

const A4_LAYOUT: InvoiceLayout = {
  margin: 36,
  headerHeight: 70,
  titleSize: 18,
  subtitleSize: 8,
  sellerTitleSize: 10,
  baseSize: 9,
  smallSize: 7.5,
  infoSize: 8,
  tableHeaderSize: 7.5,
  tableRowSize: 7,
  totalSize: 10.5,
  rowHeight: 18,
  infoBoxHeight: 50,
  summaryWidth: 260,
  // idx, product, hsn, pack, qty, taxable, cgst%, cgstAmt, sgst%, sgstAmt, total
  weights: [4, 26, 9, 12, 6, 9, 6, 9, 6, 9, 4] // Corrected sum: 4+26+9+12+6+9+6+9+6+9+4 = 100
};

const A5_LAYOUT: InvoiceLayout = {
  margin: 15, // Tighter for A5
  headerHeight: 55,
  titleSize: 15,
  subtitleSize: 7.5,
  sellerTitleSize: 10,
  baseSize: 9,
  smallSize: 8,
  infoSize: 8.5,
  tableHeaderSize: 7,
  tableRowSize: 8,
  totalSize: 11,
  rowHeight: 18,
  infoBoxHeight: 45,
  summaryWidth: 220,
  // Aggressive weights for A5: idx, product, hsn, pack, qty, taxable, cgst%, cgstAmt, sgst%, sgstAmt, total
  weights: [3, 26, 6, 9, 5, 9, 7, 9, 7, 9, 10] // Sum: 3+26+6+9+5+9+7+9+7+9+10 = 100
};

export async function generateInvoicePdf(order: any, options: { size?: string } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const isA5 = (options.size || 'A5') === 'A5';
      const layout = isA5 ? A5_LAYOUT : A4_LAYOUT;
      
      // Fetch missing HSN codes and Global GST if needed
      let globalGst = '-';
      try {
        const [settings] = await Promise.all([
          SiteSetting.findOne().lean(),
          ...order.items.map(async (item: any) => {
            if (!item.hsnCode && item.productId) {
              const p = await Product.findById(item.productId).select('hsnCode').lean();
              if (p?.hsnCode) item.hsnCode = p.hsnCode;
            }
          })
        ]);
        if (settings?.gstNumber) globalGst = settings.gstNumber;
      } catch (e) {
        console.error('[PDF] Error fetching fallback data:', e);
      }

      console.log(`[PDF] Generating RESPONSIVE invoice in ${isA5 ? 'A5' : 'A4'} format`);
      
      const doc = new PDFDocument({ 
        margin: layout.margin, 
        size: isA5 ? 'A5' : 'A4', 
        layout: 'portrait' 
      });
      
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const contentWidth = pageWidth - layout.margin * 2;
      const rightEdge = pageWidth - layout.margin;
      
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

      // Header
      doc.rect(0, 0, pageWidth, layout.headerHeight).fill('#143D2E');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(layout.titleSize)
        .text('TAX INVOICE', layout.margin, (layout.headerHeight - layout.titleSize) / 2 - 5);
      doc.font('Helvetica').fontSize(layout.subtitleSize)
        .text('Original for Recipient', layout.margin, (layout.headerHeight - layout.titleSize) / 2 + layout.titleSize - 2);
      
      const sellerName = order.isB2B ? 'Vaniki Crop' : (store.name || 'Vaniki Crop Store');
      const sellerEmail = 'teams@vanikicrop.com'; // Forced as requested
      const sellerPhone = order.isB2B ? '9406160185' : (store.phone || '9406160185');

      const headerRightX = pageWidth - layout.margin - 200;
      doc.font('Helvetica-Bold').fontSize(layout.sellerTitleSize)
        .text('Vaniki Crop', headerRightX, (layout.headerHeight - layout.sellerTitleSize) / 2 - 5, { width: 200, align: 'right' });
      doc.font('Helvetica').fontSize(layout.subtitleSize)
        .text(`${sellerEmail} | ${sellerPhone}`, headerRightX, (layout.headerHeight - layout.sellerTitleSize) / 2 + layout.sellerTitleSize - 2, { width: 200, align: 'right' });

      // Addresses
      const addressTop = layout.headerHeight + (isA5 ? 15 : 25);
      const columnGap = isA5 ? 15 : 20;
      const detailWidth = (contentWidth - columnGap) / 2;
      const detailRightX = layout.margin + detailWidth + columnGap;

      // Sold By
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(layout.baseSize).text('Sold By', layout.margin, addressTop);
      doc.font('Helvetica-Bold').fontSize(layout.baseSize - 0.5)
        .text(sellerName, layout.margin, addressTop + 13, { width: detailWidth });
      doc.font('Helvetica').fontSize(layout.baseSize - 1)
        .text(formatAddress(store.address), layout.margin, addressTop + 26, { width: detailWidth })
        .text(`Contact: ${sellerPhone}`, layout.margin, addressTop + 46, { width: detailWidth })
        .text(`GSTIN: ${store.gstNumber || store.sgstNumber || globalGst}`, layout.margin, addressTop + 57, { width: detailWidth });

      // Bill To
      doc.font('Helvetica-Bold').fontSize(layout.baseSize).text(order.isB2B ? 'Bill To' : 'Bill To / Ship To', detailRightX, addressTop);
      doc.font('Helvetica-Bold').fontSize(layout.baseSize - 0.5)
        .text(order.shippingAddress?.name || customer.name || 'Customer', detailRightX, addressTop + 13, { width: detailWidth });
      doc.font('Helvetica').fontSize(layout.baseSize - 1)
        .text(`Mobile: ${order.shippingAddress?.mobile || customer.mobile || '-'}`, detailRightX, addressTop + 26, { width: detailWidth })
        .text(formatAddress(deliveryAddress), detailRightX, addressTop + 38, { width: detailWidth });

      // Info Box
      const infoTop = addressTop + (isA5 ? 80 : 85);
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

      doc.roundedRect(layout.margin, infoTop - 8, contentWidth, layout.infoBoxHeight, 4).lineWidth(0.5).strokeColor('#E5E7EB').stroke();
      
      const colWidth = contentWidth / 3;
      infoRows.forEach(([label, value], index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = layout.margin + 10 + col * colWidth;
        const y = infoTop + row * (isA5 ? 18 : 22);
        doc.fillColor('#6B7280').font('Helvetica').fontSize(layout.smallSize - 2).text(label.toUpperCase(), x, y);
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(layout.infoSize).text(String(value), x, y + 9, { width: colWidth - 15 });
      });

      // Table Geometry
      const tableTop = infoTop + layout.infoBoxHeight + (isA5 ? 15 : 25);
      const getX = (index: number) => {
        let x = layout.margin;
        for (let i = 0; i < index; i++) {
          x += (layout.weights[i] / 100) * contentWidth;
        }
        return x;
      };
      const getW = (index: number) => (layout.weights[index] / 100) * contentWidth;

      const columns = [
        { label: '#', x: getX(0), width: getW(0), align: 'left' as const },
        { label: 'Product', x: getX(1), width: getW(1), align: 'left' as const },
        { label: 'HSN', x: getX(2), width: getW(2), align: 'left' as const },
        { label: 'Pack', x: getX(3), width: getW(3), align: 'left' as const },
        { label: 'Qty', x: getX(4), width: getW(4), align: 'right' as const },
        { label: 'Taxable', x: getX(5), width: getW(5), align: 'right' as const },
        { label: 'CGST%', x: getX(6), width: getW(6), align: 'right' as const },
        { label: 'CGST', x: getX(7), width: getW(7), align: 'right' as const },
        { label: 'SGST%', x: getX(8), width: getW(8), align: 'right' as const },
        { label: 'SGST', x: getX(9), width: getW(9), align: 'right' as const },
        { label: 'Total', x: getX(10), width: getW(10), align: 'right' as const },
      ];

      const drawHeader = (y: number) => {
        doc.moveTo(layout.margin, y - 10).lineTo(rightEdge, y - 10).lineWidth(1).strokeColor('#111827').stroke();
        columns.forEach(c => {
          doc.fillColor('#111827').font('Helvetica-Bold').fontSize(layout.tableHeaderSize)
            .text(c.label, c.x, y - 2, { width: c.width, align: c.align });
        });
        doc.moveTo(layout.margin, y + 12).lineTo(rightEdge, y + 12).lineWidth(0.5).strokeColor('#111827').stroke();
      };

      drawHeader(tableTop);

      let currentY = tableTop + 18;
      let subtotalNet = 0, subtotalCgst = 0, subtotalSgst = 0, subtotalGross = 0;
      let summaryCgstRate = storeTax?.cgst || 0, summarySgstRate = storeTax?.sgst || 0;

      order.items.forEach((item: any, index: number) => {
        if (currentY > pageHeight - 120) {
          doc.addPage();
          drawHeader(layout.margin + 20);
          currentY = layout.margin + 38;
        }

        const tax = getLineItemTax(item, storeTax, order.isB2B);
        if (!storeTax && index === 0) {
          summaryCgstRate = tax.cgstRate;
          summarySgstRate = tax.sgstRate;
        }
        subtotalNet += tax.netAmount;
        subtotalCgst += tax.cgstAmount;
        subtotalSgst += tax.sgstAmount;
        subtotalGross += tax.grossAmount;

        const vals = [
          String(index + 1),
          String(item.productName || '').replace(/\(.*\)/, '').trim(),
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

        columns.forEach((c, i) => {
          doc.fillColor('#111827').font(i === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(layout.tableRowSize)
            .text(vals[i], c.x, currentY, { width: c.width, align: c.align, ellipsis: true });
        });

        currentY += layout.rowHeight;
        doc.moveTo(layout.margin, currentY - 2).lineTo(rightEdge, currentY - 2).lineWidth(0.2).strokeColor('#E5E7EB').stroke();
      });

      // Totals
      const deliveryCharge = order.isB2B ? 0 : (order.serviceMode === 'pickup' ? 0 : Number(order.deliveryCharge || 0));
      const discount = order.isB2B ? 0 : (Number(order.couponDiscount || 0) + Number(order.loyaltyDiscount || 0) + Number(order.discount || 0));
      const payableTotal = Number(order.totalAmount || (subtotalGross - discount + deliveryCharge));
      
      let summaryTop = currentY + 15;
      if (summaryTop > pageHeight - layout.margin - 100) {
        doc.addPage();
        summaryTop = layout.margin + 20;
      }

      const summaryX = pageWidth - layout.margin - layout.summaryWidth;
      const valueX = pageWidth - layout.margin - (isA5 ? 85 : 100);
      const summaryRows = [
        ['Taxable Value', subtotalNet],
        [`CGST ${formatRate(summaryCgstRate)}%`, subtotalCgst],
        [`SGST ${formatRate(summarySgstRate)}%`, subtotalSgst],
        ['Gross Item Total', subtotalGross],
      ];
      if (!order.isB2B) {
        if (order.couponDiscount > 0) summaryRows.push(['Coupon Discount', -order.couponDiscount]);
        if (order.loyaltyDiscount > 0) summaryRows.push(['Loyalty Discount', -order.loyaltyDiscount]);
        summaryRows.push([order.serviceMode === 'pickup' ? 'Delivery (Pickup)' : 'Delivery Charge', deliveryCharge]);
      }

      doc.fillColor('#111827').font('Helvetica').fontSize(layout.baseSize);
      summaryRows.forEach(([l, v], i) => {
        const y = summaryTop + i * (isA5 ? 14 : 12);
        doc.text(String(l), summaryX, y, { width: layout.summaryWidth - (isA5 ? 85 : 100) });
        doc.text(formatMoney(Number(v)), valueX, y, { width: (isA5 ? 85 : 100), align: 'right' });
      });

      const totalY = summaryTop + summaryRows.length * (isA5 ? 14 : 12) + 8;
      doc.moveTo(summaryX, totalY).lineTo(rightEdge, totalY).lineWidth(1.5).strokeColor('#111827').stroke();
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(layout.totalSize).text('TOTAL PAYABLE', summaryX, totalY + 8);
      doc.text(formatMoney(payableTotal), valueX, totalY + 8, { width: (isA5 ? 85 : 100), align: 'right' });
      doc.moveTo(summaryX, totalY + 25).lineTo(rightEdge, totalY + 25).lineWidth(1.5).strokeColor('#111827').stroke();

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
