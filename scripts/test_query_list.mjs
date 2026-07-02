import crypto from 'crypto';
import https from 'https';
import fs from 'fs';

const ENCRYPTION_KEY = "ascvdWD34_GKIbnDVBONKE23GZLpMgA34567890";

function encryptCryptoJS(plainText, passphrase) {
    const salt = crypto.randomBytes(8);
    
    let md5 = crypto.createHash('md5');
    md5.update(Buffer.concat([Buffer.from(passphrase, 'utf8'), salt]));
    let currentHash = md5.digest();
    let md5s = [currentHash];
    
    while (Buffer.concat(md5s).length < 48) {
        md5 = crypto.createHash('md5');
        md5.update(Buffer.concat([currentHash, Buffer.from(passphrase, 'utf8'), salt]));
        currentHash = md5.digest();
        md5s.push(currentHash);
    }
    
    const keyMaterial = Buffer.concat(md5s);
    const key = keyMaterial.slice(0, 32);
    const iv = keyMaterial.slice(32, 48);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainText, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return Buffer.concat([
        Buffer.from('Salted__', 'utf8'),
        salt,
        encrypted
    ]).toString('base64');
}

// Prepare request for tomorrow's movies list
const reqData = {
  "endpoint": "cms_widget/index",
  "method": "POST",
  "data": {
    "api": "list",
    "sales_channel_id": 1,
    "cinema_location_id": "6", // Lekki
    "widget_id": "movie_calendar",
    "session_date": "2026-07-03", // TOMORROW
    "has_limit": 0,
    "per_page": 100,
    "page_number": 1,
    "url_key": "",
    "theater_experiance": "",
    "group_to_theater_experiance": false,
    "sort_by": ""
  },
  "headers": {},
  "langId": "1"
};

const payload = encryptCryptoJS(JSON.stringify(reqData), ENCRYPTION_KEY);
const postData = JSON.stringify({ payload });

console.log("Sending query to fetch tomorrow's movies...");

const req = https.request('https://www.filmhouseng.com/api/external', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Response status:", res.statusCode);
        try {
            const parsed = JSON.parse(data);
            fs.writeFileSync('scripts/_response_movies.json', JSON.stringify(parsed, null, 2));
            console.log("Wrote response to scripts/_response_movies.json");
            
            if (parsed.status && parsed.data && parsed.data.movies) {
                console.log(`Successfully fetched ${parsed.data.movies.length} movies!`);
                if (parsed.data.movies.length > 0) {
                    parsed.data.movies.forEach((movie, i) => {
                        console.log(`${i+1}. Movie: ${movie.name || movie.title}`);
                        if (movie.showtimes) {
                            console.log(`   Showtimes count: ${movie.showtimes.length}`);
                            console.log(`   Formats: ${movie.showtimes.map(s => s.name).join(', ')}`);
                            // Print individual show times
                            movie.showtimes.forEach(s => {
                                if (s.showtimes) {
                                    console.log(`     Format ${s.name}: ${s.showtimes.map(st => st.session_start_time).join(', ')}`);
                                }
                            });
                        }
                    });
                }
            } else {
                console.log("Response data structure doesn't contain movies:", parsed);
            }
        } catch (e) {
            console.error("Failed to parse response:", e.message);
        }
    });
});

req.on('error', (e) => {
    console.error("Request failed:", e.message);
});

req.write(postData);
req.end();
