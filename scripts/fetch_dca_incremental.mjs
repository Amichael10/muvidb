import fs from 'fs';
import path from 'path';

const pagesDir = path.join('scripts', 'data', 'dca_pages');
if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });

async function fetchPage(p) {
  const filePath = path.join(pagesDir, `page_${p}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (e) {
      // corrupt file, re-fetch
    }
  }

  const url = `https://dcaalumni.org/api/alumnis?page=${p}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0'
        }
      });
      if (res.status === 429) {
        console.log(`[Page ${p}] Rate limited (429). Cooling down for 12 seconds...`);
        await new Promise(r => setTimeout(r, 12000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = json.data?.data || [];
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
      return list;
    } catch (err) {
      console.warn(`[Page ${p}] Attempt ${attempt} failed: ${err.message}`);
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
  return [];
}

async function main() {
  const totalPages = 260;
  console.log(`Starting resilient incremental DCA fetch (1 to ${totalPages})...`);
  let totalItems = 0;

  for (let p = 1; p <= totalPages; p++) {
    const list = await fetchPage(p);
    totalItems += list.length;
    if (p % 10 === 0 || p === totalPages) {
      console.log(`Progress: page ${p}/${totalPages} | Total items collected: ${totalItems}`);
    }
    // Polite pacing: 800ms
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('All pages fetched! Consolidating into scripts/data/dca_alumni.json...');
  const all = [];
  for (let p = 1; p <= totalPages; p++) {
    const fp = path.join(pagesDir, `page_${p}.json`);
    if (fs.existsSync(fp)) {
      const chunk = JSON.parse(fs.readFileSync(fp, 'utf8'));
      all.push(...chunk);
    }
  }

  fs.writeFileSync(path.join('scripts', 'data', 'dca_alumni.json'), JSON.stringify(all, null, 2), 'utf8');
  console.log(`Successfully consolidated ${all.length} alumni records!`);
}

main().catch(console.error);
