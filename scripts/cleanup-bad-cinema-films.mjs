/**
 * Cleanup — remove the 14 test films + 89 test showtimes created during the first
 * Reach Cinema test run (before we added the Nollywood-only filter).
 * After this the table is clean and ready for the new behaviour.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Find test-created films (source='cinema')
const { data: badFilms } = await s.from('films').select('id, title').eq('source', 'cinema');
console.log(`Found ${badFilms?.length ?? 0} test-created films to delete.`);

if (badFilms?.length) {
  const ids = badFilms.map(f => f.id);

  // 2. Delete showtimes referencing those films
  const { error: stErr, count: stCount } = await s
    .from('showtimes')
    .delete({ count: 'exact' })
    .in('film_id', ids);
  if (stErr) console.error('showtime delete:', stErr.message);
  else console.log(`  ✓ deleted ${stCount ?? 0} showtimes`);

  // 3. Delete any credits referencing those films (safety — shouldn't be any)
  await s.from('credits').delete().in('film_id', ids);

  // 4. Delete the films themselves
  const { error: fErr, count: fCount } = await s
    .from('films')
    .delete({ count: 'exact' })
    .in('id', ids);
  if (fErr) console.error('film delete:', fErr.message);
  else console.log(`  ✓ deleted ${fCount ?? 0} test films`);
}

// 5. Ensure all remaining films are flagged is_nollywood=true
const { error: upErr, count: upCount } = await s
  .from('films')
  .update({ is_nollywood: true }, { count: 'exact' })
  .or('is_nollywood.is.null,is_nollywood.eq.false');
if (upErr) console.error('is_nollywood update:', upErr.message);
else console.log(`  ✓ ensured is_nollywood=true on ${upCount ?? 0} films`);

console.log('\n✅ Cleanup complete.');
