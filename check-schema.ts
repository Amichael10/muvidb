import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabase = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // try to query 1 row from films
    const { data: films, error } = await supabase.from('films').select('*').limit(1);
    console.log("Films columns:", Object.keys(films?.[0] || {}));
    
    // try to query credits
    const { data: credits } = await supabase.from('credits').select('*').limit(1);
    console.log("Credits columns:", Object.keys(credits?.[0] || {}));
}
main();
