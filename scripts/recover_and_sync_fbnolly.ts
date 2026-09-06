import { supabase } from '../api/_lib/supabase.ts';
import dotenv from 'dotenv';
dotenv.config();

function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 60 + minutes + Math.round(seconds / 60);
}

function cleanMovieTitle(raw: string): string {
  let title = raw
    .replace(/Part\s*(\d+)/i, 'PART $1')
    .replace(/–\s*Latest.*$/i, '')
    .replace(/-\s*Latest.*$/i, '')
    .replace(/\|\s*Latest.*$/i, '')
    .replace(/Latest\s+(?:Nigerian|Yoruba|Nollywood)\s+Movie.*$/i, '')
    .replace(/\|\s*Full\s+Movie.*$/i, '')
    .replace(/\/\s*Full\s+Movie.*$/i, '')
    .replace(/#\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Clean trailing punctuation
  title = title.replace(/[-–|/:]\s*$/, '').trim();
  return title;
}

async function findOrCreatePerson(name: string) {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length < 2) return null;

  const { data: existing } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', cleanName)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      known_for_department: 'Acting',
    })
    .select('id, name')
    .single();

  if (error) {
    console.error(`Error creating person ${cleanName}:`, error.message);
    return null;
  }
  return created;
}

async function main() {
  const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
  const channelId = 'UCBH_ZRnc2aMYpv2A6YvvL3w';

  console.log('=== STEP 1: FETCHING CHANNEL DETAILS FROM YOUTUBE ===');
  const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics,brandingSettings&id=${channelId}&key=${apiKey}`);
  const chData = await chRes.json();
  const chItem = chData.items[0];

  const channelInfo = {
    channel_id: channelId,
    name: chItem.snippet.title,
    channel_handle: chItem.snippet.customUrl || '@fbnollytv',
    channel_url: `https://www.youtube.com/${chItem.snippet.customUrl || '@fbnollytv'}`,
    description: chItem.snippet.description || 'Official FB NOLLY TV YouTube Channel',
    category: 'Yoruba',
    country: 'Nigeria',
    subscriber_count: parseInt(chItem.statistics.subscriberCount || '0', 10),
    thumbnail_url: chItem.snippet.thumbnails?.high?.url || chItem.snippet.thumbnails?.default?.url,
    banner_url: chItem.brandingSettings?.image?.bannerExternalUrl || null,
    owner_person_id: 'c912ad43-c7f3-493a-86f7-a30290c0ae93', // Faithia Balogun / Williams
    sync_enabled: true,
    is_featured: false,
  };

  const { data: existingChannel } = await supabase
    .from('channels')
    .select('id')
    .eq('channel_id', channelId)
    .single();

  let dbChannelId = existingChannel?.id;

  if (dbChannelId) {
    await supabase.from('channels').update(channelInfo).eq('id', dbChannelId);
    console.log(`Updated existing channel record: ${dbChannelId}`);
  } else {
    const { data: newCh, error: chErr } = await supabase
      .from('channels')
      .insert(channelInfo)
      .select('id')
      .single();
    if (chErr) {
      console.error('Error inserting channel:', chErr);
      return;
    }
    dbChannelId = newCh.id;
    console.log(`Created new channel record: ${dbChannelId}`);
  }

  console.log('\n=== STEP 2: FETCHING ALL VIDEOS FROM YOUTUBE ===');
  const uploadsPlaylistId = chItem.contentDetails.relatedPlaylists.uploads;
  let allPlaylistItems: any[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&pageToken=${pageToken || ''}&key=${apiKey}`;
    const plRes = await fetch(plUrl);
    const plData = await plRes.json();
    allPlaylistItems = allPlaylistItems.concat(plData.items || []);
    pageToken = plData.nextPageToken;
  } while (pageToken);

  console.log(`Found ${allPlaylistItems.length} videos on YouTube.`);

  const videoIds = allPlaylistItems.map(p => p.contentDetails.videoId);
  const videoDetailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${apiKey}`);
  const videoDetailsData = await videoDetailsRes.json();
  const videoDetailsMap = new Map(videoDetailsData.items.map((v: any) => [v.id, v]));

  console.log('\n=== STEP 3: SYNCING VIDEOS, CREATING FILMS & ATTACHING CREDITS ===');

  let filmsCreated = 0;
  let creditsAdded = 0;
  let videosUpserted = 0;

  for (const item of allPlaylistItems) {
    const videoId = item.contentDetails.videoId;
    const vDetail: any = videoDetailsMap.get(videoId) || item;
    const snippet = vDetail.snippet;
    const contentDetails = vDetail.contentDetails;

    const rawTitle = snippet.title;
    const durationMinutes = parseDuration(contentDetails?.duration || '');
    const publishedAt = snippet.publishedAt;
    const releaseYear = publishedAt ? new Date(publishedAt).getFullYear() : 2024;
    const isTrailer = /trailer|teaser|promo|preview|short/i.test(rawTitle);
    const isFullMovie = durationMinutes >= 35 || (!isTrailer && /movie|part/i.test(rawTitle) && durationMinutes > 15);

    console.log(`\nProcessing: "${rawTitle}" (${durationMinutes}m) [FullMovie: ${isFullMovie}]`);

    let filmId: string | null = null;

    if (isFullMovie) {
      const cleanTitle = cleanMovieTitle(rawTitle);
      const posterUrl = snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url;

      // Check if film already exists by source_video_id or trailer_youtube_id
      const { data: existingFilm } = await supabase
        .from('films')
        .select('id, title')
        .or(`source_video_id.eq.${videoId},trailer_youtube_id.eq.${videoId}`)
        .limit(1);

      if (existingFilm && existingFilm.length > 0) {
        filmId = existingFilm[0].id;
        console.log(`  -> Existing film found: "${existingFilm[0].title}" (${filmId})`);
      } else {
        // Create film entry
        const filmPayload = {
          title: cleanTitle,
          original_title: rawTitle,
          synopsis: snippet.description || null,
          release_date: publishedAt ? publishedAt.split('T')[0] : `${releaseYear}-01-01`,
          year: releaseYear,
          runtime_minutes: durationMinutes > 0 ? durationMinutes : null,
          source: 'youtube',
          source_video_id: videoId,
          youtube_watch_url: `https://www.youtube.com/watch?v=${videoId}`,
          trailer_youtube_id: videoId,
          poster_url: posterUrl,
          backdrop_url: posterUrl,
          status: 'released',
          release_type: 'youtube',
          language: 'Yoruba',
          content_type: 'movie',
        };

        const { data: newFilm, error: filmErr } = await supabase
          .from('films')
          .insert(filmPayload)
          .select('id, title')
          .single();

        if (filmErr) {
          console.error(`  -> Error inserting film:`, filmErr.message);
        } else {
          filmId = newFilm.id;
          filmsCreated++;
          console.log(`  -> Created film: "${newFilm.title}" (${filmId})`);
        }
      }

      // If film exists or created, parse and assign credits
      if (filmId) {
        const castCandidates = new Set<string>();

        // Always add Faithia Williams as Producer and Cast
        castCandidates.add('Faithia Williams');

        const titleCastMatches = [
          'Eniola Ajao', 'Bolanle Ninalowo', 'Ninolowo Bolanle', 'Odunlade Adekola',
          'Femi Adebayo', 'Chioma Akpotha', 'Seun Akindele', 'Ibrahim Chatta',
          'Ayo Olaiya', 'Ayo OlaIya', 'Wunmi Ajiboye', 'Habeeb Alagbe', 'Nike Hamzat',
          'Akin Olaiya', 'Bose Joseph', 'Juliet Jato', 'Sola Gaji',
          'Ejiro Okurame', 'Kelechi Udeagbe', 'Sola Sobowale', 'Lateef Adedimeji'
        ];

        for (const actor of titleCastMatches) {
          if (rawTitle.toLowerCase().includes(actor.toLowerCase())) {
            let normalized = actor;
            if (actor.toLowerCase() === 'ninolowo bolanle') normalized = 'Bolanle Ninalowo';
            if (actor.toLowerCase() === 'ayo olaiya') normalized = 'Ayo Olaiya';
            castCandidates.add(normalized);
          }
        }

        // Attach Producer credit for Faithia Williams
        const { data: existingProdCredit } = await supabase
          .from('credits')
          .select('id')
          .eq('film_id', filmId)
          .eq('person_id', 'c912ad43-c7f3-493a-86f7-a30290c0ae93')
          .eq('role', 'Producer');

        if (!existingProdCredit || existingProdCredit.length === 0) {
          await supabase.from('credits').insert({
            film_id: filmId,
            person_id: 'c912ad43-c7f3-493a-86f7-a30290c0ae93',
            role: 'Producer',
            role_detail: 'Executive Producer',
          });
          creditsAdded++;
        }

        // Attach Cast credits for each candidate
        for (const actorName of castCandidates) {
          const person = await findOrCreatePerson(actorName);
          if (person) {
            const { data: existingCastCredit } = await supabase
              .from('credits')
              .select('id')
              .eq('film_id', filmId)
              .eq('person_id', person.id)
              .eq('role', 'Cast');

            if (!existingCastCredit || existingCastCredit.length === 0) {
              await supabase.from('credits').insert({
                film_id: filmId,
                person_id: person.id,
                role: 'Cast',
                role_detail: 'Lead Cast',
              });
              creditsAdded++;
              console.log(`    + Added credit: ${person.name} (Cast)`);
            }
          }
        }
      }
    }

    // Upsert into channel_videos
    const { data: existingCv } = await supabase
      .from('channel_videos')
      .select('id')
      .eq('video_id', videoId)
      .limit(1);

    const videoRecord: any = {
      channel_id: dbChannelId,
      video_id: videoId,
      title: rawTitle,
      published_at: publishedAt,
      duration_seconds: durationMinutes * 60,
      thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
      film_id: filmId,
      match_status: filmId ? 'auto' : 'unmatched',
    };

    if (existingCv && existingCv.length > 0) {
      const { error: updErr } = await supabase.from('channel_videos').update(videoRecord).eq('id', existingCv[0].id);
      if (updErr) console.error(`  -> Error updating channel_video:`, updErr.message);
    } else {
      const { error: insErr } = await supabase.from('channel_videos').insert(videoRecord);
      if (insErr) console.error(`  -> Error inserting channel_video:`, insErr.message);
    }
    videosUpserted++;
  }

  console.log('\n=============================================');
  console.log(`🎉 RECOVERY COMPLETE FOR FB NOLLY TV`);
  console.log(`- Channel ID in DB: ${dbChannelId}`);
  console.log(`- Videos upserted: ${videosUpserted}`);
  console.log(`- Films created: ${filmsCreated}`);
  console.log(`- Credits attached: ${creditsAdded}`);
  console.log('=============================================');
}

main().catch(console.error);
