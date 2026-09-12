import { supabase } from './lib/db';

async function untoggleCinemaFilms() {
  console.log("=== STARTING CINEMA STATUS UNTOGGLE BATCH PROCESS ===");

  // 1. Fetch all showtimes
  const { data: showtimeRows, error: showtimeErr } = await supabase.from('showtimes').select('film_id');
  if (showtimeErr) {
    console.error("Error fetching showtimes:", showtimeErr);
    return;
  }
  const filmIdsWithShowtimes = new Set((showtimeRows || []).map(s => s.film_id).filter(Boolean));
  console.log(`Verified films in showtimes table: ${filmIdsWithShowtimes.size}`);

  let totalScanned = 0;
  let totalCinemaMarked = 0;
  let totalVerifiedToKeep = 0;
  
  // Categorize film IDs to update
  const toSetNull: string[] = [];
  const toSetYoutube: string[] = [];
  const toSetNetflix: string[] = [];
  const toSetPrime: string[] = [];

  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  console.log("Scanning catalog...");

  while (hasMore) {
    const { data: films, error } = await supabase
      .from('films')
      .select('id, title, year, release_type, is_in_cinemas, box_office_domestic, box_office_source, source, streaming_links, youtube_watch_url')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`Error at offset ${offset}:`, error);
      break;
    }

    if (!films || films.length === 0) {
      hasMore = false;
      break;
    }

    totalScanned += films.length;

    for (const film of films) {
      const isMarkedCinema = film.is_in_cinemas === true || film.release_type === 'cinema' || film.release_type === 'theatrical';
      if (!isMarkedCinema) continue;

      totalCinemaMarked++;

      const hasShowtimes = filmIdsWithShowtimes.has(film.id);
      const hasBoxOffice = Boolean(
        (film.box_office_domestic && Number(film.box_office_domestic) > 0) ||
        (film.box_office_source && film.box_office_source.trim() !== '') ||
        (film.streaming_links?.box_office)
      );
      const hasCinemaSource = Boolean(
        film.source && ['cinema', 'silverbird', 'filmhouse', 'genesis', 'vivacinemas', 'cean', 'cinema-promoted'].includes(film.source.toLowerCase())
      );
      const hasCinemaTicketLinks = Boolean(
        film.streaming_links?.cinema ||
        film.streaming_links?.showtimes ||
        film.streaming_links?.tickets
      );

      const isVerified = hasShowtimes || hasBoxOffice || hasCinemaSource || hasCinemaTicketLinks;

      if (isVerified) {
        totalVerifiedToKeep++;
      } else {
        // Determine fallback release_type
        if (film.youtube_watch_url || film.streaming_links?.youtube) {
          toSetYoutube.push(film.id);
        } else if (film.streaming_links?.netflix) {
          toSetNetflix.push(film.id);
        } else if (film.streaming_links?.prime || film.streaming_links?.prime_video) {
          toSetPrime.push(film.id);
        } else {
          toSetNull.push(film.id);
        }
      }
    }

    offset += pageSize;
    if (films.length < pageSize) hasMore = false;
  }

  const totalToUpdate = toSetNull.length + toSetYoutube.length + toSetNetflix.length + toSetPrime.length;

  console.log(`\n=== SCAN SUMMARY ===`);
  console.log(`Total Films Scanned: ${totalScanned}`);
  console.log(`Total Films with Cinema Toggled: ${totalCinemaMarked}`);
  console.log(`✅ Verified To Keep: ${totalVerifiedToKeep}`);
  console.log(`❌ Total To Untoggle: ${totalToUpdate}`);
  console.log(`  - Setting to NULL (Blank): ${toSetNull.length}`);
  console.log(`  - Setting to YouTube: ${toSetYoutube.length}`);
  console.log(`  - Setting to Netflix: ${toSetNetflix.length}`);
  console.log(`  - Setting to Prime Video: ${toSetPrime.length}`);

  // Helper for batch updating
  async function executeBatchUpdate(ids: string[], updatePayload: Record<string, any>, label: string) {
    if (ids.length === 0) return;
    const CHUNK_SIZE = 250;
    console.log(`\nExecuting updates for [${label}] (Total: ${ids.length} films)...`);
    
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('films')
        .update(updatePayload)
        .in('id', chunk);

      if (error) {
        console.error(`\nError updating chunk starting at ${i} for ${label}:`, error);
      } else {
        process.stdout.write(`Updated ${Math.min(i + CHUNK_SIZE, ids.length)} / ${ids.length}\r`);
      }
    }
    console.log(`\nCompleted [${label}].`);
  }

  // 2. Perform Batch Updates
  await executeBatchUpdate(toSetNull, { is_in_cinemas: false, release_type: null }, "NULL / Blank");
  await executeBatchUpdate(toSetYoutube, { is_in_cinemas: false, release_type: 'youtube' }, "YouTube");
  await executeBatchUpdate(toSetNetflix, { is_in_cinemas: false, release_type: 'netflix' }, "Netflix");
  await executeBatchUpdate(toSetPrime, { is_in_cinemas: false, release_type: 'prime_video' }, "Prime Video");

  console.log("\n=== UNTOGGLE PROCESS COMPLETE ===");
}

untoggleCinemaFilms().catch(console.error);
