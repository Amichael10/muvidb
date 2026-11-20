import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import fs from 'node:fs';

const tmdbToken = process.env.TMDB_ACCESS_TOKEN || process.env.VITE_TMDB_API_KEY;

const IMDB_IDS = [
  'tt27072200', 'tt26698628', 'tt6779038', 'tt28353848', 'tt26689336',
  'tt39390781', 'tt37427298', 'tt39290795', 'tt23144036', 'tt26450673',
  'tt39257769', 'tt23555706', 'tt23747008', 'tt9898916', 'tt22099034',
  'tt15192042', 'tt19671142', 'tt35069649', 'tt33344252', 'tt30702016',
  'tt31691317', 'tt13492362', 'tt12428002', 'tt2389428', 'tt2577388',
  'tt12719884', 'tt10167344', 'tt22469048', 'tt23643904', 'tt6316634',
  'tt29278939', 'tt23901472', 'tt12728832', 'tt33096902', 'tt29537499',
  'tt32880282', 'tt38582577', 'tt30890638', 'tt33090925', 'tt31182834',
  'tt27664362', 'tt28654625', 'tt6558110', 'tt37232807', 'tt14854224',
  'tt37675956', 'tt32880855', 'tt10202268', 'tt21361596', 'tt32439054',
  'tt36365628', 'tt37731888', 'tt7953874', 'tt10738058', 'tt34743544',
  'tt16401480', 'tt6838464', 'tt4184438', 'tt9822338', 'tt16817152',
  'tt7128052', 'tt27411942', 'tt25966838'
];

// Title dictionary / hints for known Nigerian / African titles from previous analysis
const TITLE_HINTS: Record<string, string> = {
  'tt27072200': 'Visa On Arrival',
  'tt26698628': 'My Flatmates',
  'tt6779038': 'Children of Blood and Bone',
  'tt28353848': 'My Siblings and I',
  'tt26689336': 'Wura',
  'tt39390781': 'The Real Housewives of Lagos',
  'tt37427298': 'Tough Love',
  'tt39290795': 'Love and Chaos',
  'tt23144036': 'The Smart Money Woman',
  'tt26450673': 'Flawsome',
  'tt39257769': "Cheta'm",
  'tt23555706': 'Diiche',
  'tt23747008': 'Far from Home',
  'tt9898916': 'Castle & Castle',
  'tt22099034': 'Shanty Town',
  'tt15192042': 'King of Boys: The Return of the King',
  'tt19671142': 'Savage Beauty',
  'tt35069649': 'Roses and Ivy',
  'tt33344252': 'Blood Legacy',
  'tt30702016': 'War: Wrath and Revenge',
  'tt31691317': 'Oloture: The Journey',
  'tt13492362': 'How to Ruin Christmas',
  'tt12428002': 'The Smart Money Woman',
  'tt2389428': 'Tinsel',
  'tt2577388': 'MTV Shuga',
  'tt12719884': 'The Johnsons',
  'tt10167344': "Jenifa's Diary",
  'tt22469048': 'Diiche',
  'tt23643904': 'Skinny Girl in Transit',
  'tt6316634': 'Hotel Majestic',
  'tt29278939': 'Slum King',
  'tt23901472': "The Men's Club",
  'tt12728832': 'Postcards',
  'tt33096902': "House of Ga'a",
  'tt29537499': 'Ijogbon',
  'tt32880282': 'A Tribe Called Judah',
  'tt38582577': 'Jagun Jagun 2',
  'tt30890638': 'Afamefuna: An Nwa Boi Story',
  'tt33090925': 'Lisabi: The Uprising',
  'tt31182834': 'Breathe of Life',
  'tt27664362': 'Adulting',
  'tt28654625': 'Outlaws',
  'tt6558110': 'Battleground',
  'tt37232807': 'Queenstown Kings',
  'tt14854224': 'Blood Sisters',
  'tt37675956': 'Miseducation',
  'tt32880855': 'Young, Famous & African',
  'tt10202268': 'Queen Sono',
  'tt21361596': 'Fatal Seduction',
  'tt32439054': 'Blood & Water',
  'tt36365628': 'Unseen',
  'tt37731888': 'Senzo: Murder of a Soccer Star',
  'tt7953874': 'Battleground: The Final Showdown',
  'tt10738058': 'Professor Johnbull',
  'tt34743544': 'Princess on a Hill',
  'tt16401480': 'Masquerades of Aniedo',
  'tt6838464': 'Hotel Majestic',
  'tt4184438': 'Before 30',
  'tt9822338': 'The Governor',
  'tt16817152': 'Enakhe',
  'tt7128052': 'Sons of the Caliphate',
  'tt27411942': 'Beyond the Veil',
  'tt25966838': 'Hush',
};

async function findOrSearchTMDB(imdbId: string) {
  // 1. Try find by external id
  try {
    const res = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`, {
      headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
    });
    const findRes = await res.json();
    if (findRes.tv_results?.length > 0) {
      const tv = findRes.tv_results[0];
      return { type: 'tv', id: tv.id, title: tv.name, year: tv.first_air_date?.slice(0, 4), method: 'find' };
    }
    if (findRes.movie_results?.length > 0) {
      const m = findRes.movie_results[0];
      return { type: 'movie', id: m.id, title: m.title, year: m.release_date?.slice(0, 4), method: 'find' };
    }
  } catch (e) {
    // ignore
  }

  // 2. Try search by title hint if available
  const hint = TITLE_HINTS[imdbId];
  if (hint) {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(hint)}`, {
        headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
      });
      const sRes = await res.json();
      const match = sRes.results?.find((r: any) => r.media_type === 'tv' || r.media_type === 'movie');
      if (match) {
        return {
          type: match.media_type,
          id: match.id,
          title: match.title || match.name,
          year: (match.release_date || match.first_air_date || '').slice(0, 4),
          method: 'title_search'
        };
      }
    } catch (e) {
      // ignore
    }
  }

  return null;
}

async function main() {
  console.log(`Resolving all ${IMDB_IDS.length} IDs with TMDB find + smart search...`);
  const resolved = [];
  for (let i = 0; i < IMDB_IDS.length; i++) {
    const imdbId = IMDB_IDS[i];
    const match = await findOrSearchTMDB(imdbId);
    resolved.push({
      imdbId,
      hintTitle: TITLE_HINTS[imdbId] || null,
      tmdb: match,
    });
  }

  fs.writeFileSync('scripts/resolved_mappings.json', JSON.stringify(resolved, null, 2));
  const tmdbFound = resolved.filter(r => r.tmdb);
  console.log(`Resolved: ${tmdbFound.length}/${IMDB_IDS.length} on TMDB`);
  for (const r of resolved) {
    if (r.tmdb) {
      console.log(`✔ [${r.imdbId}] -> ${r.tmdb.type.toUpperCase()}: "${r.tmdb.title}" (${r.tmdb.year}) [id:${r.tmdb.id}, by:${r.tmdb.method}]`);
    } else {
      console.log(`✖ [${r.imdbId}] -> Firecrawl IMDb fallback needed: "${r.hintTitle}"`);
    }
  }
}

main().catch(console.error);
