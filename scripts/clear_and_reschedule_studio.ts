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
  publishContentItemNow,
  reviewContentItem,
} from '../api/_lib/social_studio.js';
import type { SocialActor, SocialPlatform } from '../api/_lib/social-studio/domain/platform-types.js';

const systemActor: SocialActor = {
  id: '6e985a31-ca3b-42f2-80cc-faa2b7d3fb37',
  email: 'admin@muvidb.com',
  role: 'admin',
};

const PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok'];

async function checkPosterQuality(url: string | null): Promise<{ isPortrait: boolean; width: number; height: number; valid: boolean }> {
  if (!url) return { isPortrait: false, width: 0, height: 0, valid: false };
  try {
    const cleanUrl = url.trim();
    const res = await fetch(cleanUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { isPortrait: false, width: 0, height: 0, valid: false };
    const buf = Buffer.from(await res.arrayBuffer());
    const m = await sharp(buf).metadata();
    const width = m.width || 0;
    const height = m.height || 0;
    return {
      isPortrait: height > width,
      width,
      height,
      valid: width >= 400 && height >= 400,
    };
  } catch {
    return { isPortrait: false, width: 0, height: 0, valid: false };
  }
}

async function main() {
  console.log('🚀 Step 1: Clearing Social Studio data...');
  try {
    await supabase.from('social_content_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (e) {
    // ignore
  }
  const resetResult = await resetSocialStudioData(systemActor);
  console.log('✅ Social Studio reset:', resetResult.message);

  console.log('\n🔍 Step 2: Fetching curated candidates...');

  // 1. YouTube candidates: Query newest / recently released Page 1 films with proper portrait posters (strictly released within last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: rawYt } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, youtube_watch_url, created_at, updated_at, release_date')
    .not('youtube_watch_url', 'is', null)
    .not('poster_url', 'is', null)
    .not('synopsis', 'is', null)
    .gte('release_date', thirtyDaysAgo)
    .order('release_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(40);

  const ytFilms: any[] = [];
  for (const f of rawYt || []) {
    const q = await checkPosterQuality(f.poster_url);
    if (q.isPortrait && q.width >= 500 && q.height >= 600) {
      ytFilms.push(f);
      if (ytFilms.length >= 10) break;
    }
  }

  // 2. NolliStream candidates
  const { data: nsFilms1 } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, source, streaming_links')
    .eq('source', 'nollistream')
    .not('poster_url', 'is', null)
    .limit(10);
  const { data: nsFilms2 } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, source, streaming_links')
    .filter('streaming_links', 'neq', '{}')
    .not('poster_url', 'is', null)
    .limit(50);
  const nsFilms = [...(nsFilms1 || []), ...(nsFilms2 || []).filter(f => f.streaming_links?.nollistream)];
  const uniqueNs = Array.from(new Map(nsFilms.map(f => [f.id, f])).values());

  // 3. Docuth candidates
  const { data: docFilms } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, source, streaming_links')
    .filter('streaming_links', 'neq', '{}')
    .not('poster_url', 'is', null)
    .limit(100);
  const uniqueDoc = (docFilms || []).filter(f => f.streaming_links?.docuth || f.source === 'docuth');

  // 4. EbonyLife candidates
  const { data: ebFilms } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, source, streaming_links')
    .eq('source', 'ebonylife')
    .not('poster_url', 'is', null)
    .limit(15);
  const uniqueEb = ebFilms || [];

  // 5. HomiTV candidates
  const { data: hmFilms } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, source, streaming_links')
    .eq('source', 'homitv')
    .not('poster_url', 'is', null)
    .limit(15);
  const uniqueHm = hmFilms || [];

  // 6. Circuits candidates
  const { data: crFilms } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, source, streaming_links')
    .eq('source', 'circuits')
    .not('poster_url', 'is', null)
    .limit(15);
  const uniqueCr = crFilms || [];

  // 7. Upcoming Theatre Plays (Strictly upcoming, verified portrait posters only - NO backdrops!)
  // Order plays chronologically by nearest start date first!
  const { data: upcomingPlays } = await supabase
    .from('plays')
    .select('id, title, status, poster_url, run_start_date, run_end_date, venue, performance_time, source_url, synopsis')
    .eq('status', 'upcoming')
    .not('poster_url', 'is', null)
    .order('run_start_date', { ascending: true, nullsFirst: false });

  const verifiedStagePlays: any[] = [];
  for (const p of upcomingPlays || []) {
    if (p.poster_url?.includes('unsplash.com')) continue; // Skip generic stock placeholders
    const q = await checkPosterQuality(p.poster_url);
    if (q.isPortrait && q.width >= 500) {
      verifiedStagePlays.push(p);
    }
  }

  // Sort upcoming plays so those nearest to today come first
  verifiedStagePlays.sort((a, b) => {
    const da = a.run_start_date ? new Date(a.run_start_date).getTime() : Infinity;
    const db = b.run_start_date ? new Date(b.run_start_date).getTime() : Infinity;
    return da - db;
  });

  console.log(`  - YouTube pool (Page 1 Crisp Portraits): ${ytFilms.map(f => f.title).join(', ')}`);
  console.log(`  - NolliStream pool: ${uniqueNs.length}`);
  console.log(`  - Docuth pool: ${uniqueDoc.length}`);
  console.log(`  - EbonyLife pool: ${uniqueEb.length}`);
  console.log(`  - HomiTV pool: ${uniqueHm.length}`);
  console.log(`  - Circuits pool: ${uniqueCr.length}`);
  console.log(`  - Live Theatre pool (Ordered Nearest Date First): ${verifiedStagePlays.map(p => `${p.title} (${p.run_start_date || 'TBA'})`).join(', ')}`);

  const slotSchedule = [
    { platformName: 'YouTube', time: '08:30:00', getEntity: (day: number) => ytFilms[day % (ytFilms.length || 1)]?.id, type: 'where_to_watch' as const },
    { platformName: 'NolliStream', time: '10:30:00', getEntity: (day: number) => uniqueNs[day % (uniqueNs.length || 1)]?.id, type: 'where_to_watch' as const },
    { platformName: 'Docuth', time: '12:30:00', getEntity: (day: number) => uniqueDoc[day % (uniqueDoc.length || 1)]?.id, type: 'where_to_watch' as const },
    { platformName: 'EbonyLife ON Plus', time: '14:30:00', getEntity: (day: number) => uniqueEb[day % (uniqueEb.length || 1)]?.id, type: 'where_to_watch' as const },
    { platformName: 'HomiTV', time: '16:30:00', getEntity: (day: number) => uniqueHm[day % (uniqueHm.length || 1)]?.id, type: 'where_to_watch' as const },
    { platformName: 'Circuits', time: '18:30:00', getEntity: (day: number) => uniqueCr[day % (uniqueCr.length || 1)]?.id, type: 'where_to_watch' as const },
    { platformName: 'Live Theatre', time: '20:30:00', getEntity: (day: number) => verifiedStagePlays[day % (verifiedStagePlays.length || 1)]?.id, type: 'whats_on_stage' as const },
  ];

  console.log('\n📅 Step 3: Scheduling 7 days of daily posts (7 slots/day = 49 posts)...');

  const now = new Date();
  const scheduledItems: Array<{ contentItemId: string; title: string; scheduledFor: string; type: string }> = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset + 1));
    const dateStr = targetDate.toISOString().split('T')[0];

    console.log(`\n--- Scheduling Day ${dayOffset + 1}: ${dateStr} ---`);

    for (const slot of slotSchedule) {
      const entityId = slot.getEntity(dayOffset);
      if (!entityId) {
        console.warn(`  ⚠️ No candidate for ${slot.platformName} on ${dateStr}`);
        continue;
      }

      const scheduledFor = `${dateStr}T${slot.time}.000Z`;

      try {
        const draft = await generateSocialDraft(
          {
            contentType: slot.type,
            sourceEntityId: entityId,
            templateSlug: slot.type === 'whats_on_stage' ? 'on-stage-theatre-v1' : 'now-showing-cinemas-v1',
            platforms: PLATFORMS,
          },
          systemActor,
        );

        // Approve and schedule
        await reviewContentItem({ contentItemId: draft.contentItem.id, action: 'submit' }, systemActor);
        await reviewContentItem({ contentItemId: draft.contentItem.id, action: 'approve' }, systemActor);
        await scheduleContentItem({ contentItemId: draft.contentItem.id, scheduledFor }, systemActor);

        console.log(`  ✅ [${slot.time.slice(0, 5)}] ${slot.platformName}: "${draft.contentItem.title}"`);
        scheduledItems.push({
          contentItemId: draft.contentItem.id,
          title: draft.contentItem.title,
          scheduledFor,
          type: slot.type,
        });
      } catch (err: any) {
        console.error(`  ❌ Failed generating ${slot.platformName} on ${dateStr}:`, err.message);
      }
    }
  }

  console.log(`\n🎉 Successfully scheduled ${scheduledItems.length} curated posts across the next 7 days!`);

  console.log('\n⚡ Step 4: Testing 1 post each triggered immediately to Instagram, Facebook, and TikTok...');
  
  // 1. YouTube Film Test Post: Starting from user's new Page 1 film: 'Agbala' (Ultra-sharp 1507x2000 poster)
  const crispTestFilm = ytFilms[0];
  if (crispTestFilm) {
    try {
      console.log(`\n▶️ Generating and Triggering Immediate Publish for Page 1 YouTube Film: "${crispTestFilm.title}"...`);
      const testStreamDraft = await generateSocialDraft(
        {
          contentType: 'where_to_watch',
          sourceEntityId: crispTestFilm.id,
          templateSlug: 'now-showing-cinemas-v1',
          platforms: PLATFORMS,
        },
        systemActor,
      );
      const pubStreaming = await publishContentItemNow({ contentItemId: testStreamDraft.contentItem.id }, systemActor);
      console.log('  Streaming publish result:', JSON.stringify(pubStreaming, null, 2));
    } catch (e: any) {
      console.error('  Streaming publish error:', e.message);
    }
  }

  // 2. Live Stage Test Post: Starting from nearest upcoming play: 'Kiniun' (1080x1350 stage poster, starts Oct 10)
  const nearestStagePlay = verifiedStagePlays[0];
  if (nearestStagePlay) {
    try {
      console.log(`\n▶️ Generating and Triggering Immediate Publish for Nearest Live Stage: "${nearestStagePlay.title}"...`);
      const testTheatreDraft = await generateSocialDraft(
        {
          contentType: 'whats_on_stage',
          sourceEntityId: nearestStagePlay.id,
          templateSlug: 'on-stage-theatre-v1',
          platforms: PLATFORMS,
        },
        systemActor,
      );
      const pubTheatre = await publishContentItemNow({ contentItemId: testTheatreDraft.contentItem.id }, systemActor);
      console.log('  Theatre publish result:', JSON.stringify(pubTheatre, null, 2));
    } catch (e: any) {
      console.error('  Theatre publish error:', e.message);
    }
  }

  console.log('\n🏁 Finished clear, reschedule, and test triggers with verified crisp portrait posters and chronologically ordered plays!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
