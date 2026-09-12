import { supabase } from './lib/db';

async function countCinemaFilmsTotal() {
  console.log("=== SCANNING ENTIRE DATABASE FOR CINEMA STATUS ===");

  // 1. Fetch all showtimes
  const { data: showtimeRows } = await supabase.from('showtimes').select('film_id');
  const filmIdsWithShowtimes = new Set((showtimeRows || []).map(s => s.film_id).filter(Boolean));
  console.log(`Verified films in showtimes table: ${filmIdsWithShowtimes.size}`);

  let totalScanned = 0;
  let totalCinemaMarked = 0;
  let totalVerifiedToKeep = 0;
  let totalToUntoggle = 0;

  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

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
        totalToUntoggle++;
      }
    }

    offset += pageSize;
    if (films.length < pageSize) hasMore = false;
  }

  console.log(`\n=== FULL CATALOG SCAN RESULTS ===`);
  console.log(`Total Films Scanned: ${totalScanned}`);
  console.log(`Total Films with Cinema Toggled On: ${totalCinemaMarked}`);
  console.log(`✅ Genuine Verified Cinema Films (will KEEP): ${totalVerifiedToKeep}`);
  console.log(`❌ Unverified Cinema Films (will UNTOGGLE TO BLANK): ${totalToUntoggle}`);
}

countCinemaFilmsTotal().catch(console.error);
