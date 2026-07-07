import https from 'https';
import fs from 'fs';

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
    const chunkPath = '/_next/static/chunks/6479-d579a067a1b82f8f.js';
    const code = await fetchChunk(chunkPath);
    
    // Find all occurrences of "api:"
    let out = "Matches for 'api:':\n";
    const apiRegex = /api\s*:\s*["']([^"']+)["']/g;
    let match;
    while ((match = apiRegex.exec(code)) !== null) {
        const idx = match.index;
        out += `\nMatch: ${match[0]}\n`;
        out += code.substring(Math.max(0, idx - 150), Math.min(code.length, idx + 250)) + '\n';
    }
    
    fs.writeFileSync('scripts/_api_calls_results.txt', out);
    console.log('\nDone! Wrote findings to scripts/_api_calls_results.txt');
})();
