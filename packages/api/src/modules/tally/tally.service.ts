import mongoose from 'mongoose';
import { B2BInvoice, IB2BInvoice } from '../../models/B2BInvoice.model.js';
import { Order, IOrder } from '../../models/Order.model.js';
import { Store } from '../../models/Store.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { User } from '../../models/User.model.js';
import { AppError } from '../../utils/AppError.js';

export interface TallyConfig {
  tallyHost: string;
  tallyPort: number;
  companyName: string;
  salesLedger: string;
  cgstLedger: string;
  sgstLedger: string;
  igstLedger: string;
  roundOffLedger: string;
  companyState: string;
  companyGstin: string;
  agentSecretKey: string;
  autoSyncEnabled: boolean;
}

export const DEFAULT_TALLY_CONFIG: TallyConfig = {
  tallyHost: '127.0.0.1',
  tallyPort: 9000,
  companyName: 'Vaniki Crop Science Pvt Ltd',
  salesLedger: 'Sales - Agro Chemicals',
  cgstLedger: 'CGST Output',
  sgstLedger: 'SGST Output',
  igstLedger: 'IGST Output',
  roundOffLedger: 'Round Off',
  companyState: 'Chhattisgarh',
  companyGstin: '22AAAAA0000A1Z5',
  agentSecretKey: 'vaniki_tally_sec_2026_x9k',
  autoSyncEnabled: true,
};

