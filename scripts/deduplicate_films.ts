
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deduplicateFilms() {
  console.log('🔍 Fetching films for deduplication...');
  
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year, poster_url, created_at');

  if (error) {
    console.error('Error fetching films:', error);
    return;
  }

  const groups = new Map<string, any[]>();
  films?.forEach(f => {
    const key = `${f.title.trim().toLowerCase()}_${f.year}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  });

  let mergedCount = 0;
  for (const [key, members] of groups.entries()) {
    if (members.length > 1) {
      console.log(`🎬 Merging ${members.length} records for film: ${members[0].title}`);
      members.sort((a, b) => {
        if (a.poster_url && !b.poster_url) return -1;
        if (!a.poster_url && b.poster_url) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const survivor = members[0];
      const duplicates = members.slice(1);

      for (const dup of duplicates) {
        // Move credits
        const { data: credits } = await supabase.from('credits').select('*').eq('film_id', dup.id);
        if (credits) {
          for (const c of credits) {
            await supabase.from('credits').upsert({
              film_id: survivor.id,
              person_id: c.person_id,
              role: c.role
            }, { onConflict: 'film_id,person_id,role' });
            await supabase.from('credits').delete().match({ film_id: dup.id, person_id: c.person_id, role: c.role });
          }
        }
        // Delete dup film
        await supabase.from('films').delete().eq('id', dup.id);
        mergedCount++;
      }
    }
  }

  console.log(`✅ Film deduplication complete. Merged ${mergedCount} films.`);
}

deduplicateFilms();
