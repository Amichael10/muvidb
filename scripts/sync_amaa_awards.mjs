import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

async function getOrCreatePerson(name, extra = {}) {
  const cleanName = name.trim();
  const slug = slugify(cleanName);

  const { data: existing } = await supabase
    .from('people')
    .select('id, name, slug, photo_url, awards')
    .or(`name.ilike.${cleanName},slug.eq.${slug}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug,
      nationality: extra.nationality || 'Nigerian',
      bio: `${cleanName} is an acclaimed African screen and stage talent.`,
      photo_url: extra.photo_url || null,
      known_for_department: extra.department || 'Acting',
      source: 'amaa_awards_sync',
      is_verified: true,
      popularity_score: 85,
      awards: [],
    })
    .select('id, name, slug, photo_url, awards')
    .single();

  if (error) {
    const { data: retry } = await supabase.from('people').select('id, name, slug, photo_url, awards').ilike('name', cleanName).limit(1).maybeSingle();
    return retry || null;
  }
  return created;
}

async function getOrCreateFilm(filmData) {
  const cleanTitle = filmData.title.trim();
  const slug = slugify(`${cleanTitle}-${filmData.year || 2011}`);

  const { data: existing } = await supabase
    .from('films')
    .select('id, title, slug, year, poster_url, backdrop_url, awards')
    .or(`slug.eq.${slug},title.ilike.${cleanTitle}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: created, error } = await supabase
    .from('films')
    .insert({
      title: cleanTitle,
      slug,
      year: filmData.year || 2011,
      synopsis: `${cleanTitle} is an acclaimed African cinema feature film nominated at the Africa Movie Academy Awards (AMAA).`,
      poster_url: filmData.poster_url || null,
      backdrop_url: filmData.backdrop_url || null,
      genres: filmData.genres || ['Drama'],
      source: 'amaa_awards_sync',
      is_published: true,
      is_nollywood: true,
      awards: [],
    })
    .select('id, title, slug, year, poster_url, backdrop_url, awards')
    .single();

  if (error) {
    const { data: retry } = await supabase.from('films').select('id, title, slug, year, poster_url, backdrop_url, awards').ilike('title', cleanTitle).limit(1).maybeSingle();
    return retry || null;
  }
  return created;
}

async function addPersonAward(personId, award) {
  const { data: person } = await supabase.from('people').select('id, awards').eq('id', personId).single();
  if (!person) return;

  const currentAwards = Array.isArray(person.awards) ? person.awards : [];
  const exists = currentAwards.some(
    (a) => a.organization === award.organization && a.year === award.year && a.category === award.category && a.work === award.work
  );

  if (!exists) {
    const updated = [...currentAwards, award];
    await supabase.from('people').update({ awards: updated }).eq('id', personId);
  }
}

async function addFilmAward(filmId, award) {
  const { data: film } = await supabase.from('films').select('id, awards').eq('id', filmId).single();
  if (!film) return;

  const currentAwards = Array.isArray(film.awards) ? film.awards : [];
  const exists = currentAwards.some(
    (a) => a.organization === award.organization && a.year === award.year && a.category === award.category
  );

  if (!exists) {
    const updated = [...currentAwards, award];
    await supabase.from('films').update({ awards: updated }).eq('id', filmId);
  }
}

