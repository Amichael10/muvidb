import { supabase } from './lib/db.js';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { mirrorIfExternal } from '../api/_lib/image_mirror.js';

function parseTitleAndCast(rawTitle: string): { cleanTitle: string; cast: string[] } {
  const cast: string[] = [];
  
  // Extract cast after patterns like / Starring / FT / -
  const starringMatch = rawTitle.match(/(?:Starring|ft\.?|featuring|feat\.?|\|)\s+([^-\(\/]+)/i);
  if (starringMatch) {
    const rawNames = starringMatch[1].split(/[,&|\/]/);
    for (const n of rawNames) {
      const cleanName = n.trim().replace(/\b(?:202\d|latest|nollywood|movie|full|hd)\b/gi, '').trim();
      if (cleanName.length > 2 && !/nigerian|movie|latest|2024|2025|2026/i.test(cleanName)) {
        cast.push(cleanName);
      }
    }
  }

  // Look for slash or hyphen separated actors (e.g. "KAYAMATA AT CHRISTMAS / BOLAJI OGUNMOLA, MICHAEL DAPPA...")
  const slashParts = rawTitle.split(/[\/\-–|]/);
  if (slashParts.length > 1) {
    for (let i = 1; i < slashParts.length; i++) {
      const part = slashParts[i].trim();
      const names = part.split(/[,&]/);
      for (const n of names) {
        const cleanName = n.trim().replace(/\b(?:202\d|latest|nollywood|movie|full|hd|xmas|drama|nigerian|nigeria)\b/gi, '').trim();
        if (cleanName.length > 2 && cleanName.split(' ').length >= 2 && !/movie|latest|full|hd/i.test(cleanName)) {
          cast.push(cleanName);
        }
      }
    }
  }

  let cleaned = cleanTitle(rawTitle);
  return { cleanTitle: cleaned, cast: Array.from(new Set(cast)) };
}

function makeSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function promoteJoyflix() {
  console.log('=== Promoting Joyflix Films & Linking Cast Credits ===');
  const channelId = '9e366ebb-280d-4047-86fe-4c7ef1434afd';

  const { data: vids } = await supabase
    .from('channel_videos')
    .select('*')
    .eq('channel_id', channelId);

  console.log(`Processing ${vids?.length || 0} Joyflix channel videos...`);

  let promoted = 0;
  let creditsCount = 0;

  for (const v of vids || []) {
    // 1. Clean the title and extract actors
    const { cleanTitle: extractedTitle, cast: extractedCast } = parseTitleAndCast(v.title);
    const title = extractedTitle || cleanTitle(v.title);
    const durationMins = v.duration_seconds ? Math.round(v.duration_seconds / 60) : 90;
    const year = v.published_at ? new Date(v.published_at).getFullYear() : 2024;
    const slug = makeSlug(title);

    // 2. Check if film exists by youtube_id, slug or title
    let filmId: string | null = v.film_id;

    if (!filmId) {
      let { data: existingFilm } = await supabase
        .from('films')
        .select('id, title')
        .eq('source_video_id', v.video_id)
        .maybeSingle();

      if (!existingFilm && slug) {
        const { data: bySlug } = await supabase
          .from('films')
          .select('id, title')
          .eq('slug', slug)
          .maybeSingle();
        if (bySlug) existingFilm = bySlug;
      }

      if (existingFilm) {
        filmId = existingFilm.id;
        await supabase.from('films').update({
          distributor: 'Joyflix',
          source_video_id: v.video_id,
          youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
          is_nollywood: true,
          status: 'released',
          is_published: true
        }).eq('id', filmId);
        console.log(`🔗 Linked existing film: "${existingFilm.title}" (ID: ${filmId})`);
      } else {
        // Create new film record
        const poster = await mirrorIfExternal(v.thumbnail_url, 'posters', `joyflix-${v.video_id}`);
        const { data: newFilm, error: insErr } = await supabase
          .from('films')
          .insert({
            title,
            slug,
            year,
            runtime_minutes: durationMins,
            source_video_id: v.video_id,
            youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
            distributor: 'Joyflix',
            poster_url: poster || v.thumbnail_url,
            backdrop_url: poster || v.thumbnail_url,
            is_nollywood: true,
            status: 'released',
            is_published: true,
            synopsis: `A Nollywood feature film presented by Joyflix, starring ${extractedCast.slice(0, 4).join(', ') || 'an ensemble cast'}.`
          })
          .select('id')
          .single();

        if (insErr) {
          console.error(`Error creating film "${title}":`, insErr.message);
          continue;
        }
        filmId = newFilm.id;
        promoted++;
        console.log(`⭐ Created Film: "${title}" (${year}) - ${durationMins}m`);
      }

      // Link back to channel_videos
      await supabase
        .from('channel_videos')
        .update({ film_id: filmId, is_hidden: false })
        .eq('id', v.id);
    }

    // 3. Attach Credits for extracted cast
    if (filmId && extractedCast.length > 0) {
      for (const actorName of extractedCast) {
        if (!actorName || actorName.length < 3 || /movie|nigerian|latest|full|hd|part/i.test(actorName)) continue;
        const actorSlug = makeSlug(actorName);

        // Find or create person
        let personId: string | null = null;
        const { data: existingPerson } = await supabase
          .from('people')
          .select('id, name')
          .or(`slug.eq.${actorSlug},name.ilike.${actorName}`)
          .maybeSingle();

        if (existingPerson) {
          personId = existingPerson.id;
        } else {
          const { data: newPerson, error: pErr } = await supabase
            .from('people')
            .insert({
              name: actorName,
              slug: actorSlug,
              nationality: 'Nigerian',
              bio: `${actorName} is a Nigerian actor featured in Nollywood productions including "${title}".`
            })
            .select('id')
            .single();
          if (!pErr && newPerson) personId = newPerson.id;
        }

        if (personId) {
          // Check if credit exists
          const { data: existingCredit } = await supabase
            .from('credits')
            .select('id')
            .eq('film_id', filmId)
            .eq('person_id', personId)
            .maybeSingle();

          if (!existingCredit) {
            const { error: credErr } = await supabase
              .from('credits')
              .insert({
                film_id: filmId,
                person_id: personId,
                role: 'Actor',
                character_name: 'Lead Cast',
                order_index: creditsCount
              });

            if (!credErr) {
              creditsCount++;
              console.log(`  ✓ Linked Credit: ${actorName} -> "${title}"`);
            }
          }
        }
      }
    }
  }

  console.log('\n===============================================================');
  console.log(`Promoted / Restored Films: ${promoted}`);
  console.log(`Total Credits Linked: ${creditsCount}`);
  console.log('===============================================================');
  process.exit(0);
}

promoteJoyflix().catch(e => {
  console.error(e);
  process.exit(1);
});
