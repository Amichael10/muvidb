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
    return Buffer.concat([Buffer.from('Salted__', 'utf8'), salt, encrypted]).toString('base64');
}

function makeRequest(reqData) {
    return new Promise((resolve) => {
        const payload = encryptCryptoJS(JSON.stringify(reqData), ENCRYPTION_KEY);
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
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.write(postData);
        req.end();
    });
}

(async () => {
    console.log("Probing api: 'locations'...");
    const resLocations = await makeRequest({
        "endpoint": "cms_widget/index",
        "method": "POST",
        "data": {
            "api": "locations",
            "sales_channel_id": 1
        },
        "headers": {},
        "langId": "1"
    });
    
    fs.writeFileSync('scripts/_probe_locations_api.json', JSON.stringify(resLocations, null, 2));
    
    if (resLocations && resLocations.status) {
        console.log("api: 'locations' succeeded!");
        console.log(resLocations.data);
    } else {
        console.log("api: 'locations' failed or returned empty. Probing locations 1 to 20 with api: 'dates'...");
        
        const activeLocations = [];
        for (let i = 1; i <= 20; i++) {
            const res = await makeRequest({
                "endpoint": "cms_widget/index",
                "method": "POST",
                "data": {
                    "api": "dates",
                    "sales_channel_id": 1,
                    "cinema_location_id": String(i),
                    "page_number": "1",
                    "url_key": "",
                    "widget_id": "movie_calendar",
                    "calendar_date_picker_option": "2"
                },
                "headers": {},
                "langId": "1"
            });
            
            if (res && res.status && res.data && res.data.date_start) {
                console.log(`Location ID ${i} is ACTIVE (dates: ${res.data.date_start} to ${res.data.date_end})`);
                activeLocations.push({ id: String(i), dates: res.data });
            } else {
                console.log(`Location ID ${i} is inactive`);
            }
        }
        
        fs.writeFileSync('scripts/_active_locations.json', JSON.stringify(activeLocations, null, 2));
    }
})();
