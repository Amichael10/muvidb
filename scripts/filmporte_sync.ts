import { cleanTitle } from '../api/_lib/yt_service.js';
import { supabase } from './lib/db';
import { startSyncLog, type SyncCounters } from './lib/sync';

const API_BASE = 'https://api.filmporte.com/api/v1';
const ASSETS_BASE = 'https://assets.filmporte.com';
const WEB_BASE = 'https://films.filmporte.com';
const DRY_RUN = process.argv.includes('--dry-run');

type FilmporteCredit = {
  id: string;
  role: string;
  name: string;
  characterName: string | null;
  position: number;
  image?: {
    url?: string;
  } | null;
};

type FilmporteMediaAttachment = {
  id: string;
  role: string;
  image?: {
    url?: string;
  } | null;
  video?: {
    platform?: string;
    metadata?: {
      playbackIds?: Array<{ id: string; policy: string }>;
    };
  } | null;
};

type FilmporteContentDetail = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  slug: string;
  primaryGenre?: string[];
  secondaryGenres?: string[];
  status: string;
  createdAt: string;
  movie?: {
    releaseDate?: string;
    endDate?: string;
    status?: string;
  };
  credits?: FilmporteCredit[];
  mediaAttachments?: FilmporteMediaAttachment[];
};

function normalizeRole(role: string): string {
  const r = role.toUpperCase().trim();
  if (r === 'CAST' || r === 'ACTOR') return 'actor';
  if (r === 'DIRECTED_BY' || r === 'DIRECTOR') return 'director';
  if (r === 'PRODUCED_BY' || r === 'PRODUCER') return 'producer';
  if (r === 'WRITTEN_BY' || r === 'WRITER' || r === 'SCREENPLAY') return 'writer';
  if (r === 'EXECUTIVE_PRODUCER') return 'executive_producer';
  if (r === 'CINEMATOGRAPHER' || r === 'DOP') return 'cinematographer';
  return r.toLowerCase().replace(/_/g, ' ');
}

function normalizeGenres(primary?: string[], secondary?: string[]): string[] {
  const all = [...(primary || []), ...(secondary || [])];
  const set = new Set<string>();
  for (const g of all) {
    if (!g) continue;
    const trimmed = g.trim();
    if (trimmed.length >= 2) {
      set.add(trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase());
    }
  }
  return Array.from(set);
}

function mergeGenres(existing: string[] | null | undefined, incoming: string[]): string[] {
  return [...new Set([...(existing || []), ...incoming])];
}

async function findFilm(title: string, slug?: string) {
  if (slug) {
    const { data: bySlug } = await supabase
      .from('films')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (bySlug) return bySlug;
  }

  const cleaned = cleanTitle(title).trim();
  const candidates = [cleaned, title.trim()].filter(Boolean);

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('films')
      .select('*')
      .ilike('title', candidate)
      .limit(5);

    if (error) throw error;
    if (data?.length) {
      return data.sort((a, b) => {
        const score = (f: any) =>
          (f.year ? 4 : 0) +
          (f.poster_url ? 2 : 0) +
          (f.synopsis ? 2 : 0) +
          (f.needs_review === false ? 3 : 0);
        return score(b) - score(a);
      })[0];
    }
  }
  return null;
}

const peopleCache = new Map<string, string>();

