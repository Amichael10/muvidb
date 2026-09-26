/**
 * ingest_play_cast_2026.mjs
 * Creates people profiles for 4 stage cast members skipped in the plays ingestion,
 * then links them to their plays via stage_credits.
 *
 * Run: node scripts/ingest_play_cast_2026.mjs
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
    const opts = {
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
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', async (err) => {
      if (attempt < 4) {
        const delay = 1000 * 2 ** (attempt - 1);
        console.warn(`  Retry ${attempt} (${err.message})`);
        await new Promise(r => setTimeout(r, delay));
        try { resolve(await request(method, path, body, attempt + 1)); } catch (e) { reject(e); }
      } else reject(err);
    });
    req.on('timeout', () => req.destroy(new Error('Timeout')));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── People data ───────────────────────────────────────────────────────────────
const PEOPLE = [
  {
    name: "Gbolabo 'Gibbs' Adebakin",
    slug: 'gbolabo-gibbs-adebakin',
    known_for_department: 'Acting',
    nationality: 'Nigerian',
    gender: 'Male',
    birthplace: 'Lagos, Nigeria',
    bio: "Gbolabo 'Gibbs' Adebakin is a multi-talented Nigerian performing artist and entrepreneur affectionately known as the 'Singing Chef.' Born and raised in Lagos, he is an alumnus of King's College, Lagos, and holds a B.Sc. in Zoology from the University of Lagos. His performing arts career spans opera, jazz, gospel, and contemporary music, having graced the stages of the MUSON Centre, Terra Kulture, the National Theatre, and the University of Lagos.\n\nAdebakin gained significant critical attention in 2026 for his virtuosic portrayal of the titular Brother Jeroboam in the Vesta Orchestra's full-scale African opera adaptation of Wole Soyinka's The Trials of Brother Jero — a performance celebrated for his magnetic stage presence and charismatic command of the role.\n\nBeyond the stage, he is a prominent figure in Nigeria's culinary world: an award-winning chef who won 'Ultimate Cook' on the fifth season of the Knorr Taste Quest competition, Culinary Director for Hilda Baci's record-breaking 100-hour cooking marathon, and founder of the Nigeria Food Summit — an initiative dedicated to connecting chefs, farmers, restaurateurs, and producers to amplify the cultural heritage of Nigerian cuisine.",
    source: 'web',
    status: 'active',
    is_verified: false,
    is_spotlight: false,
  },
  {
    name: 'JohnPaul Ochei',
    slug: 'johnpaul-ochei',
    known_for_department: 'Acting',
    nationality: 'Nigerian',
    gender: 'Male',
    birthplace: 'Akaboukwu, Uruagu Nnewi, Anambra State, Nigeria',
    bio: "JohnPaul Ikechukwu Ochei is a prominent Nigerian classical and opera singer (baritone) and stage actor who has become one of the most distinctive voices in the Nigerian classical music scene. Born in Akaboukwu, Uruagu Nnewi in Anambra State, he grew up in Lagos, where early exposure to music came through his father — an organist and tenor singer.\n\nHis singing journey began as a treble in the children's choir at All Saints Anglican Church, Surulere, followed by formal voice and music theory training at St. Anthony's Catholic Church under Irene and Gregory Osuji. Mentored by Sir Emeka Nwokedi, he passed MUSON voice exams at grades 3, 5, and 8 with distinction, becoming one of the youngest active bass-baritone singers in Nigeria.\n\nIntroduced to professional singing by Christie Okosun, he joined the Laz Ekwueme Chorale and the MUSON Festival Choir. His extensive international performance history includes appearances with the Lagos City Chorale, the Dallas Symphony Chorus, and Seventeen Voices (Ottawa, Canada). His operatic roles include Bartolo in Le Nozze di Figaro (2004), the Pirate King in The Pirates of Penzance (2011), and Sarastro in The Magic Flute (2012). He is also a member of 'The 3 Baritones', a celebrated Nigerian vocal trio.\n\nIn 2026, he portrayed Chume — the long-suffering husband — in the Vesta Orchestra's African opera adaptation of Wole Soyinka's The Trials of Brother Jero at the National Theatre, Lagos. He has also served as a voice teacher at the MUSON Basic School and remains a committed advocate for higher standards of vocal training in Nigeria.",
    source: 'web',
    status: 'active',
    is_verified: false,
    is_spotlight: false,
  },
  {
    name: 'Ralph Okoro',
    slug: 'ralph-okoro',
    known_for_department: 'Acting',
    nationality: 'Nigerian',
    gender: 'Male',
    birthplace: 'Nigeria',
    bio: "Ralph Okoro (also known as Ralph O'Joe) is a Nigerian actor, performer, and storyteller celebrated as one of the most dynamic talents in contemporary Nigerian musical theatre and stage drama. A certified Musical Theatre Practitioner with training from LAMDA (London Academy of Music and Dramatic Art), his creative journey began with music before evolving into professional theatre.\n\nWith over 50 stage production credits to his name, Okoro's résumé spans musicals, plays, and concerts. His notable stage credits include Kakadu The Musical, Dear Kaffy, Moremi The Musical, Olurombi, Heartbeat The Musical, and Mamma Mia!.\n\nIn 2026, he starred as Tunde in the critically received two-hander Behind Closed Doors, a Bolanle Austen-Peters production co-written with Kanyinsola Kongi, opposite Vanessa Jev. The production — an intimate, sharp-edged exploration of marriage and the conversations couples avoid — ran at the Terra Kulture lawn, Lagos, before being selected for the Lagos International Theatre Festival (LITF) 2026 at the MUSON Centre.",
    source: 'web',
    status: 'active',
    is_verified: false,
    is_spotlight: false,
  },
  {
    name: 'Vanessa Jev',
    slug: 'vanessa-jev',
    known_for_department: 'Acting',
    nationality: 'Nigerian-Canadian',
    gender: 'Female',
    birthplace: 'Nigeria',
    bio: "Vanessa Jev is a Nigerian-Canadian theatre maker, cultural producer, actress, and the Festival Director of the Lagos International Theatre Festival (LITF) — one of Africa's most significant annual theatre events. Educated at the University of Toronto, where she served as President of the African Students Association, she founded Vanessa Jev Productions in Canada, directing and producing stage plays including an African-themed adaptation of Cinderella and Black President.\n\nShe later relocated to Lagos to fully immerse herself in Nigeria's vibrant arts and culture scene, joining the Terra Kulture family and becoming a key force in championing authentic African stories and fostering international collaboration in theatre. As LITF Festival Director alongside founder Bolanle Austen-Peters, she has been instrumental in growing the festival into a platform that bridges Nigerian theatre practitioners with audiences and collaborators from across the world.\n\nIn 2026, she stepped into the spotlight as a performer, starring as Mimi in Behind Closed Doors — an intimate two-hander co-written and directed by Bolanle Austen-Peters and Kanyinsola Kongi — opposite Ralph Okoro. The production ran at Terra Kulture lawn before being featured at LITF 2026 at the MUSON Centre under the theme 'The Masks We Wear.'",
    source: 'web',
    status: 'active',
    is_verified: false,
    is_spotlight: false,
  },
];

// ── Credits to create after inserting people ──────────────────────────────────
const CREDITS = [
  {
    person_slug: 'gbolabo-gibbs-adebakin',
    play_slug: 'the-trials-of-brother-jero-opera-2026',
    role: 'Cast',
    character_name: 'Brother Jero',
    billing_order: 1,
  },
  {
    person_slug: 'johnpaul-ochei',
    play_slug: 'the-trials-of-brother-jero-opera-2026',
    role: 'Cast',
    character_name: 'Chume',
    billing_order: 2,
  },
  {
    person_slug: 'ralph-okoro',
    play_slug: 'behind-closed-doors-2026',
    role: 'Cast',
    character_name: 'Tunde',
    billing_order: 1,
  },
  {
    person_slug: 'vanessa-jev',
    play_slug: 'behind-closed-doors-2026',
    role: 'Cast',
    character_name: 'Mimi',
    billing_order: 2,
  },
];

// ── Upsert people ─────────────────────────────────────────────────────────────
async function upsertPeople() {
  console.log(`\nCreating ${PEOPLE.length} people...\n`);
  const slugToId = {};

  for (const person of PEOPLE) {
    const res = await request('POST', '/people?on_conflict=slug', [person]);
    if (res.status >= 200 && res.status < 300) {
      const row = Array.isArray(res.body) ? res.body[0] : res.body;
      console.log(`  OK   ${person.name} (id: ${row?.id})`);
      slugToId[person.slug] = row?.id;
    } else {
      console.error(`  FAIL ${person.name} -- ${JSON.stringify(res.body)}`);
    }
  }
  return slugToId;
}

// ── Look up play IDs by slug ──────────────────────────────────────────────────
async function getPlayIds(slugs) {
  const unique = [...new Set(slugs)];
  const map = {};
  for (const slug of unique) {
    const res = await request('GET', `/plays?slug=eq.${encodeURIComponent(slug)}&select=id,slug&limit=1`);
    const rows = Array.isArray(res.body) ? res.body : [];
    if (rows.length) map[slug] = rows[0].id;
    else console.warn(`  WARN  Play not found: ${slug}`);
  }
  return map;
}

// ── Upsert stage credits ──────────────────────────────────────────────────────
async function upsertCredits(personSlugToId, playSlugToId) {
  console.log(`\nLinking ${CREDITS.length} stage credits...\n`);

  for (const c of CREDITS) {
    const personId = personSlugToId[c.person_slug];
    const playId = playSlugToId[c.play_slug];

    if (!personId) { console.warn(`  SKIP  No person_id for: ${c.person_slug}`); continue; }
    if (!playId)   { console.warn(`  SKIP  No play_id for: ${c.play_slug}`); continue; }

    const payload = {
      play_id: playId,
      person_id: personId,
      role: c.role,
      character_name: c.character_name || null,
      billing_order: c.billing_order || null,
    };

    const res = await request('POST', '/stage_credits?on_conflict=play_id,person_id,role', [payload]);
    if (res.status >= 200 && res.status < 300) {
      console.log(`  OK   ${c.person_slug} -> ${c.play_slug} (${c.character_name})`);
    } else {
      console.error(`  FAIL ${c.person_slug} -- ${JSON.stringify(res.body)}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('==============================================');
  console.log(' Stage Cast Ingestion -- 4 New People + Credits');
  console.log('==============================================');

  const personSlugToId = await upsertPeople();

  const playSlugs = [...new Set(CREDITS.map(c => c.play_slug))];
  const playSlugToId = await getPlayIds(playSlugs);

  await upsertCredits(personSlugToId, playSlugToId);

  console.log('\n==============================================');
  console.log(' Done!');
  console.log('==============================================');
})();
