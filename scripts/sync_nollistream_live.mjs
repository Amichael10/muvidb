import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanTitle(str) {
  if (!str) return '';
  return str
    .replace(/\s+/g, ' ')
    .trim();
}

const API_BASE = 'https://backend.nollistream.net';
const WEB_BASE = 'https://nollistream.net';

const email = process.env.NOLLISTREAM_EMAIL?.trim();
const password = process.env.NOLLISTREAM_PASSWORD?.trim();

function normalizeSourceTitle(value) {
  return cleanTitle(
    value
      .replace(/\s*\|\s*Movie\s*$/i, '')
      .replace(/\s*\|\s*Movies\s*$/i, '')
      .replace(/\s*\|\s*Series\s*$/i, '')
      .replace(/\s*\|\s*Thriller\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim(),
  ).trim();
}

function isTrailerOrPromo(title) {
  const t = title || '';
  if (/\btrailer\b/i.test(t) || /\bteaser\b/i.test(t)) return true;
  if (/nollistream/i.test(t)) return true;
  if (/what'?s next|african stories deserve|wonders of nollywood/i.test(t)) return true;
  if (/^test\b|upload|resume file|mkmk|^wizkid$/i.test(t.trim())) return true;
  return false;
}

function parseRuntime(value) {
  if (!value) return null;
  const parts = value.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return Math.max(0, parts[0] * 60 + parts[1] + Math.round(parts[2] / 60));
  if (parts.length === 2) return Math.max(0, parts[0] + Math.round(parts[1] / 60));
  return null;
}

function cleanSynopsis(value) {
  if (!value) return null;
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').replace(/\.\.+/g, '.').trim() || null;
}

function normalizePersonName(name) {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

async function runNolliSync() {
  console.log('🚀 Starting NolliStream Direct Live Sync...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const req = context.request;

  console.log(`Logging into ${API_BASE}/api/user/login ...`);
  const loginRes = await req.post(`${API_BASE}/api/user/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email, password }
  });
  const loginJson = await loginRes.json();
  if (!loginJson?.success || !loginJson?.data?.accessToken) {
    throw new Error(`Login failed: ${JSON.stringify(loginJson)}`);
  }
  const token = loginJson.data.accessToken;
  console.log('✅ Logged in successfully! Token obtained.');

  const byId = new Map();

  // 1. Fetch recommendedMovies
  console.log('Fetching recommended movies / sections...');
  const recRes = await req.get(`${API_BASE}/api/video/recommendedMovies`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const recJson = await recRes.json();
  if (Array.isArray(recJson?.sections)) {
    for (const section of recJson.sections) {
      for (const v of section.videos || []) {
        if (v?._id && v?.title && v.video_approve_status !== false) {
          byId.set(v._id, v);
        }
      }
    }
  }

  // 2. Comprehensive search sweep across alphabet, numbers, and common terms
  const SEARCH_QUERIES = [
    ...'abcdefghijklmnopqrstuvwxyz'.split(''),
    ...'0123456789'.split(''),
    'downhill', 'the', 'love', 'movie', 'part', 'man', 'woman', 'king', 'queen', 'house', 'family', 'heart',
    'Action', 'Crime', 'Comedy', 'Drama', 'Horror', 'Mystery', 'Family',
    'Adventure', 'Western', 'History', 'Fantasy', 'TV Movie', 'Nollywood', 'Marriage', 'Secret', 'Lies'
  ];

  console.log(`Running search sweep across ${SEARCH_QUERIES.length} queries...`);
  for (const q of SEARCH_QUERIES) {
    try {
      const sRes = await req.post(`${API_BASE}/api/video/search`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: { query: q }
      });
      const sJson = await sRes.json();
      if (sJson?.success) {
        for (const v of sJson.data || sJson.videos || []) {
          if (v?._id && v?.title && v.video_approve_status !== false) {
            byId.set(v._id, v);
          }
        }
      }
    } catch {}
  }

  console.log(`\n🎉 Discovered ${byId.size} unique titles from NolliStream!`);

  // Check specifically for Downhill
  let downhillFound = false;
  for (const v of byId.values()) {
    if (v.title?.toLowerCase().includes('downhill')) {
      console.log(`Found Downhill: [${v._id}] "${v.title}" (${v.duration}) - Thumbnail: ${v.thumbnail}`);
      downhillFound = true;
    }
  }
  if (!downhillFound) {
    console.log('Searching specifically for "downhill"...');
  }

  // Sync to MuviDB database
  let created = 0;
  let updated = 0;
  let untouched = 0;

  for (const v of byId.values()) {
    const rawTitle = v.title || '';
    if (isTrailerOrPromo(rawTitle)) continue;
    const title = normalizeSourceTitle(rawTitle);
    if (!title || isTrailerOrPromo(title)) continue;

    const runtimeMinutes = parseRuntime(v.duration);
    const synopsis = cleanSynopsis(v.description);
    const genres = [...new Set((v.category || []).map(g => String(g).trim()).filter(Boolean))];
    const posterUrl = v.thumbnail || null;
    const watchUrl = `${WEB_BASE}/movie/${v._id}`;
    const castNames = [...new Set((v.cast || []).map(normalizePersonName).filter(n => n.length >= 2))];
    const directorNames = [...new Set((v.director || []).map(normalizePersonName).filter(n => n.length >= 2))];

    // Find existing film in MuviDB
    const { data: existing } = await supabase
      .from('films')
      .select('id, title, streaming_links, poster_url, backdrop_url, release_type, runtime_minutes, synopsis, genres')
      .ilike('title', title)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const links = existing.streaming_links || {};
      const needsUpdate = links.nollistream !== watchUrl ||
        (!existing.poster_url && posterUrl) ||
        (!existing.backdrop_url && posterUrl) ||
        (!existing.runtime_minutes && runtimeMinutes) ||
        (!existing.synopsis && synopsis);

      if (needsUpdate) {
        const patch = {
          streaming_links: { ...links, nollistream: watchUrl },
          release_type: existing.release_type || 'nollistream',
          updated_at: new Date().toISOString()
        };
        if (!existing.poster_url && posterUrl) patch.poster_url = posterUrl;
        if (!existing.backdrop_url && posterUrl) patch.backdrop_url = posterUrl;
        if (!existing.runtime_minutes && runtimeMinutes) patch.runtime_minutes = runtimeMinutes;
        if (!existing.synopsis && synopsis) patch.synopsis = synopsis;
        if ((!existing.genres || existing.genres.length === 0) && genres.length > 0) patch.genres = genres;

        await supabase.from('films').update(patch).eq('id', existing.id);
        console.log(`[updated] "${title}" -> linked to NolliStream`);
        updated++;
      } else {
        untouched++;
      }
    } else {
      // Insert new film
      const newFilm = {
        title,
        synopsis,
        runtime_minutes: runtimeMinutes,
        poster_url: posterUrl,
        backdrop_url: posterUrl,
        genres: genres.length > 0 ? genres : ['Drama'],
        content_type: 'movie',
        release_type: 'nollistream',
        source: 'nollistream',
        streaming_links: { nollistream: watchUrl },
        needs_review: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: inserted, error: insErr } = await supabase
        .from('films')
        .insert(newFilm)
        .select('id')
        .single();

      if (insErr) {
        console.error(`[insert error] "${title}":`, insErr.message);
      } else {
        console.log(`[created] "${title}" (ID: ${inserted.id})`);
        created++;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`✨ NolliStream Sync Complete!`);
  console.log(`Discovered: ${byId.size}`);
  console.log(`Created new: ${created}`);
  console.log(`Updated existing: ${updated}`);
  console.log(`Already synced: ${untouched}`);
  console.log(`========================================\n`);

  await browser.close();
}

runNolliSync().catch(err => console.error('Fatal error:', err));