async function upsertPerson(name: string, photoUrl: string | null): Promise<string | null> {
  const normName = name.trim();
  if (!normName) return null;
  const cacheKey = normName.toLowerCase();
  if (peopleCache.has(cacheKey)) return peopleCache.get(cacheKey)!;

  // 1. Look up existing person
  const { data: existing, error: findError } = await supabase
    .from('people')
    .select('id, name, photo_url, source')
    .ilike('name', normName)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    // If existing person does not have a profile picture, and Filmporte provides one:
    if ((!existing.photo_url || existing.photo_url.includes('placeholder')) && photoUrl) {
      console.log(`[filmporte_sync] Updating missing photo for actor "${existing.name}": ${photoUrl}`);
      if (!DRY_RUN) {
        await supabase
          .from('people')
          .update({
            photo_url: photoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }
    }
    peopleCache.set(cacheKey, existing.id);
    return existing.id;
  }

  // 2. Try shared name matcher / upsert RPC
  if (!DRY_RUN) {
    try {
      const { data: rpcId } = await supabase.rpc('upsert_person_by_name', {
        p_name: normName,
        p_extra: {
          source: 'filmporte',
          ...(photoUrl ? { photo_url: photoUrl } : {}),
        },
      });
      if (rpcId) {
        peopleCache.set(cacheKey, rpcId as string);
        return rpcId as string;
      }
    } catch {
      // Fall through to manual insert
    }

    const { data: inserted, error: insertError } = await supabase
      .from('people')
      .insert({
        name: normName,
        photo_url: photoUrl,
        source: 'filmporte',
        needs_review: true,
      })
      .select('id')
      .single();

    if (insertError) {
      console.warn(`[filmporte_sync] Failed to insert person "${normName}":`, insertError.message);
      return null;
    }
    peopleCache.set(cacheKey, inserted.id);
    return inserted.id;
  } else {
    peopleCache.set(cacheKey, 'dry-run-person-id');
    return 'dry-run-person-id';
  }
}

async function syncCredits(filmId: string, credits: FilmporteCredit[]) {
  if (!credits || !credits.length) return;

  for (const c of credits) {
    const photoUrl = c.image?.url ? `${ASSETS_BASE}/${c.image.url}` : null;
    const personId = await upsertPerson(c.name, photoUrl);
    if (!personId) continue;

    const role = normalizeRole(c.role);
    const characterName = c.characterName?.trim() || null;
    const billingOrder = typeof c.position === 'number' ? c.position : null;

    if (!DRY_RUN) {
      // Zero-duplicate actor guarantee: check if credit exists for (film_id, person_id)
      const { data: existingCredit } = await supabase
        .from('credits')
        .select('id, character_name, billing_order, role')
        .eq('film_id', filmId)
        .eq('person_id', personId)
        .maybeSingle();

      if (existingCredit) {
        // Update in place with any richer character name or billing order
        const updates: Record<string, unknown> = {};
        if (!existingCredit.character_name && characterName) {
          updates.character_name = characterName;
        }
        if (existingCredit.billing_order === null && billingOrder !== null) {
          updates.billing_order = billingOrder;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('credits').update(updates).eq('id', existingCredit.id);
        }
      } else {
        await supabase.from('credits').insert({
          film_id: filmId,
          person_id: personId,
          role,
          character_name: characterName,
          billing_order: billingOrder,
          source: 'filmporte_sync',
        });
      }
    }
  }
}

export async function runFilmporteSync(options: { dryRun?: boolean } = {}) {
  const isDryRun = options.dryRun ?? DRY_RUN;
  console.log(`[filmporte_sync] Starting Filmporte Sync (dryRun: ${isDryRun})...`);

  const syncLog = await startSyncLog('filmporte_sync', 'Syncing Filmporte films and credits...');
  const counters: SyncCounters = syncLog.counters;

  try {
    // 1. Fetch catalog
    const res = await fetch(`${API_BASE}/contents`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Filmporte catalog: ${res.status} ${res.statusText}`);
    }

    const items: Array<{ id: string; slug: string; title: string; type: string }> = await res.json();
    console.log(`[filmporte_sync] Retrieved ${items.length} titles from Filmporte API.`);

    for (const item of items) {
      counters.processed += 1;
      try {
        console.log(`\n[filmporte_sync] Processing (${counters.processed}/${items.length}): "${item.title}" (${item.slug})`);

        // Fetch single content details
        const detailRes = await fetch(`${API_BASE}/contents/slug/${item.slug}`);
        if (!detailRes.ok) {
          console.warn(`[filmporte_sync] Failed to fetch details for ${item.slug}: ${detailRes.status}`);
          counters.failed += 1;
          continue;
        }

        const data: FilmporteContentDetail = await detailRes.json();

        const isShort = data.type === 'SHORT' || data.type === 'SHORT_FILM';
        const contentType: 'movie' = 'movie';
        const watchUrl = isShort
          ? `${WEB_BASE}/short-films/${data.slug}`
          : `${WEB_BASE}/movies/${data.slug}`;

        const rawGenres = normalizeGenres(data.primaryGenre, data.secondaryGenres);
        const genres = isShort && !rawGenres.some((g: string) => g.toLowerCase() === 'short')
          ? ['Short', ...rawGenres]
          : rawGenres;
        const synopsis = data.description?.trim() || null;
        const releaseDateIso = data.movie?.releaseDate || data.createdAt;
        const year = releaseDateIso ? new Date(releaseDateIso).getUTCFullYear() : null;

        // Poster & Backdrop extraction
        const posterAttachment = data.mediaAttachments?.find(m => m.role === 'THUMBNAIL' || m.role === 'POSTER');
        const posterUrl = posterAttachment?.image?.url ? `${ASSETS_BASE}/${posterAttachment.image.url}` : null;

        const galleryAttachment = data.mediaAttachments?.find(m => m.role === 'GALLERY');
        const backdropUrl = galleryAttachment?.image?.url ? `${ASSETS_BASE}/${galleryAttachment.image.url}` : posterUrl;

        // Trailer extraction
        const trailerAttachment = data.mediaAttachments?.find(m => m.role === 'TRAILER' || m.role === 'TEASER');
        const playbackId = trailerAttachment?.video?.metadata?.playbackIds?.[0]?.id;
        const trailerUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;

        const existingFilm = await findFilm(data.title, data.slug);

        let filmId: string;

        if (existingFilm) {
          filmId = existingFilm.id;
          console.log(`[filmporte_sync] Matched existing film in MuviDB: "${existingFilm.title}" (${existingFilm.id})`);

          if (!isDryRun) {
            const links = typeof existingFilm.streaming_links === 'object' && existingFilm.streaming_links
              ? { ...existingFilm.streaming_links }
              : {};
            links.filmporte = watchUrl;

            const updatePayload: Record<string, unknown> = {
              streaming_links: links,
              genres: mergeGenres(existingFilm.genres, genres),
              content_type: existingFilm.content_type || contentType,
              release_type: existingFilm.release_type || null,
              updated_at: new Date().toISOString(),
            };

            if ((!existingFilm.synopsis || existingFilm.synopsis.length < 20) && synopsis) {
              updatePayload.synopsis = synopsis;
            }
            if ((!existingFilm.poster_url || existingFilm.poster_url.includes('placeholder')) && posterUrl) {
              updatePayload.poster_url = posterUrl;
            }
            if (!existingFilm.backdrop_url && backdropUrl) {
              updatePayload.backdrop_url = backdropUrl;
            }
            if (!existingFilm.release_date && releaseDateIso) {
              updatePayload.release_date = releaseDateIso.slice(0, 10);
            }
            if (!existingFilm.year && year) {
              updatePayload.year = year;
            }
            if (!existingFilm.trailer_external_url && !existingFilm.trailer_youtube_id && trailerUrl) {
              updatePayload.trailer_external_url = trailerUrl;
              updatePayload.trailer_source = 'external';
            }

            const { error: updateErr } = await supabase
              .from('films')
              .update(updatePayload)
              .eq('id', filmId);

            if (updateErr) throw updateErr;
          }
          counters.updated += 1;
        } else {
          console.log(`[filmporte_sync] Inserting new ${isShort ? 'short film' : 'movie'}: "${data.title}"`);
          if (!isDryRun) {
            const { data: inserted, error: insertErr } = await supabase
              .from('films')
              .insert({
                title: data.title.trim(),
                slug: data.slug,
                synopsis,
                poster_url: posterUrl,
                backdrop_url: backdropUrl,
                genres,
                content_type: contentType,
                release_type: null,
                source: 'filmporte_sync',
                release_date: releaseDateIso ? releaseDateIso.slice(0, 10) : null,
                year,
                trailer_external_url: trailerUrl,
                trailer_source: trailerUrl ? 'external' : null,
                streaming_links: { filmporte: watchUrl },
                status: 'released',
                is_published: true,
                needs_review: false,
              })
              .select('id')
              .single();

            if (insertErr) throw insertErr;
            filmId = inserted.id;
          } else {
            filmId = 'dry-run-film-id';
          }
          counters.created += 1;
        }

        // Sync cast and crew with photos
        if (data.credits && data.credits.length > 0) {
          console.log(`[filmporte_sync] Syncing ${data.credits.length} credits with photos for "${data.title}"...`);
          await syncCredits(filmId, data.credits);
        }

        // Upsert into platform_new_releases
        if (!isDryRun && filmId && filmId !== 'dry-run-film-id') {
          await supabase.from('platform_new_releases').upsert({
            platform: 'filmporte',
            film_id: filmId,
            display_order: -1,
            entry_source: 'auto',
            is_hidden: false,
          }, { onConflict: 'platform,film_id' });
        }
      } catch (itemErr: any) {
        console.error(`[filmporte_sync] Error processing item "${item.title}":`, itemErr.message);
        counters.failed += 1;
      }
    }

    const summary = `Filmporte Sync completed. Processed: ${counters.processed}, Created: ${counters.created}, Updated: ${counters.updated}, Failed: ${counters.failed}`;
    console.log(`\n[filmporte_sync] ${summary}`);
    await syncLog.finish(summary);
    return { ok: true, counters };
  } catch (err: any) {
    console.error('[filmporte_sync] Sync failed:', err);
    await syncLog.fail(err);
    throw err;
  }
}

// Direct CLI invocation
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('filmporte_sync')) {
  runFilmporteSync()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
