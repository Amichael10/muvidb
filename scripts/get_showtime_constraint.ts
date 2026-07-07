import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    // Query pg_constraint to get the definition of showtimes_format_check
    const { data, error } = await supabase.rpc('execute_sql', { sql: `
        SELECT pg_get_constraintdef(oid) as definition
        FROM pg_constraint 
        WHERE conname = 'showtimes_format_check';
    `});
    
    fs.writeFileSync('scripts/_showtime_constraint_def.txt', JSON.stringify({
        data,
        error
    }, null, 2));
    console.log('Done checking check constraints');
}

check();
