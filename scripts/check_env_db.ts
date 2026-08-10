import dotenv from 'dotenv';

dotenv.config();

console.log('ENV KEYS FOR DATABASE/POSTGRES:', Object.keys(process.env).filter(k => k.includes('DB') || k.includes('POSTGRES') || k.includes('URL') || k.includes('KEY')));
