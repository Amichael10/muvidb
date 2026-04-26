import fetch from 'node-fetch';

async function testSync() {
  const url = 'https://lumi-rho-seven.vercel.app/api/cron/sync?task=tmdb';
  const secret = 'lumi-cron-pkenrm-2026';
  
  console.log('Testing Sync Endpoint...');
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-cron-secret': secret
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testSync();
