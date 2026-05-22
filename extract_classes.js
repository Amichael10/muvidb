import fs from 'fs';
const html = fs.readFileSync('filmhouse_dump.html', 'utf8');
const classRegex = /class=\"([^\"]+)\"/g;
let match;
const classes = new Set();
while ((match = classRegex.exec(html)) !== null) {
  match[1].split(/\s+/).forEach(c => {
    if (c) classes.add(c);
  });
}
console.log(Array.from(classes).sort().join('\n'));
