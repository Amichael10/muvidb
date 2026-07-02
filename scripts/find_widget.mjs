import fs from 'fs';
import https from 'https';

const dump = fs.readFileSync('scripts/_fh_dump.html', 'utf8');
const chunkRegex = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
const chunks = [...dump.matchAll(chunkRegex)].map(m => m[1]);

let out = `Searching all ${chunks.length} chunks...\n\n`;

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
        
        if (code.includes('calendar_date_picker_option') || code.includes('movie_calendar')) {
            out += `\n=== FOUND IN CHUNK: ${chunk} ===\n`;
            
            // Print surrounding context
            const idx = code.indexOf('calendar_date_picker_option');
            out += code.substring(Math.max(0, idx - 500), Math.min(code.length, idx + 1500)) + '\n\n';
        }
    }
    
    fs.writeFileSync('scripts/_widget_results.txt', out);
    console.log('\nDone! Wrote findings to scripts/_widget_results.txt');
})();