function formatTallyDate(date: Date): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`; // Format: YYYYMMDD
}

function escapeXml(str: string = ''): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates official TallyPrime / Tally.ERP 9 XML Sales Voucher Envelope for B2B Invoices (Dealers)
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
 * Generates official TallyPrime / Tally.ERP 9 XML Sales Voucher Envelope for Retail User Orders (Web / Mobile App)
 */
export function buildTallyRetailOrderVoucherXml(
  order: IOrder | any,
  user: any,
  store: any,
  config: TallyConfig = DEFAULT_TALLY_CONFIG
): string {
  const dateStr = formatTallyDate(order.createdAt || new Date());
  const orderNum = escapeXml(order.orderNumber || `ORD-${order._id}`);
  const customerName = order.shippingAddress?.name || user?.name || 'Customer';
  const partyName = escapeXml(customerName);
  const partyLedgerName = escapeXml(`Customer - ${customerName}`);
  const partyStreet = escapeXml(order.shippingAddress?.street || user?.savedAddress?.street || '');
  const partyCity = escapeXml(order.shippingAddress?.city || user?.savedAddress?.city || 'Ambagarh Chauki');
  const partyDistrict = escapeXml(order.shippingAddress?.district || '');
  const partyState = order.shippingAddress?.state || user?.savedAddress?.state || config.companyState || 'Chhattisgarh';
  const partyPincode = escapeXml(order.shippingAddress?.pincode || user?.savedAddress?.pincode || '491665');
  const partyPhone = escapeXml(order.shippingAddress?.mobile || user?.mobile || '');
  const partyEmail = escapeXml(user?.email || '');
  const partyGstin = escapeXml(user?.gstNumber || 'Unregistered');

  const isInterState = partyState.trim().toLowerCase() !== config.companyState.trim().toLowerCase();

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const items = order.items || [];
  items.forEach((item: any) => {
    const taxAmt = item.taxAmount || 0;
    if (isInterState) {
      igstTotal += taxAmt;
    } else {
      cgstTotal += taxAmt / 2;
      sgstTotal += taxAmt / 2;
    }
  });

  const totalAmount = Number(order.totalAmount || 0);
  const deliveryCharge = Number(order.deliveryCharge || 0);
  const totalDiscount = Number(order.couponDiscount || 0) + Number(order.loyaltyDiscount || 0) + Number(order.discount || 0);

  const paymentMethodLabel = order.paymentMethod === 'cod'
    ? 'Cash on Delivery (COD)'
    : order.paymentMethod === 'upi'
    ? 'UPI Payment'
    : order.paymentMethod === 'cash'
    ? 'Cash Payment'
    : 'Online Payment (Razorpay)';

  // Inventory entries
  const inventoryXml = items
    .map((item: any) => {
      const pName = escapeXml(item.productName || 'Product');
      const qty = item.qty || 1;
      const rate = Number(item.price || 0).toFixed(2);
      const itemAmount = (Number(item.price || 0) * qty).toFixed(2);
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

  // Delivery charge ledger entry if applicable
  let deliveryChargeXml = '';
  if (deliveryCharge > 0) {
    deliveryChargeXml = `
        <LEDGERENTRIES.LIST>
          <LEDGERNAME>Delivery Charges</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${deliveryCharge.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
  }

  // Discount ledger entry if applicable
  let discountXml = '';
  if (totalDiscount > 0) {
    discountXml = `
        <LEDGERENTRIES.LIST>
          <LEDGERNAME>Discount Allowed</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${totalDiscount.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
  }

  // Stock Items auto-creation XML
  const stockItemsCreationXml = items
    .map((item: any) => {
      const pName = escapeXml(item.productName || 'Product');
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

        <!-- 6. Auto-create Delivery Charges / Discount Ledgers if needed -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Delivery Charges" ACTION="Create">
            <NAME>Delivery Charges</NAME>
            <PARENT>Direct Incomes</PARENT>
            <ISBILLWISEON>No</ISBILLWISEON>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Discount Allowed" ACTION="Create">
            <NAME>Discount Allowed</NAME>
            <PARENT>Indirect Expenses</PARENT>
            <ISBILLWISEON>No</ISBILLWISEON>
          </LEDGER>
        </TALLYMESSAGE>

        <!-- 7. Auto-create Stock Items -->
        ${stockItemsCreationXml}

        <!-- 8. Auto-create Retail Customer Party Ledger under Sundry Debtors -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${partyLedgerName}" ACTION="Create">
            <NAME>${partyLedgerName}</NAME>
            <PARENT>Sundry Debtors</PARENT>
            <MAILINGNAME>${partyName}</MAILINGNAME>
            <ADDRESS.LIST TYPE="String">
              <ADDRESS>${partyName}</ADDRESS>
              ${partyStreet ? `<ADDRESS>${partyStreet}</ADDRESS>` : ''}
              <ADDRESS>${partyCity}${partyDistrict ? ', ' + partyDistrict : ''}${partyState ? ', ' + escapeXml(partyState) : ''}${partyPincode ? ' - ' + partyPincode : ''}</ADDRESS>
              ${partyPhone ? `<ADDRESS>Phone: ${partyPhone}</ADDRESS>` : ''}
              ${partyEmail ? `<ADDRESS>Email: ${partyEmail}</ADDRESS>` : ''}
            </ADDRESS.LIST>
            <STATENAME>${escapeXml(partyState)}</STATENAME>
            <PINCODE>${partyPincode}</PINCODE>
            <LEDGERPHONE>${partyPhone}</LEDGERPHONE>
            <LEDGERMOBILE>${partyPhone}</LEDGERMOBILE>
            <PARTYGSTIN>${partyGstin}</PARTYGSTIN>
            <GSTREGISTRATIONTYPE>Unregistered</GSTREGISTRATIONTYPE>
            <OPENINGBALANCE>0</OPENINGBALANCE>
            <ISBILLWISEON>Yes</ISBILLWISEON>
            <COUNTRYNAME>India</COUNTRYNAME>
          </LEDGER>
        </TALLYMESSAGE>

        <!-- 9. Create Official Sales Voucher for User Order -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${dateStr}</DATE>
            <REFERENCEDATE>${dateStr}</REFERENCEDATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${orderNum}</VOUCHERNUMBER>
            <REFERENCE>${orderNum}</REFERENCE>
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
              <BASICBUYERADDRESS>${partyCity}${partyDistrict ? ', ' + partyDistrict : ''}${partyState ? ', ' + escapeXml(partyState) : ''}${partyPincode ? ' - ' + partyPincode : ''}</BASICBUYERADDRESS>
              ${partyPhone ? `<BASICBUYERADDRESS>Phone: ${partyPhone}</BASICBUYERADDRESS>` : ''}
              ${partyEmail ? `<BASICBUYERADDRESS>Email: ${partyEmail}</BASICBUYERADDRESS>` : ''}
            </BASICBUYERADDRESS.LIST>
            <BASICBUYERSSALESTAXNO>${partyGstin}</BASICBUYERSSALESTAXNO>

            <!-- Consignee (Ship To) Details -->
            <CONSIGNEEMAILINGNAME>${partyName}</CONSIGNEEMAILINGNAME>
            <CONSIGNEEADDRESS.LIST TYPE="String">
              <CONSIGNEEADDRESS>${partyName}</CONSIGNEEADDRESS>
              ${partyStreet ? `<CONSIGNEEADDRESS>${partyStreet}</CONSIGNEEADDRESS>` : ''}
              <CONSIGNEEADDRESS>${partyCity}${partyDistrict ? ', ' + partyDistrict : ''}${partyState ? ', ' + escapeXml(partyState) : ''}${partyPincode ? ' - ' + partyPincode : ''}</CONSIGNEEADDRESS>
              ${partyPhone ? `<CONSIGNEEADDRESS>Phone: ${partyPhone}</CONSIGNEEADDRESS>` : ''}
            </CONSIGNEEADDRESS.LIST>
            <CONSIGNEESTATENAME>${escapeXml(partyState)}</CONSIGNEESTATENAME>
            <CONSIGNEEPINCODE>${partyPincode}</CONSIGNEEPINCODE>
            <CONSIGNEEGSTIN>${partyGstin}</CONSIGNEEGSTIN>

            <ADDRESS.LIST TYPE="String">
              <ADDRESS>${partyName}</ADDRESS>
              ${partyStreet ? `<ADDRESS>${partyStreet}</ADDRESS>` : ''}
              <ADDRESS>${partyCity}${partyDistrict ? ', ' + partyDistrict : ''}${partyState ? ', ' + escapeXml(partyState) : ''}${partyPincode ? ' - ' + partyPincode : ''}</ADDRESS>
              ${partyPhone ? `<ADDRESS>Phone: ${partyPhone}</ADDRESS>` : ''}
            </ADDRESS.LIST>

            <!-- Order & Payment Tracking -->
            <BASICBUYERORDERNO>${orderNum}</BASICBUYERORDERNO>
            <BASICORDERDATE>${dateStr}</BASICORDERDATE>
            <BASICDUEDATEOFPYMT>${escapeXml(paymentMethodLabel)}</BASICDUEDATEOFPYMT>
            <BASICORDERTERMS>${escapeXml(order.serviceMode === 'pickup' ? 'Store Pickup' : 'Home Delivery')}</BASICORDERTERMS>
            <BASICFINALDESTINATION>${escapeXml(partyCity || partyState)}</BASICFINALDESTINATION>

            <!-- Customer Party Ledger Debit Entry -->
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${partyLedgerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
              <BILLALLOCATIONS.LIST>
                <NAME>${orderNum}</NAME>
                <BILLTYPE>New Ref</BILLTYPE>
                <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
              </BILLALLOCATIONS.LIST>
            </LEDGERENTRIES.LIST>

            <!-- Stock Items / Inventory Allocations -->
            ${inventoryXml}

            <!-- GST Output Ledgers -->
            ${taxLedgersXml}

            <!-- Additional Allocations (Delivery Charge / Discounts) -->
            ${deliveryChargeXml}
            ${discountXml}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return xml.trim();
}

/**
 * Fetch pending queue of both B2B Invoices and Retail User Orders waiting to sync to Tally
 */
export async function getPendingTallySyncInvoices(limit = 30) {
  const config = await getTallyConfig();

  const [b2bInvoices, retailOrders] = await Promise.all([
    B2BInvoice.find({
      tallySyncStatus: { $in: ['pending', 'failed'] },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate('storeId', 'name address gstin phone gstNumber sgstNumber'),
    Order.find({
      tallySyncStatus: { $in: ['pending', 'failed'] },
      status: { $nin: ['cancelled'] },
      $or: [{ paymentMethod: 'cod' }, { paymentStatus: 'paid' }],
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate('userId', 'name mobile email savedAddress gstNumber')
      .populate('storeId', 'name address phone gstNumber sgstNumber cgst sgst igst panNumber'),
  ]);

  const b2bQueue = b2bInvoices.map((inv) => {
    const store = (inv.storeId as any) || {};
    const xml = buildTallySalesVoucherXml(inv, store, config);
    return {
      type: 'b2b' as const,
      entityId: inv._id.toString(),
      invoiceId: inv._id.toString(),
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      customerName: store.name || 'Dealer Store',
      storeName: store.name || 'Dealer Store',
      mobile: store.phone || '',
      totalAmount: inv.totalAmount,
      xmlPayload: xml,
    };
  });

  const retailQueue = retailOrders.map((order) => {
    const user = (order.userId as any) || {};
    const store = (order.storeId as any) || {};
    const xml = buildTallyRetailOrderVoucherXml(order, user, store, config);
    const custName = order.shippingAddress?.name || user.name || 'Customer';
    return {
      type: 'retail_order' as const,
      entityId: order._id.toString(),
      invoiceId: order._id.toString(),
      invoiceNumber: order.orderNumber,
      invoiceDate: order.createdAt,
      customerName: custName,
      storeName: store.name || 'Vaniki Store',
      mobile: order.shippingAddress?.mobile || user.mobile || '',
      totalAmount: order.totalAmount,
      xmlPayload: xml,
    };
  });

  return [...b2bQueue, ...retailQueue].slice(0, limit);
}

/**
 * Record sync result from Windows Tally Agent or Direct Server Push
 */
export async function recordTallySyncResult(
  entityId: string,
  result: {
    status: 'synced' | 'failed';
    type?: 'retail_order' | 'b2b';
    tallyVoucherNumber?: string;
    tallyVoucherGuid?: string;
    error?: string;
  }
) {
  // 1. Try finding as B2BInvoice
  const invoice = await B2BInvoice.findById(entityId);
  if (invoice) {
    invoice.tallySyncStatus = result.status;
    if (result.status === 'synced') {
      invoice.tallyVoucherNumber = result.tallyVoucherNumber || invoice.invoiceNumber;
      invoice.tallyVoucherGuid = result.tallyVoucherGuid;
      invoice.tallySyncAt = new Date();
      invoice.tallySyncError = undefined;

      // Auto-add stock to dealer inventory
      const { syncInvoiceItemsToDealerInventory } = await import('../orders/order.controller.js');
      await syncInvoiceItemsToDealerInventory(invoice);
    } else {
      invoice.tallySyncError = result.error || 'Failed to push into Tally';
    }

    await invoice.save();
    return { type: 'b2b', data: invoice };
  }

  // 2. Try finding as Order (Retail)
  const order = await Order.findById(entityId);
  if (order) {
    order.tallySyncStatus = result.status;
    if (result.status === 'synced') {
      order.tallyVoucherNumber = result.tallyVoucherNumber || order.orderNumber;
      order.tallyVoucherGuid = result.tallyVoucherGuid;
      order.tallySyncAt = new Date();
      order.tallySyncError = undefined;
    } else {
      order.tallySyncError = result.error || 'Failed to push into Tally';
    }

    await order.save();
    return { type: 'retail_order', data: order };
  }

  throw new AppError('Order or Invoice not found for sync result', 404);
}

/**
 * Parse Tally XML HTTP response
 */
export function parseTallyXmlResponse(tallyXmlResponse: string) {
  const text = tallyXmlResponse || '';

  // Check errors
  if (text.includes('<LINEERROR>') || text.includes('Errors :') || text.includes('<ERROR>')) {
    const errorMatch = text.match(/<LINEERROR>([\s\S]*?)<\/LINEERROR>/i) || text.match(/<ERROR>([\s\S]*?)<\/ERROR>/i);
    const errorMsg = errorMatch ? errorMatch[1].replace(/<[^>]+>/g, '').trim() : 'Tally rejected XML import';
    return { success: false, error: errorMsg };
  }

  // Check created / altered count
  const createdMatch = text.match(/<CREATED>(\d+)<\/CREATED>/i);
  const alteredMatch = text.match(/<ALTERED>(\d+)<\/ALTERED>/i);
  const createdCount = createdMatch ? parseInt(createdMatch[1], 10) : 0;
  const alteredCount = alteredMatch ? parseInt(alteredMatch[1], 10) : 0;

  // Extract Voucher Number or GUID
  const vchNumMatch = text.match(/<VOUCHERNUMBER>([\s\S]*?)<\/VOUCHERNUMBER>/i) || text.match(/<LASTVCHID>([\s\S]*?)<\/LASTVCHID>/i);
  const guidMatch = text.match(/<GUID>([\s\S]*?)<\/GUID>/i);

  const voucherNumber = vchNumMatch ? vchNumMatch[1].trim() : undefined;
  const voucherGuid = guidMatch ? guidMatch[1].trim() : undefined;

  if (createdCount > 0 || alteredCount > 0 || (text.includes('<STATUS>1</STATUS>') && !text.includes('<ERRORS>')) || (text.includes('<RESPONSE>') && !text.includes('<ERRORS>'))) {
    return {
      success: true,
      voucherNumber,
      voucherGuid,
    };
  }

  return {
    success: false,
    error: 'Unknown Tally response: ' + text.slice(0, 300),
  };
}

/**
 * Push XML directly to Tally XML HTTP server
 */
export async function pushXmlToTallyServer(
  xmlPayload: string,
  config?: TallyConfig
): Promise<{ success: boolean; voucherNumber?: string; voucherGuid?: string; error?: string }> {
  const activeConfig = config || (await getTallyConfig());
  const host = activeConfig.tallyHost || '127.0.0.1';
  const port = activeConfig.tallyPort || 9000;
  const url = `http://${host}:${port}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        'Content-Length': String(Buffer.byteLength(xmlPayload)),
      },
      body: xmlPayload,
      signal: AbortSignal.timeout(12000),
    });

    const responseText = await response.text();
    return parseTallyXmlResponse(responseText);
  } catch (err: any) {
    return {
      success: false,
      error: `Could not connect to Tally Server at ${url} (${err.message}). Ensure Tally is running with ODBC/HTTP Server enabled on port ${port}.`,
    };
  }
}

