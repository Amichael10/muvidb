import { supabase } from './lib/db';

interface OAFPNominee {
  category: string;
  name?: string;
  role?: string;
  filmTitle: string;
}

const NOMINEES: OAFPNominee[] = [
  // 1. Best Sound Recordist of the Year
  { category: 'Best Sound Recordist of the Year', name: 'Lukman Tanimowo', role: 'Sound recordist', filmTitle: 'Godmother' },
  { category: 'Best Sound Recordist of the Year', name: 'Saheed Adewale', role: 'Sound recordist', filmTitle: 'Red Light' },
  { category: 'Best Sound Recordist of the Year', name: 'Olamilekan Alake', role: 'Sound recordist', filmTitle: "Mother's Day" },
  { category: 'Best Sound Recordist of the Year', name: 'Adegenro Wasiu', role: 'Sound recordist', filmTitle: 'Ajagungbade' },
  { category: 'Best Sound Recordist of the Year', name: 'Quadri Adeleye', role: 'Sound recordist', filmTitle: 'Shade' },
  { category: 'Best Sound Recordist of the Year', name: 'Obafunmilayo Ahmed', role: 'Sound recordist', filmTitle: 'Alligator' },
  { category: 'Best Sound Recordist of the Year', name: 'Akinkunmi Akinade', role: 'Sound recordist', filmTitle: 'Abinibi' },
  { category: 'Best Sound Recordist of the Year', name: 'Abiola Akinseye', role: 'Sound recordist', filmTitle: 'Aperire' },

  // 2. Best Editor of the Year
  { category: 'Best Editor of the Year', name: 'Hakeem O. Lawal', role: 'Editor', filmTitle: 'Orin' },
  { category: 'Best Editor of the Year', name: 'Olakunle Olabode', role: 'Editor', filmTitle: 'Iyawo Gbajumo' },
  { category: 'Best Editor of the Year', name: 'Lateef Olofin', role: 'Editor', filmTitle: 'Aso Asiri' },
  { category: 'Best Editor of the Year', name: 'Faruk Abioye', role: 'Editor', filmTitle: 'Ajagungbade' },
  { category: 'Best Editor of the Year', name: 'Adewale Aminat', role: 'Editor', filmTitle: 'One Million Dollar' },
  { category: 'Best Editor of the Year', name: 'Oyekanmi Adekola', role: 'Editor', filmTitle: 'Adan' },
  { category: 'Best Editor of the Year', name: 'Wale Ayinde', role: 'Editor', filmTitle: 'Opake' },
  { category: 'Best Editor of the Year', name: 'Ayobami Owolabi', role: 'Editor', filmTitle: 'Orisa Ilaje' },

  // 3. Best Director of Photography of the Year
  { category: 'Best Director of Photography of the Year', name: 'Dehinde Osunkoya', role: 'Cinematographer', filmTitle: 'Ibunu Omo' },
  { category: 'Best Director of Photography of the Year', name: 'David Otemolu', role: 'Cinematographer', filmTitle: 'Ebure' },
  { category: 'Best Director of Photography of the Year', name: 'Monday Abiose', role: 'Cinematographer', filmTitle: 'Snake' },
  { category: 'Best Director of Photography of the Year', name: 'Babatunde Taiwo', role: 'Cinematographer', filmTitle: 'Gbagede' },
  { category: 'Best Director of Photography of the Year', name: 'Oyebamiji Ojo', role: 'Cinematographer', filmTitle: "Mother's Day" },
  { category: 'Best Director of Photography of the Year', name: 'Femi Oladiji', role: 'Cinematographer', filmTitle: 'Seranko Seniyan' },
  { category: 'Best Director of Photography of the Year', name: 'Ridwon Adekola', role: 'Cinematographer', filmTitle: 'Shade' },
  { category: 'Best Director of Photography of the Year', name: 'Kazeem Shonekan', role: 'Cinematographer', filmTitle: 'Ayeniromo' },
  { category: 'Best Director of Photography of the Year', name: 'Wale Jacob', role: 'Cinematographer', filmTitle: 'Orisa Ilaje' },

  // 4. Best Indigenous Movie of the Year
  { category: 'Best Indigenous Movie of the Year', filmTitle: 'Opake' },
  { category: 'Best Indigenous Movie of the Year', filmTitle: 'Ogunmakin' },
  { category: 'Best Indigenous Movie of the Year', filmTitle: 'Seranko Seniyan' },

  // 5. Best Director of the Year
  { category: 'Best Director of the Year', name: 'Wale Rasaq', role: 'Director', filmTitle: 'Ibunu Omo' },
  { category: 'Best Director of the Year', name: 'Segun Ogungbe', role: 'Director', filmTitle: "Mother's Day" },
  { category: 'Best Director of the Year', name: 'Wasiu Owoiya', role: 'Director', filmTitle: 'Seranko Seniyan' },
  { category: 'Best Director of the Year', name: 'Seun Olaiya', role: 'Director', filmTitle: 'Shade' },
  { category: 'Best Director of the Year', name: 'Tunde Shobayo', role: 'Director', filmTitle: 'Alligator' },
  { category: 'Best Director of the Year', name: 'Faruk Abioye', role: 'Director', filmTitle: 'Orisha Alaje' },
  { category: 'Best Director of the Year', name: 'Captain Eniola', role: 'Director', filmTitle: 'Apara' },
  { category: 'Best Director of the Year', name: 'Tunde Komolafe', role: 'Director', filmTitle: "Sare'ola" },
  { category: 'Best Director of the Year', name: 'Oyebamiji Ojo', role: 'Director', filmTitle: 'Iwa Esisi' },
];

