import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await s.from('cinemas').select('name, chain, city, website, booking_url, is_active').eq('is_active', true).limit(10);
console.log(JSON.stringify(data, null, 2));
const { count: withWebsite } = await s.from('cinemas').select('*', { count: 'exact', head: true }).not('website','is',null);
const { count: total } = await s.from('cinemas').select('*', { count: 'exact', head: true });
console.log('with website:', withWebsite, '/', total);
