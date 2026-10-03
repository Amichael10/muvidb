import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function mergeFilmInto(victimId: string, survivorId: string) {
  console.log(`  Merging film ${victimId} -> ${survivorId}...`);

  // Move credits
  const { data: credits } = await supabase.from('credits').select('*').eq('film_id', victimId);
  if (credits && credits.length > 0) {
    for (const c of credits) {
      const { error } = await supabase.from('credits').upsert({
        film_id: survivorId,
        person_id: c.person_id,
        role: c.role,
        character_name: c.character_name,
      }, { onConflict: 'film_id,person_id,role' });
      if (error) console.warn('Credit move warning:', error.message);
    }
    await supabase.from('credits').delete().eq('film_id', victimId);
  }

  // Move film_genres
  const { data: fGenres } = await supabase.from('film_genres').select('*').eq('film_id', victimId);
  if (fGenres && fGenres.length > 0) {
    for (const fg of fGenres) {
      await supabase.from('film_genres').upsert({
        film_id: survivorId,
        genre_id: fg.genre_id,
      }, { onConflict: 'film_id,genre_id' });
    }
    await supabase.from('film_genres').delete().eq('film_id', victimId);
  }

  // Move platform_new_releases
  await supabase.from('platform_new_releases').delete().eq('film_id', victimId);

  // Finally delete victim film
  const { error: delErr } = await supabase.from('films').delete().eq('id', victimId);
  if (delErr) {
    console.error(`  ❌ Failed to delete victim film ${victimId}:`, delErr.message);
  } else {
    console.log(`  ✅ Successfully deleted duplicate film ${victimId}`);
  }
}

async function dedupeDocuth() {
  console.log('🧹 Starting Docuth duplicates cleanup...');

  // 1. Group all Docuth films by URL
  const { data: docuthFilms, error } = await supabase
    .from('films')
    .select('id, title, slug, year, streaming_links, created_at')
    .or('source.eq.docuth_sync,release_type.eq.docuth,streaming_links->>docuth.not.is.null')
    .order('created_at', { ascending: true });

  if (error || !docuthFilms) {
    console.error('Failed to fetch docuth films:', error);
    return;
  }

  // Group by docuth URL first
  const urlMap = new Map<string, any[]>();
  for (const f of docuthFilms) {
    const url = f.streaming_links?.docuth;
    if (url) {
      if (!urlMap.has(url)) urlMap.set(url, []);
      urlMap.get(url)!.push(f);
    }
  }

  console.log(`Found ${urlMap.size} unique Docuth URLs across ${docuthFilms.length} records.`);

  for (const [url, list] of urlMap.entries()) {
    if (list.length > 1) {
      console.log(`\nURL ${url} has ${list.length} duplicate entries:`);
      // Keep earliest created row as survivor
      const survivor = list[0];
      const victims = list.slice(1);
      for (const v of victims) {
        await mergeFilmInto(v.id, survivor.id);
      }
    }
  }

  // Next, group by exact title for docuth films that don't have distinct URLs
  const { data: remainingDocuth } = await supabase
    .from('films')
    .select('id, title, slug, year, streaming_links, created_at')
    .or('source.eq.docuth_sync,release_type.eq.docuth,streaming_links->>docuth.not.is.null')
    .order('created_at', { ascending: true });

  const titleMap = new Map<string, any[]>();
  for (const f of remainingDocuth || []) {
    const cleanT = f.title.toLowerCase().trim();
    if (!titleMap.has(cleanT)) titleMap.set(cleanT, []);
    titleMap.get(cleanT)!.push(f);
  }

  for (const [title, list] of titleMap.entries()) {
    // Only merge if they also share the same year or link
    if (list.length > 1) {
      const links = new Set(list.map(x => x.streaming_links?.docuth).filter(Boolean));
      if (links.size <= 1) {
        console.log(`\nTitle "${title}" has ${list.length} duplicates with same/no link:`);
        const survivor = list[0];
        const victims = list.slice(1);
        for (const v of victims) {
          await mergeFilmInto(v.id, survivor.id);
        }
      }
    }
  }

  console.log('\n✨ Docuth deduplication completed.');
}

dedupeDocuth().catch(console.error);
