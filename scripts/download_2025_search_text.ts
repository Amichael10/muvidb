import https from 'https';
import fs from 'fs';
import path from 'path';

console.log('🚀 Downloading 2025 FilmOne Box Office Yearbook search_text.json via HTTPS...');

const url = 'https://online.fliphtml5.com/ogfbg/abpz/files/search/search_text.json';
const outputPath = path.join(process.cwd(), 'outputs', 'yearbook_2025_search_text.json');

if (!fs.existsSync(path.dirname(outputPath))) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

const file = fs.createWriteStream(outputPath);
https.get(url, (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close(() => {
      const stats = fs.statSync(outputPath);
      console.log(`✅ Downloaded search_text.json! Size: ${(stats.size / 1024).toFixed(2)} KB`);
    });
  });
}).on('error', (err) => {
  fs.unlink(outputPath, () => {});
  console.error('Download error:', err.message);
});
