import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { User } from '../../models/User.model.js';
import { Store } from '../../models/Store.model.js';
import { Staff } from '../../models/Staff.model.js';
import { B2BInvoice } from '../../models/B2BInvoice.model.js';
import { ProductRequest } from '../../models/ProductRequest.model.js';
import { Product } from '../../models/Product.model.js';
import { Order } from '../../models/Order.model.js';
import { Cart } from '../../models/Cart.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { uploadToCloudinary } from '../../utils/cloudinary.helpers.js';

/**
 * Helper: Find dealer by 4-digit code (e.g. 1018), full dealerCode (e.g. VKD1018), or mobile number
 */
async function findDealerByCodeOrMobile(codeOrMobile: string) {
  const raw = String(codeOrMobile).trim();
  const cleanUpper = raw.toUpperCase();
  const digitsOnly = raw.replace(/\D/g, '');
  const fourDigit = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : digitsOnly;

  const orQueries: any[] = [
    { shortCode: cleanUpper },
    { dealerCode: cleanUpper },
    { dealerCode: `VKD${cleanUpper}` },
  ];

  if (digitsOnly.length >= 10) {
    orQueries.push({ mobile: digitsOnly.slice(-10) });
  }

  if (fourDigit && fourDigit.length === 4) {
    orQueries.push({ shortCode: fourDigit });
    orQueries.push({ dealerCode: `VKD${fourDigit}` });
    orQueries.push({ dealerCode: new RegExp(`${fourDigit}$`, 'i') });
    orQueries.push({ name: new RegExp(`\\[${fourDigit}\\]`, 'i') });
  }

  const dealer = await User.findOne({
    role: 'storeAdmin',
    $or: orQueries,
  }).select('name mobile email dealerCode shortCode dealerProfile selectedStore savedAddress createdAt');

  if (!dealer) {
    throw new AppError(`Dealer with ID / Code / Mobile "${codeOrMobile}" not found.`, 404);
  }

  let store: any = null;
  if (dealer.selectedStore) {
    store = await Store.findById(dealer.selectedStore).select('name address phone gstNumber deliveryRadius');
  } else {
    store = await Store.findOne({ adminId: dealer._id }).select('name address phone gstNumber deliveryRadius');
  }

  return { dealer, store };
}

/**
 * GET /api/staff/dealers/lookup/:dealerCode
 * Staff enters 4-digit dealer code in StaffTrack to fetch dealer profile, credit limit, ledger & orders
 */