async function getOrCreateFilm(title: string, year = 2023) {
  const { data: existing } = await supabase
    .from('films')
    .select('id, title, year, awards')
    .ilike('title', title)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${year}`.slice(0, 80);
  const { data: created, error } = await supabase
    .from('films')
    .insert({
      title,
      slug,
      year,
      countries: ['Nigeria'],
      genres: ['Drama'],
      synopsis: `${title} is an acclaimed Nollywood indigenous production nominated at the 2023 OAFP Awards.`,
      is_nollywood: true,
      status: 'released',
      awards: []
    })
    .select('id, title, year, awards')
    .single();

  if (error) {
    console.error(`  ⚠️ Failed creating film "${title}":`, error.message);
    return null;
  }
  console.log(`  🎬 Created missing film: "${title}" (${created.id})`);
  return created;
}

async function getOrCreatePerson(name: string, role = 'Filmmaker') {
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, awards, known_for_department')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name,
      slug,
      nationality: 'Nigerian',
      known_for_department: role,
      bio: `${name} is a Nigerian filmmaker and creative talent nominated at the 2023 OAFP Awards.`,
      source: 'oafp_2023_awards_sync',
      awards: []
    })
    .select('id, name, awards, known_for_department')
    .single();

  if (error) {
    console.error(`  ⚠️ Failed creating person "${name}":`, error.message);
    return null;
  }
  console.log(`  👤 Created missing person: "${name}" (${created.id})`);
  return created;
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`  🏆 SYNCING OAFP 2023 AWARDS NOMINEES (${NOMINEES.length} NOMINATIONS)`);
  console.log(`======================================================\n`);

  let filmsUpdated = 0;
  let peopleUpdated = 0;

  for (const item of NOMINEES) {
    const film = await getOrCreateFilm(item.filmTitle);
    if (!film) continue;

    let person: any = null;
    if (item.name) {
      person = await getOrCreatePerson(item.name, item.role);
    }

    // 1. Sync on Film (films.awards)
    const filmAwards = Array.isArray(film.awards) ? [...film.awards] : [];
    const existingFilmSlot = filmAwards.find(
      (a: any) =>
        (a.organization || '').toUpperCase() === 'OAFP' &&
        a.year === 2023 &&
        (a.category || '').toLowerCase().trim() === item.category.toLowerCase().trim()
    );

    if (existingFilmSlot) {
      if (item.name) {
        const recipients = Array.isArray(existingFilmSlot.recipients) ? [...existingFilmSlot.recipients] : [];
        if (!recipients.some((r: string) => r.toLowerCase().trim() === item.name!.toLowerCase().trim())) {
          recipients.push(item.name);
          existingFilmSlot.recipients = recipients;
        }
      }
    } else {
      filmAwards.push({
        organization: 'OAFP',
        year: 2023,
        season: null,
        category: item.category,
        recipients: item.name ? [item.name] : [],
        won: false
      });
    }

    const { error: filmErr } = await supabase.from('films').update({ awards: filmAwards }).eq('id', film.id);
    if (!filmErr) {
      film.awards = filmAwards;
      filmsUpdated++;
    }

    // 2. Sync on Person (people.awards)
    if (person && item.name) {
      const personAwards = Array.isArray(person.awards) ? [...person.awards] : [];
      const existingPersonSlot = personAwards.find(
        (a: any) =>
          (a.organization || '').toUpperCase() === 'OAFP' &&
          a.year === 2023 &&
          (a.category || '').toLowerCase().trim() === item.category.toLowerCase().trim()
      );

      if (existingPersonSlot) {
        existingPersonSlot.work = film.title;
        existingPersonSlot.film_id = film.id;
        existingPersonSlot.won = false;
      } else {
        personAwards.push({
          organization: 'OAFP',
          year: 2023,
          season: null,
          category: item.category,
          work: film.title,
          film_id: film.id,
          won: false
        });
      }

      const { error: personErr } = await supabase.from('people').update({ awards: personAwards }).eq('id', person.id);
      if (!personErr) {
        person.awards = personAwards;
        peopleUpdated++;
      }
    }

    console.log(`  ✓ Synced: [${item.category}] -> ${item.name ? `${item.name} (${item.filmTitle})` : item.filmTitle}`);
  }

  console.log(`\n======================================================`);
  console.log(`  ✨ FINISHED OAFP 2023 AWARDS NOMINEES SYNC!`);
  console.log(`  Total operations completed: ${NOMINEES.length}`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
