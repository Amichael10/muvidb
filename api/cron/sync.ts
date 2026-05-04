import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { isValidAuth } from '../_lib/auth';
import { ADAPTERS, upsertShowtimes, type CinemaRow } from '../_lib/cinema-adapters';
import { generateAIContent, parseJSON } from '../_lib/ai_service';

export const config = { maxDuration: 300 }; // Increased for 225 channels

// ── YouTube Settings & Helpers ────────────────────────────────────────────────
const YT_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

async function ytGet(endpoint: string, params: Record<string, string>) {
  if (!YT_KEY) throw new Error('YOUTUBE_API_KEY is missing in environment');
  const url = new URL(`${YT_BASE}/${endpoint}`);
  Object.entries({ ...params, key: YT_KEY }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorBody = await res.text();
    let detail = errorBody;
    try {
      const json = JSON.parse(errorBody);
      detail = json.error?.message || errorBody;
    } catch (e) {}
    throw new Error(`YouTube /${endpoint} ${res.status}: ${detail}`);
  }
  return res.json();
}

function parseDuration(iso: string): number {
  const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? '0');
  const m = parseInt(iso.match(/(\d+)M/)?.[1] ?? '0');
  const s = parseInt(iso.match(/(\d+)S/)?.[1] ?? '0');
  return h * 3600 + m * 60 + s;
}

