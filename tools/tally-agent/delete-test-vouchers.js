/**
 * Tool to auto-delete Deepika Krishi Kendra test vouchers from TallyPrime
 * 
 * Step 1: Fetch all vouchers for 12-Sep-2026 from Tally Day Book
 * Step 2: Filter for "Deepika Krishi Kendra" party vouchers
 * Step 3: Delete each using its GUID
 * 
 * Run on the Windows PC where Tally is open:
 *   node delete-test-vouchers.js
 */

const http = require('http');

const COMPANY_NAME = 'Vaniki Crop Science Pvt Ltd';
const TALLY_HOST = '127.0.0.1';
const TALLY_PORT = 9000;

// Voucher numbers we want to delete (all Deepika Krishi Kendra test data from 12-Sep)
const TARGET_VOUCHER_NUMBERS = [
  '1662', '1663', '1664',
  '1681', '1682', '1683', '1684', '1685', '1686'
];

function sendToTally(xml) {
  return new Promise((resolve, reject) => {``
    const req = http.request(
      {
        hostname: TALLY_HOST,
        port: TALLY_PORT,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=utf-8',
          'Content-Length': Buffer.byteLength(xml),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve(body));
      }
    );
    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

// Step 1: Fetch all Sales vouchers for 12-Sep-2026 with their GUIDs
async function fetchVouchersForDate(dateStr) {
  const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${COMPANY_NAME}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE>${dateStr}</SVFROMDATE>
          <SVTODATE>${dateStr}</SVTODATE>
        </STATICVARIABLES>
        <REPORTNAME>Day Book</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  const res = await sendToTally(xml);
  return res;
}

// Extract voucher GUIDs from Tally XML response
function extractVoucherGuids(xmlResponse) {
  const vouchers = [];
  // Match each VOUCHER block
  const voucherBlocks = xmlResponse.match(/<VOUCHER [^>]*>[\s\S]*?<\/VOUCHER>/g) || [];
  
  for (const block of voucherBlocks) {
    const guidMatch = block.match(/REMOTEID="([^"]+)"/);
    const vchNumMatch = block.match(/<VOUCHERNUMBER>([^<]+)<\/VOUCHERNUMBER>/);
    const partyMatch = block.match(/<PARTYLEDGERNAME>([^<]+)<\/PARTYLEDGERNAME>/);
    const dateMatch = block.match(/<DATE>([^<]+)<\/DATE>/);
    const vchTypeMatch = block.match(/VCHTYPE="([^"]+)"/);
    
    if (vchNumMatch) {
      vouchers.push({
        guid: guidMatch ? guidMatch[1] : null,
        voucherNumber: vchNumMatch[1],
        party: partyMatch ? partyMatch[1] : 'Unknown',
        date: dateMatch ? dateMatch[1] : '',
        vchType: vchTypeMatch ? vchTypeMatch[1] : 'Sales',
      });
    }
  }
  return vouchers;
}

// Step 2: Delete a voucher by its GUID
async function deleteVoucherByGuid(guid, vchType) {
  const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${COMPANY_NAME}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER REMOTEID="${guid}" VCHTYPE="${vchType}" ACTION="Delete">
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return sendToTally(xml);
}

async function run() {
  console.log('🔍 Step 1: Fetching all vouchers for 12-Sep-2026 from Tally...\n');
  
  try {
    const dayBookXml = await fetchVouchersForDate('20260912');
    const allVouchers = extractVoucherGuids(dayBookXml);
    
    console.log(`   Found ${allVouchers.length} total vouchers for 12-Sep-2026`);
    
    // Filter for target voucher numbers (Deepika Krishi Kendra)
    const targetVouchers = allVouchers.filter(v => 
      TARGET_VOUCHER_NUMBERS.includes(v.voucherNumber) ||
      (v.party && v.party.toLowerCase().includes('deepika krishi'))
    );
    
    if (targetVouchers.length === 0) {
      console.log('\n⚠️  No Deepika Krishi Kendra test vouchers found! They may already be deleted.');
      console.log('\n   All vouchers on 12-Sep:');
      allVouchers.forEach(v => console.log(`   - Vch#${v.voucherNumber} | ${v.party} | GUID: ${v.guid || 'N/A'}`));
      return;
    }
    
    console.log(`\n🎯 Found ${targetVouchers.length} Deepika Krishi Kendra test vouchers to delete:\n`);
    targetVouchers.forEach(v => 
      console.log(`   - Vch#${v.voucherNumber} | ${v.party} | GUID: ${v.guid || 'N/A'}`)
    );
    
    console.log('\n🗑️  Step 2: Deleting vouchers from Tally...\n');
    
    let deleted = 0;
    let failed = 0;
    
    for (const v of targetVouchers) {
      if (!v.guid) {
        console.log(`   [Vch#${v.voucherNumber}] ⚠️  No GUID found, skipping`);
        failed++;
        continue;
      }
      
      try {
        const res = await deleteVoucherByGuid(v.guid, v.vchType);
        const isOk = res.includes('<DELETED>1</DELETED>');
        if (isOk) {
          console.log(`   [Vch#${v.voucherNumber}] ✅ Deleted (${v.party})`);
          deleted++;
        } else {
          // Try to extract error
          const errMatch = res.match(/<LINEERROR>([^<]+)<\/LINEERROR>/);
          console.log(`   [Vch#${v.voucherNumber}] ❌ Failed: ${errMatch ? errMatch[1] : 'Unknown error'}`);
          failed++;
        }
      } catch (err) {
        console.log(`   [Vch#${v.voucherNumber}] ❌ Error: ${err.message}`);
        failed++;
      }
    }
    
    console.log(`\n🎉 Done! Deleted: ${deleted} | Failed: ${failed}`);
    
  } catch (err) {
    console.error('❌ Cannot connect to Tally:', err.message);
    console.error('   Make sure Tally Prime is open and HTTP Server is enabled on port 9000');
  }
}

run();