export async function lookupDealer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { dealerCode } = req.params;
    const { dealer, store } = await findDealerByCodeOrMobile(dealerCode as string);

    const storeId = store?._id || dealer.selectedStore;

    // Fetch B2B Invoices & calculate financial ledger
    const invoices = storeId
      ? await B2BInvoice.find({ storeId }).sort({ invoiceDate: -1 }).limit(50).lean()
      : [];

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let unpaidCount = 0;

    invoices.forEach((inv: any) => {
      const invTotal = inv.totalAmount || 0;
      totalInvoiced += invTotal;

      const pStatus = inv.paymentStatus;
      if (pStatus === 'paid') {
        totalPaid += invTotal;
      } else if (pStatus === 'partially_paid' || pStatus === 'verification_pending') {
        const paid = inv.paidAmount || 0;
        totalPaid += paid;
        const out = inv.outstandingAmount !== undefined ? inv.outstandingAmount : Math.max(0, invTotal - paid);
        totalOutstanding += out;
        if (out > 0) unpaidCount++;
      } else {
        // unpaid
        const out = inv.outstandingAmount !== undefined && inv.outstandingAmount > 0 ? inv.outstandingAmount : invTotal;
        totalOutstanding += out;
        unpaidCount++;
      }
    });

    // Fetch recent product requests
    const productRequests = storeId
      ? await ProductRequest.find({ storeId }).sort({ createdAt: -1 }).limit(20).lean()
      : [];

    // Fetch recent customer retail orders fulfilled by this store or placed for this dealer
    const recentRetailOrders = storeId
      ? await Order.find({ $or: [{ storeId }, { userId: dealer._id }] })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('orderNumber totalAmount total status createdAt serviceMode paymentStatus paymentMethod items')
          .lean()
      : [];

    // Check if dealer currently has items in active cart
    const activeCart = storeId
      ? await Cart.findOne({
          $or: [{ userId: dealer._id }, { storeId }],
          status: 'active',
          totalItems: { $gt: 0 },
        }).lean()
      : null;

    // Extract 4-digit ID and clean name
    const codeMatch = (dealer.dealerCode || '').match(/\d{4}$/) || (dealer.dealerCode || '').match(/\d+/);
    const fourDigitId = dealer.shortCode || (codeMatch ? codeMatch[0] : (dealer.dealerCode || 'N/A'));
    const rawName = dealer.name || 'Dealer';
    const cleanName = rawName.replace(/^\[\d+\]\s*/, '').replace(/^\d+\s*-\s*/, '').trim();

    // Credit limit (standard ₹1,00,000 default or configured)
    const creditLimit = 100000;
    const availableCredit = Math.max(0, creditLimit - totalOutstanding);

    // Fetch platform bank details & QR configured by SuperAdmin
    const siteSettings = await SiteSetting.findOne({ singletonKey: 'default' }).lean();
    const bankDetails = siteSettings?.bankDetails || {
      accountName: 'Vaniki Crop Science Pvt Ltd',
      accountNumber: '50200088991122',
      ifscCode: 'HDFC0001234',
      bankName: 'HDFC Bank',
      branchName: 'Ambagarh Chauki',
      upiId: 'vanikicrop@hdfcbank',
      qrCodeUrl: '',
    };

    res.status(200).json({
      success: true,
      data: {
        dealer: {
          id: dealer._id,
          fourDigitId,
          dealerCode: dealer.dealerCode || `VKD${fourDigitId}`,
          name: dealer.name,
          cleanName,
          mobile: dealer.mobile,
          email: dealer.email,
          storeName: store?.name || dealer.dealerProfile?.storeName || 'Dealer Store',
          storeLocation: dealer.dealerProfile?.storeLocation || store?.address?.city || '',
          gstNumber: store?.gstNumber || dealer.dealerProfile?.gstNumber || '',
          address: store?.address || dealer.savedAddress,
        },
        credit: {
          creditLimit,
          totalOutstanding,
          availableCredit,
          totalInvoiced,
          totalPaid,
          unpaidInvoiceCount: unpaidCount,
        },
        ledgerSummary: {
          totalInvoiced,
          totalPaid,
          totalOutstanding,
          unpaidInvoiceCount: unpaidCount,
        },
        bankDetails,
        invoices,
        productRequests,
        recentRetailOrders,
        activeCart: activeCart
          ? {
              totalItems: activeCart.totalItems,
              subtotal: activeCart.subtotal,
              items: activeCart.items,
              lastActiveAt: activeCart.lastActiveAt,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/staff/dealers/:dealerCode/product-requests
 * Staff places a bulk wholesale product request on behalf of the dealer
 */
export async function placeDealerProductRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { dealerCode } = req.params;
    const staffId = req.staffId;
    const { dealer, store } = await findDealerByCodeOrMobile(dealerCode as string);

    const storeId = store?._id || dealer.selectedStore;
    if (!storeId) {
      throw new AppError('Dealer has no linked store. Cannot place bulk request.', 400);
    }

    const staff = await Staff.findById(staffId);
    const staffName = staff?.name || 'Field Staff';
    const staffMobile = staff?.mobile || '';

    const {
      productName,
      productId,
      requestedQuantity,
      requestedPack,
      garageName,
      petiQuantity = 1,
      petiSize = 12,
      petiUnit = 'Liter',
      dealerPrice,
      offerPrice,
      hsnCode,
      taxRate,
      notes,
    } = req.body;

    if (!productName || !garageName) {
      throw new AppError('productName and garageName are required.', 400);
    }

    let finalPetiSize = Number(petiSize) || 12;
    let finalPetiUnit = petiUnit || 'Liter';
    let finalHsn = hsnCode;
    let finalTaxRate = taxRate !== undefined ? Number(taxRate) : 18;
    let finalDealerPrice = dealerPrice;
    let finalOfferPrice = offerPrice;

    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      const prod = await Product.findById(productId).select('name shortDescription petiSize petiUnit taxRate hsnCode variants');
      if (prod) {
        if (prod.petiSize && !req.body.petiSize) finalPetiSize = prod.petiSize;
        if (prod.petiUnit && !req.body.petiUnit) finalPetiUnit = prod.petiUnit;
        if (prod.hsnCode && !finalHsn) finalHsn = prod.hsnCode;
        if (prod.taxRate !== undefined && req.body.taxRate === undefined) finalTaxRate = prod.taxRate;
        if (prod.variants && prod.variants.length > 0) {
          const v = prod.variants[0];
          if (!finalDealerPrice) finalDealerPrice = v.adminPrice || v.price;
          if (!finalOfferPrice) finalOfferPrice = v.offerPrice || v.price;
          if (!finalHsn && v.hsnCode) finalHsn = v.hsnCode;
        }
      }
    }

    const combinedNotes = `[Placed via StaffTrack by ${staffName} (${staffMobile})] ${notes || ''}`.trim();

    const request = await ProductRequest.create({
      storeId,
      adminId: dealer._id,
      productId: productId && mongoose.Types.ObjectId.isValid(productId) ? productId : undefined,
      productName: String(productName).trim(),
      requestedQuantity: Number(requestedQuantity) || (Number(petiQuantity) * finalPetiSize),
      requestedPack: requestedPack ? String(requestedPack).trim() : undefined,
      garageName: String(garageName).trim(),
      petiQuantity: Number(petiQuantity) || 1,
      petiSize: finalPetiSize,
      petiUnit: finalPetiUnit as any,
      dealerPrice: finalDealerPrice,
      offerPrice: finalOfferPrice,
      hsnCode: finalHsn || '38089190',
      taxRate: finalTaxRate,
      notes: combinedNotes,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Product bulk request placed successfully for dealer!',
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/staff/dealers/:dealerCode/invoices/:invoiceId/payment
 * Staff collects & uploads payment slip (IFSC / UPI QR) for the dealer
 */
export async function submitDealerPaymentSlip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { invoiceId } = req.params;
    const staffId = req.staffId;

    const invoice = await B2BInvoice.findById(invoiceId);
    if (!invoice) {
      throw new AppError('B2B Invoice not found.', 404);
    }

    const { utr, paidAmount, notes } = req.body;
    if (!utr || !String(utr).trim()) {
      throw new AppError('UTR / Transaction reference number is required.', 400);
    }

    let screenshotUrls: string[] = [];
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length > 0) {
      for (const file of files) {
        const uploadRes = await uploadToCloudinary(file.buffer, 'vaniki/dealer-staff-proofs');
        screenshotUrls.push(uploadRes.url);
      }
    } else if (req.body.screenshots) {
      const raw = Array.isArray(req.body.screenshots) ? req.body.screenshots : [req.body.screenshots];
      screenshotUrls = raw.filter((s: any) => typeof s === 'string' && s.trim());
    }

    if (screenshotUrls.length === 0) {
      throw new AppError('At least 1 payment screenshot is required.', 400);
    }

    const staff = await Staff.findById(staffId);
    const staffLabel = staff ? `Collected by Staff: ${staff.name} (${staff.mobile})` : 'Collected by Field Staff';

    const paymentAmount = paidAmount !== undefined && Number(paidAmount) > 0
      ? Number(paidAmount)
      : (invoice.outstandingAmount || invoice.totalAmount);

    invoice.paidAmount = Math.min(invoice.totalAmount, (invoice.paidAmount || 0) + paymentAmount);
    invoice.outstandingAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);

    invoice.paymentStatus = 'verification_pending';
    invoice.paymentUtr = String(utr).trim();
    invoice.paymentScreenshots = screenshotUrls;
    invoice.paymentSubmittedAt = new Date();
    invoice.collectedByStaff = staffId as any;

    const existingNotes = invoice.paymentNotes ? `${invoice.paymentNotes}\n` : '';
    const userNotes = notes ? ` Note: ${notes}` : '';
    invoice.paymentNotes = `${existingNotes}[${staffLabel}]${userNotes}`.trim();

    await invoice.save();

    res.status(200).json({
      success: true,
      message: 'Payment slip submitted successfully by staff!',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/staff/dealers/:dealerCode/ledger
 * Complete transaction ledger & outstanding bills for the dealer
 */
export async function getDealerLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { dealerCode } = req.params;
    const { dealer, store } = await findDealerByCodeOrMobile(dealerCode as string);

    const storeId = store?._id || dealer.selectedStore;
    const invoices = storeId ? await B2BInvoice.find({ storeId }).sort({ invoiceDate: -1 }) : [];

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    const ledgerEntries = invoices.map((inv) => {
      const invTotal = inv.totalAmount || 0;
      totalInvoiced += invTotal;

      let p = inv.paidAmount || 0;
      let out = inv.outstandingAmount !== undefined ? inv.outstandingAmount : Math.max(0, invTotal - p);

      if (inv.paymentStatus === 'paid') {
        p = invTotal;
        out = 0;
      }

      totalPaid += p;
      totalOutstanding += out;

      return {
        invoiceId: inv._id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        totalAmount: invTotal,
        paidAmount: p,
        outstandingAmount: out,
        paymentStatus: inv.paymentStatus,
        paymentUtr: inv.paymentUtr,
        paymentScreenshots: inv.paymentScreenshots || [],
        paymentSubmittedAt: inv.paymentSubmittedAt,
        paymentVerifiedAt: inv.paymentVerifiedAt,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        dealerCode: dealer.dealerCode,
        dealerName: dealer.name,
        storeName: store?.name || dealer.dealerProfile?.storeName || 'Dealer Store',
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        ledger: ledgerEntries,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/staff/dealers/products
 * Returns wholesale/B2B product catalog for staff ordering
 */
export async function getWholesaleProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const products = await Product.find({ isActive: true })
      .select('name slug brand category images variants shortDescription isB2B petiSize petiUnit taxRate hsnCode')
      .populate('category', 'name slug')
      .sort({ name: 1 })
      .lean();

    const catalog = products.map((p: any) => {
      const v = p.variants?.[0] || {};
      const unitDealerPrice = v.adminPrice || v.price || 0;
      const unitMrp = v.mrp || unitDealerPrice;
      const petiSize = p.petiSize || 12;
      const petiUnit = p.petiUnit || 'Liter';
      const petiPrice = Math.round(unitDealerPrice * petiSize);

      return {
        id: p._id,
        name: p.name,
        slug: p.slug,
        brand: p.brand || 'Vaniki',
        category: p.category?.name || 'Crop Protection',
        image: p.images?.[0]?.url || '',
        petiSize,
        petiUnit,
        packSize: v.label || `${petiSize} ${petiUnit}/Box`,
        mrp: unitMrp,
        dealerPrice: unitDealerPrice,
        petiPrice,
        taxRate: p.taxRate !== undefined ? p.taxRate : 18,
        hsnCode: p.hsnCode || v.hsnCode || '38089190',
        stock: v.stock !== undefined ? v.stock : 100,
        variants: (p.variants || []).map((va: any) => ({
          id: va._id,
          label: va.label,
          price: va.price,
          dealerPrice: va.adminPrice || va.price,
          mrp: va.mrp,
          stock: va.stock,
        })),
      };
    });

    res.status(200).json({
      success: true,
      count: catalog.length,
      data: catalog,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/staff/dealers/:dealerCode/orders
 * Staff places a complete wholesale order for the dealer:
 * - Selects products & quantities
 * - Payment options: Credit, UPI QR / Bank Slip, Cash, or Partial
 * - Records paid amount, pending amount, and deal description notes
 */
export async function placeStaffOrderForDealer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { dealerCode } = req.params;
    const { dealer, store } = await findDealerByCodeOrMobile(dealerCode as string);
    const storeId = store?._id || dealer.selectedStore;

    if (!storeId) {
      throw new AppError('Dealer has no linked store. Cannot place order.', 400);
    }

    // Parse items (support both JSON body and multipart form-data)
    let rawItems = req.body.items;
    if (typeof rawItems === 'string') {
      try {
        rawItems = JSON.parse(rawItems);
      } catch (_) {
        rawItems = [];
      }
    }
    const items: any[] = Array.isArray(rawItems) ? rawItems : [];

    if (items.length === 0) {
      throw new AppError('At least 1 product item is required in the order.', 400);
    }

    // Parse payment info
    let payment = req.body.payment || {};
    if (typeof payment === 'string') {
      try {
        payment = JSON.parse(payment);
      } catch (_) {
        payment = {};
      }
    }

    // Support top-level payment fields if sent as form-data
    if (req.body.paymentMode && !payment.mode) payment.mode = req.body.paymentMode;
    if (req.body.paidAmount !== undefined && payment.paidAmount === undefined) payment.paidAmount = req.body.paidAmount;
    if (req.body.totalAmount !== undefined && payment.totalAmount === undefined) payment.totalAmount = req.body.totalAmount;
    if (req.body.utr && !payment.utr) payment.utr = req.body.utr;

    const dealDescription = req.body.dealDescription || req.body.notes || '';
    const staffId = req.staffId || req.body.staffId;
    const staffName = req.body.staffName || req.headers['x-staff-name'] || 'Field Staff';
    const staffMobile = req.body.staffMobile || req.headers['x-staff-phone'] || '';

    // Handle payment proof screenshots (uploaded files or image URLs)
    let screenshotUrls: string[] = [];
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length > 0) {
      for (const file of files) {
        try {
          const uploadRes = await uploadToCloudinary(file.buffer, 'vaniki/stafftrack-orders');
          screenshotUrls.push(uploadRes.url);
        } catch (uploadErr) {
          console.error('Screenshot upload error:', uploadErr);
        }
      }
    } else if (payment.paymentProofScreenshots || req.body.screenshots) {
      const raw = payment.paymentProofScreenshots || req.body.screenshots;
      const arr = Array.isArray(raw) ? raw : [raw];
      screenshotUrls = arr.filter((s: any) => typeof s === 'string' && s.trim());
    }

    const paymentMode: string = payment.mode || 'credit'; // 'credit' | 'upi_qr' | 'bank_transfer' | 'cash' | 'partial'

    // Calculate item pricing & build invoice items and Order items
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    const invoiceItems: any[] = [];
    const orderItems: any[] = [];
    const createdProductRequests: any[] = [];
    const batchId = `STAFF-${Date.now().toString(36).toUpperCase()}`;

    for (const it of items) {
      const pQty = Math.max(1, Number(it.petiQuantity || it.qty || 1));
      let pSize = Number(it.petiSize) || 12;
      let pUnit = it.petiUnit || 'Liter';
      let uPrice = Number(it.dealerPrice || it.price || 0);
      let taxRate = Number(it.taxRate) || 18;
      let hsn = it.hsnCode || '38089190';
      let prodName = String(it.productName || 'Product').trim();
      let variantId = it.variantId;
      let variantLabel = it.packSize || it.variantLabel || `${pSize} ${pUnit}`;
      let mrp = Number(it.mrp) || (uPrice * 1.25);
      let img = it.image || '';

      if (it.productId && mongoose.Types.ObjectId.isValid(it.productId)) {
        const prod = await Product.findById(it.productId).select('name petiSize petiUnit taxRate hsnCode variants images').lean();
        if (prod) {
          if (!it.productName) prodName = prod.name;
          if (prod.petiSize && !it.petiSize) pSize = prod.petiSize;
          if (prod.petiUnit && !it.petiUnit) pUnit = prod.petiUnit;
          if (prod.taxRate !== undefined && it.taxRate === undefined) taxRate = prod.taxRate;
          if (prod.hsnCode && !it.hsnCode) hsn = prod.hsnCode;
          if (prod.variants && prod.variants.length > 0) {
            const v = (prod.variants as any[])[0];
            if (!uPrice) uPrice = v.adminPrice || v.price || 0;
            if (!variantId) variantId = v._id;
            if (!it.packSize && !it.variantLabel) variantLabel = v.label || variantLabel;
            if (!it.mrp) mrp = v.mrp || (uPrice * 1.25);
          }
          if (!img && (prod as any).images?.length > 0) {
            img = (prod as any).images[0]?.url || '';
          }
        }
      }

      const totalUnits = Number(it.requestedQuantity) || (pQty * pSize);
      const itemSubtotal = Math.round(uPrice * totalUnits * 100) / 100;
      const itemTax = Math.round(((itemSubtotal * taxRate) / 100) * 100) / 100;
      const itemTotal = Math.round((itemSubtotal + itemTax) * 100) / 100;

      calculatedSubtotal += itemSubtotal;
      calculatedTax += itemTax;

      invoiceItems.push({
        productName: prodName,
        hsnCode: hsn,
        packSize: it.packSize || `${pSize} ${pUnit}/Box`,
        petiQty: pQty,
        petiSize: pSize,
        qty: totalUnits,
        price: uPrice,
        taxRate,
        taxAmount: itemTax,
        total: itemTotal,
      });

      if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
        variantId = new mongoose.Types.ObjectId();
      }

      orderItems.push({
        productId: it.productId && mongoose.Types.ObjectId.isValid(it.productId) ? new mongoose.Types.ObjectId(it.productId) : new mongoose.Types.ObjectId(),
        variantId: new mongoose.Types.ObjectId(variantId),
        productName: prodName,
        variantLabel,
        price: uPrice,
        mrp: Math.round(mrp),
        qty: totalUnits,
        image: img,
        hsnCode: hsn,
        taxRate,
        taxAmount: itemTax,
        taxType: 'CGST/SGST',
        netAmount: itemSubtotal,
      });

      // Create linked ProductRequest record for warehouse dispatch
      const reqDoc = await ProductRequest.create({
        storeId,
        adminId: dealer._id,
        productId: it.productId && mongoose.Types.ObjectId.isValid(it.productId) ? it.productId : undefined,
        batchId,
        productName: prodName,
        requestedQuantity: totalUnits,
        requestedPack: it.packSize || `${pSize} ${pUnit}`,
        garageName: store?.name || dealer.dealerProfile?.storeName || 'Dealer Store',
        petiQuantity: pQty,
        petiSize: pSize,
        petiUnit: pUnit as any,
        dealerPrice: uPrice,
        offerPrice: Number(it.offerPrice) || uPrice,
        hsnCode: hsn,
        taxRate,
        notes: `[StaffTrack Order by ${staffName} (${staffMobile}) | Payment: ${paymentMode.toUpperCase()}] ${dealDescription}`.trim(),
        status: 'approved',
      });
      createdProductRequests.push(reqDoc);
    }

    const calculatedGrandTotal = Math.round((calculatedSubtotal + calculatedTax) * 100) / 100;
    const finalGrandTotal = Number(payment.totalAmount) > 0 ? Number(payment.totalAmount) : calculatedGrandTotal;
    const paidAmount = Math.max(0, Number(payment.paidAmount || 0));
    const outstandingAmount = Math.max(0, finalGrandTotal - paidAmount);

    let paymentStatus: 'paid' | 'partially_paid' | 'unpaid' | 'verification_pending' = 'unpaid';
    if (paymentMode === 'credit') {
      paymentStatus = 'unpaid';
    } else if (paidAmount >= finalGrandTotal) {
      paymentStatus = screenshotUrls.length > 0 || payment.utr ? 'verification_pending' : 'paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'partially_paid';
    }

    const invoiceNumber = `B2B-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    const combinedDealNotes = [
      `[StaffTrack Order by ${staffName} (${staffMobile})]`,
      `Payment Mode: ${paymentMode.toUpperCase()}`,
      `Total: ₹${finalGrandTotal} | Paid: ₹${paidAmount} | Outstanding: ₹${outstandingAmount}`,
      payment.utr ? `UTR: ${payment.utr}` : '',
      dealDescription ? `Deal Notes: ${dealDescription}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Create official Order record in orders collection
    const orderNumber = await (Order as any).generateOrderNumber();
    const resolvedPaymentMethod = paymentMode === 'cash' ? 'cash' : (paymentMode === 'upi_qr' ? 'upi' : 'cod');
    const orderPaymentStatus = paymentStatus === 'paid' || paidAmount >= finalGrandTotal ? 'paid' : (paidAmount > 0 ? 'paid' : 'pending');

    const createdOrder = await Order.create({
      orderNumber,
      userId: dealer._id,
      storeId,
      serviceMode: 'pickup',
      items: orderItems,
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      discount: 0,
      couponDiscount: 0,
      loyaltyPointsApplied: 0,
      loyaltyDiscount: 0,
      deliveryCharge: 0,
      totalAmount: finalGrandTotal,
      totalTaxAmount: Math.round(calculatedTax * 100) / 100,
      shippingAddress: {
        name: dealer.name || 'Dealer Admin',
        mobile: dealer.mobile || '',
        street: store?.address?.street || dealer.savedAddress?.street || 'Store Address',
        city: store?.address?.city || dealer.savedAddress?.city || 'Bhilai',
        district: store?.address?.district || dealer.savedAddress?.district || 'Durg',
        state: store?.address?.state || dealer.savedAddress?.state || 'Chhattisgarh',
        pincode: store?.address?.pincode || dealer.savedAddress?.pincode || '490001',
      },
      paymentStatus: orderPaymentStatus,
      paymentMethod: resolvedPaymentMethod,
      paymentCollectedBy: staffId && mongoose.Types.ObjectId.isValid(staffId) ? new mongoose.Types.ObjectId(staffId) : null,
      paymentCollectedAt: paidAmount > 0 ? new Date() : undefined,
      status: 'confirmed',
      adminNote: `[StaffTrack Order by ${staffName} (${staffMobile}) | Paid: ₹${paidAmount} | Pending: ₹${outstandingAmount}] ${dealDescription}`.trim(),
      statusHistory: [
        {
          status: 'confirmed',
          note: `Order booked via StaffTrack by ${staffName} (${staffMobile})`,
          timestamp: new Date(),
        },
      ],
      tallySyncStatus: 'pending',
    });

    const invoice = await B2BInvoice.create({
      storeId,
      invoiceNumber,
      invoiceDate: new Date(),
      items: invoiceItems,
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      totalTaxAmount: Math.round(calculatedTax * 100) / 100,
      totalAmount: finalGrandTotal,
      paymentStatus,
      paidAmount,
      outstandingAmount,
      paymentTerms: paymentMode === 'credit' ? 'Credit (Udhaar)' : paymentMode.toUpperCase(),
      paymentUtr: payment.utr || '',
      paymentScreenshots: screenshotUrls,
      paymentSubmittedAt: paidAmount > 0 ? new Date() : undefined,
      paymentNotes: combinedDealNotes,
      buyerOrderNo: createdOrder.orderNumber,
      buyerOrderDate: createdOrder.createdAt,
      collectedByStaff: staffId && mongoose.Types.ObjectId.isValid(staffId) ? staffId : undefined,
      tallySyncStatus: 'pending',
    });

    // Link invoiceId to all product requests in this batch
    await ProductRequest.updateMany(
      { batchId },
      { $set: { invoiceId: invoice._id } }
    );

    // Extract 4-digit code
    const codeMatch = (dealer.dealerCode || '').match(/\d{4}$/) || (dealer.dealerCode || '').match(/\d+/);
    const fourDigitId = dealer.shortCode || (codeMatch ? codeMatch[0] : dealer.dealerCode);

    res.status(201).json({
      success: true,
      message: 'Dealer order placed successfully via StaffTrack!',
      data: {
        orderId: createdOrder._id,
        orderNumber: createdOrder.orderNumber,
        batchId,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        dealer: {
          id: dealer._id,
          fourDigitId,
          dealerCode: dealer.dealerCode,
          name: dealer.name,
          storeName: store?.name || dealer.dealerProfile?.storeName,
          mobile: dealer.mobile,
        },
        itemsCount: invoiceItems.length,
        items: invoiceItems,
        totalAmount: finalGrandTotal,
        paidAmount,
        outstandingAmount,
        paymentMode,
        paymentStatus,
        paymentUtr: payment.utr || null,
        paymentScreenshots: screenshotUrls,
        dealDescription: dealDescription || null,
        placedAt: invoice.invoiceDate,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/staff/dealers/bank-details
 * Returns dynamic platform Bank Details & QR code set by SuperAdmin
 */
export async function getBankDetails(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await SiteSetting.findOne({ singletonKey: 'default' }).lean();
    res.status(200).json({
      success: true,
      data: settings?.bankDetails || {
        accountName: 'Vaniki Crop Science Pvt Ltd',
        accountNumber: '50200088991122',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        branchName: 'Ambagarh Chauki',
        upiId: 'vanikicrop@hdfcbank',
        qrCodeUrl: '',
      },
    });
  } catch (error) {
    next(error);
  }
}

