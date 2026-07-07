import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function list() {
    const { data: cinemas, error } = await supabase.from('cinemas').select('*').ilike('name', '%filmhouse%');
    if (error) {
        console.error(error);
        return;
    }
    fs.writeFileSync('scripts/_fh_cinemas_db.txt', JSON.stringify(cinemas, null, 2));
    console.log('Done listing filmhouse cinemas from DB');
}

list();
