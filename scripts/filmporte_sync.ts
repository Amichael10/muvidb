import crypto from 'crypto';
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

type FilmporteCatalogItem = {
  id: string;
  title: string;
  slug: string;
  type: string;
};

function normalizeGenres(primary?: string[], secondary?: string[]): string[] {
  const all = [...(primary || []), ...(secondary || [])];
  const set = new Set<string>();
  for (const g of all) {
    if (!g) continue;
    const clean = g.trim();
    if (clean) set.add(clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase());
  }
  return Array.from(set);
}

function mergeGenres(existing?: string[] | null, incoming?: string[] | null): string[] {
  const set = new Set<string>([...(existing || []), ...(incoming || [])]);
  return Array.from(set);
}

function normalizeRole(role: string): string {
  const r = (role || '').toUpperCase();
  if (r.includes('ACTOR') || r.includes('CAST')) return 'actor';
  if (r.includes('DIRECTOR')) return 'director';
  if (r.includes('PRODUCER')) return 'producer';
  if (r.includes('WRITER')) return 'writer';
  return 'actor';
}

function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';
  return null;
}

// Fetch a remote image with the source-site Referer and upload to Supabase Storage.
// Returns the public Supabase URL, or original if failed.
async function mirrorImage(
  srcUrl: string | null,
  bucket: 'posters' | 'backdrops' | 'people'
): Promise<string | null> {
  if (!srcUrl) return null;
  if (srcUrl.includes('supabase.co/storage/v1/object/public/')) return srcUrl;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(srcUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://films.filmporte.com/',
      },
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.warn(`[mirrorImage] Failed to download ${srcUrl}: ${res.status}`);
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 500) return null;

    const ct = sniffImageType(buf) || 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const filename = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from(bucket).upload(filename, buf, {
      contentType: ct,
      upsert: true,
      cacheControl: '31536000',
    });

    if (uploadErr) {
      console.warn(`[mirrorImage] Upload to ${bucket} failed:`, uploadErr.message);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filename);
    return publicUrl;
  } catch (err: any) {
    console.warn(`[mirrorImage] Error mirroring ${srcUrl}:`, err.message);
    return null;
  }
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

async function upsertPerson(name: string, rawPhotoUrl: string | null): Promise<string | null> {
  const normName = name.trim();
  if (!normName) return null;
  const cacheKey = normName.toLowerCase();
  if (peopleCache.has(cacheKey)) return peopleCache.get(cacheKey)!;

  // Mirror photo to people bucket if from external host
  let photoUrl = rawPhotoUrl;
  if (rawPhotoUrl && !rawPhotoUrl.includes('supabase.co/storage/')) {
    const mirrored = await mirrorImage(rawPhotoUrl, 'people');
    if (mirrored) photoUrl = mirrored;
  }

  // 1. Look up existing person
  const { data: existing, error: findError } = await supabase
    .from('people')
    .select('id, name, photo_url, source')
    .ilike('name', normName)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const needsNewPhoto = (!existing.photo_url || 
      existing.photo_url.includes('placeholder') || 
      existing.photo_url.includes('assets.filmporte.com')) && photoUrl;

    if (needsNewPhoto) {
      console.log(`[filmporte_sync] Updating photo for actor "${existing.name}": ${photoUrl}`);
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
    const rawPhotoUrl = c.image?.url ? `${ASSETS_BASE}/${c.image.url}` : null;
    const personId = await upsertPerson(c.name, rawPhotoUrl);
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Filmporte catalog: HTTP ${res.status}`);
    }

    const items: FilmporteCatalogItem[] = await res.json();
    console.log(`[filmporte_sync] Retrieved ${items.length} titles from Filmporte API.`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      counters.processed += 1;
      console.log(`\n[filmporte_sync] Processing (${i + 1}/${items.length}): "${item.title}" (${item.slug})`);

      try {
        const detailRes = await fetch(`${API_BASE}/contents/slug/${item.slug}`);
        if (!detailRes.ok) {
          console.warn(`[filmporte_sync] Failed to fetch details for ${item.slug}: ${detailRes.status}`);
          counters.failed += 1;
          continue;
        }

        const data: FilmporteContentDetail = await detailRes.json();

        const isShort = data.type === 'SHORT' || data.type === 'SHORT_FILM';
        const contentType: 'movie' | 'short_film' = isShort ? 'short_film' : 'movie';
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

        // Poster & Backdrop extraction + mirroring to Supabase Storage
        const posterAttachment = data.mediaAttachments?.find(m => m.role === 'THUMBNAIL' || m.role === 'POSTER');
        const rawPosterUrl = posterAttachment?.image?.url ? `${ASSETS_BASE}/${posterAttachment.image.url}` : null;
        const posterUrl = await mirrorImage(rawPosterUrl, 'posters');

        const galleryAttachment = data.mediaAttachments?.find(m => m.role === 'GALLERY');
        const rawBackdropUrl = galleryAttachment?.image?.url ? `${ASSETS_BASE}/${galleryAttachment.image.url}` : rawPosterUrl;
        const backdropUrl = await mirrorImage(rawBackdropUrl, 'backdrops') || posterUrl;

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
              content_type: contentType,
              release_type: existingFilm.release_type || 'filmporte',
              updated_at: new Date().toISOString(),
            };

            const needsNewPoster = !existingFilm.poster_url ||
              existingFilm.poster_url.includes('placeholder') ||
              existingFilm.poster_url.includes('assets.filmporte.com');

            if (needsNewPoster && posterUrl) {
              updatePayload.poster_url = posterUrl;
            }

            const needsNewBackdrop = !existingFilm.backdrop_url ||
              existingFilm.backdrop_url.includes('placeholder') ||
              existingFilm.backdrop_url.includes('assets.filmporte.com');

            if (needsNewBackdrop && backdropUrl) {
              updatePayload.backdrop_url = backdropUrl;
            }

            if ((!existingFilm.synopsis || existingFilm.synopsis.length < 20) && synopsis) {
              updatePayload.synopsis = synopsis;
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
          console.log(`[filmporte_sync] Inserting new ${contentType}: "${data.title}"`);
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
                release_type: 'filmporte',
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

    await syncLog.finish(
      `Filmporte Sync completed. Processed: ${counters.processed}, Created: ${counters.created}, Updated: ${counters.updated}, Failed: ${counters.failed}`
    );
    console.log(`\n[filmporte_sync] Filmporte Sync completed. Processed: ${counters.processed}, Created: ${counters.created}, Updated: ${counters.updated}, Failed: ${counters.failed}`);
  } catch (err: any) {
    console.error('[filmporte_sync] Fatal error during sync:', err);
    await syncLog.fail(err);
    process.exit(1);
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('filmporte_sync.ts') || process.argv[1]?.endsWith('filmporte_sync.js')) {
  runFilmporteSync().catch(console.error);
}
