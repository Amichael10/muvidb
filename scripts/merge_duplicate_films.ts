/**
 * Production Nollywood Movie Deduplication & Intelligent Merge Runner
 * 
 * Rules Enforced:
 * 1. Primary Preference: Portrait posters (TMDB / Cloudinary / direct upload) + fullest cast/crew ensemble.
 * 2. Protected Series: NEVER merge series from FAAN, SAAMU ALAJO, DAMILOLA BAMIGBOYE, MOUNT ZION, UCHE NANCY.
 * 3. Raw Video Guard: If linked YouTube titles indicate different episodes, seasons, parts, dates, or subtitles, DO NOT MERGE!
 * 4. Zero-Duplicate Actor Guarantee: An actor has only 1 credit row per movie (character name enriched).
 * 5. Complete Foreign Key Reassignment: pending_cinema_films, film_companies, film_genres, channel_videos, etc.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import dns from 'dns';
import { setGlobalDispatcher, Agent } from 'undici';
import { parseTitleMetadata } from '../src/utils/titleCleaner.js';
import { isProtectedSeries, isPortraitPoster } from '../src/lib/deduplicator.js';

// Enforce IPv4 and set robust HTTP timeouts for Supabase connections
dns.setDefaultResultOrder('ipv4first');
setGlobalDispatcher(
  new Agent({
    connect: {
      timeout: 60000,
    },
    headersTimeout: 60000,
    bodyTimeout: 60000,
  })
);

dotenv.config({ path: '.env.local' });
if (!process.env.VITE_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase configuration missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

interface FilmRecord {
  id: string;
  title: string;
  original_title?: string | null;
  slug?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  synopsis?: string | null;
  year?: number | null;
  release_date?: string | null;
  runtime_minutes?: number | null;
  tmdb_id?: number | null;
  tmdb_rating?: number | null;
  mubi_id?: number | null;
  source_video_id?: string | null;
  youtube_watch_url?: string | null;
  content_type?: string | null;
  series_id?: string | null;
  season_number?: number | null;
  episode_number?: number | null;
  streaming_links?: Record<string, any> | null;
  is_published?: boolean;
  view_count?: number;
  created_at?: string;
}

function scoreFilmForPrimary(f: FilmRecord, creditsCount: number): number {
  let score = 0;

  // 1. Portrait Poster priority (highest weight)
  if (f.poster_url) {
    if (isPortraitPoster(f.poster_url)) {
      score += 10000; // Real portrait poster art (TMDB / Cloudinary / direct upload)
    } else {
      score += 1000;  // Landscape YouTube thumbnail
    }
  }

  // 2. Full ensemble priority (second highest weight)
  score += creditsCount * 100;

  // 3. Official External IDs
  if (f.tmdb_id) score += 500;
  if (f.mubi_id) score += 250;

  // 4. Metadata completeness
  if (f.synopsis && f.synopsis.length > 30) score += 200;
  if (f.backdrop_url && isPortraitPoster(f.backdrop_url)) score += 100;
  if (f.runtime_minutes && f.runtime_minutes > 0) score += 100;
  if (f.year) score += 50;
  if (f.release_date) score += 50;
  if (f.is_published) score += 20;

  return score;
}

function normalizeTitleKey(rawTitle: string): { key: string; isSeries: boolean; partNumber: number | null } {
  if (!rawTitle) return { key: '', isSeries: false, partNumber: null };

  const parsed = parseTitleMetadata(rawTitle);
  if (parsed.content_type === 'series' || isProtectedSeries(parsed)) {
    return { key: '', isSeries: true, partNumber: null };
  }

  let t = (parsed.title || rawTitle).toLowerCase().trim();

  // Normalize punctuation and extra spaces
  t = t.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    key: t,
    isSeries: false,
    partNumber: parsed.part_number,
  };
}

async function loadProtectedChannelIds(): Promise<Set<string>> {
  const { data } = await supabase.from('channels').select('id, name');
  const set = new Set<string>();
  for (const c of data || []) {
    if (/faan|akindele|saamu|alajo|odunlade|adekola|damilola|mike[- ]bamiloye|bamiloye|mount zion|uche nancy|sceneone/i.test(c.name)) {
      set.add(c.id);
    }
  }
  return set;
}

async function loadAllFilms(): Promise<FilmRecord[]> {
  console.log('📥 Loading all films from database...');
  const allFilms: FilmRecord[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, original_title, slug, poster_url, backdrop_url, synopsis, year, release_date, runtime_minutes, tmdb_id, tmdb_rating, mubi_id, source_video_id, youtube_watch_url, content_type, series_id, season_number, episode_number, streaming_links, is_published, view_count, created_at')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error loading films page:', error.message);
      break;
    }

    if (!data || data.length === 0) break;
    allFilms.push(...data);
    process.stdout.write(`  Loaded ${allFilms.length} films...`);

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`\n✅ Finished loading ${allFilms.length} total film records.\n`);
  return allFilms;
}

async function getCreditCounts(filmIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!filmIds.length) return map;

  for (let i = 0; i < filmIds.length; i += 100) {
    const batch = filmIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from('credits')
      .select('film_id, person_id, role')
      .in('film_id', batch);

    if (error) {
      console.error('Error fetching credits batch:', error.message);
      continue;
    }

    for (const c of data || []) {
      const current = map.get(c.film_id) || 0;
      map.set(c.film_id, current + 1);
    }
  }

  return map;
}

async function mergeFilmGroup(
  primary: FilmRecord,
  duplicates: FilmRecord[],
  creditsMap: Map<string, number>
): Promise<{ success: boolean; error?: string }> {
  const dupeIds = duplicates.map(d => d.id);

  try {
    // 1. Prepare survivor metadata enrichment
    const survivorUpdates: Record<string, any> = {};

    // A. Portrait Poster: Ensure primary gets the best portrait poster
    const primaryIsPortrait = isPortraitPoster(primary.poster_url);
    if (!primaryIsPortrait) {
      const withPortrait = duplicates.find(d => isPortraitPoster(d.poster_url));
      if (withPortrait?.poster_url) {
        survivorUpdates.poster_url = withPortrait.poster_url;
      } else if (!primary.poster_url) {
        const withAnyPoster = duplicates.find(d => d.poster_url);
        if (withAnyPoster?.poster_url) survivorUpdates.poster_url = withAnyPoster.poster_url;
      }
    }

    // B. Backdrop
    if (!primary.backdrop_url) {
      const withBackdrop = duplicates.find(d => d.backdrop_url);
      if (withBackdrop?.backdrop_url) survivorUpdates.backdrop_url = withBackdrop.backdrop_url;
    }

    // C. Synopsis
    if (!primary.synopsis || primary.synopsis.length < 30) {
      const withSynopsis = duplicates.find(d => d.synopsis && d.synopsis.length > 30);
      if (withSynopsis?.synopsis) survivorUpdates.synopsis = withSynopsis.synopsis;
    }

    // D. TMDB / MUBI
    if (!primary.tmdb_id) {
      const withTmdb = duplicates.find(d => d.tmdb_id);
      if (withTmdb?.tmdb_id) survivorUpdates.tmdb_id = withTmdb.tmdb_id;
    }
    if (!primary.mubi_id) {
      const withMubi = duplicates.find(d => d.mubi_id);
      if (withMubi?.mubi_id) survivorUpdates.mubi_id = withMubi.mubi_id;
    }

    // E. Runtime
    if (!primary.runtime_minutes) {
      const withRuntime = duplicates.find(d => d.runtime_minutes);
      if (withRuntime?.runtime_minutes) survivorUpdates.runtime_minutes = withRuntime.runtime_minutes;
    }

    // F. Streaming links
    const mergedLinks = { ...(primary.streaming_links || {}) };
    for (const d of duplicates) {
      if (d.streaming_links) Object.assign(mergedLinks, d.streaming_links);
    }
    if (Object.keys(mergedLinks).length > 0) {
      survivorUpdates.streaming_links = mergedLinks;
    }

    // G. Source video ID (if primary lacks one)
    if (!primary.source_video_id) {
      const withVid = duplicates.find(d => d.source_video_id);
      if (withVid?.source_video_id) survivorUpdates.source_video_id = withVid.source_video_id;
    }

    // Apply survivor updates
    if (Object.keys(survivorUpdates).length > 0) {
      const { error: updateErr } = await supabase
        .from('films')
        .update(survivorUpdates)
        .eq('id', primary.id);
      if (updateErr) {
        console.error(`  Warning updating primary ${primary.id}:`, updateErr.message);
      }
    }

    // 2. Reconcile Credits (Zero-Duplicate Actor Guarantee)
    const { data: primaryCredits } = await supabase
      .from('credits')
      .select('id, person_id, role, character_name, billing_order')
      .eq('film_id', primary.id);

    const primaryPeople = new Map<string, any>();
    for (const pc of primaryCredits || []) {
      primaryPeople.set(pc.person_id, pc);
    }

    const { data: dupeCredits } = await supabase
      .from('credits')
      .select('id, film_id, person_id, role, character_name, billing_order')
      .in('film_id', dupeIds);

    for (const dc of dupeCredits || []) {
      const existing = primaryPeople.get(dc.person_id);
      if (existing) {
        // Person already credited on primary. Enrich character name if missing
        if (!existing.character_name && dc.character_name) {
          await supabase.from('credits').update({ character_name: dc.character_name }).eq('id', existing.id);
          existing.character_name = dc.character_name;
        }
        // Delete redundant credit on duplicate
        await supabase.from('credits').delete().eq('id', dc.id);
      } else {
        // Move credit to primary
        const { error: moveErr } = await supabase.from('credits').update({ film_id: primary.id }).eq('id', dc.id);
        if (!moveErr) {
          primaryPeople.set(dc.person_id, dc);
        } else {
          await supabase.from('credits').delete().eq('id', dc.id);
        }
      }
    }

    // 3. Reassign child tables
    await supabase.from('channel_videos').update({ film_id: primary.id }).in('film_id', dupeIds);
    await supabase.from('film_watch_links').update({ film_id: primary.id }).in('film_id', dupeIds);
    await supabase.from('reviews').update({ film_id: primary.id }).in('film_id', dupeIds);
    await supabase.from('watchlist').update({ film_id: primary.id }).in('film_id', dupeIds);
    await supabase.from('platform_new_releases').update({ film_id: primary.id }).in('film_id', dupeIds);
    await supabase.from('top_10_films').update({ film_id: primary.id }).in('film_id', dupeIds);
    await supabase.from('trailer_review_queue').update({ film_id: primary.id }).in('film_id', dupeIds);
    await supabase.from('pending_cinema_films').update({ promoted_film_id: primary.id }).in('promoted_film_id', dupeIds);
    await supabase.from('credit_candidates').update({ film_id: primary.id }).in('film_id', dupeIds);
    await supabase.from('showtimes').update({ film_id: primary.id }).in('film_id', dupeIds);
    await supabase.from('collection_films').update({ film_id: primary.id }).in('film_id', dupeIds);

    // Film companies: delete conflicts if company already credited on primary, otherwise update
    const { data: primaryComps } = await supabase.from('film_companies').select('company_id, role').eq('film_id', primary.id);
    const existingCompKeys = new Set((primaryComps || []).map(c => `${c.company_id}_${c.role}`));
    const { data: dupeComps } = await supabase.from('film_companies').select('id, company_id, role').in('film_id', dupeIds);
    for (const dc of dupeComps || []) {
      const key = `${dc.company_id}_${dc.role}`;
      if (existingCompKeys.has(key)) {
        await supabase.from('film_companies').delete().eq('id', dc.id);
      } else {
        await supabase.from('film_companies').update({ film_id: primary.id }).eq('id', dc.id);
        existingCompKeys.add(key);
      }
    }

    // Film genres: delete conflicts if genre already exists on primary, otherwise update
    const { data: primaryGenres } = await supabase.from('film_genres').select('genre_id').eq('film_id', primary.id);
    const existingGenres = new Set((primaryGenres || []).map(g => g.genre_id));
    const { data: dupeGenres } = await supabase.from('film_genres').select('id, genre_id').in('film_id', dupeIds);
    for (const dg of dupeGenres || []) {
      if (existingGenres.has(dg.genre_id)) {
        await supabase.from('film_genres').delete().eq('id', dg.id);
      } else {
        await supabase.from('film_genres').update({ film_id: primary.id }).eq('id', dg.id);
        existingGenres.add(dg.genre_id);
      }
    }

    // Clear unique constraints on duplicate films before deletion
    await supabase.from('films').update({
      source_video_id: null,
      tmdb_id: null,
      mubi_id: null,
    }).in('id', dupeIds);

    // 4. Delete duplicate films
    const { error: delErr } = await supabase.from('films').delete().in('id', dupeIds);
    if (delErr) {
      return { success: false, error: delErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

async function runDeduplicator() {
  console.log('====================================================');
  console.log('       🎬 NOLlYWOOD MOVIE DEDUPLICATOR & MERGER      ');
  console.log('====================================================\n');

  const protectedChannelIds = await loadProtectedChannelIds();
  console.log(`🛡️  Loaded ${protectedChannelIds.size} protected creator channels (FAAN, Saamu Alajo, Mount Zion, Uche Nancy).\n`);

  const allFilms = await loadAllFilms();

  // 1. Group by normalized title + year
  const candidateGroups = new Map<string, FilmRecord[]>();
  let seriesSkippedCount = 0;

  for (const f of allFilms) {
    // Check if this is a series or protected series
    if (isProtectedSeries(f) || f.content_type === 'series' || f.season_number != null || f.episode_number != null || f.series_id != null) {
      seriesSkippedCount++;
      continue;
    }

    const { key, isSeries } = normalizeTitleKey(f.title);
    if (isSeries || !key) {
      seriesSkippedCount++;
      continue;
    }

    // Year key: if year is known, group by title + year; if year is null, group by title
    const yearKey = f.year ? String(f.year) : 'unknown';
    const groupKey = `${key}__y${yearKey}`;

    if (!candidateGroups.has(groupKey)) {
      candidateGroups.set(groupKey, []);
    }
    candidateGroups.get(groupKey)!.push(f);
  }

  console.log(`🛡️  Series skipped from movie deduplication: ${seriesSkippedCount}`);

  // Filter groups with > 1 member
  const duplicateGroups = [...candidateGroups.entries()].filter(([, members]) => members.length > 1);
  console.log(`🎯 Identified ${duplicateGroups.length} candidate duplicate movie groups for verification & merging.\n`);

  if (duplicateGroups.length === 0) {
    console.log('✨ No duplicate movies found in the database! Everything is clean.');
    return;
  }

  // Collect all film IDs in duplicate groups to fetch credit counts
  const allDuplicateFilmIds = duplicateGroups.flatMap(([, members]) => members.map(m => m.id));
  console.log(`📊 Fetching ensemble credits for ${allDuplicateFilmIds.length} candidate films...`);
  const creditsMap = await getCreditCounts(allDuplicateFilmIds);
  console.log(`✅ Loaded credits for candidate records.\n`);

  let groupsMerged = 0;
  let filmsRemoved = 0;
  let groupsProtected = 0;
  let errorsCount = 0;

  for (let idx = 0; idx < duplicateGroups.length; idx++) {
    const [groupKey, members] = duplicateGroups[idx];
    const groupFilmIds = members.map(m => m.id);

    // Fetch linked channel_videos to perform raw YouTube title divergence verification
    const { data: vids } = await supabase
      .from('channel_videos')
      .select('id, video_id, title, channel_id, film_id')
      .in('film_id', groupFilmIds);

    // A. Protected Channel Check
    const fromProtectedChannel = (vids || []).some(v => protectedChannelIds.has(v.channel_id));
    if (fromProtectedChannel) {
      console.log(`[${idx + 1}/${duplicateGroups.length}] 🛡️  Skipping group "${members[0].title}": belongs to protected creator channel.`);
      groupsProtected++;
      continue;
    }

    // B. Raw Video Divergence Check
    if (vids && vids.length > 1) {
      const uniqueVideoIds = new Set(vids.map(v => v.video_id));
      if (uniqueVideoIds.size > 1) {
        let isDivergent = false;
        let divergenceReason = '';

        const parsedVids = vids.map(v => ({ v, p: parseTitleMetadata(v.title) }));

        // Check if any video has episodic series signals
        const hasSeries = parsedVids.some(pv => pv.p.content_type === 'series' || pv.p.season_number != null || pv.p.episode_number != null);
        if (hasSeries) {
          isDivergent = true;
          divergenceReason = 'Raw video title indicates episodic series';
        }

        // Check if different parts (e.g. Part 1 vs Part 2)
        const parts = new Set(parsedVids.map(pv => pv.p.part_number).filter(Boolean));
        if (parts.size > 1) {
          isDivergent = true;
          divergenceReason = `Raw video titles indicate different parts (${[...parts].join(', ')})`;
        }

        // Check if different dates / months (e.g. June vs July)
        const monthRegex = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
        const months = new Set(vids.map(v => {
          const m = v.title.match(monthRegex);
          return m ? m[0].toLowerCase() : null;
        }).filter(Boolean));
        if (months.size > 1) {
          isDivergent = true;
          divergenceReason = `Raw video titles indicate different monthly events (${[...months].join(', ')})`;
        }

        // Check if cleaned video titles differ
        const cleanTitles = new Set(parsedVids.map(pv => pv.p.title.toLowerCase().trim()));
        if (cleanTitles.size > 1) {
          isDivergent = true;
          divergenceReason = `Cleaned video titles differ (${[...cleanTitles].slice(0, 2).join(' vs ')})`;
        }

        if (isDivergent) {
          console.log(`[${idx + 1}/${duplicateGroups.length}] 🛡️  Skipping group "${members[0].title}": ${divergenceReason}. Updating films to series/distinct titles.`);
          for (const pv of parsedVids) {
            await supabase.from('films').update({
              title: pv.p.title,
              content_type: pv.p.content_type,
              season_number: pv.p.season_number,
              episode_number: pv.p.episode_number,
            }).eq('id', pv.v.film_id);
          }
          groupsProtected++;
          continue;
        }
      }
    }

    console.log(`\n[${idx + 1}/${duplicateGroups.length}] Group: "${members[0].title}" (${members.length} records)`);

    // Score and rank members
    const scoredMembers = members.map(f => {
      const crCount = creditsMap.get(f.id) || 0;
      const score = scoreFilmForPrimary(f, crCount);
      const isPortrait = isPortraitPoster(f.poster_url);
      return { film: f, score, creditsCount: crCount, isPortrait };
    });

    scoredMembers.sort((a, b) => b.score - a.score);

    const primaryWinner = scoredMembers[0];
    const duplicateList = scoredMembers.slice(1).map(s => s.film);

    console.log(`  ⭐ Primary Selected: [${primaryWinner.film.id}]`);
    console.log(`     Title: "${primaryWinner.film.title}"`);
    console.log(`     Poster: ${primaryWinner.isPortrait ? '🖼️ PORTRAIT' : primaryWinner.film.poster_url ? '🌄 Landscape YT' : '❌ None'} (${primaryWinner.film.poster_url?.slice(0, 60) || 'none'})`);
    console.log(`     Ensemble: 🎭 ${primaryWinner.creditsCount} cast/crew members`);
    console.log(`     Score: ${primaryWinner.score} | TMDB: ${primaryWinner.film.tmdb_id || 'none'}`);

    for (const d of scoredMembers.slice(1)) {
      console.log(`  ❌ Duplicate: [${d.film.id}] "${d.film.title}" (Poster: ${d.isPortrait ? 'Portrait' : d.film.poster_url ? 'Landscape' : 'None'}, Ensemble: ${d.creditsCount}, Score: ${d.score})`);
    }

    const mergeResult = await mergeFilmGroup(primaryWinner.film, duplicateList, creditsMap);
    if (mergeResult.success) {
      console.log(`  ✅ Successfully merged ${duplicateList.length} duplicate(s) into primary!`);
      groupsMerged++;
      filmsRemoved += duplicateList.length;
    } else {
      console.error(`  ❌ Failed to merge group: ${mergeResult.error}`);
      errorsCount++;
    }
  }

  console.log('\n====================================================');
  console.log('              🎉 DEDUPLICATION COMPLETE             ');
  console.log('====================================================');
  console.log(`  Groups Successfully Merged: ${groupsMerged}`);
  console.log(`  Duplicate Films Removed: ${filmsRemoved}`);
  console.log(`  Groups Protected / Skipped as Series: ${groupsProtected}`);
  console.log(`  Errors: ${errorsCount}`);

  const { count: finalCount } = await supabase.from('films').select('*', { count: 'exact', head: true });
  console.log(`  Total Remaining Films in Database: ${finalCount}\n`);
}

runDeduplicator().catch(console.error);
