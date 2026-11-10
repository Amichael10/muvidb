import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where custom DNS fails
}

import os from 'os';
import { Agent, setGlobalDispatcher } from 'undici';

// In local Windows environments with VPN or multiple virtual NICs,
// undici might need binding to the active network interface.
function setupNetworkDispatcher() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wifi') || name.toLowerCase().includes('ethernet')) {
        for (const net of nets[name] || []) {
          if (net.family === 'IPv4' && !net.internal) {
            setGlobalDispatcher(new Agent({
              connect: { localAddress: net.address }
            }));
            return;
          }
        }
      }
    }
  } catch {
    // Standard fetch fallback
  }
}

setupNetworkDispatcher();

import dotenv from 'dotenv';
dotenv.config();

import { runBoxOfficeDigestSync } from '../api/_lib/box_office_digest.js';

async function main() {
  console.log('[sync_box_office_digest] Starting Nigerian Box Office Digest synchronization...');
  const startTime = Date.now();

  try {
    const result = await runBoxOfficeDigestSync();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[sync_box_office_digest] Done in ${duration}s! Result:`, JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('[sync_box_office_digest] Fatal error:', err?.message || err);
    process.exit(1);
  }
}

main();
