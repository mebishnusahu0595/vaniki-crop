/**
 * ============================================================================
 * Vaniki Crop Science - Official TallyPrime & Tally.ERP 9 Windows Sync Agent
 * ============================================================================
 * 
 * Runs on the Windows 10 PC where Tally is installed.
 * 1. Fetches approved B2B & B2C invoices from Vaniki Cloud Server.
 * 2. Posts standard XML Sales Vouchers to Tally (http://127.0.0.1:9000).
 * 3. Extracts Official Tally Voucher Number & reports sync status back to Vaniki.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ANSI Colors for Console Output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Load Configuration
const configPath = path.join(__dirname, 'config.json');
let config = {
  serverApiUrl: 'https://vanikicrop.com/api/tally',
  fallbackApiUrls: [
    'http://192.168.1.36/api/tally',
    'http://192.168.1.36:5000/api/tally',
    'http://192.168.1.57:5000/api/tally',
  ],
  agentSecretKey: 'vaniki_tally_sec_2026_x9k',
  tallyHost: '127.0.0.1',
  tallyPort: 9000,
  pollIntervalSeconds: 10,
  autoSync: true,
};

if (fs.existsSync(configPath)) {
  try {
    const fileData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...config, ...fileData };
  } catch (err) {
    console.error(`${COLORS.red}[Config Error] Could not read config.json, using defaults.${COLORS.reset}`);
  }
}

let activeApiUrl = config.serverApiUrl;

/**
 * Helper to make HTTP / HTTPS Requests
 */
function makeRequest(urlStr, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 25000,
    };

    if (postData) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Send XML to Local Tally Server (Port 9000)
 */
async function postToTally(xmlPayload) {
  const url = `http://${config.tallyHost}:${config.tallyPort}`;
  const response = await makeRequest(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
      },
      timeout: 15000,
    },
    xmlPayload
  );

  return response.data;
}

/**
 * Parse Tally XML Response to check if voucher created successfully
 */
function parseTallyResponse(tallyXmlResponse) {
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

  if (createdCount > 0 || alteredCount > 0 || (text.includes('<STATUS>1</STATUS>') && !text.includes('<ERRORS>'))) {
    return {
      success: true,
      voucherNumber,
      voucherGuid,
    };
  }

  // Check if general response is ok
  if (text.includes('<RESPONSE>') && !text.includes('<ERRORS>')) {
    return {
      success: true,
      voucherNumber,
      voucherGuid,
    };
  }

  return {
    success: false,
    error: 'Unknown Tally response format: ' + text.slice(0, 200),
  };
}

/**
 * Main Sync Loop
 */
let isSyncing = false;

async function fetchQueueFromAnyEndpoint() {
  const candidateUrls = Array.from(new Set([activeApiUrl, config.serverApiUrl, ...(config.fallbackApiUrls || [])]));

  for (const baseUrl of candidateUrls) {
    try {
      const queueUrl = `${baseUrl.replace(/\/+$/, '')}/pending-sync`;
      const res = await makeRequest(queueUrl, {
        method: 'GET',
        headers: {
          'x-tally-secret': config.agentSecretKey,
          'Accept': 'application/json',
        },
        timeout: 5000,
      });

      if (res.statusCode === 200) {
        if (activeApiUrl !== baseUrl) {
          activeApiUrl = baseUrl;
          console.log(`\n${COLORS.green}[Connected] Successfully connected to API: ${activeApiUrl}${COLORS.reset}`);
        }
        return JSON.parse(res.data);
      }
    } catch {}
  }

  throw new Error(`Could not connect to Vaniki Server (${activeApiUrl}). Check internet/LAN connection.`);
}

