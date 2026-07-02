import crypto from 'crypto';

function decryptCryptoJS(ciphertextBase64, passphrase) {
    const ciphertextBytes = Buffer.from(ciphertextBase64, 'base64');
    
    // The first 8 bytes are 'Salted__', the next 8 are the salt
    if (ciphertextBytes.toString('utf8', 0, 8) !== 'Salted__') {
        throw new Error('Invalid CryptoJS payload');
    }
    const salt = ciphertextBytes.slice(8, 16);
    const ciphertext = ciphertextBytes.slice(16);
    
    // CryptoJS default is MD5 with 1 iteration to derive Key (32 bytes) and IV (16 bytes)
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

const payload = "U2FsdGVkX1+BzpKV/3pCTd9nEBtC2qGo0+s96DA7yl9BjuyE14POqUgXkBMFMh5T4CopmYkTwKIsQm/s2vdiz0iW0PPjmXasKs44Y6B+D47kYbBr99YlIAFAJd7EJ6r5b6LjKLREck5th9zsdm1ZPljt3V91efosgLEgPLFglf8katPgfsynEJfJxwRmtiJkB+9dhh90tyJboeEzE7kYrdvnIF9W5sni6sWIATvInVB/XksJEpp2TGwPX3rowOtaU/oRsoeLB2UfCY6Wq+5DQ9HxE0BxI3A9RgR7HDx4o9JOteV0IPPnDjcVa7l47B7v2JxKePukKxQbSMxw9Zgg6Q==";
const key = "ascvdWD34_GKIbnDVBONKE23GZLpMgA34567890";

console.log("Decrypted payload:");
console.log(decryptCryptoJS(payload, key));