/**
 * Trigger immediate direct sync of all pending orders and invoices to Tally
 */
export async function syncAllPendingToTally() {
  const queue = await getPendingTallySyncInvoices(50);
  const config = await getTallyConfig();

  const results: Array<{ id: string; invoiceNumber: string; success: boolean; error?: string }> = [];

  for (const item of queue) {
    const syncRes = await pushXmlToTallyServer(item.xmlPayload, config);

    if (syncRes.success) {
      await recordTallySyncResult(item.entityId, {
        status: 'synced',
        type: item.type,
        tallyVoucherNumber: syncRes.voucherNumber || item.invoiceNumber,
        tallyVoucherGuid: syncRes.voucherGuid,
      });
      results.push({ id: item.entityId, invoiceNumber: item.invoiceNumber, success: true });
    } else {
      await recordTallySyncResult(item.entityId, {
        status: 'failed',
        type: item.type,
        error: syncRes.error,
      });
      results.push({ id: item.entityId, invoiceNumber: item.invoiceNumber, success: false, error: syncRes.error });
    }
  }

  return {
    totalProcessed: queue.length,
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    details: results,
  };
}

/**
 * Test Tally Server Connection
 */
export async function testTallyConnection(customHost?: string, customPort?: number) {
  const config = await getTallyConfig();
  const host = customHost || config.tallyHost || '127.0.0.1';
  const port = customPort || config.tallyPort || 9000;
  const url = `http://${host}:${port}`;

  const pingXml = `<ENVELOPE>
    <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
    <BODY>
      <EXPORTDATA>
        <REQUESTDESC>
          <REPORTNAME>List of Companies</REPORTNAME>
        </REQUESTDESC>
      </EXPORTDATA>
    </BODY>
  </ENVELOPE>`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        'Content-Length': String(Buffer.byteLength(pingXml)),
      },
      body: pingXml,
      signal: AbortSignal.timeout(6000),
    });

    const text = await response.text();
    const isOk = response.status === 200 && (text.includes('<COMPANY') || text.includes('<ENVELOPE') || text.includes('<RESPONSE>') || text.includes('<BODY>'));

    return {
      connected: isOk,
      statusCode: response.status,
      host,
      port,
      rawResponseSnippet: text.slice(0, 300),
    };
  } catch (err: any) {
    return {
      connected: false,
      host,
      port,
      error: err.message,
    };
  }
}

