import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const API_BASE = 'https://api.homitv.com/medias/api/v2';

function normalizeNfvcbRating(raw?: string | null): string | null {
  if (!raw) return null;
  const clean = raw.trim().toUpperCase();
  if (clean === '18+' || clean === '18' || clean === 'R' || clean === 'NC-17') return '18';
  if (clean === '16+' || clean === '15+' || clean === '15') return '15';
  if (clean === '12A' || clean === 'PG-13' || clean === '13+') return '12A';
  if (clean === '12' || clean === '12+') return '12';
  if (clean === 'PG') return 'PG';
  if (clean === 'G' || clean === 'ALL' || clean === 'U') return 'G';
  if (clean === 'RE') return 'RE';
  return null;
}

function parseRuntime(durationStr?: string, seconds?: number): number | null {
  if (typeof seconds === 'number' && seconds > 0) {
    return Math.max(1, Math.round(seconds / 60));
  }
  if (!durationStr) return null;
  const parts = durationStr.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) {
    return Math.max(1, parts[0] * 60 + parts[1] + Math.round(parts[2] / 60));
  }
  if (parts.length === 2) {
    return Math.max(1, parts[0] + Math.round(parts[1] / 60));
  }
  return null;
}

function parseGenres(genre?: string, category?: string, tags?: any[]): string[] {
  const set = new Set<string>();
  if (genre) {
    genre.split(/[,|/]/).forEach((g) => {
      const clean = g.trim();
      if (clean && !clean.toLowerCase().includes('movie')) set.add(clean);
    });
  }
  if (category) {
    category.split(/[-–—,/]/).forEach((c) => {
      const clean = c.trim();
      if (clean && !clean.toLowerCase().includes('movie')) set.add(clean);
    });
  }
  if (Array.isArray(tags)) {
    tags.forEach((t) => {
      const name = typeof t === 'string' ? t : t?.name || t?.tag;
      if (typeof name === 'string' && name.trim()) {
        const clean = name.trim();
        if (clean.length > 2 && clean.length < 25 && !clean.toLowerCase().includes('movie')) {
          set.add(clean);
        }
      }
    });
  }
  return [...set];
}

function normalizeCast(value?: string): string[] {
  if (!value) return [];
  return [...new Set(
    value
      .split(/[,|/]/)
      .map((name) => name.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim())
      .filter((name) => name.length >= 2 && name.length <= 80)
      .filter((name) => !/[a-z][A-Z]/.test(name))
  )];
}

const peopleCache = new Map<string, string | null>();

async function upsertActor(name: string) {
  const cacheKey = name.toLowerCase();
  if (peopleCache.has(cacheKey)) return peopleCache.get(cacheKey) || null;

  const { data: existing, error: findError } = await supabase
    .from('people')
    .select('id,source')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) {
    if (!existing.source) await supabase.from('people').update({ source: 'homitv' }).eq('id', existing.id);
    peopleCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const { data: id, error } = await supabase.rpc('upsert_person_by_name', {
    p_name: name,
    p_extra: { source: 'homitv' },
  });
  if (error) {
    console.warn(`Could not upsert actor "${name}":`, error.message);
    return null;
  }
  const personId = id as unknown as string;
  peopleCache.set(cacheKey, personId);
  return personId;
}

async function syncCast(filmId: string, cast: string[]) {
  for (const name of cast) {
    try {
      const personId = await upsertActor(name);
      if (!personId) continue;
      await supabase.from('credits').upsert(
        { film_id: filmId, person_id: personId, role: 'actor' },
        { onConflict: 'film_id,person_id,role' }
      );
    } catch (e: any) {
      console.warn(`Cast credit failed for "${name}":`, e.message);
    }
  }
}

async function fetchVideoDetails(slug: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}/videos/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen: '' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    return json?.response?.video_info || json?.data?.video_info || json?.data || null;
  } catch (err: any) {
    console.warn(`Fetch details for ${slug} failed:`, err.message);
    return null;
  }
}

