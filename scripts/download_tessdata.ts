import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import https from 'node:https';

const TESSDATA_DIR = join(process.cwd(), 'tessdata');
if (!existsSync(TESSDATA_DIR)) {
  mkdirSync(TESSDATA_DIR, { recursive: true });
}

const FILES = [
  { name: 'eng.traineddata', url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata' },
  { name: 'yor.traineddata', url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/yor.traineddata' },
  { name: 'ibo.traineddata', url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/ibo.traineddata' },
];

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const request = (targetUrl: string) => {
      https.get(targetUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          if (response.headers.location) {
            return request(response.headers.location);
          }
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        reject(err);
      });
    };
    request(url);
  });
}

async function main() {
  console.log(`📥 Downloading Tesseract language data into: ${TESSDATA_DIR}`);
  for (const item of FILES) {
    const dest = join(TESSDATA_DIR, item.name);
    if (existsSync(dest) && statSync(dest).size > 100_000) {
      console.log(`✅ ${item.name} already exists (${(statSync(dest).size / 1024 / 1024).toFixed(2)} MB). Skipping.`);
      continue;
    }
    console.log(`⏳ Downloading ${item.name} from ${item.url}...`);
    try {
      await downloadFile(item.url, dest);
      console.log(`✅ Successfully downloaded ${item.name} (${(statSync(dest).size / 1024 / 1024).toFixed(2)} MB).`);
    } catch (err: any) {
      console.warn(`⚠️ Warning for ${item.name}: ${err.message}`);
    }
  }
  console.log('🎉 Tesseract tessdata setup complete!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
