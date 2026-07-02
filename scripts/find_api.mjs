import fs from 'fs';
import https from 'https';

const dump = fs.readFileSync('scripts/_fh_dump.html', 'utf8');

// Find all JS chunk URLs
const chunkRegex = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
const chunks = [...dump.matchAll(chunkRegex)].map(m => m[1]);

let out = `Found ${chunks.length} JS chunks. Searching them for API endpoints...\n\n`;

const fetchChunk = (path) => {
    return new Promise((resolve) => {
        https.get(`https://www.filmhouseng.com${path}`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', () => resolve(''));
    });
};

(async () => {
    for (const chunk of chunks) {
        const code = await fetchChunk(chunk);
        
        // Look for URLs, graphql, or cinesync
        if (code.includes('graphql') || code.includes('cinesync.io') || code.includes('query')) {
            let chunkOut = `\n=== MATCH IN CHUNK: ${chunk} ===\n`;
            let hasInteresting = false;
            
            // Extract nearby strings
            const strings = [...code.matchAll(/(["'`])(.*?)\1/g)]
                .map(m => m[2])
                .filter(s => s.includes('graphql') || s.includes('cinesync.io') || s.includes('api/'));
            
            if (strings.length > 0) {
                chunkOut += 'Interesting strings found:\n';
                chunkOut += [...new Set(strings)].join('\n') + '\n';
                hasInteresting = true;
            }
            
            // Look for graphql queries
            const queries = [...code.matchAll(/query\s+\w+\s*[{]/g)];
            if (queries.length > 0) {
                chunkOut += 'GraphQL Queries found inside this chunk!\n';
                queries.forEach(q => {
                    const idx = code.indexOf(q[0]);
                    chunkOut += code.substring(idx, Math.min(idx + 200, code.length)) + '\n';
                });
                hasInteresting = true;
            }

            if (hasInteresting) {
                out += chunkOut;
            }
        }
    }
    
    fs.writeFileSync('scripts/_api_results.txt', out);
    console.log('\nDone! Wrote all findings to scripts/_api_results.txt');
})();
