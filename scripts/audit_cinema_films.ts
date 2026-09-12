import { supabase } from './lib/db';

async function auditCinemaFilms() {
  console.log("=== 1. AUDITING FILMS WITH CINEMA STATUS IN DB ===");
  
  // 1. Fetch films where is_in_cinemas = true OR release_type IN ('cinema', 'theatrical')
  const { data: cinemaFilms, error } = await supabase
    .from('films')
    .select('id, title, year, release_type, is_in_cinemas, box_office_domestic, box_office_source, source, streaming_links')
    .or('is_in_cinemas.eq.true,release_type.eq.cinema,release_type.eq.theatrical');

  if (error) {
    console.error("Error fetching cinema films:", error);
    return;
  }

  console.log(`Total films currently marked with cinema/theatrical status: ${cinemaFilms?.length || 0}`);

  // 2. Fetch all film IDs that have active or historical showtimes in the `showtimes` table
  const { data: showtimeRows } = await supabase
    .from('showtimes')
    .select('film_id');

  const filmIdsWithShowtimes = new Set((showtimeRows || []).map(s => s.film_id).filter(Boolean));
  console.log(`Unique films with verified records in showtimes table: ${filmIdsWithShowtimes.size}`);

  let verifiedCount = 0;
  let toUntoggleCount = 0;

  const toUntoggleList = [];
  const verifiedList = [];

  for (const film of (cinemaFilms || [])) {
    const hasShowtimes = filmIdsWithShowtimes.has(film.id);
    const hasBoxOffice = Boolean(
      (film.box_office_domestic && Number(film.box_office_domestic) > 0) ||
      (film.box_office_source && film.box_office_source.trim() !== '') ||
      (film.streaming_links?.box_office)
    );
    const hasCinemaSource = Boolean(
      film.source && ['cinema', 'silverbird', 'filmhouse', 'genesis', 'vivacinemas', 'cean'].includes(film.source.toLowerCase())
    );
    const hasCinemaTicketLinks = Boolean(
      film.streaming_links?.cinema ||
      film.streaming_links?.showtimes ||
      film.streaming_links?.tickets
    );

    const isVerifiedCinema = hasShowtimes || hasBoxOffice || hasCinemaSource || hasCinemaTicketLinks;

    if (isVerifiedCinema) {
      verifiedCount++;
      if (verifiedList.length < 10) {
        verifiedList.push({
          title: film.title,
          year: film.year,
          hasShowtimes,
          hasBoxOffice,
          source: film.source
        });
      }
    } else {
      toUntoggleCount++;
      if (toUntoggleList.length < 15) {
        toUntoggleList.push({
          id: film.id,
          title: film.title,
          year: film.year,
          release_type: film.release_type,
          is_in_cinemas: film.is_in_cinemas,
          streaming_links: film.streaming_links
        });
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`✅ Verified Genuine Cinema / Box Office Films (KEEP): ${verifiedCount}`);
  console.log(`❌ Unverified Cinema Films (TO UNTOGGLE TO BLANK): ${toUntoggleCount}`);

  console.log(`\nSample Verified Cinema Films (will KEEP cinema status):`);
  console.table(verifiedList);

  console.log(`\nSample Films to UNTOGGLE (will set to blank/streaming):`);
  console.table(toUntoggleList);
}

auditCinemaFilms().catch(console.error);
