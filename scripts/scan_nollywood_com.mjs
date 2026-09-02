import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('--- Probing Nollywood.com GraphQL Gateway ---');

  // Let's test production & staging GraphQL endpoints
  const endpoints = [
    'https://gateway.nollywood.com/graphql',
    'https://gateway.staging.nollywood.com/graphql',
    'https://api.nollywood.com/graphql',
    'https://api.nollywood.com/v1/graphql'
  ];

  // Let's test a schema introspection or simple query
  const testQueries = [
    { query: '{ __schema { types { name } } }' },
    { query: '{ movies { id title } }' },
    { query: '{ getMovies { id title } }' }
  ];

  for (const ep of endpoints) {
    console.log(`\nTesting endpoint: ${ep}`);
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://nollywood.com',
          'Referer': 'https://nollywood.com/'
        },
        body: JSON.stringify(testQueries[0])
      });
      console.log(`Status: ${res.status}, Content-Type: ${res.headers.get('content-type')}`);
      const text = await res.text();
      console.log('Response:', text.slice(0, 400));
    } catch (e) {
      console.error(`Error connecting to ${ep}:`, e.message);
    }
  }

  // Let's search inside the Next.js chunks for actual GraphQL query strings / operations!
  const html = await fetch('https://nollywood.com/movies', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }).then(r => r.text());

  const scripts = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map(m => m[1]);
  for (const s of scripts) {
    const text = await fetch('https://nollywood.com' + s, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }).then(r => r.text());

    const gqlMatches = text.match(/(?:query|mutation)\s+[a-zA-Z0-9_]+\s*(?:\([^)]*\))?\s*\{[^}]{15,}/g) || [];
    if (gqlMatches.length > 0) {
      console.log(`\nFound GraphQL operations in chunk ${s}:`);
      gqlMatches.forEach(q => console.log(q.slice(0, 200) + '...\n'));
    }

    // Also look for NEXT_PUBLIC env or gateway URL strings
    const gatewayMatch = text.match(/https?:\/\/[^\s"'\`]+gateway[^\s"'\`]+/g);
    if (gatewayMatch) {
      console.log('Gateway match in chunk:', gatewayMatch);
    }
  }
}

main().catch(console.error);
