import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

interface FilmRecord {
  id: string;
  title: string;
  original_title: string | null;
  year: number | null;
  release_type: string | null;
  source: string | null;
  box_office_domestic: number | null;
  box_office_worldwide: number | null;
  box_office_source: string | null;
  is_in_cinemas: boolean | null;
  view_count: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  synopsis: string | null;
  tmdb_id: number | null;
  trailer_youtube_id: string | null;
  youtube_watch_url: string | null;
  credit_count?: number;
}

function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics for grouping
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function extractYoutubeId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function scoreFilm(f: FilmRecord, creditCount: number = 0): number {
  let score = 0;
  // Box office has highest priority
  if (Number(f.box_office_domestic) > 0 || Number(f.box_office_worldwide) > 0) score += 50000;
  if (f.box_office_source) score += 10000;
  if (f.is_in_cinemas) score += 10000;

  // Release type hierarchy
  const rel = (f.release_type || '').toLowerCase();
  if (rel === 'cinema' || rel === 'theatrical') score += 25000;
  else if (rel === 'netflix') score += 15000;
  else if (rel === 'prime' || rel === 'prime_video') score += 12000;
  else if (rel === 'kava' || rel === 'ebonylife') score += 10000;
  else if (rel === 'iroko' || rel === 'afrolandtv') score += 8000;
  else if (rel === 'youtube') score += 1000;

  // Credit count
  if (creditCount > 0) score += Math.min(10000, creditCount * 200);

  // Richness of metadata
  if (f.poster_url && !f.poster_url.includes('placeholder')) score += 1500;
  if (f.backdrop_url) score += 500;
  if (f.synopsis && f.synopsis.length > 50) score += 1500;
  if (f.tmdb_id) score += 2000;
  if (f.year) score += 1000;

  // If title has proper accents/diacritics (e.g. Aníkúlápó)
  if (/[áàéèíìóòúù]/i.test(f.title)) score += 500;

  return score;
}

