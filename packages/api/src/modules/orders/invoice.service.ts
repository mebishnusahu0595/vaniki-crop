import PDFDocument from 'pdfkit';
import { SiteSetting } from '../../models/SiteSetting.model.js';

function formatAddress(address?: Record<string, any> | null) {
  if (!address) return '-';
  return [address.street, address.city, address.district, address.state, address.pincode].filter(Boolean).join(', ');
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
 * Generates an Authentic Tally-Standard GST Tax Invoice (A4 Grid Layout) for any order.
 * @param order Order document with populated items and store
 * @param options PDF generation options
 * @returns Buffer containing the PDF data
 */
export async function generateInvoicePdf(order: any, _options: { size?: string } = {}): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      let siteSettings: any = null;
      try {
        siteSettings = await SiteSetting.findOne({ singletonKey: 'default' }).lean();
      } catch (err) {
        console.error('[PDF] Error loading site settings:', err);
      }

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
        .text('TAX INVOICE', startX, 22, { width: contentW, align: 'center' });
      doc.font('Helvetica').fontSize(8)
        .text('(ORIGINAL FOR RECIPIENT)', startX, 39, { width: contentW, align: 'center' });

      // ─── Box 1: Seller & Dispatch Details ──────────────────────────────
      const box1Y = 52;
      const box1H = 135;
      const splitX = startX + 270; // 295

      doc.rect(startX, box1Y, contentW, box1H).lineWidth(0.75).stroke('#000000');
      doc.moveTo(splitX, box1Y).lineTo(splitX, box1Y + box1H).lineWidth(0.75).stroke('#000000');

      const store = order.storeId || {};
      const sellerGst = store.gstNumber || siteSettings?.gstNumber || '22AAACV9876Q1Z2';
      const sellerName = store.name || 'Vaniki Crop Science Pvt. Ltd.';
      const sellerAddress = store.address ? formatAddress(store.address) : 'Village - Ambagarh Chauki, Dist - Mohla Manpur Ambagarh Chauki, Chhattisgarh - 491665';
      const sellerPhone = store.phone || '9406160185';
      const sellerEmail = store.email || 'teams@vanikicrop.com';

      // Left: Seller Details
      doc.font('Helvetica-Bold').fontSize(9.5).text(sellerName, startX + 8, box1Y + 8, { width: 255 });
      doc.font('Helvetica').fontSize(7.5)
        .text(sellerAddress, startX + 8, box1Y + 22, { width: 255 })
        .text(`GSTIN/UIN: ${sellerGst}`, startX + 8, box1Y + 46)
        .text('State Name : Chhattisgarh, Code : 22', startX + 8, box1Y + 58)
        .text('CIN : U01111CT2020PTC010101', startX + 8, box1Y + 70)
        .text(`Contact: ${sellerPhone}, E-Mail: ${sellerEmail}`, startX + 8, box1Y + 82, { width: 255 });

      // Right: Dispatch / Invoice Metadata Grid
      const gridRowH = box1H / 5;
      const midRightX = splitX + 130;

      for (let i = 1; i < 5; i++) {
        const y = box1Y + i * gridRowH;
        doc.moveTo(splitX, y).lineTo(rightX, y).lineWidth(0.5).stroke('#000000');
      }
      doc.moveTo(midRightX, box1Y).lineTo(midRightX, box1Y + gridRowH * 4).lineWidth(0.5).stroke('#000000');

      const invNumber = order.orderNumber ? `INV-${String(order.orderNumber).replace(/^VNK-?/, '')}` : `INV-${order._id || '0001'}`;
      const invDateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const tallyVoucherDisplay = order.tallyVoucherNumber ? `#${order.tallyVoucherNumber}` : (order.tallySyncStatus === 'synced' ? `#${order.orderNumber}` : 'Pending');
      const paymentDisplay = order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : `Online / UPI (${order.razorpayPaymentId || order.paymentStatus || 'Paid'})`;
      const serviceModeDisplay = order.serviceMode === 'pickup' ? 'Store Pickup' : 'Doorstep Delivery';
      const destinationCity = order.shippingAddress?.city || store.address?.city || 'Chhattisgarh';

      // Row 1
      doc.font('Helvetica').fontSize(7).text('Invoice No.', splitX + 5, box1Y + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).text(invNumber, splitX + 5, box1Y + 13);
      doc.font('Helvetica').fontSize(7).text('Dated', midRightX + 5, box1Y + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).text(invDateStr, midRightX + 5, box1Y + 13);

      // Row 2
      doc.font('Helvetica').fontSize(7).text('Tally Voucher No.', splitX + 5, box1Y + gridRowH + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).text(tallyVoucherDisplay, splitX + 5, box1Y + gridRowH + 13);
      doc.font('Helvetica').fontSize(7).text('Mode/Terms of Payment', midRightX + 5, box1Y + gridRowH + 4);
      doc.font('Helvetica-Bold').fontSize(7.5).text(paymentDisplay, midRightX + 5, box1Y + gridRowH + 13, { width: rightX - midRightX - 6 });

      // Row 3
      doc.font('Helvetica').fontSize(7).text("Buyer's Order No.", splitX + 5, box1Y + gridRowH * 2 + 4);
      doc.font('Helvetica-Bold').fontSize(8).text(order.orderNumber || invNumber, splitX + 5, box1Y + gridRowH * 2 + 13);
      doc.font('Helvetica').fontSize(7).text('Order Date', midRightX + 5, box1Y + gridRowH * 2 + 4);
      doc.font('Helvetica-Bold').fontSize(8).text(invDateStr, midRightX + 5, box1Y + gridRowH * 2 + 13);

      // Row 4
      doc.font('Helvetica').fontSize(7).text('Despatch Doc No.', splitX + 5, box1Y + gridRowH * 3 + 4);
      doc.font('Helvetica-Bold').fontSize(8).text(`VNK-DEL-${String(order.orderNumber || '0001').slice(-4)}`, splitX + 5, box1Y + gridRowH * 3 + 13);
      doc.font('Helvetica').fontSize(7).text('Delivery Note Date', midRightX + 5, box1Y + gridRowH * 3 + 4);
      doc.font('Helvetica-Bold').fontSize(8).text(invDateStr, midRightX + 5, box1Y + gridRowH * 3 + 13);

      // Row 5
      doc.font('Helvetica').fontSize(7).text('Despatched through', splitX + 5, box1Y + gridRowH * 4 + 3);
      doc.font('Helvetica-Bold').fontSize(7.5).text(serviceModeDisplay, splitX + 5, box1Y + gridRowH * 4 + 13);
      doc.font('Helvetica').fontSize(7).text('Destination', midRightX + 5, box1Y + gridRowH * 4 + 3);
      doc.font('Helvetica-Bold').fontSize(7.5).text(destinationCity, midRightX + 5, box1Y + gridRowH * 4 + 13);

      // ─── Box 2: Consignee & Buyer Box ───────────────────────────────────
      const box2Y = box1Y + box1H; // 187
      const box2H = 75;

      doc.rect(startX, box2Y, contentW, box2H).lineWidth(0.75).stroke('#000000');
      doc.moveTo(splitX, box2Y).lineTo(splitX, box2Y + box2H).lineWidth(0.75).stroke('#000000');

      const customer = order.userId || {};
      const buyerName = order.shippingAddress?.name || customer.name || 'Valued Customer';
      const buyerMobile = order.shippingAddress?.mobile || customer.mobile || '';
      const buyerAddress = order.shippingAddress ? formatAddress(order.shippingAddress) : (customer.savedAddress ? formatAddress(customer.savedAddress) : 'Delivery Address Provided at Checkout');
      const buyerState = order.shippingAddress?.state || customer.savedAddress?.state || 'Chhattisgarh';

      // Left: Consignee (Ship to)
      doc.font('Helvetica').fontSize(7.5).text('Consignee (Ship to)', startX + 8, box2Y + 6);
      doc.font('Helvetica-Bold').fontSize(8.5).text(buyerName, startX + 8, box2Y + 17);
      doc.font('Helvetica').fontSize(7.5)
        .text(buyerAddress, startX + 8, box2Y + 28, { width: 255 })
        .text(`Contact: ${buyerMobile}`, startX + 8, box2Y + 48)
        .text(`State Name : ${buyerState}, Code : 22`, startX + 8, box2Y + 58);

      // Right: Buyer (Bill to)
      doc.font('Helvetica').fontSize(7.5).text('Buyer (Bill to)', splitX + 8, box2Y + 6);
      doc.font('Helvetica-Bold').fontSize(8.5).text(buyerName, splitX + 8, box2Y + 17);
      doc.font('Helvetica').fontSize(7.5)
        .text(buyerAddress, splitX + 8, box2Y + 28, { width: 255 })
        .text('GSTIN/UIN: Unregistered Consumer', splitX + 8, box2Y + 48)
        .text(`State Name : ${buyerState}, Code : 22`, splitX + 8, box2Y + 58);

      // ─── Box 3: Items Grid Table ────────────────────────────────────────
      const box3Y = box2Y + box2H; // 262
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
      const tableTotalH = 230;

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
      doc.text('Rate (Rs.)', colX[4], box3Y + 6, { width: colX[5] - colX[4] - 4, align: 'right' });
      doc.text('per', colX[5], box3Y + 6, { width: colX[6] - colX[5], align: 'center' });
      doc.text('Amount (Rs.)', colX[6], box3Y + 6, { width: colX[7] - colX[6] - 6, align: 'right' });

      // Rows
      let rowY = box3Y + headerH + 6;
      let totalUnitsSum = 0;
      let taxableSubtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;

      const hsnSummaryMap = new Map<string, { taxable: number; cgst: number; sgst: number }>();
      const items = order.items || [];

      items.forEach((item: any, idx: number) => {
        const qty = Number(item.qty || 1);
        const grossPrice = Number(item.price || 0);
        const taxRate = Number(item.taxRate || 18);
        const hsn = item.hsnCode || '38089910';
        const pName = item.productName || item.productId?.name || 'Crop Protection Product';
        const vLabel = item.variantLabel ? ` (${item.variantLabel})` : '';

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
        doc.font('Helvetica-Bold').text(`${pName}${vLabel}`, colX[1] + 4, rowY, { width: colX[2] - colX[1] - 8, align: 'left' });
        doc.font('Helvetica').text(hsn, colX[2], rowY, { width: colX[3] - colX[2], align: 'center' });
        doc.text(`${qty} Units`, colX[3], rowY, { width: colX[4] - colX[3] - 4, align: 'right' });
        doc.text(netRate.toFixed(2), colX[4], rowY, { width: colX[5] - colX[4] - 4, align: 'right' });
        doc.text('Nos', colX[5], rowY, { width: colX[6] - colX[5], align: 'center' });
        doc.text(lineTaxable.toFixed(2), colX[6], rowY, { width: colX[7] - colX[6] - 6, align: 'right' });

        rowY += 16;
      });

      // Tally Output CGST & SGST ledger entries
      rowY += 4;
      doc.font('Helvetica-Bold').fontSize(7.5);
      doc.text('Output CGST @ 9%', colX[1] + 12, rowY, { width: colX[2] - colX[1] - 8 });
      doc.text('9%', colX[4], rowY, { width: colX[5] - colX[4] - 4, align: 'right' });
      doc.text(totalCgst.toFixed(2), colX[6], rowY, { width: colX[7] - colX[6] - 6, align: 'right' });

      rowY += 13;
      doc.text('Output SGST @ 9%', colX[1] + 12, rowY, { width: colX[2] - colX[1] - 8 });
      doc.text('9%', colX[4], rowY, { width: colX[5] - colX[4] - 4, align: 'right' });
      doc.text(totalSgst.toFixed(2), colX[6], rowY, { width: colX[7] - colX[6] - 6, align: 'right' });

      // Delivery charge ledger (if any)
      const deliveryCharge = Number(order.deliveryCharge || 0);
      if (deliveryCharge > 0) {
        rowY += 13;
        doc.text('Delivery & Freight Charges', colX[1] + 12, rowY, { width: colX[2] - colX[1] - 8 });
        doc.text(deliveryCharge.toFixed(2), colX[6], rowY, { width: colX[7] - colX[6] - 6, align: 'right' });
      }

      // Discount ledger (if any)
      const totalDiscount = Number(order.couponDiscount || 0) + Number(order.loyaltyDiscount || 0);
      if (totalDiscount > 0) {
        rowY += 13;
        doc.text('Less: Promotional Discount', colX[1] + 12, rowY, { width: colX[2] - colX[1] - 8 });
        doc.text(`-${totalDiscount.toFixed(2)}`, colX[6], rowY, { width: colX[7] - colX[6] - 6, align: 'right' });
      }

      // Table Footer Total Row
      const tableBottomY = box3Y + tableTotalH - 22;
      doc.moveTo(startX, tableBottomY).lineTo(rightX, tableBottomY).lineWidth(0.75).stroke('#000000');

      doc.font('Helvetica-Bold').fontSize(8.5);
      doc.text('Total', colX[1] + 4, tableBottomY + 6);
      doc.text(`${totalUnitsSum} Units`, colX[3], tableBottomY + 6, { width: colX[4] - colX[3] - 4, align: 'right' });
      doc.text(`Rs. ${Number(order.totalAmount || (taxableSubtotal + totalCgst + totalSgst + deliveryCharge - totalDiscount)).toFixed(2)}`, colX[6], tableBottomY + 6, { width: colX[7] - colX[6] - 6, align: 'right' });

      // ─── Box 4: Amount Chargeable in Words ──────────────────────────────
      const box4Y = box3Y + tableTotalH; // 492
      const box4H = 26;
      doc.rect(startX, box4Y, contentW, box4H).lineWidth(0.75).stroke('#000000');

      doc.font('Helvetica').fontSize(7).text('Amount Chargeable (in words)', startX + 8, box4Y + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).text(numberToWordsIndian(order.totalAmount || (taxableSubtotal + totalCgst + totalSgst + deliveryCharge - totalDiscount)), startX + 8, box4Y + 13);
      doc.font('Helvetica').fontSize(7.5).text('E. & O.E', rightX - 60, box4Y + 13, { align: 'right' });

      // ─── Box 5: HSN / Tax Breakdown Summary Table ───────────────────────
      const box5Y = box4Y + box4H; // 518
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
        doc.text(val.sgst.toFixed(2), hsnColX[3], hsnRowY, { width: hsnColX[4] - hsnColX[3] - 4, align: 'right' });
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
      const box6Y = box5Y + box5H; // 583
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
      doc.font('Helvetica-Bold').fontSize(8.5).text(`for ${sellerName}`, signLeft, box6Y + 8, { width: signW, align: 'right' });
      doc.font('Helvetica').fontSize(7.5).text('Authorised Signatory', signLeft, box6Y + box6H - 16, { width: signW, align: 'right' });

      // Footer note
      doc.font('Helvetica-Oblique').fontSize(7).text('This is a Computer Generated Invoice (Tally Synced)', startX, box6Y + box6H + 8, { width: contentW, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates an Authentic Tally-Standard GST Tax Invoice (A4 Grid Layout) for B2B Procurements.
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
      const tableTotalH = 225;

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
      doc.text('Rate (Rs.)', colX[4], box3Y + 6, { width: colX[5] - colX[4] - 4, align: 'right' });
      doc.text('per', colX[5], box3Y + 6, { width: colX[6] - colX[5], align: 'center' });
      doc.text('Amount (Rs.)', colX[6], box3Y + 6, { width: colX[7] - colX[6] - 6, align: 'right' });

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
        doc.text(`${qty} Units`, colX[3], rowY, { width: colX[4] - colX[3] - 4, align: 'right' });
        doc.text(netRate.toFixed(2), colX[4], rowY, { width: colX[5] - colX[4] - 4, align: 'right' });
        doc.text('Nos', colX[5], rowY, { width: colX[6] - colX[5], align: 'center' });
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
      doc.text(`${totalUnitsSum} Units`, colX[3], tableBottomY + 6, { width: colX[4] - colX[3] - 4, align: 'right' });
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
        doc.text(val.sgst.toFixed(2), hsnColX[3], hsnRowY, { width: hsnColX[4] - hsnColX[3] - 4, align: 'right' });
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