async function syncPendingInvoices() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    // 1. Fetch pending queue from Vaniki Server with automatic failover
    const json = await fetchQueueFromAnyEndpoint();
    const queue = json.data || [];

    if (queue.length === 0) {
      // Idle heartbeat
      process.stdout.write(`\r${COLORS.cyan}[Vaniki Agent] Listening for new approved bills... (${new Date().toLocaleTimeString()})${COLORS.reset}`);
      isSyncing = false;
      return;
    }

    console.log(`\n${COLORS.bright}${COLORS.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
    console.log(`${COLORS.green}⚡ [Incoming] Found ${queue.length} invoice(s)/order(s) to sync into Tally!${COLORS.reset}`);

    // 2. Process each invoice/order
    for (const item of queue) {
      const typeLabel = item.type === 'retail_order' ? '🛒 [User App/Web Order]' : '🏢 [Dealer B2B Bill]';
      const entityId = item.entityId || item.invoiceId;
      console.log(`\n⏳ Processing ${typeLabel} ${COLORS.bright}${item.invoiceNumber}${COLORS.reset} for ${COLORS.cyan}${item.customerName || item.storeName}${COLORS.reset} (₹${item.totalAmount})...`);

      try {
        // Send XML to Tally on Port 9000
        const tallyResXml = await postToTally(item.xmlPayload);
        const parsed = parseTallyResponse(tallyResXml);

        if (parsed.success) {
          console.log(`✅ ${COLORS.green}SUCCESS! Auto-created in Tally! Voucher No: ${parsed.voucherNumber || item.invoiceNumber}${COLORS.reset}`);

          // Report sync success back to Vaniki Server
          await makeRequest(
            `${activeApiUrl}/sync-result`,
            {
              method: 'POST',
              headers: {
                'x-tally-secret': config.agentSecretKey,
                'Content-Type': 'application/json',
              },
            },
            JSON.stringify({
              entityId,
              invoiceId: entityId,
              type: item.type || 'b2b',
              status: 'synced',
              tallyVoucherNumber: parsed.voucherNumber || item.invoiceNumber,
              tallyVoucherGuid: parsed.voucherGuid,
            })
          );
        } else {
          console.error(`❌ ${COLORS.red}Tally Error: ${parsed.error}${COLORS.reset}`);

          // Report failure back to Vaniki Server
          await makeRequest(
            `${activeApiUrl}/sync-result`,
            {
              method: 'POST',
              headers: {
                'x-tally-secret': config.agentSecretKey,
                'Content-Type': 'application/json',
              },
            },
            JSON.stringify({
              entityId,
              invoiceId: entityId,
              type: item.type || 'b2b',
              status: 'failed',
              error: parsed.error,
            })
          );
        }
      } catch (tallyErr) {
        console.error(`❌ ${COLORS.red}Could not connect to Tally on Port ${config.tallyPort}. Is Tally running? (${tallyErr.message})${COLORS.reset}`);

        await makeRequest(
          `${activeApiUrl}/sync-result`,
          {
            method: 'POST',
            headers: {
              'x-tally-secret': config.agentSecretKey,
              'Content-Type': 'application/json',
            },
          },
          JSON.stringify({
            entityId,
            invoiceId: entityId,
            type: item.type || 'b2b',
            status: 'failed',
            error: `Tally connection failed: ${tallyErr.message}. Ensure Tally is open with Port ${config.tallyPort} enabled.`,
          })
        ).catch(() => null);
      }
    }
  } catch (err) {
    console.error(`\n${COLORS.red}[Sync Error] ${err.message}${COLORS.reset}`);
  } finally {
    isSyncing = false;
  }
}

// Prevent process from ever crashing on unexpected network or socket errors
process.on('uncaughtException', (err) => {
  const errMsg = `[${new Date().toISOString()}] Uncaught Exception: ${err.stack || err.message}\n`;
  try {
    fs.appendFileSync(path.join(__dirname, 'tally-agent.log'), errMsg);
  } catch {}
  console.error(`\n${COLORS.red}[Crash Prevention] Caught error: ${err.message}. Retrying in 10s...${COLORS.reset}`);
});

process.on('unhandledRejection', (reason) => {
  const errMsg = `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n`;
  try {
    fs.appendFileSync(path.join(__dirname, 'tally-agent.log'), errMsg);
  } catch {}
  console.error(`\n${COLORS.red}[Crash Prevention] Unhandled promise rejection: ${reason}. Retrying in 10s...${COLORS.reset}`);
});

/**
 * Startup Banner & Polling Loop
 */
function start() {
  console.clear();
  console.log(`${COLORS.bright}${COLORS.green}`);
  console.log(`=============================================================`);
  console.log(`    🌾 VANIKI CROP SCIENCE - TALLY AUTO-SYNC AGENT v1.0     `);
  console.log(`=============================================================${COLORS.reset}`);
  console.log(`${COLORS.cyan}• Vaniki Cloud API : ${config.serverApiUrl}`);
  console.log(`• Local Tally Target: http://${config.tallyHost}:${config.tallyPort}`);
  console.log(`• Sync Interval     : Every ${config.pollIntervalSeconds} seconds${COLORS.reset}`);
  console.log(`-------------------------------------------------------------`);
  console.log(`${COLORS.yellow}ℹ️  Auto-Restart Enabled: Agent runs 24/7 continuously.`);
  console.log(`ℹ️  Ensure Tally ODBC / Server Port 9000 is enabled in Tally F12.${COLORS.reset}`);
  console.log(`-------------------------------------------------------------\n`);

  // Initial check
  syncPendingInvoices();

  // Recurring loop (Runs forever)
  setInterval(syncPendingInvoices, config.pollIntervalSeconds * 1000);
}

start();

