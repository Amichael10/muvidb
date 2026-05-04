const fetch = require('node-fetch');
require('dotenv').config({ path: '.env' });

const BASE_URL = 'https://lumi-rho-seven.vercel.app';
const CRON_SECRET = process.env.CRON_SECRET;

async function testApi(path) {
  console.log(`🚀 Testing API: ${path}`);
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-cron-secret': CRON_SECRET
    }
  });
  
  console.log(`Status: ${res.status}`);
  const data = await res.text();
  try {
    console.log('Response:', JSON.stringify(JSON.parse(data), null, 2));
  } catch (e) {
    console.log('Response (raw):', data.substring(0, 500));
  }
}

async function run() {
  await testApi('/api/cron/sync?task=videos&limit=1'); // Test with limit 1 if I can modify it
}

run();