// Complete AMAA 2011 Nomination & Winners Dataset
const AMAA_2011_ENTRIES = [
  // Best Actor in a Leading Role
  { category: 'Best Actor in a Leading Role', person: 'Themba Ndaba', film: 'Hopeville', won: true, year: 2011 },
  { category: 'Best Actor in a Leading Role', person: 'Patsha Bay', film: 'Viva Riva!', won: false, year: 2011 },
  { category: 'Best Actor in a Leading Role', person: 'Jimmy Jean-Louis', film: 'Sinking Sands', won: false, year: 2011 },
  { category: 'Best Actor in a Leading Role', person: 'Ekow Blankson', film: 'Checkmate', won: false, year: 2011 },
  { category: 'Best Actor in a Leading Role', person: 'Majid Michel', film: 'Pool Party', won: false, year: 2011 },
  { category: 'Best Actor in a Leading Role', person: 'Antar Laniyan', film: 'Yemoja', won: false, year: 2011 },

  // Best Actor in a Supporting Role
  { category: 'Best Actor in a Supporting Role', person: 'Hoji Fortuna', film: 'Viva Riva!', won: true, year: 2011 },
  { category: 'Best Actor in a Supporting Role', person: 'Desmond Dube', film: 'Hopeville', won: false, year: 2011 },
  { category: 'Best Actor in a Supporting Role', person: 'Osita Iheme', film: 'The Mirror Boy', won: false, year: 2011 },
  { category: 'Best Actor in a Supporting Role', person: 'Vusi Kunene', film: 'A Small Town Called Descent', won: false, year: 2011 },
  { category: 'Best Actor in a Supporting Role', person: 'John Dumelo', film: 'A Private Storm', won: false, year: 2011 },

  // Best Actress in a Leading Role
  { category: 'Best Actress in a Leading Role', person: 'Ama K. Abebrese', film: 'Sinking Sands', won: true, year: 2011 },
  { category: 'Best Actress in a Leading Role', person: 'Manie Malone', film: 'Viva Riva!', won: false, year: 2011 },
  { category: 'Best Actress in a Leading Role', person: 'Genevieve Nnaji', film: 'Tango with Me', won: false, year: 2011 },
  { category: 'Best Actress in a Leading Role', person: 'Idiatu Sobande', film: 'Aramotu', won: false, year: 2011 },
  { category: 'Best Actress in a Leading Role', person: 'Omoni Oboli', film: 'Anchor Baby', won: false, year: 2011 },
  { category: 'Best Actress in a Leading Role', person: 'Denise Newman', film: 'Shirley Adams', won: false, year: 2011 },

  // Best Actress in a Supporting Role
  { category: 'Best Actress in a Supporting Role', person: 'Marlene Longage', film: 'Viva Riva!', won: true, year: 2011 },
  { category: 'Best Actress in a Supporting Role', person: 'Mary Twala', film: 'Hopeville', won: false, year: 2011 },
  { category: 'Best Actress in a Supporting Role', person: 'Joyce Brabner', film: 'Soul Boy', won: false, year: 2011 },
  { category: 'Best Actress in a Supporting Role', person: 'Tina Mba', film: 'Tango with Me', won: false, year: 2011 },
  { category: 'Best Actress in a Supporting Role', person: 'Yvonne Okoro', film: 'Pool Party', won: false, year: 2011 },

  // Best Young / Promising Actor
  { category: 'Most Promising Actor', person: 'Samsun Siasia', film: 'Ghetto Dreamz: The Dagrin Story', won: true, year: 2011 },
  { category: 'Most Promising Actor', person: 'Yves Dusenge', film: 'Kanyekanye', won: false, year: 2011 },
  { category: 'Most Promising Actor', person: 'Helen Rogers', film: 'Anchor Baby', won: false, year: 2011 },
  { category: 'Most Promising Actor', person: 'Danielle Leutwiler', film: 'Shirley Adams', won: false, year: 2011 },
  { category: 'Most Promising Actor', person: 'Travis Mirrione', film: 'Soul Boy', won: false, year: 2011 },

  // Best Director
  { category: 'Best Director', person: 'Djo Tunda Wa Munga', film: 'Viva Riva!', won: true, year: 2011, department: 'Directing' },
  { category: 'Best Director', person: 'Leila Djansi', film: 'Sinking Sands', won: false, year: 2011, department: 'Directing' },
  { category: 'Best Director', person: 'Mahmood Ali-Balogun', film: 'Tango with Me', won: false, year: 2011, department: 'Directing' },
  { category: 'Best Director', person: 'Niji Akanni', film: 'Aramotu', won: false, year: 2011, department: 'Directing' },
  { category: 'Best Director', person: 'Jahmil X.T. Qubeka', film: 'A Small Town Called Descent', won: false, year: 2011, department: 'Directing' },
  { category: 'Best Director', person: 'Wanuri Kahiu', film: 'Soul Boy', won: false, year: 2011, department: 'Directing' },

  // Best Film (Award to film & director/producer)
  { category: 'Best Film', film: 'Viva Riva!', won: true, year: 2011, recipients: ['Djo Tunda Wa Munga'] },
  { category: 'Best Film', film: 'Sinking Sands', won: false, year: 2011, recipients: ['Leila Djansi'] },
  { category: 'Best Film', film: 'Aramotu', won: false, year: 2011, recipients: ['Niji Akanni'] },
  { category: 'Best Film', film: 'Soul Boy', won: false, year: 2011, recipients: ['Wanuri Kahiu'] },
  { category: 'Best Film', film: 'Hopeville', won: false, year: 2011, recipients: ['John Trengove'] },
  { category: 'Best Film', film: 'A Small Town Called Descent', won: false, year: 2011, recipients: ['Jahmil X.T. Qubeka'] },

  // Best Screenplay
  { category: 'Best Screenplay', film: 'Sinking Sands', won: true, year: 2011, recipients: ['Leila Djansi'] },
  { category: 'Best Screenplay', film: 'Soul Boy', won: false, year: 2011 },
  { category: 'Best Screenplay', film: 'Hopeville', won: false, year: 2011 },
  { category: 'Best Screenplay', film: 'Shirley Adams', won: false, year: 2011 },
  { category: 'Best Screenplay', film: 'Izulu Lami', won: false, year: 2011 },

  // Best Cinematography
  { category: 'Best Cinematography', film: 'Viva Riva!', won: true, year: 2011 },
  { category: 'Best Cinematography', film: 'Sinking Sands', won: false, year: 2011 },
  { category: 'Best Cinematography', film: 'Maami', won: false, year: 2011 },
  { category: 'Best Cinematography', film: 'Izulu Lami', won: false, year: 2011 },
  { category: 'Best Cinematography', film: 'Hopeville', won: false, year: 2011 },

  // Best Costume Design
  { category: 'Best Costume Design', film: 'Aramotu', won: true, year: 2011 },
  { category: 'Best Costume Design', film: 'Inale', won: false, year: 2011 },
  { category: 'Best Costume Design', film: 'Yemoja', won: false, year: 2011 },
  { category: 'Best Costume Design', film: 'Sinking Sands', won: false, year: 2011 },

  // Best Original Soundtrack
  { category: 'Best Original Soundtrack', film: 'Inale', won: true, year: 2011 },
  { category: 'Best Original Soundtrack', film: 'Viva Riva!', won: false, year: 2011 },
  { category: 'Best Original Soundtrack', film: 'Sinking Sands', won: false, year: 2011 },
  { category: 'Best Original Soundtrack', film: 'A Small Town Called Descent', won: false, year: 2011 },

  // Best Film for African Abroad (Diaspora)
  { category: 'Best Film for African Abroad', film: 'In America: The Story of the Soul Sister', won: true, year: 2011 },
  { category: 'Best Film for African Abroad', film: 'Anchor Baby', won: false, year: 2011 },
  { category: 'Best Film for African Abroad', film: 'The Mirror Boy', won: false, year: 2011 },
  { category: 'Best Film for African Abroad', film: 'Africa United', won: false, year: 2011 },
];

