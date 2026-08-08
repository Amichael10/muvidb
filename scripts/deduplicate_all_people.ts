import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const FIELDS_TO_MERGE = [
  'photo_url',
  'bio',
  'date_of_birth',
  'birthplace',
  'nationality',
  'gender',
  'known_for_department',
  'instagram_url',
  'facebook_url',
  'twitter_url',
  'tiktok_url',
  'youtube_channel_id',
  'youtube_handle',
  'tmdb_id',
  'is_spotlight',
  'is_verified',
];

function isBlank(value: any) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

async function deduplicateAllPeople() {
  console.log('🔍 Fetching ALL people records for full metadata deduplication...');

  let allPeople: any[] = [];
  let lastId = '00000000-0000-0000-0000-000000000000';
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('people')
      .select(`
        id, name, photo_url, bio, date_of_birth, birthplace, nationality, gender,
        known_for_department, instagram_url, facebook_url, twitter_url, tiktok_url,
        youtube_channel_id, youtube_handle, tmdb_id, is_spotlight, is_verified,
        created_at
      `)
      .gt('id', lastId)
      .order('id')
      .limit(1000);

    if (error) {
      console.error('Error fetching people batch:', error);
      break;
    }

    if (data && data.length > 0) {
      allPeople = allPeople.concat(data);
      lastId = data[data.length - 1].id;
      if (allPeople.length % 5000 === 0) {
        console.log(`  Fetched ${allPeople.length} people...`);
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Total people fetched: ${allPeople.length}`);

  // Group by exact normalized name
  const groups = allPeople.reduce((acc, p) => {
    const key = p.name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, any[]>);

  let mergedCount = 0;
  let totalCreditsReassigned = 0;

  for (const [nameKey, members] of Object.entries(groups)) {
    if (members.length > 1) {
      // Sort members: prioritize the record with photo, bio, or older created_at
      members.sort((a, b) => {
        const scoreA = (a.photo_url ? 10 : 0) + (a.bio ? 5 : 0) + (a.tmdb_id ? 3 : 0);
        const scoreB = (b.photo_url ? 10 : 0) + (b.bio ? 5 : 0) + (b.tmdb_id ? 3 : 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const survivor = members[0];
      const duplicates = members.slice(1);

      console.log(`👤 Merging ${duplicates.length} duplicate(s) into canonical record for: "${survivor.name}" (${survivor.id})`);

      for (const dup of duplicates) {
        // 1. Consolidate missing metadata from duplicate into survivor
        const updatesToSurvivor: Record<string, any> = {};
        for (const field of FIELDS_TO_MERGE) {
          if (isBlank(survivor[field]) && !isBlank(dup[field])) {
            updatesToSurvivor[field] = dup[field];
            survivor[field] = dup[field]; // update local copy too
            console.log(`   ✨ Merging field [${field}] from duplicate to survivor: "${dup[field]}"`);
          }
        }

        if (Object.keys(updatesToSurvivor).length > 0) {
          const { error: updateError } = await supabase
            .from('people')
            .update(updatesToSurvivor)
            .eq('id', survivor.id);

          if (updateError) {
            console.error(`   ⚠️ Failed to update survivor ${survivor.id} metadata:`, updateError.message);
          }
        }

        // 2. Re-point credits from dup to survivor
        const { data: dupCredits } = await supabase
          .from('credits')
          .select('*')
          .eq('person_id', dup.id);

        if (dupCredits && dupCredits.length > 0) {
          for (const credit of dupCredits) {
            // Check if survivor already has this credit (film_id + role)
            const { data: existingSurvivorCredit } = await supabase
              .from('credits')
              .select('id')
              .match({ film_id: credit.film_id, person_id: survivor.id, role: credit.role })
              .maybeSingle();

            if (!existingSurvivorCredit) {
              // Re-assign credit to survivor
              const { error: reassignError } = await supabase
                .from('credits')
                .update({ person_id: survivor.id })
                .eq('id', credit.id);

              if (reassignError) {
                // Unique constraint violation or failure -> delete duplicate credit row
                await supabase.from('credits').delete().eq('id', credit.id);
              } else {
                totalCreditsReassigned++;
              }
            } else {
              // Survivor already has this credit, delete dup credit row
              await supabase.from('credits').delete().eq('id', credit.id);
            }
          }
        }

        // 3. Re-point people_enrichment_queue rows
        await supabase
          .from('people_enrichment_queue')
          .update({ person_id: survivor.id })
          .eq('person_id', dup.id);

        // 4. Delete the duplicate person row
        const { error: deleteError } = await supabase
          .from('people')
          .delete()
          .eq('id', dup.id);

        if (deleteError) {
          console.error(`   ❌ Failed to delete duplicate person ${dup.id}:`, deleteError.message);
        } else {
          mergedCount++;
        }
      }
    }
  }

  console.log(`\n🎉 Full metadata deduplication complete!`);
  console.log(`   - Duplicate actor profiles merged & deleted: ${mergedCount}`);
  console.log(`   - Film credits reassigned: ${totalCreditsReassigned}`);
}

deduplicateAllPeople().catch(console.error);
