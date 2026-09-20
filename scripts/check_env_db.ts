import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const keys = Object.keys(process.env).filter(k => /database|postgres|db_url|supabase/i.test(k));
console.log('Database related env keys:', keys);