async function main() {
  console.log(`🏆 Syncing ${AMAA_2011_ENTRIES.length} AMAA 2011 honours into MuviDB...`);

  let filmsUpdated = 0;
  let peopleUpdated = 0;

  for (let i = 0; i < AMAA_2011_ENTRIES.length; i++) {
    const item = AMAA_2011_ENTRIES[i];
    console.log(`[${i + 1}/${AMAA_2011_ENTRIES.length}] Processing: ${item.category} -> ${item.film || item.person} (${item.won ? 'Winner' : 'Nominee'})...`);

    let filmObj = null;
    if (item.film) {
      filmObj = await getOrCreateFilm({ title: item.film, year: item.year });
      if (filmObj) {
        await addFilmAward(filmObj.id, {
          organization: 'AMAA',
          year: item.year,
          category: item.category,
          work: item.film,
          won: item.won,
          recipients: item.recipients || (item.person ? [item.person] : []),
        });
        filmsUpdated++;
      }
    }

    if (item.person) {
      const personObj = await getOrCreatePerson(item.person, { department: item.department || 'Acting' });
      if (personObj) {
        await addPersonAward(personObj.id, {
          organization: 'AMAA',
          year: item.year,
          category: item.category,
          work: item.film || 'Cinema',
          film_id: filmObj?.id || null,
          won: item.won,
        });
        peopleUpdated++;
      }
    }
  }

  console.log(`\n🎉 AMAA AWARDS SYNC COMPLETE!`);
  console.log(`- Total Film Honours Recorded: ${filmsUpdated}`);
  console.log(`- Total Talent Honours Recorded: ${peopleUpdated}`);
}

main().catch(console.error);
