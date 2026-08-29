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
  store: { name: string; address?: { street?: string; city?: string; state?: string; pincode?: string }; gstin?: string; phone?: string },
  config: TallyConfig = DEFAULT_TALLY_CONFIG
): string {
  const dateStr = formatTallyDate(invoice.invoiceDate || new Date());
  const orderDateStr = formatTallyDate(invoice.buyerOrderDate || invoice.invoiceDate || new Date());
  const dispatchDateStr = formatTallyDate(invoice.dispatchDate || invoice.invoiceDate || new Date());
  const invoiceNum = escapeXml(invoice.invoiceNumber);
  const partyName = escapeXml(store.name || 'Sundry Debtors');
  const partyLedgerName = escapeXml(store.name || 'Sundry Debtors');
  const partyStreet = escapeXml(store.address?.street || store.name || '');
  const partyCity = escapeXml(store.address?.city || 'Ambagarh Chauki');
  const partyState = store.address?.state || config.companyState || 'Chhattisgarh';
  const partyPincode = escapeXml(store.address?.pincode || '491665');
  const partyPhone = escapeXml(store.phone || '');
  const partyGstin = escapeXml(store.gstin || (store as any).gstNumber || (store as any).sgstNumber || '27ABCDE1234F1Z4');

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
      const hsnCode = escapeXml(item.hsnCode || '38089190');

      return `
        <ALLINVENTORYENTRIES.LIST>
          <STOCKITEMNAME>${pName}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <RATE>${rate}/NOS</RATE>
          <AMOUNT>${itemAmount}</AMOUNT>
          <ACTUALQTY>${qty} NOS</ACTUALQTY>
          <BILLEDQTY>${qty} NOS</BILLEDQTY>
          <HSNCODE>${hsnCode}</HSNCODE>
          <GSTRATEDETAILS.LIST>
            <HSNCODE>${hsnCode}</HSNCODE>
            <HSN>${hsnCode}</HSN>
          </GSTRATEDETAILS.LIST>
          <BATCHALLOCATIONS.LIST>
            <GODOWNNAME>Main Location</GODOWNNAME>
            <BATCHNAME>Primary Batch</BATCHNAME>
            <AMOUNT>${itemAmount}</AMOUNT>
            <ACTUALQTY>${qty} NOS</ACTUALQTY>
            <BILLEDQTY>${qty} NOS</BILLEDQTY>
          </BATCHALLOCATIONS.LIST>
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
        <LEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(config.igstLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${igstTotal.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
  } else {
    if (cgstTotal > 0) {
      taxLedgersXml += `
        <LEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(config.cgstLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${cgstTotal.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
    }
    if (sgstTotal > 0) {
      taxLedgersXml += `
        <LEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(config.sgstLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${sgstTotal.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
    }
  }

  // Stock Items auto-creation XML
  const stockItemsCreationXml = invoice.items
    .map((item) => {
      const pName = escapeXml(item.productName);
      const hsnCode = escapeXml(item.hsnCode || '38089190');
      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${pName}" ACTION="Create">
            <NAME>${pName}</NAME>
            <BASEUNITS>NOS</BASEUNITS>
            <ISBATCHWISEON>No</ISBATCHWISEON>
            <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
            <HSNCODE>${hsnCode}</HSNCODE>
            <HSNDETAILS.LIST>
              <APPLICABLEFROM>20260401</APPLICABLEFROM>
              <HSNCODE>${hsnCode}</HSNCODE>
              <HSN>${hsnCode}</HSN>
            </HSNDETAILS.LIST>
            <GSTRATEDETAILS.LIST>
              <APPLICABLEFROM>20260401</APPLICABLEFROM>
              <HSNCODE>${hsnCode}</HSNCODE>
              <HSN>${hsnCode}</HSN>
              <TAXABILITY>Taxable</TAXABILITY>
              <GSTRATE>${item.taxRate || 18}</GSTRATE>
            </GSTRATEDETAILS.LIST>
          </STOCKITEM>
        </TALLYMESSAGE>`;
    })
    .join('');

  const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(config.companyName || 'Vaniki Crop Science Pvt Ltd')}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <!-- 0. Auto-create Godown / Location -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <GODOWN NAME="Main Location" ACTION="Create">
            <NAME>Main Location</NAME>
            <PARENT/>
          </GODOWN>
        </TALLYMESSAGE>

        <!-- 1. Auto-create Units -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <UNIT NAME="NOS" ACTION="Create">
            <NAME>NOS</NAME>
            <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
            <DECIMALPLACES>0</DECIMALPLACES>
            <ORIGINALNAME>Numbers</ORIGINALNAME>
          </UNIT>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <UNIT NAME="Nos" ACTION="Create">
            <NAME>Nos</NAME>
            <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
            <DECIMALPLACES>0</DECIMALPLACES>
            <ORIGINALNAME>Numbers</ORIGINALNAME>
          </UNIT>
        </TALLYMESSAGE>

        <!-- 2. Auto-create Sales Ledger -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${escapeXml(config.salesLedger)}" ACTION="Create">
            <NAME>${escapeXml(config.salesLedger)}</NAME>
            <PARENT>Sales Accounts</PARENT>
            <ISBILLWISEON>No</ISBILLWISEON>
            <AFFECTSSTOCK>Yes</AFFECTSSTOCK>
            <GSTTYPE>Applicable</GSTTYPE>
          </LEDGER>
        </TALLYMESSAGE>

        <!-- 3. Auto-create CGST Ledger -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${escapeXml(config.cgstLedger)}" ACTION="Create">
            <NAME>${escapeXml(config.cgstLedger)}</NAME>
            <PARENT>Duties &amp; Taxes</PARENT>
            <TAXTYPE>GST</TAXTYPE>
            <GSTDUTYHEAD>Central Tax</GSTDUTYHEAD>
          </LEDGER>
        </TALLYMESSAGE>

        <!-- 4. Auto-create SGST Ledger -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${escapeXml(config.sgstLedger)}" ACTION="Create">
            <NAME>${escapeXml(config.sgstLedger)}</NAME>
            <PARENT>Duties &amp; Taxes</PARENT>
            <TAXTYPE>GST</TAXTYPE>
            <GSTDUTYHEAD>State Tax</GSTDUTYHEAD>
          </LEDGER>
        </TALLYMESSAGE>

        <!-- 5. Auto-create IGST Ledger -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${escapeXml(config.igstLedger)}" ACTION="Create">
            <NAME>${escapeXml(config.igstLedger)}</NAME>
            <PARENT>Duties &amp; Taxes</PARENT>
            <TAXTYPE>GST</TAXTYPE>
            <GSTDUTYHEAD>Integrated Tax</GSTDUTYHEAD>
          </LEDGER>
        </TALLYMESSAGE>

        <!-- 6. Auto-create Stock Items -->
        ${stockItemsCreationXml}

        <!-- 7. Auto-create Party Ledger under Sundry Debtors if not present -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${partyLedgerName}" ACTION="Create">
            <NAME>${partyLedgerName}</NAME>
            <PARENT>Sundry Debtors</PARENT>
            <MAILINGNAME>${partyName}</MAILINGNAME>
            <ADDRESS.LIST TYPE="String">
              <ADDRESS>${partyName}</ADDRESS>
              ${partyStreet ? `<ADDRESS>${partyStreet}</ADDRESS>` : ''}
              <ADDRESS>${partyCity}${partyCity && partyState ? ', ' : ''}${escapeXml(partyState)}${partyPincode ? ' - ' + partyPincode : ''}</ADDRESS>
              ${partyPhone ? `<ADDRESS>Phone: ${partyPhone}</ADDRESS>` : ''}
            </ADDRESS.LIST>
            <STATENAME>${escapeXml(partyState)}</STATENAME>
            <PINCODE>${partyPincode}</PINCODE>
            <LEDGERPHONE>${partyPhone}</LEDGERPHONE>
            <LEDGERMOBILE>${partyPhone}</LEDGERMOBILE>
            <PARTYGSTIN>${partyGstin}</PARTYGSTIN>
            <GSTREGISTRATIONTYPE>${store.gstin || (store as any).gstNumber ? 'Regular' : 'Unregistered'}</GSTREGISTRATIONTYPE>
            <OPENINGBALANCE>0</OPENINGBALANCE>
            <ISBILLWISEON>Yes</ISBILLWISEON>
            <COUNTRYNAME>India</COUNTRYNAME>
          </LEDGER>
        </TALLYMESSAGE>

        <!-- 8. Create Official Sales Voucher -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${dateStr}</DATE>
            <REFERENCEDATE>${dateStr}</REFERENCEDATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${invoiceNum}</VOUCHERNUMBER>
            <REFERENCE>${invoiceNum}</REFERENCE>
            <PARTYLEDGERNAME>${partyLedgerName}</PARTYLEDGERNAME>
            <PARTYNAME>${partyName}</PARTYNAME>
            <PARTYMAILINGNAME>${partyName}</PARTYMAILINGNAME>
            <STATENAME>${escapeXml(partyState)}</STATENAME>
            <COUNTRYNAME>India</COUNTRYNAME>
            <PARTYGSTIN>${partyGstin}</PARTYGSTIN>
            <PLACEOFSUPPLY>${escapeXml(partyState)}</PLACEOFSUPPLY>
            <ISINVOICE>Yes</ISINVOICE>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>

            <!-- Buyer Details for Invoice Printing -->
            <BASICBUYERNAME>${partyName}</BASICBUYERNAME>
            <BASICBUYERADDRESS.LIST TYPE="String">
              <BASICBUYERADDRESS>${partyName}</BASICBUYERADDRESS>
              ${partyStreet ? `<BASICBUYERADDRESS>${partyStreet}</BASICBUYERADDRESS>` : ''}
              <BASICBUYERADDRESS>${partyCity}${partyCity && partyState ? ', ' : ''}${escapeXml(partyState)}${partyPincode ? ' - ' + partyPincode : ''}</BASICBUYERADDRESS>
              ${partyPhone ? `<BASICBUYERADDRESS>Phone: ${partyPhone}</BASICBUYERADDRESS>` : ''}
            </BASICBUYERADDRESS.LIST>
            <BASICBUYERSSALESTAXNO>${partyGstin}</BASICBUYERSSALESTAXNO>

            <!-- Consignee (Ship To) Details -->
            <CONSIGNEEMAILINGNAME>${partyName}</CONSIGNEEMAILINGNAME>
            <CONSIGNEEADDRESS.LIST TYPE="String">
              <CONSIGNEEADDRESS>${partyName}</CONSIGNEEADDRESS>
              ${partyStreet ? `<CONSIGNEEADDRESS>${partyStreet}</CONSIGNEEADDRESS>` : ''}
              <CONSIGNEEADDRESS>${partyCity}${partyCity && partyState ? ', ' : ''}${escapeXml(partyState)}${partyPincode ? ' - ' + partyPincode : ''}</CONSIGNEEADDRESS>
              ${partyPhone ? `<CONSIGNEEADDRESS>Phone: ${partyPhone}</CONSIGNEEADDRESS>` : ''}
            </CONSIGNEEADDRESS.LIST>
            <CONSIGNEESTATENAME>${escapeXml(partyState)}</CONSIGNEESTATENAME>
            <CONSIGNEEPINCODE>${partyPincode}</CONSIGNEEPINCODE>
            <CONSIGNEEGSTIN>${partyGstin}</CONSIGNEEGSTIN>

            <ADDRESS.LIST TYPE="String">
              <ADDRESS>${partyName}</ADDRESS>
              ${partyStreet ? `<ADDRESS>${partyStreet}</ADDRESS>` : ''}
              <ADDRESS>${partyCity}${partyCity && partyState ? ', ' : ''}${escapeXml(partyState)}${partyPincode ? ' - ' + partyPincode : ''}</ADDRESS>
              ${partyPhone ? `<ADDRESS>Phone: ${partyPhone}</ADDRESS>` : ''}
            </ADDRESS.LIST>

            <!-- Order, Transport & Dispatch Tracking -->
            <BASICBUYERORDERNO>${escapeXml(invoice.buyerOrderNo || invoice.invoiceNumber)}</BASICBUYERORDERNO>
            <BASICORDERDATE>${orderDateStr}</BASICORDERDATE>
            <BASICSHIPDOCUMENTNO>${escapeXml(invoice.dispatchDocNo || '')}</BASICSHIPDOCUMENTNO>
            <BASICSHIPDELIVERYDATE>${dispatchDateStr}</BASICSHIPDELIVERYDATE>
            <BASICSHIPPEDBY>${escapeXml(invoice.despatchedThrough || 'Vaniki Fleet / Transport')}</BASICSHIPPEDBY>
            <BASICFINALDESTINATION>${escapeXml(invoice.destination || partyCity || partyState)}</BASICFINALDESTINATION>
            <BASICORDERTERMS>${escapeXml(invoice.termsOfDelivery || 'Door Delivery')}</BASICORDERTERMS>
            <BASICDUEDATEOFPYMT>${escapeXml(invoice.paymentTerms || 'Immediate / On Delivery')}</BASICDUEDATEOFPYMT>
            <BILLOFENTRYNO>${escapeXml(invoice.dispatchDocNo || '')}</BILLOFENTRYNO>
            <BILLOFENTRYDATE>${dispatchDateStr}</BILLOFENTRYDATE>

            <!-- Party Ledger (Sundry Debtors) Debit Entry -->
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${partyLedgerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
              <BILLALLOCATIONS.LIST>
                <NAME>${invoiceNum}</NAME>
                <BILLTYPE>New Ref</BILLTYPE>
                <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
              </BILLALLOCATIONS.LIST>
            </LEDGERENTRIES.LIST>

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
    .populate('storeId', 'name address gstin phone gstNumber sgstNumber');

  const settings = await SiteSetting.findOne({ singletonKey: 'default' });
  const config: TallyConfig = {
    ...DEFAULT_TALLY_CONFIG,
    companyName: 'Vaniki Crop Science Pvt Ltd',
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
