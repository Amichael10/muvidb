import { supabase } from '../api/_lib/supabase.ts';
import fs from 'fs';

async function auditActions() {
  console.log('Loading active channels and resolved items...');
  let channels: any = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error: chErr } = await supabase
      .from('channels')
      .select('id, name, channel_handle, channel_url, channel_id');
    if (!chErr && data) {
      channels = data;
      break;
    }
    console.log(`Retry fetching channels (attempt ${attempt + 1})...`);
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }

  if (!channels) {
    console.error('Failed to fetch channels after retries.');
    return;
  }

  // Create name / handle lookup maps for active channels
  const channelMap = new Map(); // key -> channel
  channels?.forEach(ch => {
    if (ch.name) channelMap.set(ch.name.toLowerCase().trim(), ch);
    if (ch.channel_handle) channelMap.set(ch.channel_handle.toLowerCase().trim().replace(/^@/, ''), ch);
    if (ch.channel_id) channelMap.set(ch.channel_id.toLowerCase().trim(), ch);
  });

  const progress = JSON.parse(fs.readFileSync('unattached_films_resolved_progress.json', 'utf8'));

  const toDelete = [];
  const toRelink = [];
  const deadOrPrivate = [];
  const unresolvedTimeouts = [];

  for (const item of progress) {
    if (item.status === 'unavailable') {
      deadOrPrivate.push(item);
      continue;
    }
    if (item.status === 'timeout') {
      unresolvedTimeouts.push(item);
      continue;
    }

    const cName = (item.resolved_channel || '').toLowerCase().trim();
    const cHandle = item.resolved_channel_url ? item.resolved_channel_url.replace(/.*\/@/, '').toLowerCase().trim() : '';

    const matchedChannel = channelMap.get(cName) || channelMap.get(cHandle);

    if (matchedChannel) {
      toRelink.push({
        ...item,
        channel_db_id: matchedChannel.id,
        channel_db_name: matchedChannel.name,
      });
    } else {
      toDelete.push(item);
    }
  }

  console.log(`\n=== ACTION AUDIT ===`);
  console.log(`Total Scanned: ${progress.length}`);
  console.log(`Category 1 - To Delete (Deleted/Untracked channels): ${toDelete.length}`);
  console.log(`Category 2 - To Relink (Active DB channels): ${toRelink.length}`);
  console.log(`Dead / Private YouTube Videos: ${deadOrPrivate.length}`);
  console.log(`Timeouts / Unresolved: ${unresolvedTimeouts.length}`);

  // Now let's analyze the Dead / Private videos:
  console.log(`\nAnalyzing ${deadOrPrivate.length} Dead/Private films for Cast & Crew in DB...`);
  const deadIds = deadOrPrivate.map(d => d.id);
  
  // Query credits for these films in chunks
  let filmsWithCredits = 0;
  let totalCreditsCount = 0;
  let filmsWithSynopsis = 0;
  let filmsWithGenres = 0;

  const CHUNK = 100;
  for (let i = 0; i < deadIds.length; i += CHUNK) {
    const chunk = deadIds.slice(i, i + CHUNK);
    
    // Check credits
    const { data: credits } = await supabase
      .from('credits')
      .select('film_id, person_id, role, raw_name')
      .in('film_id', chunk);

    if (credits && credits.length > 0) {
      const distinctFilmsInChunk = new Set(credits.map(c => c.film_id));
      filmsWithCredits += distinctFilmsInChunk.size;
      totalCreditsCount += credits.length;
    }

    // Check films table data
    const { data: filmRows } = await supabase
      .from('films')
      .select('id, synopsis, genres, tmdb_id, director')
      .in('id', chunk);

    filmRows?.forEach(f => {
      if (f.synopsis && f.synopsis.trim().length > 10) filmsWithSynopsis++;
      if (f.genres && f.genres.length > 0) filmsWithGenres++;
    });
  }

  console.log(`\n=== DEAD / PRIVATE FILMS BREAKDOWN (${deadOrPrivate.length} total) ===`);
  console.log(`Films WITH Cast & Crew in DB: ${filmsWithCredits} (Total credits: ${totalCreditsCount})`);
  console.log(`Films WITHOUT Cast & Crew (Empty shells): ${deadOrPrivate.length - filmsWithCredits}`);
  console.log(`Films with synopsis: ${filmsWithSynopsis}`);
  console.log(`Films with genres: ${filmsWithGenres}`);
}

auditActions();
