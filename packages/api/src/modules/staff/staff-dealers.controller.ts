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
import { uploadToCloudinary } from '../../utils/cloudinary.helpers.js';

/**
 * Helper: Find dealer by code or mobile
 */
async function findDealerByCodeOrMobile(codeOrMobile: string) {
  const cleanCode = String(codeOrMobile).trim().toUpperCase();
  const cleanMobile = String(codeOrMobile).trim();

  const dealer = await User.findOne({
    role: 'storeAdmin',
    $or: [{ dealerCode: cleanCode }, { mobile: cleanMobile }],
  }).select('name mobile email dealerCode dealerProfile selectedStore savedAddress createdAt');

  if (!dealer) {
    throw new AppError(`Dealer with code/mobile "${codeOrMobile}" not found.`, 404);
  }

  let store: any = null;
  if (dealer.selectedStore) {
    store = await Store.findById(dealer.selectedStore).select('name address phone gstNumber');
  } else {
    store = await Store.findOne({ adminId: dealer._id }).select('name address phone gstNumber');
  }

  return { dealer, store };
}

/**
 * GET /api/staff/dealers/lookup/:dealerCode
 * Staff enters dealer code in StaffTrack to fetch dealer profile, ledger & orders
 */
export async function lookupDealer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { dealerCode } = req.params;
    const { dealer, store } = await findDealerByCodeOrMobile(dealerCode as string);

    const storeId = store?._id || dealer.selectedStore;

    // Fetch B2B Invoices & calculate financial ledger
    const invoices = storeId
      ? await B2BInvoice.find({ storeId }).sort({ invoiceDate: -1 }).limit(50)
      : [];

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let unpaidCount = 0;

    invoices.forEach((inv) => {
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
      ? await ProductRequest.find({ storeId }).sort({ createdAt: -1 }).limit(20)
      : [];

    // Fetch recent customer retail orders fulfilled by this store (if any)
    const recentRetailOrders = storeId
      ? await Order.find({ storeId }).sort({ createdAt: -1 }).limit(10).select('orderNumber total status createdAt serviceMode')
      : [];

    res.status(200).json({
      success: true,
      data: {
        dealer: {
          id: dealer._id,
          name: dealer.name,
          mobile: dealer.mobile,
          email: dealer.email,
          dealerCode: dealer.dealerCode || 'N/A',
          storeName: store?.name || dealer.dealerProfile?.storeName || 'Dealer Store',
          storeLocation: dealer.dealerProfile?.storeLocation || store?.address?.city || '',
          gstNumber: store?.gstNumber || dealer.dealerProfile?.gstNumber || '',
          address: store?.address || dealer.savedAddress,
        },
        ledgerSummary: {
          totalInvoiced,
          totalPaid,
          totalOutstanding,
          unpaidInvoiceCount: unpaidCount,
        },
        invoices,
        productRequests,
        recentRetailOrders,
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
