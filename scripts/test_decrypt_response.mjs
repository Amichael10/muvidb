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

function decryptCryptoJS(ciphertextBase64, passphrase) {
    const ciphertextBytes = Buffer.from(ciphertextBase64, 'base64');
    if (ciphertextBytes.toString('utf8', 0, 8) !== 'Salted__') {
        // Not encrypted
        return ciphertextBytes.toString('utf8');
    }
    const salt = ciphertextBytes.slice(8, 16);
    const ciphertext = ciphertextBytes.slice(16);
    
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
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const reqData = {
  "endpoint": "cms_widget/index",
  "method": "POST",
  "data": {
    "api": "dates",
    "sales_channel_id": 1,
    "cinema_location_id": "6",
    "page_number": "1",
    "url_key": "",
    "widget_id": "movie_calendar",
    "calendar_date_picker_option": "2"
  },
  "headers": {},
  "langId": "1"
};

const payload = encryptCryptoJS(JSON.stringify(reqData), ENCRYPTION_KEY);

console.log("Encrypted payload:", payload);

const postData = JSON.stringify({ payload });

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
        console.log("Raw Response:", data);
        try {
            const parsed = JSON.parse(data);
            if (parsed.payload) {
                console.log("Decrypting response payload...");
                const decrypted = decryptCryptoJS(parsed.payload, ENCRYPTION_KEY);
                console.log("Decrypted response:");
                console.log(decrypted.substring(0, 1000) + (decrypted.length > 1000 ? "... [TRUNCATED]" : ""));
                fs.writeFileSync('scripts/_response_dates.json', decrypted);
            }
        } catch (e) {
            console.error("Failed to parse/decrypt response:", e.message);
        }
    });
});

req.on('error', (e) => {
    console.error("Request failed:", e.message);
});

req.write(postData);
req.end();
