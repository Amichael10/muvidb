const https = require('https');

const url = 'https://ticketing.eu.veezi.com/sessions/?siteToken=4x3z2wcre0rek2beab5w344ae0';

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  }
}, (res) => {
  let html = '';
  res.on('data', c => html += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Length:', html.length);
    console.log('HTML start:', html.substring(0, 100));
    console.log('Film count:', (html.match(/class="[^"]*\bfilm\b[^"]*"/ig)||[]).length);
    console.log('Session times count:', (html.match(/session-times/ig)||[]).length);
  });
}).on('error', console.error);
