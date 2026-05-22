import fs from 'fs';
const t = fs.readFileSync('filmhouse_dump.html', 'utf8');

// Find all URLs inside the HTML dump
const urls = new Set();
const urlRegex = /https?:\/\/[a-zA-Z0-9\-\.]+\/[a-zA-Z0-9\-\.\/\_\?\=\&]+/g;
let m;
while((m = urlRegex.exec(t)) !== null) {
  urls.add(m[0]);
}
console.log('API URLs found in HTML dump:');
Array.from(urls).filter(u => u.includes('api') || u.includes('graphql') || u.includes('filmhouse')).slice(0, 50).forEach(u => console.log(u));
