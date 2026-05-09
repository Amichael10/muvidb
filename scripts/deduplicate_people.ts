import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deduplicatePeople() {
  console.log('🔍 Finding duplicates in people table...');
  
  const { data: people } = await supabase.from('people').select('id, name, photo_url, created_at');
  if (!people) return;

  const groups = people.reduce((acc, p) => {
    const key = p.name.trim().toLowerCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, any[]>);

  let mergedCount = 0;
  for (const [name, members] of Object.entries(groups)) {
    if (members.length > 1) {
      console.log(`👤 Merging ${members.length} records for: ${members[0].name}`);
      
      members.sort((a, b) => {
        if (a.photo_url && !b.photo_url) return -1;
        if (!a.photo_url && b.photo_url) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const survivor = members[0];
      const duplicates = members.slice(1);

      for (const dup of duplicates) {
        // 1. Move credits to survivor
        const { data: dupCredits } = await supabase.from('credits').select('*').eq('person_id', dup.id);
        if (dupCredits) {
          for (const credit of dupCredits) {
             // Try to update, ignore if already exists
             await supabase.from('credits').update({ person_id: survivor.id }).match({ film_id: credit.film_id, person_id: dup.id, role: credit.role });
             // If update fails due to constraint, delete the duplicate credit
             await supabase.from('credits').delete().match({ film_id: credit.film_id, person_id: dup.id, role: credit.role });
          }
        }
        
        // 2. Delete duplicate person
        const { error: deleteError } = await supabase.from('people').delete().eq('id', dup.id);
        if (deleteError) {
           console.error(`  ❌ Person delete error for ${dup.id}:`, deleteError.message);
        } else {
          mergedCount++;
        }
      }
    }
  }

  console.log(`✅ Deduplication complete. Merged ${mergedCount} duplicate person records.`);
}

deduplicatePeople();