async function backfillAllHomiTv() {
  console.log('🎬 Starting full backfill for HomiTV movies...');

  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, slug, year, runtime_minutes, nfvcb_rating, genres, streaming_links, poster_url, backdrop_url, synopsis')
    .or('source.eq.homitv,streaming_links->>homitv.not.is.null');

  if (error || !films) {
    console.error('Failed to fetch films:', error);
    return;
  }

  console.log(`Found ${films.length} HomiTV films in database to backfill.`);

  let updatedCount = 0;
  let failedCount = 0;

  for (const film of films) {
    // Extract slug from streaming_links.homitv or film.slug
    let homiSlug = '';
    const homiLink = film.streaming_links?.homitv || film.streaming_links?.homitv_info || '';
    if (homiLink) {
      const m = homiLink.match(/(?:watch|video)\/([^/?#]+)/);
      if (m) homiSlug = m[1];
    }
    if (!homiSlug && film.slug) {
      homiSlug = film.slug;
    }

    if (!homiSlug) {
      console.log(`⚠️ No slug found for "${film.title}" (${film.id})`);
      continue;
    }

    console.log(`\n🔍 Fetching details for "${film.title}" [slug: ${homiSlug}]...`);
    const details = await fetchVideoDetails(homiSlug);

    if (!details) {
      console.log(`  ❌ Could not get details for slug "${homiSlug}"`);
      failedCount++;
      continue;
    }

    const yearVal = details.published_on
      ? parseInt(String(details.published_on).replace(/\D/g, ''), 10) || null
      : null;
    const runtimeVal = parseRuntime(details.video_duration, details.video_duration_seconds);
    const ratingVal = normalizeNfvcbRating(details.video_rating);
    const genresVal = parseGenres(details.genre_name, details.video_category_name, details.tags);
    const castVal = normalizeCast(details.presenter);

    const mergedGenres = [...new Set([...(film.genres || []), ...genresVal])];

    const updates: Record<string, any> = {
      genres: mergedGenres.length > 0 ? mergedGenres : film.genres,
    };

    if (yearVal && (!film.year || film.year < 1900 || film.year > 2030)) {
      updates.year = yearVal;
    } else if (yearVal && !film.year) {
      updates.year = yearVal;
    }

    if (runtimeVal && !film.runtime_minutes) {
      updates.runtime_minutes = runtimeVal;
    }

    if (ratingVal && !film.nfvcb_rating) {
      updates.nfvcb_rating = ratingVal;
    }

    if (details.description && (!film.synopsis || film.synopsis.length < 20)) {
      updates.synopsis = details.description.trim();
    }

    if (details.poster_image && (!film.poster_url || film.poster_url.includes('placeholder'))) {
      updates.poster_url = details.poster_image;
    }

    if (details.thumbnail_image && (!film.backdrop_url || film.backdrop_url.includes('placeholder'))) {
      updates.backdrop_url = details.thumbnail_image;
    }

    console.log(`  📝 Updates for "${film.title}":`, {
      year: updates.year ?? film.year,
      runtime_minutes: updates.runtime_minutes ?? film.runtime_minutes,
      nfvcb_rating: updates.nfvcb_rating ?? film.nfvcb_rating,
      genres: updates.genres,
      castCount: castVal.length,
    });

    const { error: updateErr } = await supabase
      .from('films')
      .update(updates)
      .eq('id', film.id);

    if (updateErr) {
      console.error(`  ❌ Failed to update film ${film.id}:`, updateErr.message);
      failedCount++;
    } else {
      updatedCount++;
      if (castVal.length > 0) {
        await syncCast(film.id, castVal);
      }
    }

    // Brief pause to be respectful to API
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n🎉 Backfill complete!`);
  console.log(`   - Updated: ${updatedCount}`);
  console.log(`   - Failed / Skipped: ${failedCount}`);
}

backfillAllHomiTv().catch(console.error);
