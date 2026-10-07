import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function mergeFilmInto(primaryId: string, dupId: string) {
  console.log(`Merging dup [${dupId}] into primary [${primaryId}]...`);

  // 1. Credits
  const { data: primaryCredits } = await supabase
    .from('credits')
    .select('id, person_id, role, character_name, billing_order')
    .eq('film_id', primaryId);
  const primPersonMap = new Map<string, any>();
  primaryCredits?.forEach(c => {
    if (c.person_id) primPersonMap.set(c.person_id, c);
  });

  const { data: dupCredits } = await supabase
    .from('credits')
    .select('id, person_id, role, character_name, billing_order')
    .eq('film_id', dupId);

  if (dupCredits && dupCredits.length > 0) {
    const toRelink: string[] = [];
    const toDelete: string[] = [];

    for (const dc of dupCredits) {
      if (!dc.person_id) {
        toRelink.push(dc.id);
        continue;
      }
      const existing = primPersonMap.get(dc.person_id);
      if (existing) {
        const updates: any = {};
        if (!existing.character_name && dc.character_name) {
          updates.character_name = dc.character_name;
          existing.character_name = dc.character_name;
        }
        if ((!existing.role || existing.role === 'cast') && dc.role && dc.role !== 'cast') {
          updates.role = dc.role;
          existing.role = dc.role;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('credits').update(updates).eq('id', existing.id);
        }
        toDelete.push(dc.id);
      } else {
        toRelink.push(dc.id);
        primPersonMap.set(dc.person_id, dc);
      }
    }

    if (toRelink.length > 0) await supabase.from('credits').update({ film_id: primaryId }).in('id', toRelink);
    if (toDelete.length > 0) await supabase.from('credits').delete().in('id', toDelete);
  }

  // 2. Child tables
  await supabase.from('reviews').update({ film_id: primaryId }).eq('film_id', dupId);
  await supabase.from('comments').update({ film_id: primaryId }).eq('film_id', dupId);
  await supabase.from('channel_videos').update({ film_id: null }).eq('film_id', dupId);
  await supabase.from('films').update({ series_id: primaryId }).eq('series_id', dupId);

  // 3. Delete dup
  const { error: delErr } = await supabase.from('films').delete().eq('id', dupId);
  if (delErr) {
    console.error(`Error deleting dup [${dupId}]:`, delErr.message);
  } else {
    console.log(`Deleted dup [${dupId}] successfully.`);
  }
}

async function main() {
  console.log('=== Cleaning up Aníkúlápó Films & Series ===');

  // 1. Primary Feature Film: Aníkúlápó (2022)
  const PRIMARY_FILM_ID = 'da545eea-bfc5-40bd-ac14-2dd1f27e5d72';
  // Dup YouTube watch party titled "Anikulapo"
  const YOUTUBE_ANIKULAPO_ID = '3ac53bd6-b9e1-4032-84f2-d10bf12c8d33';
  await mergeFilmInto(PRIMARY_FILM_ID, YOUTUBE_ANIKULAPO_ID);

  // 2. Primary Netflix Series: Aníkúlápó: Rise of the Spectre (2024)
  const PRIMARY_SERIES_ID = 'ed0fd6cb-8b23-4cf8-ad78-56367f5a5c6f';
  // Set content_type = 'series' and release_type = 'netflix' on primary series
  await supabase.from('films').update({
    content_type: 'series',
    release_type: 'netflix',
    is_nollywood: true
  }).eq('id', PRIMARY_SERIES_ID);

  const seriesDuplicates = [
    '672f64d9-6cb1-4bd2-9916-ffc12a8c807d',
    'fa271e8a-bf88-4e58-999f-6ae0b7fc1f6e',
    '8ac9f0e8-9404-46a1-9634-a55ab16fd79c',
    '0509864c-8c2c-407b-b658-92393c67ca53',
    '06e4205f-ccb4-4b96-9471-cfb8a0bb2df8',
    '3c0bb840-7942-4aa0-9dc5-6faf7f2955d2',
    '56fa8174-32dd-4af8-b643-6b73f10b661f',
    'bd55b1ca-7d8b-453e-ab23-437dbef2e7c8'
  ];

  for (const dupId of seriesDuplicates) {
    await mergeFilmInto(PRIMARY_SERIES_ID, dupId);
  }

  // 3. Anikulapo 2 duplicates
  const anikulapo2Primary = '831434fd-e789-4b6f-a410-fdf1da6cd5c1';
  const anikulapo2Dup = '7ce58015-e9ef-44be-8ef1-81c80d4e8ad4';
  await mergeFilmInto(anikulapo2Primary, anikulapo2Dup);

  console.log('🎉 Anikulapo deduplication complete!');
}

main().catch(console.error);
