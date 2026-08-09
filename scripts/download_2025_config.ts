import https from 'https';
import fs from 'fs';
import path from 'path';

console.log('🚀 Downloading 2025 FilmOne Box Office Yearbook config.js...');

const url = 'https://online.fliphtml5.com/ogfbg/abpz/javascript/config.js';
const outputPath = path.join(process.cwd(), 'outputs', 'yearbook_2025_config.js');

if (!fs.existsSync(path.dirname(outputPath))) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

const file = fs.createWriteStream(outputPath);
https.get(url, (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close(() => {
      const stats = fs.statSync(outputPath);
      console.log(`✅ Downloaded config.js successfully! Size: ${(stats.size / 1024).toFixed(2)} KB`);
    });
  });
}).on('error', (err) => {
  fs.unlink(outputPath, () => {});
  console.error('Download error:', err.message);
});
