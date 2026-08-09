import fs from 'fs';

const dump = JSON.parse(fs.readFileSync('outputs/yearbook_2025_htmlconfig_dump.json', 'utf8'));

console.log('Top level dump keys:', Object.keys(dump));

if (dump.pageEditor) {
  console.log(`pageEditor length: ${dump.pageEditor.length}`);
  const nonEmp = dump.pageEditor.map((p: any, idx: number) => ({ idx: idx + 1, len: Array.isArray(p) ? p.length : 0 })).filter((x: any) => x.len > 0);
  console.log('Non-empty pageEditor pages:', nonEmp);
}

if (dump.ols) {
  console.log('ols length:', dump.ols.length);
}
