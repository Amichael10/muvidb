import fs from 'fs';

const dump = JSON.parse(fs.readFileSync('outputs/yearbook_2025_htmlconfig_dump.json', 'utf8'));

for (const p of [42, 43, 44, 45, 46]) {
  console.log(`\n--- PAGE ${p} ANNOTATIONS ---`);
  const annotations = dump.pageEditor[p - 1] || [];
  for (const ann of annotations) {
    if (ann.action && ann.action.url) {
      console.log(`  • URL: ${ann.action.url}`);
    }
  }
}
