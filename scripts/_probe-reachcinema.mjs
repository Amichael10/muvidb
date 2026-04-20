// Probe the Reach Cinema API (Viva/Ozone/KADA shared backend)
// Goal: confirm JWT works + discover the exact showtimes response shape

const JWT = process.env.REACH_CINEMA_JWT
  || 'PLACEHOLDER'; // JWT lives in web.vivacinemas.com JS chunk 5684-*.js

const BASE = 'https://api.reachcinema.io/api/v1';
const VIVA_CIRCUIT = 'circuit-4b010751';
const VIVA_LEKKI   = 'viv-6ac91519';

const hdrs = {
  'Authorization': `Bearer ${JWT}`,
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function get(path) {
  const url = `${BASE}${path}`;
  console.log(`\n── GET ${url}`);
  const r = await fetch(url, { headers: hdrs });
  console.log(`   status: ${r.status}`);
  const text = await r.text();
  try {
    const j = JSON.parse(text);
    console.log('   body  :', JSON.stringify(j, null, 2).slice(0, 2500));
    return j;
  } catch {
    console.log('   body  :', text.slice(0, 500));
    return null;
  }
}

// 1. Confirm cinema list works
await get(`/Cinemas/ListAllByCircuit?circuitId=${VIVA_CIRCUIT}`);

// 2. Now-showing films (probably circuit-wide)
await get(`/Films/get-now-showing?circuitId=${VIVA_CIRCUIT}`);
await get(`/Films/get-coming-soon?circuitId=${VIVA_CIRCUIT}`);

// 3. Showtimes — try a few common parameter shapes
const d1 = today(0);
const d7 = today(7);

await get(`/Showtimes/get-showtimes?cinemaId=${VIVA_LEKKI}&dateFrom=${d1}&dateTo=${d7}`);
await get(`/Showtimes/get-showtimes?cinemaId=${VIVA_LEKKI}&DateFrom=${d1}&DateTo=${d7}`);
await get(`/Showtimes/get-showtimes?cinemaId=${VIVA_LEKKI}&date=${d1}`);
await get(`/Showtimes/get-showtimes?cinemaId=${VIVA_LEKKI}`);
await get(`/Showtimes/get-film-showtimes?cinemaId=${VIVA_LEKKI}&date=${d1}`);
