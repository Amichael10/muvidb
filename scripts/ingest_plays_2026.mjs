/**
 * ingest_plays_2026.mjs
 * Ingest upcoming Nigerian stage plays (Sept-Dec 2026) into Supabase.
 * Run: node scripts/ingest_plays_2026.mjs
 */

import https from 'https';
import dns from 'dns';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

dns.setDefaultResultOrder('ipv4first');

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require('dotenv').config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const API_BASE = `${SUPABASE_URL}/rest/v1`;

// ── HTTP helper with retry ────────────────────────────────────────────────────
function request(method, path, body = null, attempt = 1) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation,resolution=merge-duplicates',
      },
      timeout: 30000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', async (err) => {
      if (attempt < 4) {
        const delay = 1000 * 2 ** (attempt - 1);
        console.warn(`  Retry ${attempt} after ${delay}ms: ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
        try { resolve(await request(method, path, body, attempt + 1)); }
        catch (e) { reject(e); }
      } else reject(err);
    });
    req.on('timeout', () => req.destroy(new Error('Timeout')));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const today = new Date().toISOString().slice(0, 10);
function deriveStatus(start, end) {
  if (end && end < today) return 'archived';
  if (start && start <= today) return 'currently_running';
  return 'upcoming';
}

// ── Play data ─────────────────────────────────────────────────────────────────
const PLAYS = [
  {
    title: 'The Naija Spirit',
    slug: 'the-naija-spirit',
    playwright: 'Dike Chukwumerije',
    director: 'Dike Chukwumerije',
    producer: 'Simply Poetry Foundation',
    venue: 'Faculty of Environmental Studies (FESSA) Auditorium, University of Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-09-26',
    run_end_date: '2026-09-26',
    performance_time: '2:00 PM',
    genre: 'Spoken Word / Drama',
    synopsis: 'A multidisciplinary total-theatre experience blending poetry, music, drama, and storytelling to explore Nigerian unity, identity, and coexistence. The production uses satire and comedy to critique how political figures exploit ethnic and religious tensions, while encouraging audiences to reflect on the shared experiences that connect Nigerians across tribal, religious, and political divides.',
    source_url: 'https://naijatheatre.com',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'TALP X: Two Stories, One Stage',
    slug: 'talp-x-two-stories-one-stage',
    playwright: null,
    director: null,
    producer: 'Terra Academy for the Arts (TAFTA) / Bolanle Austen-Peters',
    venue: 'Terra Kulture Arena',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-10-10',
    run_end_date: '2026-10-10',
    performance_time: '3:00 PM',
    genre: 'Drama',
    synopsis: 'The tenth edition of TAFTA\'s signature showcase presenting two original stage plays in a single session. Performed by emerging theatrical talents trained at the Terra Academy for the Arts, the works explore socially conscious themes of cultural expression, resilience, and personal growth. TALP X serves as the platform for graduating cohorts to transition from the classroom to professional stage performance.',
    source_url: 'https://terrakulture.com',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'The Trials of Brother Jero',
    slug: 'the-trials-of-brother-jero-opera-2026',
    playwright: 'Wole Soyinka (original play); Libretto by Kehinde Oretimehin',
    director: 'Rosalyn Aninyei',
    producer: 'Vesta Orchestra and Opera Foundation',
    venue: 'National Theatre (Wole Soyinka Centre for Culture and Creative Arts)',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-10-11',
    run_end_date: '2026-10-11',
    performance_time: null,
    genre: 'Opera / Musical Theatre',
    synopsis: 'An African opera adaptation of Wole Soyinka\'s satirical classic, celebrating the 10th anniversary of the Vesta Orchestra. The story follows Brother Jeroboam ("Jero"), a charismatic, manipulative self-proclaimed prophet who operates on Bar Beach in Lagos. The production features entirely sung dialogue, backed by a 50-piece orchestra and 25-member chorus in an ethno-African soundscape integrating traditional Nigerian percussion and rhythms with European operatic structure. Music composed by Dr. Seun Owoaje. Themes of religious hypocrisy, ambition, and human vulnerability explored through humour and satire.',
    source_url: 'https://tix.africa/discover/trialsofbrotherjeroopera',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'Monkey Laundry',
    slug: 'monkey-laundry-litf-2026',
    playwright: null,
    director: 'Olarotimi Fakunle',
    producer: null,
    venue: 'MUSON Centre',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-11-14',
    run_end_date: '2026-11-15',
    performance_time: null,
    genre: 'Drama',
    synopsis: 'Featured in the Nigerian programme at the Lagos International Theatre Festival (LITF) 2026, themed "The Masks We Wear." Directed by acclaimed Nigerian actor, director and producer Olarotimi Fakunle (known for Gangs of Lagos and various stage classics), the play examines identity and the social roles people inhabit. Part of a diverse lineup alongside international productions from Kenya, Canada, and Brazil.',
    source_url: 'https://lagosinternationaltheatrefestival.ng',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'tHERapy',
    slug: 'therapy-litf-2026',
    playwright: 'Oladotun Olagbadebo',
    director: 'Tosin Adeyemi',
    producer: 'Oladotun Olagbadebo',
    venue: 'MUSON Centre',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-11-14',
    run_end_date: '2026-11-15',
    performance_time: null,
    genre: 'Drama / Monologue',
    synopsis: 'A raw one-woman stage play following Deola as she navigates societal expectations, family dynamics, and personal trauma. Through intense monologues, tHERapy explores the challenges women face regarding marriage, childbirth, gender roles in Nigeria, alongside deeply personal experiences including sexual assault, betrayal, and emotional abuse. The narrative charts the protagonist\'s path toward self-acceptance and liberation. An all-female-led production (cast and crew) known for audience interaction. Previously staged at the J. Randle Centre for Yoruba Culture and History. Featured at LITF 2026 under the theme "The Masks We Wear."',
    source_url: 'https://lagosinternationaltheatrefestival.ng',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'Men-Oh-Pause',
    slug: 'men-oh-pause-litf-2026',
    playwright: null,
    director: 'Elvina Ibru',
    producer: null,
    venue: 'MUSON Centre',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-11-14',
    run_end_date: '2026-11-15',
    performance_time: null,
    genre: 'Drama',
    synopsis: 'A theatrical production directed by Elvina Ibru, featured in the Nigerian programme at the Lagos International Theatre Festival (LITF) 2026, themed "The Masks We Wear." Part of a diverse lineup exploring identity and the social roles people assume in everyday life.',
    source_url: 'https://lagosinternationaltheatrefestival.ng',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'Behind Closed Doors',
    slug: 'behind-closed-doors-2026',
    playwright: 'Bolanle Austen-Peters & Kanyinsola Kongi',
    director: 'Bolanle Austen-Peters',
    producer: 'BAP Productions',
    venue: 'MUSON Centre',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-11-14',
    run_end_date: '2026-11-15',
    performance_time: null,
    genre: 'Drama',
    synopsis: 'Tunde and Mimi return home from what should have been one of the happiest nights of their marriage. A sudden, unexpected phone call triggers a long night of arguments, confessions, and unresolved emotions. Sharp, funny and painfully familiar — the play examines resentment, tenderness, and whether love can endure when life fundamentally changes the people in a relationship. Stars Ralph Okoro and Vanessa Jev. Performed at Terra Kulture lawn throughout September 2026 before LITF 2026.',
    source_url: 'https://lagosinternationaltheatrefestival.ng',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'Queen Idia',
    slug: 'queen-idia-2026',
    playwright: 'Lydia Idakula',
    director: null,
    producer: null,
    venue: 'National Theatre, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-11-14',
    run_end_date: '2026-11-14',
    performance_time: '10:00 AM',
    genre: 'Musical Theatre',
    synopsis: 'A musical uncovering the story of the 16th-century Queen Mother of the Benin Kingdom, Idia, who defied royal tradition — which demanded the mother of a new king must die — to secure the throne for her son, Esigie. She became the first woman to lead an army into war and the first Queen Mother of Benin. Featuring Highlife, Afrobeats, and poetry, with music and lyrics by Lydia Idakula, Donna Ogunnaike, Ndukwe Onuoha, and Omolara.',
    source_url: 'https://nationaltheatre.gov.ng',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'Tales By Moonlight',
    slug: 'tales-by-moonlight-revival-2026',
    playwright: null,
    director: null,
    producer: 'National Theatre, Lagos',
    venue: 'National Theatre, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-12-04',
    run_end_date: '2026-12-04',
    performance_time: '3:00 PM',
    genre: 'Drama / Family',
    synopsis: 'A revival of the beloved Nigerian theatre classic. A multi-generational storytelling tradition presented as a live stage production, celebrating oral heritage, folklore, and community values through dramatic re-enactment of beloved Nigerian folk tales.',
    source_url: 'https://nationaltheatre.gov.ng',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'Hafsatu',
    slug: 'hafsatu-dosf-2026',
    playwright: 'Prof. Rasheedat Liman',
    director: 'Prof. Rasheedat Liman',
    producer: 'Duke of Shomolu Foundation (DOSF)',
    venue: 'Lagos (venue TBC)',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-12-24',
    run_end_date: '2026-12-24',
    performance_time: null,
    genre: 'Drama',
    synopsis: 'Part of the Duke of Shomolu Foundation\'s landmark 2026 season "Powerfully Unapologetic" — six stage productions written and directed exclusively by women from Nigeria\'s six geopolitical zones. Hafsatu is written and directed by Prof. Rasheedat Liman (Ahmadu Bello University, Zaria), representing the North-West zone. The season\'s cast and crew are over 70% female.',
    source_url: 'https://thesun.ng',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'Princess Inikpi',
    slug: 'princess-inikpi-dosf-2026',
    playwright: 'Dr. Tayo Joan Adenuga',
    director: 'Dr. Tayo Joan Adenuga',
    producer: 'Duke of Shomolu Foundation (DOSF)',
    venue: 'Lagos (venue TBC)',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-12-25',
    run_end_date: '2026-12-25',
    performance_time: null,
    genre: 'Drama / Historical',
    synopsis: 'Part of the Duke of Shomolu Foundation\'s 2026 "Powerfully Unapologetic" season. Written and directed by Dr. Tayo Joan Adenuga (Kwara State University, Malete), Princess Inikpi brings to life the legendary story of Princess Inikpi of the Igala Kingdom — a tale of sacrifice, love, and patriotism.',
    source_url: 'https://thesun.ng',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'Makamba',
    slug: 'makamba-dosf-2026',
    playwright: 'Prof. Ifure Ufford-Azorbo',
    director: 'Prof. Ifure Ufford-Azorbo',
    producer: 'Duke of Shomolu Foundation (DOSF)',
    venue: 'Lagos (venue TBC)',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-12-26',
    run_end_date: '2026-12-26',
    performance_time: null,
    genre: 'Drama',
    synopsis: 'Part of the Duke of Shomolu Foundation\'s 2026 "Powerfully Unapologetic" season. Written and directed by Prof. Ifure Ufford-Azorbo (University of Uyo), representing the South-South geopolitical zone. Celebrates female creative authority, leadership, and storytelling within Nigerian theatre.',
    source_url: 'https://thesun.ng',
    poster_url: null,
    banner_url: null,
  },
  {
    title: 'The Dein of Agbor',
    slug: 'the-dein-of-agbor-dosf-2026',
    playwright: 'Prof. Juliana Okoh',
    director: 'Prof. Juliana Okoh',
    producer: 'Duke of Shomolu Foundation (DOSF)',
    venue: 'Lagos (venue TBC)',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '2026-12-27',
    run_end_date: '2026-12-27',
    performance_time: null,
    genre: 'Drama / Historical',
    synopsis: 'The closing production of the Duke of Shomolu Foundation\'s 2026 "Powerfully Unapologetic" season. Written and directed by Prof. Juliana Okoh (Dennis Osadebay University, Asaba), representing the South-South zone. Explores royalty, leadership, and cultural identity in Delta State through the story of the Dein (king) of Agbor.',
    source_url: 'https://thesun.ng',
    poster_url: null,
    banner_url: null,
  },
];

// ── Stage credits for known cast ──────────────────────────────────────────────
// NOTE: tix.africa/discover/wktp6 returned 403 and could not be identified.
// Please open that URL in your browser and share the event title so we can add it.
const CREDITS = [
  {
    play_slug: 'the-trials-of-brother-jero-opera-2026',
    role: 'Cast',
    character_name: 'Brother Jero',
    person_name: "Gbolabo 'Gibbs' Adebakin",
  },
  {
    play_slug: 'the-trials-of-brother-jero-opera-2026',
    role: 'Cast',
    character_name: 'Chume',
    person_name: 'John Paul Ochei',
  },
  {
    play_slug: 'behind-closed-doors-2026',
    role: 'Cast',
    character_name: 'Tunde',
    person_name: 'Ralph Okoro',
  },
  {
    play_slug: 'behind-closed-doors-2026',
    role: 'Cast',
    character_name: 'Mimi',
    person_name: 'Vanessa Jev',
  },
];

// ── Upsert plays ──────────────────────────────────────────────────────────────
async function upsertPlays() {
  console.log(`\nUpserting ${PLAYS.length} plays...\n`);
  const results = [];

  for (const play of PLAYS) {
    const year = play.run_start_date ? Number(play.run_start_date.slice(0, 4)) : null;
    const status = deriveStatus(play.run_start_date, play.run_end_date);
    const payload = { ...play, year, status };

    const res = await request('POST', '/plays?on_conflict=slug', [payload]);
    if (res.status >= 200 && res.status < 300) {
      const inserted = Array.isArray(res.body) ? res.body[0] : res.body;
      console.log(`  OK   ${play.title} (id: ${inserted?.id})`);
      results.push({ slug: play.slug, id: inserted?.id, title: play.title });
    } else {
      console.error(`  FAIL ${play.title} -- ${JSON.stringify(res.body)}`);
    }
  }
  return results;
}

// ── Upsert stage credits ──────────────────────────────────────────────────────
async function upsertCredits(playResults) {
  if (!CREDITS.length) return;
  console.log(`\nProcessing ${CREDITS.length} stage credits...\n`);

  const slugMap = {};
  for (const r of playResults) slugMap[r.slug] = r.id;

  for (const credit of CREDITS) {
    const playId = slugMap[credit.play_slug];
    if (!playId) {
      console.warn(`  SKIP No play_id for slug: ${credit.play_slug}`);
      continue;
    }

    const nameQ = `name=ilike.${encodeURIComponent(credit.person_name)}`;
    const personRes = await request('GET', `/people?${nameQ}&select=id,name&limit=5`);
    const people = Array.isArray(personRes.body) ? personRes.body : [];
    if (!people.length) {
      console.warn(`  SKIP Person not in DB: "${credit.person_name}"`);
      continue;
    }

    const creditPayload = {
      play_id: playId,
      person_id: people[0].id,
      role: credit.role,
      character_name: credit.character_name || null,
    };
    const credRes = await request(
      'POST',
      '/stage_credits?on_conflict=play_id,person_id,role',
      [creditPayload]
    );
    if (credRes.status >= 200 && credRes.status < 300) {
      console.log(`  OK   ${people[0].name} -> ${credit.play_slug} (${credit.character_name})`);
    } else {
      console.error(`  FAIL ${people[0].name} -- ${JSON.stringify(credRes.body)}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('==============================================');
  console.log(' Stage Plays 2026 -- Ingestion Script');
  console.log('==============================================');
  console.log('NOTE: tix.africa/discover/wktp6 returned 403.');
  console.log('Please open that URL in a browser and share the event title.\n');

  const playResults = await upsertPlays();
  await upsertCredits(playResults);

  console.log(`\n==============================================`);
  console.log(`Done! ${playResults.length}/${PLAYS.length} plays processed.`);
  console.log(`==============================================`);
})();
