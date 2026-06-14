const fs = require('fs');
const html = fs.readFileSync('prime_sample.html', 'utf8');
const urls = [...new Set(html.match(/https:\/\/m\.media-amazon\.com\/images\/S\/pv-target-images\/[a-f0-9]{64}[^"'\s\\]*/gi) || [])];
console.log(urls.join('\n'));