function cleanTitle(raw: string): string {
  let t = raw.replace(/\|\|[^|]+\|\|/g, '').replace(/\([A-Z][A-Z\s,]{6,}\)/g, '').trim();
  return t.split(/\s+/).map(w => w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  if (!(await isValidAuth(req))) return res.status(401).json({ error: 'Unauthorized' });

  const { task } = req.query;
  const startTime = Date.now();

  try {
    if (!task) {
      console.log('[cron/sync] No task specified, running ALL tasks...');
      
      const { data: masterLog } = await supabase.from('sync_logs').insert({
        source: 'master',
        status: 'running',
        message: 'Running all sync tasks...'
      }).select().single();

      const results: any = {};
      const tasks = [
        { name: 'showtimes', fn: runShowtimesSync },
        { name: 'videos', fn: runVideosSync },
        { name: 'tmdb', fn: runTMDBSync },
        { name: 'ai_maintenance', fn: runAIMaintenance }
      ];

      for (const t of tasks) {
        const tStart = Date.now();
        try {
          const res = await t.fn();
          results[t.name] = res;
          await supabase.from('sync_logs').insert({
            source: t.name,
            status: 'success',
            message: `Completed ${t.name} task`,
            details: res,
            duration_ms: Date.now() - tStart,
            items_processed: res.processed || res.upserted || res.imported || 0,
            items_updated: res.upserted || res.imported || 0
          });
        } catch (e: any) {
          results[t.name] = { error: e.message };
          await supabase.from('sync_logs').insert({
            source: t.name,
            status: 'error',
            message: e.message,
            duration_ms: Date.now() - tStart,
            items_failed: 1
          });
        }
      }
      
      if (masterLog) {
        await supabase.from('sync_logs').update({
          status: 'success',
          message: 'All sync tasks completed',
          details: { results, completed_at: new Date().toISOString() },
          duration_ms: Date.now() - startTime
        }).eq('id', masterLog.id);
      }
      
      return res.status(200).json({
        success: true,
        message: 'All sync tasks completed',
        results
      });
    }

    const { data: taskLog } = await supabase.from('sync_logs').insert({
      source: task as string,
      status: 'running',
      message: `Running ${task} task...`
    }).select().single();

    const tStart = Date.now();
    let result: any;
    switch (task) {
      case 'showtimes': result = await runShowtimesSync(); break;
      case 'videos':    result = await runVideosSync(); break;
      case 'tmdb':      result = await runTMDBSync(); break;
      case 'ai_maintenance': result = await runAIMaintenance(); break;
      case 'kava':      
        return res.status(200).json({ 
          task: 'kava', 
          status: 'moved_to_github_actions',
          message: 'Kava sync now runs directly in GitHub Actions to bypass Vercel timeout limits.' 
        });
      default:
        return res.status(400).json({ error: 'Invalid task' });
    }

    if (taskLog) {
      await supabase.from('sync_logs').update({
        status: 'success',
        message: `Completed ${task} task`,
        details: { result, completed_at: new Date().toISOString() },
        duration_ms: Date.now() - tStart,
        items_processed: result.processed || result.upserted || result.imported || 0,
        items_updated: result.upserted || result.imported || 0
      }).eq('id', taskLog.id);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error(`[cron/sync] Task ${task} failed:`, err.message);
    await supabase.from('sync_logs').insert({
      source: (task as string) || 'master',
      status: 'error',
      message: err.message,
      duration_ms: Date.now() - startTime,
      items_failed: 1
    });
    return res.status(500).json({ error: err.message });
  }
}

// ── TASK: SHOWTIMES ──────────────────────────────────────────────────────────
async function runShowtimesSync() {
  const { data: cinemas } = await supabase.from('cinemas').select('*').eq('scrape_enabled', true).limit(15);
  if (!cinemas) return { message: 'No cinemas to scrape' };

  const results = [];
  for (const cinema of cinemas) {
    try {
      const adapter = ADAPTERS[cinema.scrape_adapter];
      if (!adapter) continue;
      const scraped = await adapter(cinema);
      const stats = await upsertShowtimes(cinema.id, scraped.showtimes, cinema.scrape_adapter);
      results.push({ name: cinema.name, ...stats });
    } catch (e: any) { results.push({ name: cinema.name, error: e.message }); }
  }
  return { task: 'showtimes', results };
}

// ── TASK: VIDEOS ─────────────────────────────────────────────────────────────
async function runVideosSync() {
  if (!YT_KEY) throw new Error('YT_KEY missing');
  
  // Only fetch channels that haven't been fetched in the last 3.5 hours
  const { data: channels } = await supabase
    .from('channels')
    .select('*')
    .or('videos_last_fetched_at.is.null,videos_last_fetched_at.lt.' + new Date(Date.now() - 3.5*3600*1000).toISOString())
    .order('videos_last_fetched_at', { ascending: true, nullsFirst: true });
    
  if (!channels || channels.length === 0) return { message: 'No channels need syncing right now' };

  console.log(`[runVideosSync] Starting sync for ${channels.length} channels`);
  let totalUpserted = 0;
  let channelsProcessed = 0;
  let filmsCreated = 0;
  const FILM_MIN_SEC = 1800; // 30 minutes

  for (const ch of channels) {
    try {
      const handle = ch.channel_handle?.replace(/^@/, '');
      const idMatch = ch.channel_url?.match(/\/channel\/(UC[\w-]+)/);
      let discoveredChannelId = ch.channel_id || idMatch?.[1];
      let uploadsId = '';

      // 1. Fetch Channel Metadata & resolve IDs
      let ytChannelData = null;
      if (discoveredChannelId) {
        ytChannelData = await ytGet('channels', { 
          part: 'snippet,contentDetails,statistics,brandingSettings', 
          id: discoveredChannelId 
        });
      } else if (handle) {
        ytChannelData = await ytGet('channels', { 
          part: 'snippet,contentDetails,statistics,brandingSettings', 
          forHandle: handle 
        });
      }

      if (ytChannelData?.items?.[0]) {
        const item = ytChannelData.items[0];
        discoveredChannelId = item.id;
        uploadsId = item.contentDetails?.relatedPlaylists?.uploads;
        
        // Update Channel Metadata (Logo, Banner, Subs)
        const updateData: any = {
          channel_id: discoveredChannelId,
          subscriber_count: parseInt(item.statistics?.subscriberCount || '0'),
          thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url,
          banner_url: item.brandingSettings?.image?.bannerExternalUrl || ch.banner_url
        };
        
        // Append YouTube banner sizing if the external URL was just fetched (it needs to be sized)
        if (updateData.banner_url && !updateData.banner_url.includes('=w')) {
            updateData.banner_url = `${updateData.banner_url}=w1060-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`;
        }
        
        // Only update if something changed or is missing
        if (updateData.thumbnail_url !== ch.thumbnail_url || updateData.banner_url !== ch.banner_url || updateData.subscriber_count !== ch.subscriber_count || updateData.channel_id !== ch.channel_id) {
          await supabase.from('channels').update(updateData).eq('id', ch.id);
        }
      }

      if (!uploadsId) {
        console.warn(`[runVideosSync] No uploads playlist for ${ch.name}`);
        continue;
      }

      // 2. Fetch Latest Videos (increased to 50)
      const plData = await ytGet('playlistItems', { 
        part: 'snippet', 
        playlistId: uploadsId, 
        maxResults: '50' 
      });
      
      if (!plData.items?.length) {
        channelsProcessed++;
        continue;
      }

      const videoIds = plData.items.map((i: any) => i.snippet.resourceId.videoId).join(',');
      const vData = await ytGet('videos', { part: 'contentDetails,statistics', id: videoIds });

      const meta: Record<string, any> = {};
      for (const v of vData.items ?? []) {
        meta[v.id] = { 
          seconds: parseDuration(v.contentDetails?.duration ?? ''), 
          views: parseInt(v.statistics?.viewCount ?? '0') 
        };
      }

      // Fetch hidden videos for this channel to avoid re-promoting them
      const { data: hiddenVids } = await supabase
        .from('channel_videos')
        .select('video_id')
        .eq('channel_id', ch.id)
        .eq('is_hidden', true);
      
      const hiddenSet = new Set(hiddenVids?.map((v: any) => v.video_id) || []);

      const videoRows = plData.items.map((item: any) => {
        const vid = item.snippet.resourceId.videoId;
        return {
          channel_id: ch.id,
          video_id: vid,
          title: item.snippet.title,
          thumbnail_url: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
          published_at: item.snippet.publishedAt,
          duration_seconds: meta[vid]?.seconds ?? 0
        };
      }).filter((row: any) => !hiddenSet.has(row.video_id));

      if (videoRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('channel_videos')
          .upsert(videoRows, { onConflict: 'channel_id,video_id' });
        
        if (upsertErr) {
          console.error(`[runVideosSync] Upsert error for ${ch.name}:`, upsertErr.message);
        } else {
          totalUpserted += videoRows.length;
        }
      }
      
      // Auto-create films for 30+ min videos from channels with an owner
      let newFilms = 0;
      if (ch.owner_person_id) {
        const longVideos = videoRows.filter((v: any) => (v.duration_seconds ?? 0) >= FILM_MIN_SEC);
        for (const v of longVideos) {
          const { data: existing } = await supabase.from('channel_videos').select('film_id').eq('channel_id', ch.id).eq('video_id', v.video_id).maybeSingle();
          if (existing?.film_id) continue;

          const { data: existingFilm } = await supabase.from('films').select('id').eq('source_video_id', v.video_id).maybeSingle();
          let filmId = existingFilm?.id;

          if (!filmId) {
            const { data: newFilm } = await supabase.from('films').insert({
              title: cleanTitle(v.title), 
              year: v.published_at ? new Date(v.published_at).getFullYear() : null,
              release_type: 'youtube', 
              source: 'youtube', 
              source_video_id: v.video_id,
              youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
              trailer_youtube_id: v.video_id, 
              poster_url: v.thumbnail_url,
              backdrop_url: v.thumbnail_url,
              needs_review: true, 
              status: 'released',
              runtime_minutes: Math.round(v.duration_seconds / 60)
            }).select('id').single();
            filmId = newFilm?.id;
            if (filmId) newFilms++;
          }

          if (filmId) {
            const { data: ec } = await supabase.from('credits').select('id').eq('film_id', filmId).eq('person_id', ch.owner_person_id).eq('role', 'producer').maybeSingle();
            if (!ec) await supabase.from('credits').insert({ film_id: filmId, person_id: ch.owner_person_id, role: 'producer', billing_order: 1 });
            await supabase.from('channel_videos').update({ film_id: filmId, match_status: 'auto' }).eq('channel_id', ch.id).eq('video_id', v.video_id);
          }
        }
      }
      filmsCreated += newFilms;
      
      await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', ch.id);
      channelsProcessed++;
    } catch (e: any) {
      console.error(`[cron/sync] Failed channel ${ch.name}:`, e.message);
    }
  }
  
  console.log(`[runVideosSync] Completed. Processed ${channelsProcessed}/${channels.length} channels. Videos: ${totalUpserted}, Films: ${filmsCreated}`);
  return { 
    task: 'videos', 
    status: 'completed', 
    processed: channelsProcessed,
    total_channels: channels.length,
    upserted: totalUpserted,
    films_created: filmsCreated
  };
}

// ── TASK: TMDB ───────────────────────────────────────────────────────────────
async function runTMDBSync() {
  const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_origin_country=NG&sort_by=popularity.desc`;
  
  const resData = await fetch(url).then(r => r.json());
  const movies = resData.results || [];
  
  if (movies.length === 0) {
    return { task: 'tmdb', imported: 0, message: 'No movies found' };
  }

  // 1. Get or Create the TMDB Channel
  let { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('name', 'TMDB Discover')
    .maybeSingle();
  
  if (!channel) {
    const { data: newChannel, error: chErr } = await supabase
      .from('channels')
      .insert([{ 
        name: 'TMDB Discover', 
        category: 'Discovery',
        description: 'Auto-fetched from TMDB Discover API (Nigeria Origin)'
      }])
      .select()
      .single();
    if (chErr) throw chErr;
    channel = newChannel;
  }

  // 2. Map to channel_videos schema
  const { data: hiddenVids } = await supabase
    .from('channel_videos')
    .select('video_id')
    .eq('channel_id', channel.id)
    .eq('is_hidden', true);
  const hiddenSet = new Set(hiddenVids?.map(v => v.video_id) || []);

  const videoRows = movies.map((m: any) => ({
    channel_id: channel!.id,
    video_id: `TMDB_${m.id}`,
    title: m.title,
    description: m.overview,
    thumbnail_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    published_at: m.release_date ? new Date(m.release_date).toISOString() : new Date().toISOString()
  })).filter(row => !hiddenSet.has(row.video_id));

  // 3. Upsert to DB
  if (videoRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('channel_videos')
      .upsert(videoRows, { onConflict: 'channel_id,video_id' });

    if (upsertErr) throw upsertErr;
  }

  // 4. Update last fetched timestamp
  await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', channel.id);

  return { 
    task: 'tmdb', 
    imported: movies.length,
    channel_id: channel.id
  };
}

// ── TASK: KAVA ───────────────────────────────────────────────────────────────
async function handleKava(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ 
    task: 'kava', 
    status: 'moved_to_github_actions',
    message: 'Kava sync now runs directly in GitHub Actions to bypass Vercel timeout limits.' 
  });
}

// ── TASK: AI MAINTENANCE ─────────────────────────────────────────────────────
// Runs extract_cast → cleanup_titles in sequence, fully automated.
// Order matters: extract cast FIRST (captures actors from messy titles),
// THEN cleanup (strips marketing noise without losing actor names).
async function runAIMaintenance() {
  console.log('[AI Maintenance] Starting automated AI pipeline...');
  const results: any = { extract_cast: null, cleanup_titles: null };

  // ── STEP 1: Extract Cast from Titles ──────────────────────────────────────
  try {
    // Find films whose titles likely contain embedded cast names
    const { data: starringFilms } = await supabase
      .from('films')
      .select('id, title')
      .or('title.ilike.%starring%,title.ilike.%feat%,title.ilike.%ft.%,title.ilike.%ft %')
      .order('created_at', { ascending: false })
      .limit(30);

    const { data: pipeFilms } = await supabase
      .from('films')
      .select('id, title')
      .ilike('title', '%|%')
      .order('created_at', { ascending: false })
      .limit(20);

    // Merge and deduplicate
    const allCastFilms = [...(starringFilms || [])];
    const seenIds = new Set(allCastFilms.map(f => f.id));
    for (const f of (pipeFilms || [])) {
      if (!seenIds.has(f.id)) {
        allCastFilms.push(f);
        seenIds.add(f.id);
      }
    }

    if (allCastFilms.length > 0) {
      console.log(`[AI Maintenance] Analyzing ${allCastFilms.length} titles for embedded cast...`);

      const castPrompt = `
        You are a Nollywood database editor. These YouTube video titles contain actor/cast names embedded in them.
        
        Your job:
        1. EXTRACT the clean movie title (remove all marketing noise, years, category labels).
        2. EXTRACT all actor/cast names embedded in the title.
        
        Common patterns to detect:
        - "Ago(cage) Starring Aishat Lawal Muyiwa Ademola, Lalude" → title: "Ago (Cage)", cast: ["Aishat Lawal", "Muyiwa Ademola", "Lalude"]
        - "ALAKO | MIDE MARTINS | DAMILOLA OMOTOSO" → title: "Alako", cast: ["Mide Martins", "Damilola Omotoso"]
        - "OKO ASEWO ft Odunlade Adekola, Mercy Aigbe" → title: "Oko Asewo", cast: ["Odunlade Adekola", "Mercy Aigbe"]
        
        Rules:
        - Proper Case all names.
        - Each cast entry must be a FULL PERSON NAME. Single words like "ozain" should be kept as-is if that's their known stage name.
        - If the title has NO embedded cast, return an empty cast array.
        - ONLY return entries where you found at least 1 cast member.
        
        Return ONLY JSON: [{"id": "...", "old_title": "...", "new_title": "...", "cast": ["Name One", "Name Two"]}]
        
        Titles: ${JSON.stringify(allCastFilms)}
      `;

      const { text: castText } = await generateAIContent(castPrompt);
      const castParsed = parseJSON(castText);

      // Build lookup for cross-reference
      const filmLookup = new Map(allCastFilms.map(f => [f.id, f.title]));
      
      const castExtracted = castParsed
        .map((f: any) => ({
          id: f.id,
          old_title: filmLookup.get(f.id) || f.old_title || '',
          new_title: f.new_title || f.clean_title || filmLookup.get(f.id) || '',
          cast: Array.isArray(f.cast) ? f.cast : (Array.isArray(f.actors) ? f.actors : []),
        }))
        .filter((f: any) => f.id && f.cast.length > 0);

      let castApplied = 0;
      for (const item of castExtracted) {
        try {
          // Update film title if changed
          if (item.new_title && item.new_title !== item.old_title) {
            await supabase.from('films').update({ title: item.new_title }).eq('id', item.id);
          }

          // Upsert cast members with fuzzy matching
          for (const actorName of item.cast) {
            try {
              // Tier 1: Exact match
              let { data: person } = await supabase
                .from('people').select('id, name').ilike('name', actorName).maybeSingle();

              // Tier 2: Partial/contains match
              if (!person) {
                const { data: partial } = await supabase
                  .from('people').select('id, name').ilike('name', `%${actorName}%`).limit(1).maybeSingle();
                if (partial) {
                  person = partial;
                  console.log(`[AI Maintenance] Fuzzy: "${actorName}" → "${partial.name}"`);
                }
              }

              // Tier 3: Create new person
              let personId = person?.id;
              if (!personId) {
                const { data: newP } = await supabase
                  .from('people')
                  .insert({ name: actorName, nationality: 'Nigerian', created_at: new Date().toISOString() })
                  .select('id').single();
                personId = newP?.id;
                console.log(`[AI Maintenance] Created: "${actorName}"`);
              }

              // Link credit if not exists
              if (personId) {
                const { data: existing } = await supabase
                  .from('credits').select('id').eq('film_id', item.id).eq('person_id', personId).maybeSingle();
                if (!existing) {
                  await supabase.from('credits').insert({
                    film_id: item.id, person_id: personId, role: 'actor', character_name: '', billing_order: 1,
                  });
                }
              }
            } catch (e: any) {
              console.warn(`[AI Maintenance] Cast link error for "${actorName}":`, e.message);
            }
          }
          castApplied++;
        } catch (e: any) {
          console.warn(`[AI Maintenance] Film ${item.id} error:`, e.message);
        }
      }
      results.extract_cast = { analyzed: allCastFilms.length, extracted: castExtracted.length, applied: castApplied };
      console.log(`[AI Maintenance] Cast extraction: ${castApplied} films updated`);
    } else {
      results.extract_cast = { analyzed: 0, message: 'No films with embedded cast patterns found' };
    }
  } catch (err: any) {
    console.error('[AI Maintenance] Cast extraction failed:', err.message);
    results.extract_cast = { error: err.message };
  }

  // ── STEP 2: Cleanup Titles ────────────────────────────────────────────────
  try {
    const { data: messyFilms } = await supabase
      .from('films')
      .select('id, title')
      .or('title.ilike.%|%,title.ilike.%YORUBA%,title.ilike.%MOVIE%,title.ilike.%PART%,title.ilike.%2024%,title.ilike.%2025%,title.ilike.%FULL%,title.ilike.%NIGERIAN%,title.ilike.%(%,title.ilike.%[%,title.ilike.%-%,title.ilike.%LATEST%')
      .order('created_at', { ascending: false })
      .limit(40);

    if (messyFilms && messyFilms.length > 0) {
      console.log(`[AI Maintenance] Cleaning ${messyFilms.length} messy titles...`);

      const titlePrompt = `
        You are a Nollywood database editor. 
        Clean up these movie titles by removing common YouTube marketing noise, years, and category labels.
        
        Rules:
        1. EXTRACT ONLY the actual movie title. 
        2. DISCARD all marketing buzzwords: "LATEST", "YORUBA MOVIE", "NIGERIAN MOVIE", "2024", "2025", "FULL MOVIE", "HD", "APA", "PART 1", etc.
        3. DISCARD all actor/cast lists separated by |, /, or hyphens.
        4. Proper Case: Convert ALL CAPS to Proper Case.
        5. If the title contains a pipe (|), remove the pipe and everything after it.
        
        Return ONLY JSON: [{"id": "...", "old_title": "...", "new_title": "..."}]
        
        Titles to clean: ${JSON.stringify(messyFilms)}
      `;

      const { text: titleText } = await generateAIContent(titlePrompt);
      const titleParsed = parseJSON(titleText);
      const titleChanges = titleParsed.filter((f: any) => f.old_title && f.new_title && f.old_title.trim() !== f.new_title.trim());

      let titlesApplied = 0;
      for (const item of titleChanges) {
        try {
          await supabase.from('films').update({ title: item.new_title }).eq('id', item.id);
          titlesApplied++;
        } catch (e: any) {
          console.warn(`[AI Maintenance] Title update error for ${item.id}:`, e.message);
        }
      }
      results.cleanup_titles = { analyzed: messyFilms.length, changes: titleChanges.length, applied: titlesApplied };
      console.log(`[AI Maintenance] Title cleanup: ${titlesApplied} titles polished`);
    } else {
      results.cleanup_titles = { analyzed: 0, message: 'No messy titles found' };
    }
  } catch (err: any) {
    console.error('[AI Maintenance] Title cleanup failed:', err.message);
    results.cleanup_titles = { error: err.message };
  }

  console.log('[AI Maintenance] Pipeline complete:', JSON.stringify(results));
  return { task: 'ai_maintenance', ...results };
}
