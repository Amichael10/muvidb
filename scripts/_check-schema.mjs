import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: showtime } = await s.from('showtimes').select('*').limit(1);
console.log('SHOWTIMES columns:', showtime?.[0] ? Object.keys(showtime[0]) : '(empty table)');

const { data: cinema } = await s.from('cinemas').select('*').limit(1);
console.log('\nCINEMAS columns:', cinema?.[0] ? Object.keys(cinema[0]) : '(empty)');

const { data: film } = await s.from('films').select('*').limit(1);
console.log('\nFILMS columns:', film?.[0] ? Object.keys(film[0]) : '(empty)');
