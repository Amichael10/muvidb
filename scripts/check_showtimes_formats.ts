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
    // Select distinct formats from showtimes table using Supabase PostgREST
    // Since PostgREST doesn't support select distinct directly, we can use a query with select and count
    // or select('*') and distinct locally if we pull enough records, but since there are many,
    // we can use a select('format') but group by or just select('format') on a small set
    // Or we can try to fetch all of them. How many showtimes are there? Probably a few thousands.
    // Actually, we can fetch all formats and deduplicate locally.
    const { data, error } = await supabase.from('showtimes').select('format');
    if (error) {
        console.error(error);
        return;
    }
    
    const unique = [...new Set(data.map(r => r.format))];
    
    fs.writeFileSync('scripts/_showtime_formats.txt', JSON.stringify({
        unique_formats: unique,
        total_rows: data.length
    }, null, 2));
    
    console.log('Unique formats in DB:', unique);
}

check();