/**
 * Get Tally Settings
 */
export async function getTallyConfig(): Promise<TallyConfig> {
  const settings = await SiteSetting.findOne({ singletonKey: 'default' });
  const custom = settings?.tallyConfig || {};

  return {
    tallyHost: custom.tallyHost || DEFAULT_TALLY_CONFIG.tallyHost,
    tallyPort: custom.tallyPort || DEFAULT_TALLY_CONFIG.tallyPort,
    companyName: custom.companyName || settings?.platformName || DEFAULT_TALLY_CONFIG.companyName,
    salesLedger: custom.salesLedger || DEFAULT_TALLY_CONFIG.salesLedger,
    cgstLedger: custom.cgstLedger || DEFAULT_TALLY_CONFIG.cgstLedger,
    sgstLedger: custom.sgstLedger || DEFAULT_TALLY_CONFIG.sgstLedger,
    igstLedger: custom.igstLedger || DEFAULT_TALLY_CONFIG.igstLedger,
    roundOffLedger: custom.roundOffLedger || DEFAULT_TALLY_CONFIG.roundOffLedger,
    companyState: custom.companyState || settings?.address?.state || DEFAULT_TALLY_CONFIG.companyState,
    companyGstin: custom.companyGstin || settings?.gstNumber || DEFAULT_TALLY_CONFIG.companyGstin,
    agentSecretKey: custom.agentSecretKey || DEFAULT_TALLY_CONFIG.agentSecretKey,
    autoSyncEnabled: custom.autoSyncEnabled !== undefined ? custom.autoSyncEnabled : true,
  };
}

/**
 * Update Tally Settings
 */
export async function updateTallyConfig(input: Partial<TallyConfig>): Promise<TallyConfig> {
  const settings = await SiteSetting.findOneAndUpdate(
    { singletonKey: 'default' },
    {
      $set: {
        'tallyConfig.tallyHost': input.tallyHost,
        'tallyConfig.tallyPort': input.tallyPort,
        'tallyConfig.companyName': input.companyName,
        'tallyConfig.salesLedger': input.salesLedger,
        'tallyConfig.cgstLedger': input.cgstLedger,
        'tallyConfig.sgstLedger': input.sgstLedger,
        'tallyConfig.igstLedger': input.igstLedger,
        'tallyConfig.roundOffLedger': input.roundOffLedger,
        'tallyConfig.companyState': input.companyState,
        'tallyConfig.companyGstin': input.companyGstin,
        'tallyConfig.agentSecretKey': input.agentSecretKey,
        'tallyConfig.autoSyncEnabled': input.autoSyncEnabled,
      },
    },
    { new: true, upsert: true }
  );

  return getTallyConfig();
}
