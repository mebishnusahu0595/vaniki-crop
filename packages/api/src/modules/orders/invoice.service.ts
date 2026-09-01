import PDFDocument from 'pdfkit';
import { Product } from '../../models/Product.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { User } from '../../models/User.model.js';

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
  weights: [4, 24, 10, 8, 5, 10, 6, 8, 6, 8, 11] // Sum: 100
};

const A5_LAYOUT: InvoiceLayout = {
  margin: 10, // Even tighter for A5
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
  weights: [3, 23, 11, 8, 5, 8, 7, 8, 7, 8, 12] // Sum: 100
};

export async function generateInvoicePdf(order: any, options: { size?: string } = {}): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const isA5 = (options.size || 'A5') === 'A5';
      const layout = isA5 ? A5_LAYOUT : A4_LAYOUT;
      
      // Fetch missing HSN codes and Global GST if needed
      let globalGst = '-';
      try {
        const items = order.items || [];
        const [settings] = await Promise.all([
          SiteSetting.findOne().lean(),
          ...items.map(async (item: any) => {
            // Force fetch HSN from DB if missing or default '-'
            if (!item.hsnCode || item.hsnCode === '-' || item.hsnCode === '') {
              try {
                const pId = item.productId?._id || item.productId;
                const vId = item.variantId?._id || item.variantId;
                
                if (pId) {
                  const p = await Product.findById(pId).select('variants').lean();
                  if (p?.variants) {
                    // 1. Try ID match
                    let variant = p.variants.find((v: any) => String(v._id || v.id) === String(vId));
                    
                    // 2. Fallback to label match (handles stale variant IDs)
                    if (!variant && item.variantLabel) {
                      variant = p.variants.find((v: any) => 
                        v.label?.toLowerCase().trim() === item.variantLabel.toLowerCase().trim()
                      );
                    }

                    if (variant?.hsnCode) item.hsnCode = variant.hsnCode;
                  }
                }
              } catch (err) {
                console.error('[PDF] HSN Fetch Error:', err);
              }
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
      
      // Resolve Store GST with deep fallback
      let finalGst = store.gstNumber || store.sgstNumber || globalGst;
      const adminIdForFallback = store.adminId?._id || store.adminId;
      if ((!store.gstNumber || store.gstNumber === '-') && adminIdForFallback) {
        try {
          const admin = await User.findById(adminIdForFallback).select('dealerProfile').lean();
          if (admin?.dealerProfile?.gstNumber) finalGst = admin.dealerProfile.gstNumber;
          else if (admin?.dealerProfile?.sgstNumber) finalGst = admin.dealerProfile.sgstNumber;
        } catch (e) {
          console.error('[PDF] Error fetching admin GST fallback:', e);
        }
      }

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
        .text(`GSTIN: ${finalGst}`, layout.margin, addressTop + 57, { width: detailWidth });

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
        ['Tally Voucher', order.tallyVoucherNumber ? `#${order.tallyVoucherNumber} (Synced)` : (order.tallySyncStatus === 'synced' ? 'Synced' : 'Pending')],
        ['Invoice Date', order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '-'],
        ['Place of Supply', store.address?.state || '-'],
      ] : [
        ['Order Number', order.orderNumber || '-'],
        ['Invoice Number', invoiceNumber],
        ['Tally Voucher', order.tallyVoucherNumber ? `#${order.tallyVoucherNumber}` : (order.tallySyncStatus === 'synced' ? 'Synced' : 'Pending Sync')],
        ['Order Date', order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')],
        ['Fulfillment', serviceMode],
        ['Payment', `${String(order.paymentMethod || '-').toUpperCase()} (${order.paymentStatus || '-'})`],
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

function numberToWordsIndian(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n === 0) return '';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + inWords(n % 10000000);
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let str = 'INR ' + (rupees === 0 ? 'Zero ' : inWords(rupees)) + 'Rupees';
  if (paise > 0) {
    str += ' and ' + inWords(paise) + 'Paise';
  }
  str += ' Only';
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Generates an Authentic Tally-Standard GST Tax Invoice (A4 Grid Layout).
 */
export async function generateB2BInvoicePdf(data: any): Promise<Buffer> {
  const { invoice, store, siteSettings } = data;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 25,
        size: 'A4',
        layout: 'portrait',
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const startX = 25;
      const contentW = 545.28;
      const rightX = startX + contentW;

      // ─── Header: TAX INVOICE ───────────────────────────────────────────
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(14)
        .text('TAX INVOICE', startX, 25, { width: contentW, align: 'center' });
      doc.font('Helvetica').fontSize(8)
        .text('(ORIGINAL FOR RECIPIENT)', startX, 42, { width: contentW, align: 'center' });

      // ─── Box 1: Seller & Dispatch Details ──────────────────────────────
      const box1Y = 56;
      const box1H = 135;
      const splitX = startX + 270; // 295

      doc.rect(startX, box1Y, contentW, box1H).lineWidth(0.75).stroke('#000000');
      doc.moveTo(splitX, box1Y).lineTo(splitX, box1Y + box1H).lineWidth(0.75).stroke('#000000');

      // Left: Seller Details
      const sellerGst = siteSettings?.gstNumber || '22AAACV9876Q1Z2';
      doc.font('Helvetica-Bold').fontSize(10).text('Vaniki Crop Science Pvt. Ltd.', startX + 8, box1Y + 8);
      doc.font('Helvetica').fontSize(8)
        .text('Village - Ambagarh Chauki, Dist - Mohla Manpur Ambagarh Chauki', startX + 8, box1Y + 22, { width: 255 })
        .text('Chhattisgarh - 491665, India', startX + 8, box1Y + 34)
        .text(`GSTIN/UIN: ${sellerGst}`, startX + 8, box1Y + 48, { stroke: false })
        .text('State Name : Chhattisgarh, Code : 22', startX + 8, box1Y + 60)
        .text('CIN : U01111CT2020PTC010101', startX + 8, box1Y + 72)
        .text('E-Mail : teams@vanikicrop.com, Contact: 9406160185', startX + 8, box1Y + 84, { width: 255 });

      // Right: Dispatch / Invoice Metadata Grid
      const gridRowH = box1H / 5; // 27
      const midRightX = splitX + 130;

      for (let i = 1; i < 5; i++) {
        const y = box1Y + i * gridRowH;
        doc.moveTo(splitX, y).lineTo(rightX, y).lineWidth(0.5).stroke('#000000');
      }
      doc.moveTo(midRightX, box1Y).lineTo(midRightX, box1Y + gridRowH * 4).lineWidth(0.5).stroke('#000000');

      const invDateStr = invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      const orderDateStr = invoice.buyerOrderDate ? new Date(invoice.buyerOrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : invDateStr;
      const dispatchDateStr = invoice.dispatchDate ? new Date(invoice.dispatchDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : invDateStr;

      // Row 1
      doc.font('Helvetica').fontSize(7).text('Invoice No.', splitX + 5, box1Y + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).text(invoice.invoiceNumber, splitX + 5, box1Y + 13);
      doc.font('Helvetica').fontSize(7).text('Dated', midRightX + 5, box1Y + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).text(invDateStr, midRightX + 5, box1Y + 13);

      // Row 2
      doc.font('Helvetica').fontSize(7).text('Tally Voucher No.', splitX + 5, box1Y + gridRowH + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).text(invoice.tallyVoucherNumber ? `#${invoice.tallyVoucherNumber} (Synced)` : 'Pending', splitX + 5, box1Y + gridRowH + 13);
      doc.font('Helvetica').fontSize(7).text('Mode/Terms of Payment', midRightX + 5, box1Y + gridRowH + 4);
      doc.font('Helvetica-Bold').fontSize(8).text(invoice.paymentTerms || '30 Days Credit', midRightX + 5, box1Y + gridRowH + 13);

      // Row 3
      doc.font('Helvetica').fontSize(7).text("Buyer's Order No.", splitX + 5, box1Y + gridRowH * 2 + 4);
      doc.font('Helvetica-Bold').fontSize(8).text(invoice.buyerOrderNo || invoice.invoiceNumber, splitX + 5, box1Y + gridRowH * 2 + 13);
      doc.font('Helvetica').fontSize(7).text('Dated', midRightX + 5, box1Y + gridRowH * 2 + 4);
      doc.font('Helvetica-Bold').fontSize(8).text(orderDateStr, midRightX + 5, box1Y + gridRowH * 2 + 13);

      // Row 4
      doc.font('Helvetica').fontSize(7).text('Despatch Doc No.', splitX + 5, box1Y + gridRowH * 3 + 4);
      doc.font('Helvetica-Bold').fontSize(8).text(invoice.dispatchDocNo || `LR-${invoice.invoiceNumber.slice(-4)}`, splitX + 5, box1Y + gridRowH * 3 + 13);
      doc.font('Helvetica').fontSize(7).text('Delivery Note Date', midRightX + 5, box1Y + gridRowH * 3 + 4);
      doc.font('Helvetica-Bold').fontSize(8).text(dispatchDateStr, midRightX + 5, box1Y + gridRowH * 3 + 13);

      // Row 5
      doc.font('Helvetica').fontSize(7).text('Despatched through', splitX + 5, box1Y + gridRowH * 4 + 3);
      doc.font('Helvetica-Bold').fontSize(7.5).text(invoice.despatchedThrough || 'Vaniki Logistics', splitX + 5, box1Y + gridRowH * 4 + 13);
      doc.font('Helvetica').fontSize(7).text('Destination', midRightX + 5, box1Y + gridRowH * 4 + 3);
      doc.font('Helvetica-Bold').fontSize(7.5).text(invoice.destination || store.address?.city || 'Ambagarh Chauki', midRightX + 5, box1Y + gridRowH * 4 + 13);

      // ─── Box 2: Consignee & Buyer Box ───────────────────────────────────
      const box2Y = box1Y + box1H; // 191
      const box2H = 75;

      doc.rect(startX, box2Y, contentW, box2H).lineWidth(0.75).stroke('#000000');
      doc.moveTo(splitX, box2Y).lineTo(splitX, box2Y + box2H).lineWidth(0.75).stroke('#000000');

      const storeGst = store.gstNumber || store.sgstNumber || 'Unregistered Dealer';
      const storeState = store.address?.state || 'Chhattisgarh';

      // Left: Consignee (Ship to)
      doc.font('Helvetica').fontSize(7.5).text('Consignee (Ship to)', startX + 8, box2Y + 6);
      doc.font('Helvetica-Bold').fontSize(9).text(store.name || 'Store Admin', startX + 8, box2Y + 17);
      doc.font('Helvetica').fontSize(7.5)
        .text(formatAddress(store.address), startX + 8, box2Y + 28, { width: 255 })
        .text(`GSTIN/UIN: ${storeGst}`, startX + 8, box2Y + 48)
        .text(`State Name : ${storeState}, Code : 22`, startX + 8, box2Y + 58);

      // Right: Buyer (Bill to)
      doc.font('Helvetica').fontSize(7.5).text('Buyer (Bill to)', splitX + 8, box2Y + 6);
      doc.font('Helvetica-Bold').fontSize(9).text(store.name || 'Store Admin', splitX + 8, box2Y + 17);
      doc.font('Helvetica').fontSize(7.5)
        .text(formatAddress(store.address), splitX + 8, box2Y + 28, { width: 255 })
        .text(`GSTIN/UIN: ${storeGst}`, splitX + 8, box2Y + 48)
        .text(`State Name : ${storeState}, Code : 22`, splitX + 8, box2Y + 58);

      // ─── Box 3: Items Grid Table ────────────────────────────────────────
      const box3Y = box2Y + box2H; // 266
      const colX = [
        startX,                  // 0: Sl No (25)
        startX + 28,             // 1: Description (53)
        startX + 28 + 215,       // 2: HSN/SAC (268)
        startX + 28 + 215 + 60,  // 3: Quantity (328)
        startX + 28 + 215 + 60 + 55, // 4: Rate (383)
        startX + 28 + 215 + 60 + 55 + 45, // 5: per (428)
        startX + 28 + 215 + 60 + 55 + 45 + 35, // 6: Amount (463)
        rightX,                  // 7: End (570.28)
      ];

      const headerH = 20;
      const tableTotalH = 225; // height of item table area

      doc.rect(startX, box3Y, contentW, tableTotalH).lineWidth(0.75).stroke('#000000');
      doc.moveTo(startX, box3Y + headerH).lineTo(rightX, box3Y + headerH).lineWidth(0.5).stroke('#000000');

      // Draw vertical column dividers
      for (let i = 1; i < colX.length - 1; i++) {
        doc.moveTo(colX[i], box3Y).lineTo(colX[i], box3Y + tableTotalH - 22).lineWidth(0.5).stroke('#000000');
      }

      // Column Headers
      doc.font('Helvetica-Bold').fontSize(7.5);
      doc.text('Sl No.', colX[0], box3Y + 6, { width: colX[1] - colX[0], align: 'center' });
      doc.text('Description of Goods', colX[1] + 4, box3Y + 6, { width: colX[2] - colX[1] - 8, align: 'left' });
      doc.text('HSN/SAC', colX[2], box3Y + 6, { width: colX[3] - colX[2], align: 'center' });
      doc.text('Quantity', colX[3], box3Y + 6, { width: colX[4] - colX[3] - 4, align: 'right' });
      doc.text('Rate (₹)', colX[4], box3Y + 6, { width: colX[5] - colX[4] - 4, align: 'right' });
      doc.text('per', colX[5], box3Y + 6, { width: colX[6] - colX[5], align: 'center' });
      doc.text('Amount (₹)', colX[6], box3Y + 6, { width: colX[7] - colX[6] - 6, align: 'right' });

      // Rows
      let rowY = box3Y + headerH + 6;
      let totalUnitsSum = 0;
      let taxableSubtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;

      const hsnSummaryMap = new Map<string, { taxable: number; cgst: number; sgst: number }>();

      invoice.items.forEach((item: any, idx: number) => {
        const qty = Number(item.qty || 1);
        const grossPrice = Number(item.price || 0);
        const taxRate = Number(item.taxRate || 18);
        const hsn = item.hsnCode || '38089190';
        
        const lineGross = grossPrice * qty;
        const lineTaxable = lineGross / (1 + taxRate / 100);
        const lineTax = lineGross - lineTaxable;
        const lineCgst = lineTax / 2;
        const lineSgst = lineTax / 2;
        const netRate = lineTaxable / qty;

        totalUnitsSum += qty;
        taxableSubtotal += lineTaxable;
        totalCgst += lineCgst;
        totalSgst += lineSgst;

        if (!hsnSummaryMap.has(hsn)) {
          hsnSummaryMap.set(hsn, { taxable: 0, cgst: 0, sgst: 0 });
        }
        const prevHsn = hsnSummaryMap.get(hsn)!;
        prevHsn.taxable += lineTaxable;
        prevHsn.cgst += lineCgst;
        prevHsn.sgst += lineSgst;

        doc.font('Helvetica').fontSize(7.5);
        doc.text(String(idx + 1), colX[0], rowY, { width: colX[1] - colX[0], align: 'center' });
        doc.font('Helvetica-Bold').text(item.productName, colX[1] + 4, rowY, { width: colX[2] - colX[1] - 8, align: 'left' });
        doc.font('Helvetica').text(hsn, colX[2], rowY, { width: colX[3] - colX[2], align: 'center' });
        doc.text(`${qty} Liter`, colX[3], rowY, { width: colX[4] - colX[3] - 4, align: 'right' });
        doc.text(netRate.toFixed(2), colX[4], rowY, { width: colX[5] - colX[4] - 4, align: 'right' });
        doc.text('Liter', colX[5], rowY, { width: colX[6] - colX[5], align: 'center' });
        doc.text(lineTaxable.toFixed(2), colX[6], rowY, { width: colX[7] - colX[6] - 6, align: 'right' });

        rowY += 16;
      });

      // Tally Output CGST & SGST ledger entries
      rowY += 6;
      doc.font('Helvetica-Bold').fontSize(7.5);
      doc.text('Output CGST @ 9%', colX[1] + 12, rowY, { width: colX[2] - colX[1] - 8 });
      doc.text('9%', colX[4], rowY, { width: colX[5] - colX[4] - 4, align: 'right' });
      doc.text(totalCgst.toFixed(2), colX[6], rowY, { width: colX[7] - colX[6] - 6, align: 'right' });

      rowY += 14;
      doc.text('Output SGST @ 9%', colX[1] + 12, rowY, { width: colX[2] - colX[1] - 8 });
      doc.text('9%', colX[4], rowY, { width: colX[5] - colX[4] - 4, align: 'right' });
      doc.text(totalSgst.toFixed(2), colX[6], rowY, { width: colX[7] - colX[6] - 6, align: 'right' });

      // Table Footer Total Row
      const tableBottomY = box3Y + tableTotalH - 22;
      doc.moveTo(startX, tableBottomY).lineTo(rightX, tableBottomY).lineWidth(0.75).stroke('#000000');

      doc.font('Helvetica-Bold').fontSize(8.5);
      doc.text('Total', colX[1] + 4, tableBottomY + 6);
      doc.text(`${totalUnitsSum} Liter`, colX[3], tableBottomY + 6, { width: colX[4] - colX[3] - 4, align: 'right' });
      doc.text(`₹ ${Number(invoice.totalAmount || (taxableSubtotal + totalCgst + totalSgst)).toFixed(2)}`, colX[6], tableBottomY + 6, { width: colX[7] - colX[6] - 6, align: 'right' });

      // ─── Box 4: Amount Chargeable in Words ──────────────────────────────
      const box4Y = box3Y + tableTotalH; // 491
      const box4H = 26;
      doc.rect(startX, box4Y, contentW, box4H).lineWidth(0.75).stroke('#000000');

      doc.font('Helvetica').fontSize(7).text('Amount Chargeable (in words)', startX + 8, box4Y + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).text(numberToWordsIndian(invoice.totalAmount), startX + 8, box4Y + 13);
      doc.font('Helvetica').fontSize(7.5).text('E. & O.E', rightX - 60, box4Y + 13, { align: 'right' });

      // ─── Box 5: HSN / Tax Breakdown Summary Table ───────────────────────
      const box5Y = box4Y + box4H; // 517
      const box5H = 65;
      doc.rect(startX, box5Y, contentW, box5H).lineWidth(0.75).stroke('#000000');

      const hsnColX = [
        startX,                  // 0: HSN/SAC (25)
        startX + 95,             // 1: Taxable (120)
        startX + 95 + 110,       // 2: Central Tax Rate & Amt (230)
        startX + 95 + 110 + 130, // 3: State Tax Rate & Amt (360)
        startX + 95 + 110 + 130 + 130, // 4: Total Tax (490)
        rightX,                  // 5: End (570.28)
      ];

      // HSN table header
      doc.moveTo(startX, box5Y + 16).lineTo(rightX, box5Y + 16).lineWidth(0.5).stroke('#000000');
      for (let i = 1; i < hsnColX.length - 1; i++) {
        doc.moveTo(hsnColX[i], box5Y).lineTo(hsnColX[i], box5Y + 45).lineWidth(0.5).stroke('#000000');
      }

      doc.font('Helvetica-Bold').fontSize(7);
      doc.text('HSN/SAC', hsnColX[0], box5Y + 5, { width: hsnColX[1] - hsnColX[0], align: 'center' });
      doc.text('Taxable Value', hsnColX[1], box5Y + 5, { width: hsnColX[2] - hsnColX[1] - 4, align: 'right' });
      doc.text('Central Tax (9%)', hsnColX[2], box5Y + 5, { width: hsnColX[3] - hsnColX[2] - 4, align: 'right' });
      doc.text('State Tax (9%)', hsnColX[3], box5Y + 5, { width: hsnColX[4] - hsnColX[3] - 4, align: 'right' });
      doc.text('Total Tax Amount', hsnColX[4], box5Y + 5, { width: hsnColX[5] - hsnColX[4] - 6, align: 'right' });

      // HSN rows
      let hsnRowY = box5Y + 20;
      hsnSummaryMap.forEach((val, hsnCode) => {
        doc.font('Helvetica').fontSize(7.5);
        doc.text(hsnCode, hsnColX[0], hsnRowY, { width: hsnColX[1] - hsnColX[0], align: 'center' });
        doc.text(val.taxable.toFixed(2), hsnColX[1], hsnRowY, { width: hsnColX[2] - hsnColX[1] - 4, align: 'right' });
        doc.text(val.cgst.toFixed(2), hsnColX[2], hsnRowY, { width: hsnColX[3] - hsnColX[2] - 4, align: 'right' });
        doc.text(val.sgst.toFixed(3), hsnColX[3], hsnRowY, { width: hsnColX[4] - hsnColX[3] - 4, align: 'right' });
        doc.text((val.cgst + val.sgst).toFixed(2), hsnColX[4], hsnRowY, { width: hsnColX[5] - hsnColX[4] - 6, align: 'right' });
        hsnRowY += 12;
      });

      // Total row
      doc.moveTo(startX, box5Y + 45).lineTo(rightX, box5Y + 45).lineWidth(0.5).stroke('#000000');
      doc.font('Helvetica-Bold').fontSize(7.5);
      doc.text('Total', hsnColX[0], box5Y + 49, { width: hsnColX[1] - hsnColX[0], align: 'center' });
      doc.text(taxableSubtotal.toFixed(2), hsnColX[1], box5Y + 49, { width: hsnColX[2] - hsnColX[1] - 4, align: 'right' });
      doc.text(totalCgst.toFixed(2), hsnColX[2], box5Y + 49, { width: hsnColX[3] - hsnColX[2] - 4, align: 'right' });
      doc.text(totalSgst.toFixed(2), hsnColX[3], box5Y + 49, { width: hsnColX[4] - hsnColX[3] - 4, align: 'right' });
      doc.text((totalCgst + totalSgst).toFixed(2), hsnColX[4], box5Y + 49, { width: hsnColX[5] - hsnColX[4] - 6, align: 'right' });

      // ─── Box 6: Bank Details, Declaration & Signatory ──────────────────
      const box6Y = box5Y + box5H; // 582
      const box6H = 88;
      doc.rect(startX, box6Y, contentW, box6H).lineWidth(0.75).stroke('#000000');
      doc.moveTo(splitX + 35, box6Y).lineTo(splitX + 35, box6Y + box6H).lineWidth(0.75).stroke('#000000');

      // Left: Bank Details & Declaration
      doc.font('Helvetica-Bold').fontSize(7.5).text("Company's Bank Details :", startX + 8, box6Y + 6);
      doc.font('Helvetica').fontSize(7)
        .text('Bank Name  : HDFC Bank', startX + 8, box6Y + 17)
        .text('A/c No.        : 50200088991122', startX + 8, box6Y + 27)
        .text('Branch & IFS : Ambagarh Chauki & HDFC0001234', startX + 8, box6Y + 37);

      doc.font('Helvetica-Bold').fontSize(7).text('Declaration :', startX + 8, box6Y + 52);
      doc.font('Helvetica-Oblique').fontSize(6.5)
        .text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', startX + 8, box6Y + 62, { width: 285 });

      // Right: Signatory Box
      const signLeft = splitX + 45;
      const signW = rightX - signLeft - 8;
      doc.font('Helvetica-Bold').fontSize(8.5).text('for Vaniki Crop Science Pvt. Ltd.', signLeft, box6Y + 8, { width: signW, align: 'right' });
      doc.font('Helvetica').fontSize(7.5).text('Authorised Signatory', signLeft, box6Y + box6H - 16, { width: signW, align: 'right' });

      // Footer note
      doc.font('Helvetica-Oblique').fontSize(7).text('This is a Computer Generated Invoice (Tally Synced)', startX, box6Y + box6H + 8, { width: contentW, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
