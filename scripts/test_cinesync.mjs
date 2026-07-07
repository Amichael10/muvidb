import fs from 'fs';
import https from 'https';

const dump = fs.readFileSync('scripts/_fh_dump.html', 'utf8');

console.log('--- HTML DUMP ANALYSIS ---');
// Let's find ANY instance of the word 'title' or 'movies' in the RSC payload
let titleMatches = [...dump.matchAll(/(.{0,30})"title"(.{0,60})/g)];
if (titleMatches.length > 0) {
    console.log(`Found ${titleMatches.length} occurrences of "title". Here are the first 10:`);
    titleMatches.slice(0, 10).forEach(m => console.log(m[0]));
} else {
    console.log('No "title" found in HTML dump at all! It must be fetching client-side.');
}

console.log('\n--- TESTING CINESYNC API ---');

const fetchApi = (path, body = null) => {
    return new Promise((resolve) => {
        const req = https.request(`https://filmhouseng.api.cinesync.io${path}`, {
            method: body ? 'POST' : 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, data: data.substring(0, 500) });
            });
        });
        req.on('error', e => resolve({ status: 500, error: e.message }));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

(async () => {
    console.log('1. Testing /graphql (Introspection)');
    const gqlRes = await fetchApi('/graphql', { query: '{ __schema { types { name } } }' });
    console.log(`HTTP ${gqlRes.status}: ${gqlRes.data}`);
    
    // Also try a known query from browser scratchpad if graphql exists
    if (gqlRes.status === 200 || gqlRes.status === 400) {
        console.log('GraphQL endpoint found! Trying GetMovies query...');
        const moviesQ = await fetchApi('/graphql', { query: `query GetMovies { movies { id title } }` });
        console.log(`HTTP ${moviesQ.status}: ${moviesQ.data}`);
    }

    console.log('\n2. Testing /api/v1/movies (REST GET)');
    const restRes = await fetchApi('/api/v1/movies');
    console.log(`HTTP ${restRes.status}: ${restRes.data}`);
})();
