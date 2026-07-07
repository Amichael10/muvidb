import fs from 'fs';
import https from 'https';

const dump = fs.readFileSync('scripts/_fh_dump.html', 'utf8');
const chunkRegex = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
const chunks = [...dump.matchAll(chunkRegex)].map(m => m[1]);

let out = `Found ${chunks.length} JS chunks. Searching for AES keys and Crypto code...\n\n`;

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
        
        // Look for crypto related keywords
        if (code.includes('CryptoJS') || code.includes('AES') || code.includes('U2FsdGVkX1')) {
            out += `\n=== CRYPTO FOUND IN CHUNK: ${chunk} ===\n`;
            
            // Extract string literals that might be keys (e.g. 16, 32 chars)
            const strings = [...code.matchAll(/(["'`])([^"']{10,50})\1/g)]
                .map(m => m[2]);
            
            out += 'Potential Keys/Secrets:\n';
            out += [...new Set(strings)].join('\n') + '\n\n';
            
            // Try to grab a snippet of the code around 'CryptoJS' or 'AES.encrypt'
            const encryptIdx = code.indexOf('encrypt');
            if (encryptIdx !== -1) {
                out += 'Encrypt Context:\n';
                out += code.substring(Math.max(0, encryptIdx - 150), Math.min(code.length, encryptIdx + 150)) + '\n\n';
            }
        }
    }
    
    fs.writeFileSync('scripts/_key_results.txt', out);
    console.log('\nDone! Wrote all findings to scripts/_key_results.txt');
})();
