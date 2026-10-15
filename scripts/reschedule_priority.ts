import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
process.env.SOCIAL_PUBLISH_MODE = 'live';
import sharp from 'sharp';
import { supabase } from '../api/_lib/supabase.js';
import {
  resetSocialStudioData,
  generateSocialDraft,
  scheduleContentItem,
} from '../api/_lib/social_studio.js';
import type { SocialActor, SocialPlatform } from '../api/_lib/social-studio/domain/platform-types.js';

const systemActor: SocialActor = {
  id: '6e985a31-ca3b-42f2-80cc-faa2b7d3fb37',
  email: 'admin@muvidb.com',
  role: 'admin',
};

const PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok'];

// Lagos is UTC+1
const LAGOS_OFFSET_MS = 1 * 60 * 60 * 1000;

function lagosToUtc(dateStr: string, timeStr: string): string {
  // dateStr = 'YYYY-MM-DD', timeStr = 'HH:MM:SS'
  const lagosMs = new Date(`${dateStr}T${timeStr}+01:00`).getTime();
  return new Date(lagosMs).toISOString();
}

async function checkPosterQuality(url: string | null): Promise<{ isPortrait: boolean; width: number; height: number; valid: boolean }> {
  if (!url) return { isPortrait: false, width: 0, height: 0, valid: false };
  try {
    const res = await fetch(url.trim(), { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { isPortrait: false, width: 0, height: 0, valid: false };
    const buf = Buffer.from(await res.arrayBuffer());
    const m = await sharp(buf).metadata();
    const w = m.width || 0;
    const h = m.height || 0;
    return { isPortrait: h > w, width: w, height: h, valid: w >= 450 && h >= 600 };
  } catch {
    return { isPortrait: false, width: 0, height: 0, valid: false };
  }
}

async function scheduleOne(
  type: 'where_to_watch' | 'whats_on_stage',
  entityId: string,
  entityLabel: string,
  scheduledFor: string,
  templateSlug: string,
  slot: string
): Promise<boolean> {
  try {
    const draft = await generateSocialDraft({
      contentType: type,
      sourceEntityId: entityId,
      templateSlug,
      platforms: PLATFORMS,
    }, systemActor);

    if (!draft?.id) { console.warn(`  ⚠️  [${slot}] No draft for "${entityLabel}"`); return false; }

    await scheduleContentItem({ contentItemId: draft.id, scheduledFor }, systemActor);
    console.log(`  ✅ [${slot}] "${entityLabel}" → ${scheduledFor}`);
    return true;
  } catch (err: any) {
    console.error(`  ❌ [${slot}] "${entityLabel}" failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🔄 Step 1: Resetting Social Studio...');
  try { await supabase.from('social_content_events').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  const reset = await resetSocialStudioData(systemActor);
  console.log('✅', reset.message);

  // ── Fix Hafsatu and Makamba: update venue if missing
  console.log('\n🏛️  Fixing plays with missing venue/location...');
  const { data: playsToFix } = await supabase
    .from('plays')
    .select('id, title, venue, city')
    .in('title', ['Hafsatu', 'Makamba', 'The Dein of Agbor']);

  for (const p of playsToFix || []) {
    if (!p.venue || p.venue === 'TBC' || p.venue === 'TBA') {
      console.log(`  ⚠️  "${p.title}" has no venue — skipping from theatre pool`);
    } else {
      console.log(`  ✓  "${p.title}" venue: ${p.venue}, ${p.city}`);
    }
  }

  // ── Fetch new YouTube films (last 5 days — the fresh batch)
  console.log('\n🎬 Step 2: Fetching candidates...');
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
  const { data: rawNewYt } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, youtube_watch_url, created_at, release_date')
    .not('youtube_watch_url', 'is', null)
    .not('poster_url', 'is', null)
    .not('synopsis', 'is', null)
    .gte('created_at', fiveDaysAgo)
    .order('created_at', { ascending: false })
    .limit(30);

  // Also get Yimika's Lies specifically if it's not in the fresh batch
  const { data: rawOlderYt } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, youtube_watch_url, created_at, release_date')
    .not('youtube_watch_url', 'is', null)
    .not('poster_url', 'is', null)
    .not('synopsis', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  // Combine, deduplicate by id, fresh first
  const allYt = [...(rawNewYt || [])];
  for (const f of rawOlderYt || []) {
    if (!allYt.find(x => x.id === f.id)) allYt.push(f);
  }

  // Check poster quality
  const ytFilms: any[] = [];
  for (const f of allYt) {
    const q = await checkPosterQuality(f.poster_url);
    if (q.isPortrait && q.width >= 450 && q.height >= 600) {
      ytFilms.push(f);
      if (ytFilms.length >= 12) break;
    }
  }
  console.log(`  YouTube NEW pool (${ytFilms.length}): ${ytFilms.map(f => f.title).join(', ')}`);

  // ── Theatre plays with real venue only, ordered nearest first, valid poster
  const { data: rawPlays } = await supabase
    .from('plays')
    .select('id, title, status, poster_url, run_start_date, run_end_date, venue, city, performance_time')
    .in('status', ['currently_running', 'upcoming'])
    .not('poster_url', 'is', null)
    .order('run_start_date', { ascending: true, nullsFirst: false });

  const verifiedPlays: any[] = [];
  for (const p of rawPlays || []) {
    // Skip if no real venue
    if (!p.venue || ['TBC', 'TBA', 'TBD', ''].includes((p.venue || '').trim().toUpperCase())) {
      console.log(`  ⏭️  Skipping "${p.title}" — no confirmed venue (${p.venue || 'null'})`);
      continue;
    }
    // Skip Unsplash stock posters
    if (p.poster_url?.includes('unsplash.com')) {
      console.log(`  ⏭️  Skipping "${p.title}" — stock poster`);
      continue;
    }
    const q = await checkPosterQuality(p.poster_url);
    if (q.isPortrait && q.width >= 400) {
      verifiedPlays.push(p);
      console.log(`  ✓  Theatre: "${p.title}" (${p.run_start_date}) @ ${p.venue} ${q.width}x${q.height}`);
    } else {
      console.log(`  ⏭️  "${p.title}" — poster not portrait/too small (${q.width}x${q.height})`);
    }
  }

  // ── Other streaming pools (unchanged logic)
  const { data: nsFilms1 } = await supabase.from('films').select('id, title, poster_url, synopsis, source').eq('source', 'nollistream').not('poster_url', 'is', null).limit(10);
  const { data: nsFilms2 } = await supabase.from('films').select('id, title, poster_url, synopsis, streaming_links').filter('streaming_links', 'neq', '{}').not('poster_url', 'is', null).limit(50);
  const nsFilms = Array.from(new Map([...(nsFilms1 || []), ...(nsFilms2 || []).filter((f: any) => f.streaming_links?.nollistream)].map(f => [f.id, f])).values());

  const { data: docFilms } = await supabase.from('films').select('id, title, poster_url, synopsis, streaming_links, source').filter('streaming_links', 'neq', '{}').not('poster_url', 'is', null).limit(100);
  const docPool = (docFilms || []).filter((f: any) => f.streaming_links?.docuth || f.source === 'docuth');

  const { data: ebFilms } = await supabase.from('films').select('id, title, poster_url, synopsis, source').eq('source', 'ebonylife').not('poster_url', 'is', null).limit(15);
  const { data: hmFilms } = await supabase.from('films').select('id, title, poster_url, synopsis, source').eq('source', 'homitv').not('poster_url', 'is', null).limit(15);
  const { data: crFilms } = await supabase.from('films').select('id, title, poster_url, synopsis, source').eq('source', 'circuits').not('poster_url', 'is', null).limit(15);

  console.log(`  NolliStream: ${nsFilms.length}, Docuth: ${docPool.length}, EbonyLife: ${ebFilms?.length}, HomiTV: ${hmFilms?.length}, Circuits: ${crFilms?.length}`);
  console.log(`  Theatre (verified): ${verifiedPlays.map(p => `${p.title} (${p.run_start_date})`).join(', ')}`);

  // ── SCHEDULING LOGIC
  // TODAY (Oct 15) + TOMORROW (Oct 16) = new YouTube blasts
  // Each day gets MULTIPLE YouTube slots to rotate all 9+ new films quickly
  // Theatre: An Evening of Kwagh-hir TODAY, Behind Closed Doors tomorrow if poster passes
  // Days 3-7 = regular rotation

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Helper: get date string for dayOffset from today
  function dayStr(offset: number): string {
    const d = new Date(todayUtc);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().split('T')[0];
  }

  let ytIdx = 0;
  let nsIdx = 0;
  let docIdx = 0;
  let ebIdx = 0;
  let hmIdx = 0;
  let crIdx = 0;
  let playIdx = 0;

  function nextYt() { const f = ytFilms[ytIdx % (ytFilms.length || 1)]; ytIdx++; return f; }
  function nextNs() { const f = nsFilms[nsIdx % (nsFilms.length || 1)]; nsIdx++; return f; }
  function nextDoc() { const f = docPool[docIdx % (docPool.length || 1)]; docIdx++; return f; }
  function nextEb() { const f = (ebFilms || [])[ebIdx % ((ebFilms?.length) || 1)]; ebIdx++; return f; }
  function nextHm() { const f = (hmFilms || [])[hmIdx % ((hmFilms?.length) || 1)]; hmIdx++; return f; }
  function nextCr() { const f = (crFilms || [])[crIdx % ((crFilms?.length) || 1)]; crIdx++; return f; }
  function nextPlay() { const p = verifiedPlays[playIdx % (verifiedPlays.length || 1)]; playIdx++; return p; }

  console.log('\n📅 Step 3: Scheduling...');

  // ────────────────────────────────────────────
  // TODAY (Day 0) — BLAST new YouTube films
  // Schedule at: 09:00, 11:00, 13:00, 15:00, 17:00, 19:00, 21:00 Lagos time
  // Theatre slot at 21:00 = An Evening of Kwagh-hir (TODAY as requested)
  // ────────────────────────────────────────────
  const today = dayStr(0);
  console.log(`\n--- TODAY: ${today} (New YouTube Blast) ---`);

  const todaySlots = ['09:00:00', '11:00:00', '13:00:00', '15:00:00', '17:00:00', '19:00:00'];

  // Find An Evening of Kwagh-hir specifically
  const kwagPlay = verifiedPlays.find(p => p.title?.toLowerCase().includes('kwagh'));
  if (kwagPlay) {
    // Theatre post at 21:00 Lagos today
    await scheduleOne('whats_on_stage', kwagPlay.id, kwagPlay.title, lagosToUtc(today, '21:00:00'), 'on-stage-theatre-v1', '21:00 🎭');
  }

  for (const slot of todaySlots) {
    const yt = nextYt();
    if (yt) await scheduleOne('where_to_watch', yt.id, yt.title, lagosToUtc(today, slot), 'now-showing-cinemas-v1', slot);
  }

  // ────────────────────────────────────────────
  // TOMORROW (Day 1) — Continue YouTube blast + regular slots
  // ────────────────────────────────────────────
  const tomorrow = dayStr(1);
  console.log(`\n--- TOMORROW: ${tomorrow} (YouTube Blast continued) ---`);

  const tmSlots = [
    { time: '08:30:00', source: 'youtube' },
    { time: '09:30:00', source: 'youtube' },
    { time: '11:00:00', source: 'youtube' },
    { time: '12:30:00', source: 'nollistream' },
    { time: '14:30:00', source: 'youtube' },
    { time: '16:30:00', source: 'ebonylife' },
    { time: '18:30:00', source: 'circuits' },
    { time: '20:30:00', source: 'theatre' },
  ];

  for (const s of tmSlots) {
    if (s.source === 'youtube') { const f = nextYt(); if (f) await scheduleOne('where_to_watch', f.id, f.title, lagosToUtc(tomorrow, s.time), 'now-showing-cinemas-v1', s.time); }
    else if (s.source === 'nollistream') { const f = nextNs(); if (f) await scheduleOne('where_to_watch', f.id, f.title, lagosToUtc(tomorrow, s.time), 'now-showing-cinemas-v1', s.time); }
    else if (s.source === 'ebonylife') { const f = nextEb(); if (f) await scheduleOne('where_to_watch', f.id, f.title, lagosToUtc(tomorrow, s.time), 'now-showing-cinemas-v1', s.time); }
    else if (s.source === 'circuits') { const f = nextCr(); if (f) await scheduleOne('where_to_watch', f.id, f.title, lagosToUtc(tomorrow, s.time), 'now-showing-cinemas-v1', s.time); }
    else if (s.source === 'theatre') { const p = nextPlay(); if (p && p.id !== kwagPlay?.id) await scheduleOne('whats_on_stage', p.id, p.title, lagosToUtc(tomorrow, s.time), 'on-stage-theatre-v1', s.time); }
  }

  // ────────────────────────────────────────────
  // DAYS 2-6 — Normal 7-slot daily rotation
  // ────────────────────────────────────────────
  const dailySlots = [
    { time: '08:30:00', source: 'youtube' },
    { time: '10:30:00', source: 'nollistream' },
    { time: '12:30:00', source: 'docuth' },
    { time: '14:30:00', source: 'ebonylife' },
    { time: '16:30:00', source: 'homitv' },
    { time: '18:30:00', source: 'circuits' },
    { time: '20:30:00', source: 'theatre' },
  ];

  for (let d = 2; d <= 6; d++) {
    const dateStr = dayStr(d);
    console.log(`\n--- Day ${d}: ${dateStr} ---`);
    for (const s of dailySlots) {
      let f: any = null;
      if (s.source === 'youtube') f = nextYt();
      else if (s.source === 'nollistream') f = nextNs();
      else if (s.source === 'docuth') f = nextDoc();
      else if (s.source === 'ebonylife') f = nextEb();
      else if (s.source === 'homitv') f = nextHm();
      else if (s.source === 'circuits') f = nextCr();
      else if (s.source === 'theatre') f = nextPlay();

      if (!f) { console.warn(`  ⚠️  No candidate for ${s.source}`); continue; }

      const type = s.source === 'theatre' ? 'whats_on_stage' : 'where_to_watch';
      const tmpl = s.source === 'theatre' ? 'on-stage-theatre-v1' : 'now-showing-cinemas-v1';
      await scheduleOne(type, f.id, f.title, lagosToUtc(dateStr, s.time), tmpl, s.time);
    }
  }

  console.log('\n🎉 Done! Social studio rescheduled with new YouTube film priority.');
}

main().catch(console.error);
