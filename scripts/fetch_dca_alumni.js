import fs from 'fs';
import path from 'path';

async function fetchPageWithRetry(page, retries = 3) {
  const url = `https://dcaalumni.org/api/alumnis?page=${page}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data?.data || [];
    } catch (err) {
      if (attempt === retries) {
        console.error(`Failed page ${page} after ${retries} attempts:`, err.message);
        return [];
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return [];
}

async function main() {
  const totalPages = 260;
  console.log(`Starting fetch of all ${totalPages} pages from DCA Alumni directory...`);
  const concurrency = 6;
  const allAlumni = [];

  for (let i = 1; i <= totalPages; i += concurrency) {
    const chunk = [];
    for (let j = i; j < i + concurrency && j <= totalPages; j++) {
      chunk.push(j);
    }

    const results = await Promise.all(chunk.map(p => fetchPageWithRetry(p)));
    for (const list of results) {
      allAlumni.push(...list);
    }

    process.stdout.write(`Fetched pages ${chunk[0]}..${chunk[chunk.length - 1]} | Total collected: ${allAlumni.length} / 3892\r`);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nFetch complete! Collected ${allAlumni.length} alumni.`);
  const outPath = path.join('scripts', 'data', 'dca_alumni.json');
  fs.writeFileSync(outPath, JSON.stringify(allAlumni, null, 2), 'utf8');
  console.log(`Saved to ${outPath}`);
}

main().catch(console.error);
