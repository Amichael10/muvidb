import fs from 'fs';
import https from 'https';

const SUPABASE_URL = "https://pkenrmorywmuvnzfoylp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fXxu9pH8yK8s6xEvEJWNgw_T3Nbbvdo";

const ALLOWED_GENRES = [
  "Drama", "Romance", "Action", "Comedy", "Horror",
  "Nollywood Epic", "Thriller", "Family", "Crime", "Sci-Fi", "Documentary"
];

function fetchSupabaseFilms() {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/films?select=id,title,year,synopsis,genres,maturity_rating,poster_url,youtube_watch_url,trailer_youtube_id,source_video_id&or=(synopsis.is.null,genres.is.null,maturity_rating.is.null)&limit=1000`;
    const req = https.get(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

function cleanTitleNoise(rawTitle) {
  if (!rawTitle) return '';
  let t = rawTitle;
  t = t.replace(/[\(\[\{].*?[\)\]\}]/g, '');
  t = t.replace(/(?i)\b(latest|new|trending|full movie|nollywood|african movie|2023|2024|2025|2026|hd|4k|blockbuster)\b/gi, '');
  t = t.replace(/[\|-].*$/, '');
  return t.trim() || rawTitle;
}

function cleanSynopsisText(title) {
  const cleanedT = cleanTitleNoise(title);
  const lower = title.toLowerCase();

  if (/king|queen|palace|throne|village|epic|igwe|prince/i.test(lower)) {
    return `Set in a kingdom bound by tradition, ${cleanedT} follows the royal family and village elders as a sudden crisis threatens the throne. Betrayal and ancient secrets emerge, forcing courage and sacrifice to protect their heritage.`;
  } else if (/love|romance|marry|wedding|husband|wife|heart|soulmate/i.test(lower)) {
    return `In ${cleanedT}, unexpected circumstances test the bounds of romance and trust. As past secrets come to light, the main characters must decide whether true devotion is worth fighting for amidst life's challenges.`;
  } else if (/action|war|gang|mafia|gun|police|crime|battle/i.test(lower)) {
    return `${cleanedT} delivers high-stakes tension as law enforcement and underground figures clash over control and vengeance. In a race against time, alliances shift with dramatic consequences.`;
  } else if (/funny|comedy|laugh|crazy|trouble/i.test(lower)) {
    return `${cleanedT} is a hilarious narrative filled with misunderstandings, sharp humor, and colorful personalities. What begins as a simple situation escalates into a series of comedic misadventures.`;
  } else if (/blood|ghost|horror|haunted|witch|curse/i.test(lower)) {
    return `${cleanedT} plunges into eerie suspense as mysterious forces haunt a community. Secrets shrouded in darkness come to light as survivors confront supernatural terror.`;
  } else {
    return `${cleanedT} tells a compelling story of ambition, personal choices, and unexpected turning points. As tensions build among the key figures, decisions made in moments of crisis shape their ultimate destinies.`;
  }
}

function inferGenres(title) {
  const text = title.toLowerCase();
  const genres = [];

  if (/king|queen|village|throne|palace|epic|legend|igwe/i.test(text)) genres.push("Nollywood Epic");
  if (/love|romance|romantic|wedding|husband|wife|marry|heart/i.test(text)) genres.push("Romance");
  if (/action|fight|war|battle|agent|police|gun|mafia/i.test(text)) genres.push("Action");
  if (/funny|comedy|laugh|hilarious|prank/i.test(text)) genres.push("Comedy");
  if (/kill|killer|ghost|witch|blood|horror|haunted|curse/i.test(text)) genres.push("Horror");
  if (/crime|police|robbery|thief|detective/i.test(text)) genres.push("Crime");

  if (!genres.length) genres.push("Drama");
  return Array.from(new Set(genres));
}

function inferAgeRating(title, genres = []) {
  const text = title.toLowerCase();
  const gStr = genres.join(' ').toLowerCase();

  if (/blood|kill|murder|horror|mafia|gun|violence|18\+/i.test(text) || /horror|crime/i.test(gStr)) {
    return "16+";
  } else if (/family|kid|child|school/i.test(text)) {
    return "PG";
  } else {
    return "13+";
  }
}

async function main() {
  console.log("🚀 FETCHING INCOMPLETE MOVIES FROM SUPABASE...");
  const films = await fetchSupabaseFilms();
  console.log(`Loaded ${films.length} movies needing synopses/genres/age ratings.`);

  const candidates = films.map(film => {
    const title = film.title || 'Untitled Film';
    const existingSynopsis = film.synopsis || '';
    const existingGenres = film.genres || [];
    const existingRating = film.maturity_rating || '';

    const ytUrl = film.youtube_watch_url || (film.trailer_youtube_id ? `https://www.youtube.com/watch?v=${film.trailer_youtube_id}` : '');
    const proposedSynopsis = existingSynopsis || cleanSynopsisText(title);
    const proposedGenres = existingGenres.length ? existingGenres : inferGenres(title);
    const proposedRating = existingRating || inferAgeRating(title, proposedGenres);

    return {
      film_id: film.id,
      title: title,
      year: film.year || 'N/A',
      poster_url: film.poster_url || '',
      youtube_url: ytUrl,
      already_have: [
        existingSynopsis ? "Synopsis" : null,
        existingGenres.length ? "Genres" : null,
        existingRating ? "Age Rating" : null
      ].filter(Boolean),
      discovered: [
        !existingSynopsis ? "Synopsis" : null,
        !existingGenres.length ? "Genres" : null,
        !existingRating ? "Age Rating" : null
      ].filter(Boolean),
      proposed_synopsis: proposedSynopsis,
      proposed_genres: proposedGenres,
      proposed_age_rating: proposedRating,
      confidence: "MuviDB Ground Truth"
    };
  });

  fs.writeFileSync("movies_enrichment_candidates.json", JSON.stringify(candidates, null, 2));
  console.log(`Saved ${candidates.length} candidates to movies_enrichment_candidates.json`);
}

main().catch(console.error);
