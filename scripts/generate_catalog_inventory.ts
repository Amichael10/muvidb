import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const tmdbToken = process.env.TMDB_ACCESS_TOKEN || process.env.VITE_TMDB_API_KEY;

const IMDB_IDS = [
  'tt27072200', // Visa On Arrival
  'tt26698628', // My Flatmates
  'tt6779038',  // Children of Blood and Bone
  'tt28353848', // My Siblings and I
  'tt26689336', // Wura
  'tt39390781',
  'tt37427298',
  'tt39290795',
  'tt23144036',
  'tt26450673', // Flawsome
  'tt39257769', // Cheta'm
  'tt23555706',
  'tt23747008', // Far From Home
  'tt9898916',  // Castle and Castle
  'tt22099034', // Shanty Town
  'tt15192042', // King of Boys: The Return of the King
  'tt19671142', // Savage Beauty
  'tt35069649', // Roses and Ivy
  'tt33344252', // Blood Legacy
  'tt30702016', // War: Wrath and Revenge
  'tt31691317', // Oloture: The Journey
  'tt13492362', // How to Ruin Christmas
  'tt12428002', // The Smart Money Woman
  'tt2389428',  // Tinsel
  'tt2577388',  // Shuga
  'tt12719884', // The Johnsons
  'tt10167344', // Jenifa's Diary
  'tt22469048', // Diiche
  'tt23643904', // Skinny Girl in Transit
  'tt6316634',  // Hotel Majestic
  'tt29278939', // Slum King
  'tt23901472', // The Men's Club
  'tt12728832', // Postcards
  'tt33096902', // House of Ga'a
  'tt29537499', // Ijogbon
  'tt32880282', // A Tribe Called Judah
  'tt38582577', // Jagun Jagun 2
  'tt30890638', // Afamefuna: An Nwa Boi Story
  'tt33090925', // Lisabi: The Uprising
  'tt31182834', // Breathe of Life
  'tt27664362', // Adulting
  'tt28654625', // Outlaws
  'tt6558110',  // Battleground
  'tt37232807', // Queenstown Kings
  'tt14854224', // Blood Sisters
  'tt37675956', // Miseducation
  'tt32880855', // Young, Famous & African
  'tt10202268', // Queen Sono
  'tt21361596', // Fatal Seduction
  'tt32439054', // Blood & Water
  'tt36365628', // Unseen
  'tt37731888', // Senzo: Murder of a Soccer Star
  'tt7953874',  // Battleground: The Final Showdown
  'tt10738058', // Professor Johnbull
  'tt34743544', // Princess on a Hill
  'tt16401480', // Masquerades of Aniedo
  'tt6838464',  // Before 30
  'tt4184438',  // Before 30
  'tt9822338',  // The Governor
  'tt16817152', // Enakhe
  'tt7128052',  // Sons of the Caliphate
  'tt27411942', // Beyond the Veil
  'tt25966838', // Hush
];

async function checkInventory() {
  console.log(`Starting inventory check for ${IMDB_IDS.length} IDs...`);
  
  // 1. Fetch DB records
  const { data: dbRecords } = await supabase
    .from('films')
    .select('id, title, imdb_id, tmdb_id, content_type, series_id, season_count, episode_count, release_type, streaming_links, poster_url, backdrop_url, synopsis')
    .in('imdb_id', IMDB_IDS);

  const dbMap = new Map();
  for (const r of dbRecords || []) {
    dbMap.set(r.imdb_id, r);
  }

  const catalog: any[] = [];

  for (let i = 0; i < IMDB_IDS.length; i++) {
    const imdbId = IMDB_IDS[i];
    const existing = dbMap.get(imdbId);
    
    // Check TMDB find
    let tmdbData: any = null;
    try {
      const res = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`, {
        headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
      });
      const findRes = await res.json();
      if (findRes.tv_results?.length > 0) {
        tmdbData = { type: 'tv', id: findRes.tv_results[0].id, title: findRes.tv_results[0].name, poster: findRes.tv_results[0].poster_path, backdrop: findRes.tv_results[0].backdrop_path };
      } else if (findRes.movie_results?.length > 0) {
        tmdbData = { type: 'movie', id: findRes.movie_results[0].id, title: findRes.movie_results[0].title, poster: findRes.movie_results[0].poster_path, backdrop: findRes.movie_results[0].backdrop_path };
      }
    } catch (e) {
      // ignore
    }

    catalog.push({
      imdbId,
      inDb: !!existing,
      dbId: existing?.id || null,
      dbTitle: existing?.title || null,
      dbContentType: existing?.content_type || null,
      tmdbType: tmdbData?.type || null,
      tmdbId: tmdbData?.id || null,
      tmdbTitle: tmdbData?.title || null,
    });
  }

  import('node:fs').then(fs => {
    fs.writeFileSync('scripts/catalog_inventory.json', JSON.stringify(catalog, null, 2));
    console.log(`Saved ${catalog.length} items to scripts/catalog_inventory.json`);
    console.log(`In DB: ${catalog.filter(c => c.inDb).length}, On TMDB: ${catalog.filter(c => c.tmdbId).length}`);
  });
}

checkInventory().catch(console.error);
