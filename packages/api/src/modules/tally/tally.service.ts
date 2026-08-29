import mongoose from 'mongoose';
import { B2BInvoice, IB2BInvoice } from '../../models/B2BInvoice.model.js';
import { Store } from '../../models/Store.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { AppError } from '../../utils/AppError.js';

export interface TallyConfig {
  companyName: string;
  salesLedger: string;
  cgstLedger: string;
  sgstLedger: string;
  igstLedger: string;
  roundOffLedger: string;
  companyState: string;
  companyGstin: string;
  agentSecretKey: string;
}

const DEFAULT_TALLY_CONFIG: TallyConfig = {
  companyName: 'Vaniki Crop Science Pvt Ltd',
  salesLedger: 'Sales - Agro Chemicals',
  cgstLedger: 'CGST Output',
  sgstLedger: 'SGST Output',
  igstLedger: 'IGST Output',
  roundOffLedger: 'Round Off',
  companyState: 'Chhattisgarh',
  companyGstin: '22AAAAA0000A1Z5',
  agentSecretKey: 'vaniki_tally_sec_2026_x9k',
};

function formatTallyDate(date: Date): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`; // Format: YYYYMMDD
}

function escapeXml(str: string = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates official TallyPrime / Tally.ERP 9 XML Sales Voucher Envelope
 */
export function buildTallySalesVoucherXml(
  invoice: IB2BInvoice,
  store: { name: string; address?: { street?: string; city?: string; state?: string; pincode?: string }; gstin?: string },
  config: TallyConfig = DEFAULT_TALLY_CONFIG
): string {
  const dateStr = formatTallyDate(invoice.invoiceDate || new Date());
  const invoiceNum = escapeXml(invoice.invoiceNumber);
  const partyName = escapeXml(store.name || 'Cash Customer');
  const partyLedgerName = escapeXml(store.name || 'Sundry Debtors');
  const partyState = store.address?.state || config.companyState || 'Chhattisgarh';
  const partyGstin = escapeXml(store.gstin || 'URP');

  const isInterState = partyState.trim().toLowerCase() !== config.companyState.trim().toLowerCase();

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  invoice.items.forEach((item) => {
    const taxAmt = item.taxAmount || 0;
    if (isInterState) {
      igstTotal += taxAmt;
    } else {
      cgstTotal += taxAmt / 2;
      sgstTotal += taxAmt / 2;
    }
  });

  const totalAmount = invoice.totalAmount;
  const subtotal = invoice.subtotal;

  // Inventory entries
  const inventoryXml = invoice.items
    .map((item) => {
      const pName = escapeXml(item.productName);
      const qty = item.qty;
      const rate = item.price.toFixed(2);
      const itemAmount = (item.price * item.qty).toFixed(2);
      const hsn = item.hsnCode ? `<HSNCODE>${escapeXml(item.hsnCode)}</HSNCODE>` : '';

      return `
        <ALLINVENTORYENTRIES.LIST>
          <STOCKITEMNAME>${pName}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <RATE>${rate}/Nos</RATE>
          <AMOUNT>${itemAmount}</AMOUNT>
          <ACTUALQTY>${qty} Nos</ACTUALQTY>
          <BILLEDQTY>${qty} Nos</BILLEDQTY>
          ${hsn}
          <ACCOUNTINGALLOCATIONS.LIST>
            <LEDGERNAME>${escapeXml(config.salesLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${itemAmount}</AMOUNT>
          </ACCOUNTINGALLOCATIONS.LIST>
        </ALLINVENTORYENTRIES.LIST>`;
    })
    .join('');

  // Tax ledger entries
  let taxLedgersXml = '';
  if (isInterState && igstTotal > 0) {
    taxLedgersXml += `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(config.igstLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${igstTotal.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
  } else {
    if (cgstTotal > 0) {
      taxLedgersXml += `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(config.cgstLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${cgstTotal.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
    }
    if (sgstTotal > 0) {
      taxLedgersXml += `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(config.sgstLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${sgstTotal.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
    }
  }

  const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(config.companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${dateStr}</DATE>
            <REFERENCEDATE>${dateStr}</REFERENCEDATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${invoiceNum}</VOUCHERNUMBER>
            <REFERENCE>${invoiceNum}</REFERENCE>
            <PARTYLEDGERNAME>${partyLedgerName}</PARTYLEDGERNAME>
            <PARTYNAME>${partyName}</PARTYNAME>
            <STATENAME>${escapeXml(partyState)}</STATENAME>
            <COUNTRYNAME>India</COUNTRYNAME>
            <PARTYGSTIN>${partyGstin}</PARTYGSTIN>
            <PLACEOFSUPPLY>${escapeXml(partyState)}</PLACEOFSUPPLY>
            <ISINVOICE>Yes</ISINVOICE>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>

            <!-- Party Ledger (Sundry Debtors) Debit Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyLedgerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Stock Items / Inventory Allocations -->
            ${inventoryXml}

            <!-- GST Output Ledgers -->
            ${taxLedgersXml}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return xml.trim();
}

/**
 * Fetch pending invoices waiting to be synced to Tally
 */
export async function getPendingTallySyncInvoices(limit = 20) {
  const invoices = await B2BInvoice.find({
    tallySyncStatus: { $in: ['pending', 'failed'] },
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('storeId', 'name address gstin phone');

  const settings = await SiteSetting.findOne({ singletonKey: 'default' });
  const config: TallyConfig = {
    ...DEFAULT_TALLY_CONFIG,
    companyName: settings?.platformName || DEFAULT_TALLY_CONFIG.companyName,
    companyState: settings?.address?.state || DEFAULT_TALLY_CONFIG.companyState,
    companyGstin: settings?.gstNumber || DEFAULT_TALLY_CONFIG.companyGstin,
  };

  const payload = invoices.map((inv) => {
    const store = (inv.storeId as any) || {};
    const xml = buildTallySalesVoucherXml(inv, store, config);
    return {
      invoiceId: inv._id.toString(),
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      storeName: store.name || 'Dealer',
      totalAmount: inv.totalAmount,
      xmlPayload: xml,
    };
  });

  return payload;
}

/**
 * Record sync result from Windows Tally Agent
 */
export async function recordTallySyncResult(
  invoiceId: string,
  result: {
    status: 'synced' | 'failed';
    tallyVoucherNumber?: string;
    tallyVoucherGuid?: string;
    error?: string;
  }
) {
  const invoice = await B2BInvoice.findById(invoiceId);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  invoice.tallySyncStatus = result.status;
  if (result.status === 'synced') {
    invoice.tallyVoucherNumber = result.tallyVoucherNumber || invoice.invoiceNumber;
    invoice.tallyVoucherGuid = result.tallyVoucherGuid;
    invoice.tallySyncAt = new Date();
    invoice.tallySyncError = undefined;
  } else {
    invoice.tallySyncError = result.error || 'Failed to push into Tally';
  }

  await invoice.save();
  return invoice;
}

/**
 * Get Tally Settings
 */
export async function getTallyConfig(): Promise<TallyConfig> {
  const settings = await SiteSetting.findOne({ singletonKey: 'default' });
  return {
    ...DEFAULT_TALLY_CONFIG,
    companyName: settings?.platformName || DEFAULT_TALLY_CONFIG.companyName,
    companyState: settings?.address?.state || DEFAULT_TALLY_CONFIG.companyState,
    companyGstin: settings?.gstNumber || DEFAULT_TALLY_CONFIG.companyGstin,
  };
}