async function mergeFilmCluster(
  primary: FilmRecord,
  duplicates: FilmRecord[],
  dryRun = false
) {
  console.log(`\n======================================================`);
  console.log(`🎯 Merging cluster into Primary: [${primary.id}] "${primary.title}" (${primary.year || 'N/A'}) [rel: ${primary.release_type}, src: ${primary.source}, bo: ${primary.box_office_domestic}]`);
  console.log(`   Duplicates to absorb: ${duplicates.length}`);
  duplicates.forEach(d => {
    console.log(`     - [${d.id}] "${d.title}" (${d.year || 'N/A'}) [rel: ${d.release_type}, src: ${d.source}]`);
  });

  if (dryRun) return;

  const isPrimaryCinema = Boolean(
    primary.release_type === 'cinema' ||
    primary.release_type === 'theatrical' ||
    Number(primary.box_office_domestic) > 0 ||
    primary.box_office_source ||
    primary.is_in_cinemas
  );

  // Fetch all existing credits for Primary
  const { data: primaryCredits } = await supabase
    .from('credits')
    .select('id, person_id, role, character_name, billing_order')
    .eq('film_id', primary.id);

  const primaryPersonCreditMap = new Map<string, any>();
  primaryCredits?.forEach(c => {
    if (c.person_id) {
      // Keep best role/billing if multiple already exist on primary
      if (!primaryPersonCreditMap.has(c.person_id)) {
        primaryPersonCreditMap.set(c.person_id, c);
      }
    }
  });

  for (const dup of duplicates) {
    // 1. Process Credits for dup in batch
    const { data: dupCredits } = await supabase
      .from('credits')
      .select('id, person_id, role, character_name, billing_order')
      .eq('film_id', dup.id);

    if (dupCredits && dupCredits.length > 0) {
      const toRelinkIds: string[] = [];
      const toDeleteDupIds: string[] = [];

      for (const dc of dupCredits) {
        if (!dc.person_id) {
          toRelinkIds.push(dc.id);
          continue;
        }

        const existingPrimaryCredit = primaryPersonCreditMap.get(dc.person_id);
        if (existingPrimaryCredit) {
          // Zero Duplicate Actor Guarantee: Person is already credited on Primary!
          // Merge missing details into Primary credit
          const updates: any = {};
          if (!existingPrimaryCredit.character_name && dc.character_name) {
            updates.character_name = dc.character_name;
            existingPrimaryCredit.character_name = dc.character_name;
          }
          if ((!existingPrimaryCredit.role || existingPrimaryCredit.role === 'cast') && dc.role && dc.role !== 'cast') {
            updates.role = dc.role;
            existingPrimaryCredit.role = dc.role;
          }
          if ((existingPrimaryCredit.billing_order == null || existingPrimaryCredit.billing_order > 50) && dc.billing_order != null) {
            updates.billing_order = dc.billing_order;
            existingPrimaryCredit.billing_order = dc.billing_order;
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from('credits').update(updates).eq('id', existingPrimaryCredit.id);
          }
          toDeleteDupIds.push(dc.id);
        } else {
          // New person credit for primary! Re-link to primary
          toRelinkIds.push(dc.id);
          primaryPersonCreditMap.set(dc.person_id, dc);
        }
      }

      if (toRelinkIds.length > 0) {
        await supabase.from('credits').update({ film_id: primary.id }).in('id', toRelinkIds);
      }
      if (toDeleteDupIds.length > 0) {
        await supabase.from('credits').delete().in('id', toDeleteDupIds);
      }
    }

    // 2. Film Companies
    const { data: dupCompanies } = await supabase
      .from('film_companies')
      .select('id, company_id, role')
      .eq('film_id', dup.id);
    if (dupCompanies && dupCompanies.length > 0) {
      const { data: primCompanies } = await supabase
        .from('film_companies')
        .select('company_id')
        .eq('film_id', primary.id);
      const primCompIds = new Set(primCompanies?.map(c => c.company_id) || []);
      const toDeleteCompIds: string[] = [];
      const toRelinkCompIds: string[] = [];
      for (const fc of dupCompanies) {
        if (primCompIds.has(fc.company_id)) {
          toDeleteCompIds.push(fc.id);
        } else {
          toRelinkCompIds.push(fc.id);
          primCompIds.add(fc.company_id);
        }
      }
      if (toDeleteCompIds.length > 0) await supabase.from('film_companies').delete().in('id', toDeleteCompIds);
      if (toRelinkCompIds.length > 0) await supabase.from('film_companies').update({ film_id: primary.id }).in('id', toRelinkCompIds);
    }

    // 3. Film Genres
    const { data: dupGenres } = await supabase
      .from('film_genres')
      .select('id, genre_id')
      .eq('film_id', dup.id);
    if (dupGenres && dupGenres.length > 0) {
      const { data: primGenres } = await supabase
        .from('film_genres')
        .select('genre_id')
        .eq('film_id', primary.id);
      const primGenIds = new Set(primGenres?.map(g => g.genre_id) || []);
      for (const fg of dupGenres) {
        if (primGenIds.has(fg.genre_id)) {
          await supabase.from('film_genres').delete().eq('id', fg.id);
        } else {
          await supabase.from('film_genres').update({ film_id: primary.id }).eq('id', fg.id);
          primGenIds.add(fg.genre_id);
        }
      }
    }

    // 4. Other Relations: Reviews, Watchlist, Favorites, Series Episodes, etc.
    await supabase.from('reviews').update({ film_id: primary.id }).eq('film_id', dup.id);
    await supabase.from('comments').update({ film_id: primary.id }).eq('film_id', dup.id);
    await supabase.from('showtimes').update({ film_id: primary.id }).eq('film_id', dup.id);
    await supabase.from('social_content_items').update({ film_id: primary.id }).eq('film_id', dup.id);
    await supabase.from('screenplay_analyses').update({ film_id: primary.id }).eq('film_id', dup.id);
    await supabase.from('films').update({ series_id: primary.id }).eq('series_id', dup.id);
    await supabase.from('pending_cinema_films').update({ promoted_film_id: primary.id }).eq('promoted_film_id', dup.id);

    // Watchlist & Favorites (delete duplicates if unique constraint)
    const { data: dupWatchlist } = await supabase.from('watchlist').select('id, user_id').eq('film_id', dup.id);
    for (const w of (dupWatchlist || [])) {
      const { error: wErr } = await supabase.from('watchlist').update({ film_id: primary.id }).eq('id', w.id);
      if (wErr) await supabase.from('watchlist').delete().eq('id', w.id);
    }
    const { data: dupFavs } = await supabase.from('user_favorites').select('id, user_id').eq('film_id', dup.id);
    for (const f of (dupFavs || [])) {
      const { error: fErr } = await supabase.from('user_favorites').update({ film_id: primary.id }).eq('id', f.id);
      if (fErr) await supabase.from('user_favorites').delete().eq('id', f.id);
    }

    // 5. Channel videos relation:
    if (isPrimaryCinema) {
      // If primary is cinema, do not let aggregator YouTube video pretend to be this movie
      await supabase.from('channel_videos').update({ film_id: null }).eq('film_id', dup.id);
    } else {
      await supabase.from('channel_videos').update({ film_id: primary.id }).eq('film_id', dup.id);
    }

    // 6. Enrich primary film metadata if primary lacks fields
    const enrichUpdates: any = {};
    if (!primary.poster_url && dup.poster_url) enrichUpdates.poster_url = dup.poster_url;
    if (!primary.backdrop_url && dup.backdrop_url) enrichUpdates.backdrop_url = dup.backdrop_url;
    if ((!primary.synopsis || primary.synopsis.length < 50) && dup.synopsis && dup.synopsis.length > 50) {
      enrichUpdates.synopsis = dup.synopsis;
    }
    if (!primary.tmdb_id && dup.tmdb_id) enrichUpdates.tmdb_id = dup.tmdb_id;
    if (!primary.year && dup.year) enrichUpdates.year = dup.year;
    if (!primary.trailer_youtube_id && dup.trailer_youtube_id) enrichUpdates.trailer_youtube_id = dup.trailer_youtube_id;
    if (!isPrimaryCinema && (primary.view_count || 0) < (dup.view_count || 0)) {
      enrichUpdates.view_count = dup.view_count;
    }
    if (Object.keys(enrichUpdates).length > 0) {
      await supabase.from('films').update(enrichUpdates).eq('id', primary.id);
    }

    // 7. Finally, safely delete the duplicate film record
    const { error: delFilmErr } = await supabase.from('films').delete().eq('id', dup.id);
    if (delFilmErr) {
      console.error(`❌ Failed to delete duplicate film [${dup.id}]:`, delFilmErr.message);
    } else {
      console.log(`✅ Deleted duplicate film row [${dup.id}]`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targetTitle = args.find(a => !a.startsWith('--'));
  const isDryRun = args.includes('--dry-run');

  console.log(`Starting film deduplication... ${isDryRun ? '(DRY RUN)' : '(LIVE EXECUTION)'}`);
  if (targetTitle) console.log(`Targeting title filter: "${targetTitle}"`);

  // Fetch all films
  let allFilms: FilmRecord[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabase
      .from('films')
      .select('id, title, original_title, year, release_type, source, box_office_domestic, box_office_worldwide, box_office_source, is_in_cinemas, view_count, poster_url, backdrop_url, synopsis, tmdb_id, trailer_youtube_id, youtube_watch_url')
      .order('created_at', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (targetTitle) {
      query = query.ilike('title', `%${targetTitle}%`);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) break;
    allFilms = allFilms.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Loaded ${allFilms.length} films.`);

  // Group by normalized title
  const groups: Record<string, FilmRecord[]> = {};
  for (const f of allFilms) {
    const norm = normalizeTitle(f.title);
    if (!norm || norm.length < 2) continue;
    if (!groups[norm]) groups[norm] = [];
    groups[norm].push(f);
  }

  const clustersToMerge: { primary: FilmRecord; duplicates: FilmRecord[] }[] = [];

  for (const [norm, filmList] of Object.entries(groups)) {
    if (filmList.length < 2) continue;

    // Sub-cluster by compatible year: films within 1 year of each other or where year is null
    // (e.g. 2016 and 2017 for festival/cinema vs streaming)
    // Or if all films in the group share the exact same title string
    const subClusters: FilmRecord[][] = [];

    for (const film of filmList) {
      let placed = false;
      for (const cluster of subClusters) {
        const rep = cluster[0];

        // 1. Strict protection for pre-2015 classics (e.g. Living in Bondage 1992 vs 2019):
        // If either film is from before 2015, only merge if years match EXACTLY!
        if ((film.year != null && film.year < 2015) || (rep.year != null && rep.year < 2015)) {
          if (film.year !== rep.year) continue;
        }

        // 2. Year compatibility: if both years are present, max difference is 1 year
        if (film.year != null && rep.year != null) {
          if (Math.abs(film.year - rep.year) > 1) continue;
        }

        // 3. YouTube separate productions safeguard:
        // If both films have distinct YouTube video IDs, they are DIFFERENT channel uploads / movies!
        const filmVid = film.source_video_id || extractYoutubeId(film.youtube_watch_url);
        const repVid = rep.source_video_id || extractYoutubeId(rep.youtube_watch_url);
        if (filmVid && repVid && filmVid !== repVid) {
          continue; // Different YouTube videos from different production companies / channels!
        }

        // 4. Cinema / theatrical protection:
        const isFilmCinema = film.release_type === 'cinema' || film.release_type === 'theatrical' || Number(film.box_office_domestic) > 0;
        const isRepCinema = rep.release_type === 'cinema' || rep.release_type === 'theatrical' || Number(rep.box_office_domestic) > 0;
        if (isFilmCinema && film.release_type === 'youtube') continue;
        if (isRepCinema && rep.release_type === 'youtube') continue;

        cluster.push(film);
        placed = true;
        break;
      }
      if (!placed) {
        subClusters.push([film]);
      }
    }

    for (const cluster of subClusters) {
      if (cluster.length < 2) continue;

      // Score and sort descending
      const scored = cluster.map(f => ({
        film: f,
        score: scoreFilm(f)
      })).sort((a, b) => b.score - a.score);

      const primary = scored[0].film;
      const duplicates = scored.slice(1).map(s => s.film);

      clustersToMerge.push({ primary, duplicates });
    }
  }

  console.log(`Identified ${clustersToMerge.length} duplicate clusters to merge.`);

  for (const { primary, duplicates } of clustersToMerge) {
    await mergeFilmCluster(primary, duplicates, isDryRun);
  }

  console.log(`\n🎉 Completed merge of ${clustersToMerge.length} film clusters!`);
}

main().catch(console.error);
