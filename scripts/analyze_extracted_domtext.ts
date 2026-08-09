import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'outputs', 'yearbook_2025_pages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

console.log(`Analyzing ${files.length} JSON page files...`);

for (const file of files) {
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const text = data.domText || '';

  if (text.length > 50) {
    console.log(`Page #${data.page} text snippet (${text.length} chars):`, text.slice(0, 200));
  }
}
