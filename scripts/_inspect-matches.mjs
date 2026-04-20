import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Count distinct films showing at Viva Ikeja and their showtime counts
const { data: ikeja } = await s.from('cinemas').select('id').ilike('name', '%Ikeja%').limit(1);
if (!ikeja?.length) { console.log('No Ikeja cinema'); process.exit(0); }

const { data: showtimes } = await s
  .from('showtimes')
  .select('film_id, show_date, films(title, is_nollywood, source, release_type, year)')
  .eq('cinema_id', ikeja[0].id)
  .eq('is_available', true);

console.log(`\n${showtimes?.length ?? 0} available showtimes at Viva Ikeja.\n`);

const byFilm = {};
for (const s of showtimes ?? []) {
  const t = s.films?.title || '(unknown)';
  if (!byFilm[t]) byFilm[t] = { title: t, year: s.films?.year, count: 0, nollywood: s.films?.is_nollywood, source: s.films?.source };
  byFilm[t].count++;
}
console.log('Showtimes grouped by film title:');
Object.values(byFilm).sort((a,b) => b.count - a.count).forEach(f => {
  console.log(`  ${f.count}x  "${f.title}" (${f.year ?? '—'}) is_nollywood=${f.nollywood} source=${f.source}`);
});
