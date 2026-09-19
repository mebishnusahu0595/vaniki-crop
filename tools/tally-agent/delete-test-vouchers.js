/**
 * Tool to auto-delete test vouchers from TallyPrime / Tally.ERP 9
 * Run on the Windows PC:
 * node delete-test-vouchers.js
 */

const http = require('http');

const VOUCHERS_TO_DELETE = [
  { vchNo: '1662', date: '20260912' },
  { vchNo: '1663', date: '20260912' },
  { vchNo: '1664', date: '20260912' },
  { vchNo: '1681', date: '20260912' },
  { vchNo: '1682', date: '20260912' },
  { vchNo: '1683', date: '20260912' },
  { vchNo: '1684', date: '20260912' },
  { vchNo: '1685', date: '20260912' },
  { vchNo: '1686', date: '20260912' },
];

const COMPANY_NAME = 'Vaniki Crop Science Pvt Ltd';

function deleteVoucherFromTally(vchNo, dateStr) {
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
          <VOUCHER VCHTYPE="Sales" ACTION="Delete">
            <DATE>${dateStr}</DATE>
            <VOUCHERNUMBER>${vchNo}</VOUCHERNUMBER>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 9000,
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

async function run() {
  console.log('🚀 Connecting to Tally at http://127.0.0.1:9000 to delete test vouchers...');
  for (const item of VOUCHERS_TO_DELETE) {
    try {
      const res = await deleteVoucherFromTally(item.vchNo, item.date);
      const isOk = res.includes('<DELETED>1</DELETED>') || res.includes('<STATUS>1</STATUS>');
      console.log(`[Voucher ${item.vchNo}] ${isOk ? '✅ Deleted' : 'Response: ' + res.slice(0, 150)}`);
    } catch (err) {
      console.error(`[Voucher ${item.vchNo}] ✕ Error:`, err.message);
    }
  }
  console.log('\n🎉 Finished deleting test vouchers from Tally!');
}

run();
