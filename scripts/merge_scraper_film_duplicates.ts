import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function normalizeTitle(t: string): string {
  return (t || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function retry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1500): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 1) throw err;
    await new Promise(res => setTimeout(res, delayMs));
    return retry(fn, retries - 1, delayMs * 2);
  }
}

async function mergeFilmInto(victimId: string, survivorId: string) {
  // 1. Move/reconcile credits
  const { data: vCredits } = await retry(() => supabase.from('credits').select('*').eq('film_id', victimId));
  const { data: sCredits } = await retry(() => supabase.from('credits').select('*').eq('film_id', survivorId));
  const sPersonMap = new Map((sCredits || []).map(c => [c.person_id, c]));

  if (vCredits && vCredits.length > 0) {
    for (const c of vCredits) {
      if (!c.person_id) continue;
      const existing = sPersonMap.get(c.person_id);
      if (existing) {
        // Person already has a credit on survivor film!
        // Enrich character_name or role if survivor's is missing
        if (!existing.character_name && c.character_name) {
          await retry(() => supabase.from('credits').update({ character_name: c.character_name }).eq('id', existing.id));
        }
      } else {
        // Move credit to survivor
        await retry(() => supabase.from('credits').insert({
          film_id: survivorId,
          person_id: c.person_id,
          role: c.role,
          character_name: c.character_name,
          order: c.order,
          source: c.source
        }));
      }
    }
    await retry(() => supabase.from('credits').delete().eq('film_id', victimId));
  }

  // 2. Move film_genres
  const { data: fGenres } = await retry(() => supabase.from('film_genres').select('*').eq('film_id', victimId));
  if (fGenres && fGenres.length > 0) {
    for (const fg of fGenres) {
      await retry(() => supabase.from('film_genres').upsert({
        film_id: survivorId,
        genre_id: fg.genre_id,
      }, { onConflict: 'film_id,genre_id' }));
    }
    await retry(() => supabase.from('film_genres').delete().eq('film_id', victimId));
  }

  // 3. Move credit_candidates
  const { data: candidates } = await retry(() => supabase.from('credit_candidates').select('id').eq('film_id', victimId));
  if (candidates && candidates.length > 0) {
    await retry(() => supabase.from('credit_candidates').update({ film_id: survivorId }).eq('film_id', victimId));
  }

  // 4. Move reviews / ratings
  const { data: reviews } = await retry(() => supabase.from('reviews').select('id').eq('film_id', victimId));
  if (reviews && reviews.length > 0) {
    await retry(() => supabase.from('reviews').update({ film_id: survivorId }).eq('film_id', victimId));
  }

  // 5. Move critic_reviews
  const { data: cReviews } = await retry(() => supabase.from('critic_reviews').select('id').eq('film_id', victimId));
  if (cReviews && cReviews.length > 0) {
    await retry(() => supabase.from('critic_reviews').update({ film_id: survivorId }).eq('film_id', victimId));
  }

  // 6. Delete platform_new_releases for victim
  await retry(() => supabase.from('platform_new_releases').delete().eq('film_id', victimId));

  // 7. Delete victim film
  const { error: delErr } = await retry(() => supabase.from('films').delete().eq('id', victimId));
  if (delErr) {
    console.error(`  ❌ Failed to delete victim film ${victimId}:`, delErr.message);
  } else {
    console.log(`  ✅ Successfully deleted duplicate film ${victimId}`);
  }
}

async function dedupeScraperFilms() {
  console.log('Fetching scraper duplicate candidates...');

  const scraperSources = [
    'docuth_sync', 'prime_video', 'circuits', 'partyjollof', 
    'afinolly', 'imdb', 'tmdb', 'netflix', 'showmax', 'irokotv'
  ];

  let allFilms: any[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await retry(() => supabase
      .from('films')
      .select('id, title, year, source, poster_url, backdrop_url, synopsis, source_video_id, content_type, release_type, streaming_links, created_at')
      .in('source', scraperSources)
      .range(page * pageSize, (page + 1) * pageSize - 1));

    if (error) {
      console.error('Error fetching films:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allFilms = allFilms.concat(data);
    page++;
    if (data.length < pageSize) break;
  }

  console.log(`Loaded ${allFilms.length} total scraper films.`);

  // Group by normalized title + year (or unknown)
  const map = new Map<string, any[]>();
  for (const film of allFilms) {
    const norm = normalizeTitle(film.title);
    if (!norm) continue;
    const yearKey = film.year ? `${norm}__${film.year}` : `${norm}__unknown`;
    if (!map.has(yearKey)) map.set(yearKey, []);
    map.get(yearKey)!.push(film);
  }

  let mergedCount = 0;
  for (const [key, films] of map.entries()) {
    if (films.length <= 1) continue;

    console.log(`\nProcessing duplicate cluster: "${key}" (${films.length} copies)`);

    // Pick survivor: priority to one with poster, synopsis, or earliest created_at
    const sorted = [...films].sort((a, b) => {
      const aScore = (a.poster_url ? 2 : 0) + (a.synopsis ? 2 : 0) + (a.backdrop_url ? 1 : 0);
      const bScore = (b.poster_url ? 2 : 0) + (b.synopsis ? 2 : 0) + (b.backdrop_url ? 1 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const survivor = sorted[0];
    const victims = sorted.slice(1);

    console.log(`  Survivor: [${survivor.id}] "${survivor.title}" (${survivor.year}) source=${survivor.source}`);

    // Merge streaming links from victims into survivor
    let mergedLinks = { ...(survivor.streaming_links || {}) };
    for (const v of victims) {
      if (v.streaming_links && typeof v.streaming_links === 'object') {
        mergedLinks = { ...mergedLinks, ...v.streaming_links };
      }
    }
    await retry(() => supabase.from('films').update({ streaming_links: mergedLinks }).eq('id', survivor.id));

    // Merge each victim
    for (const v of victims) {
      await mergeFilmInto(v.id, survivor.id);
      mergedCount++;
    }
  }

  console.log(`\n🎉 Finished! Merged and deleted ${mergedCount} duplicate scraper films.`);
}

dedupeScraperFilms().catch(console.error);
