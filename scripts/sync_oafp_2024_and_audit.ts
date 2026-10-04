import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (k: string) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim() : '';
};

const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

interface OAFPEntry {
  name: string;
  category: string;
  awardTitle?: string;
  filmTitle?: string;
  role?: string;
  aliases?: string[];
  isFilmAward?: boolean;
}

const OAFP_2024_AWARDS: OAFPEntry[] = [
  { name: 'Ibrahim Chatta', category: 'Legendary Award', role: 'Actor' },
  { name: 'Jide Kosoko', category: 'Legendary Award', role: 'Actor' },
  { name: 'Rotimi Salami', category: 'Best Actor - Male', role: 'Actor' },
  { name: 'Funmi Martin', aliases: ['Mide Funmi Martins', 'Funmi Martins', 'Mide Martins'], category: 'Best Actor - Female', role: 'Actor' },
  { name: 'Afeez Abiodun Owo', aliases: ['Afeez Abiodun', 'Afeez Owo'], category: 'Best Director', role: 'Director' },
  { name: 'Olalekan Alake', aliases: ['Olamilekan Alake'], category: 'Best Sound Recordist', role: 'Sound Department' },
  { name: 'Kazeem Atinuke', aliases: ['Mama No Network', 'Atinuke Kazeem'], category: 'Best Comedian Female', role: 'Actor' },
  { name: 'Sanusi Izihaq', aliases: ['Izihaq Sanusi'], category: 'Best Comedian Male', role: 'Actor' },
  { name: 'Yemi Solade', category: 'Best Dressed Male', role: 'Actor' },
  { name: 'Omowunmi Ajiboye', category: 'Best Indigenous Movie', isFilmAward: true, role: 'Producer' },
  { name: 'Yetunde Barnabas', aliases: ['Yetunde barnabas'], category: 'Next Rated Actor Female', role: 'Actor' },
  { name: 'Yetunde Barnabas', aliases: ['Yetunde barnabas'], category: 'Producer of the Year', role: 'Producer' },
  { name: 'Sherif Taiwo', aliases: ['Sherif Taiwo Abayomi'], category: 'Best Gaffer', role: 'Lighting' },
  { name: 'Adisa Yusuf', category: 'Best Director of Photography', role: 'Cinematographer' },
  { name: 'Adedoyin Ikukoyi', category: 'Best Dressed Female', role: 'Actor' },
  { name: 'Opeyemi Olawale', category: 'Best Set Designer', role: 'Art Department' },
  { name: 'Kunle Omisore', filmTitle: 'Ale Mi', category: 'Best Overall Movie', isFilmAward: true, role: 'Producer' },
  { name: 'Dehinde Oshunkoya', aliases: ['Dehinde Osunkoya'], category: 'Best Director of Photography', role: 'Cinematographer' },
  { name: 'Gbenga Okunola', category: 'Best Editor', role: 'Editor' },
  { name: 'Temitope Olaiya', category: 'Next Rated Actor Male', role: 'Actor' },
];

async function findPerson(entry: OAFPEntry) {
  const namesToTry = [entry.name, ...(entry.aliases || [])];

  for (const n of namesToTry) {
    const { data: exact } = await supabase
      .from('people')
      .select('id, name, slug, photo_url, awards, known_for_department')
      .ilike('name', n.trim())
      .limit(1)
      .maybeSingle();

    if (exact) return exact;
  }

  // Try fuzzy / contains matching
  for (const n of namesToTry) {
    const parts = n.trim().split(' ').filter(p => p.length > 2);
    if (parts.length >= 2) {
      const { data: matched } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, awards, known_for_department')
        .ilike('name', `%${parts[0]}%${parts[1]}%`)
        .limit(1)
        .maybeSingle();

      if (matched) return matched;
    }
  }

  return null;
}

async function getOrCreateFilm(title: string, year = 2024) {
  const { data: existing } = await supabase
    .from('films')
    .select('id, title, slug, awards, year, poster_url')
    .ilike('title', title.trim())
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
      synopsis: `${title} is an acclaimed Nollywood production honored at the 2024 OAFP Awards.`,
      is_nollywood: true,
      status: 'released',
      awards: []
    })
    .select('id, title, slug, awards, year, poster_url')
    .single();

  if (error) {
    console.error(`⚠️ Failed to create film "${title}":`, error.message);
    return null;
  }
  console.log(`🎬 Created missing film: "${title}" (${created.id})`);
  return created;
}

async function createPerson(name: string, role = 'Actor') {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 80);
  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name,
      slug,
      nationality: 'Nigerian',
      known_for_department: role,
      bio: `${name} is a distinguished Nollywood creative recognized at the 2024 OAFP Awards.`,
      source: 'oafp_2024_awards_sync',
      awards: []
    })
    .select('id, name, slug, photo_url, awards, known_for_department')
    .single();

  if (error) {
    console.error(`⚠️ Failed to create person "${name}":`, error.message);
    return null;
  }
  console.log(`👤 Created missing person: "${name}" (${created.id})`);
  return created;
}

async function sync2024Awards() {
  console.log('\n======================================================');
  console.log('🏆 1. SYNCING OAFP AWARDS 2024');
  console.log('======================================================\n');

  for (const entry of OAFP_2024_AWARDS) {
    let person = await findPerson(entry);

    if (!person) {
      person = await createPerson(entry.name, entry.role);
    }

    if (!person) {
      console.log(`❌ Could not resolve person for: ${entry.name}`);
      continue;
    }

    console.log(`🎯 Matched "${entry.name}" -> ${person.name} (${person.id}) [Photo: ${person.photo_url ? '✅' : '❌'}]`);

    // Sync award on Person
    const currentAwards = Array.isArray(person.awards) ? [...person.awards] : [];
    const alreadyHas = currentAwards.some((a: any) =>
      (a.organization || '').toUpperCase() === 'OAFP' &&
      Number(a.year) === 2024 &&
      (a.category || '').toLowerCase().trim() === entry.category.toLowerCase().trim()
    );

    if (alreadyHas) {
      console.log(`   ℹ️ Already has award: ${entry.category} (2024)`);
    } else {
      const newAward: any = {
        organization: 'OAFP',
        year: 2024,
        season: 2024,
        category: entry.category,
        title: `${entry.category} - OAFP Awards 2024`,
        won: true,
        work: entry.filmTitle || null
      };
      currentAwards.push(newAward);

      const { error: updateErr } = await supabase
        .from('people')
        .update({ awards: currentAwards })
        .eq('id', person.id);

      if (updateErr) {
        console.error(`   ❌ Failed to update awards for ${person.name}:`, updateErr.message);
      } else {
        console.log(`   ✅ Added 2024 Award: "${entry.category}" to ${person.name}`);
      }
    }

    // If award is tagged with a film (e.g. Ale Mi)
    if (entry.filmTitle) {
      const film = await getOrCreateFilm(entry.filmTitle, 2024);
      if (film) {
        const filmAwards = Array.isArray(film.awards) ? [...film.awards] : [];
        const hasFilm = filmAwards.some((a: any) =>
          (a.organization || '').toUpperCase() === 'OAFP' &&
          Number(a.year) === 2024 &&
          (a.category || '').toLowerCase().trim() === entry.category.toLowerCase().trim()
        );
        if (!hasFilm) {
          filmAwards.push({
            organization: 'OAFP',
            year: 2024,
            season: 2024,
            category: entry.category,
            title: `${entry.category} - OAFP Awards 2024`,
            won: true,
            recipients: [person.name]
          });
          await supabase.from('films').update({ awards: filmAwards }).eq('id', film.id);
          console.log(`   🎬 Added award to Film "${film.title}": "${entry.category}"`);
        }
      }
    }
  }

  console.log('\n======================================================');
  console.log('🔍 2. AUDIT: PROFILE PICTURES FOR OAFP 2022, 2023 & 2024');
  console.log('======================================================\n');

  // Fetch all people with awards
  const { data: allPeopleWithAwards, error } = await supabase
    .from('people')
    .select('id, name, slug, photo_url, awards')
    .not('awards', 'eq', '[]');

  if (error || !allPeopleWithAwards) {
    console.error('Error fetching people for audit:', error?.message);
    return;
  }

  const oafpYears = [2022, 2023, 2024];
  const auditResults: {
    year: number;
    personName: string;
    personId: string;
    hasPhoto: boolean;
    photoUrl?: string;
    category: string;
  }[] = [];

  for (const p of allPeopleWithAwards) {
    const pAwards = Array.isArray(p.awards) ? p.awards : [];
    for (const a of pAwards) {
      const org = (a.organization || '').toUpperCase();
      const yr = Number(a.year);
      if (org === 'OAFP' && oafpYears.includes(yr)) {
        auditResults.push({
          year: yr,
          personName: p.name,
          personId: p.id,
          hasPhoto: Boolean(p.photo_url && p.photo_url.trim().length > 0),
          photoUrl: p.photo_url || undefined,
          category: a.category || a.title || 'Honoree'
        });
      }
    }
  }

  // De-duplicate per person & year
  const missingPhotosByYear: Record<number, { name: string; id: string; category: string }[]> = {
    2022: [],
    2023: [],
    2024: []
  };

  const withPhotosByYear: Record<number, { name: string; id: string; category: string }[]> = {
    2022: [],
    2023: [],
    2024: []
  };

  for (const item of auditResults) {
    const list = item.hasPhoto ? withPhotosByYear[item.year] : missingPhotosByYear[item.year];
    if (list && !list.some(x => x.id === item.personId)) {
      list.push({ name: item.personName, id: item.personId, category: item.category });
    }
  }

  for (const yr of oafpYears) {
    console.log(`\n📅 --- OAFP ${yr} ---`);
    console.log(`  Total Honorees/Nominees: ${(withPhotosByYear[yr]?.length || 0) + (missingPhotosByYear[yr]?.length || 0)}`);
    console.log(`  ✅ With Photo: ${withPhotosByYear[yr]?.length || 0}`);
    console.log(`  ❌ Missing Photo: ${missingPhotosByYear[yr]?.length || 0}`);

    if (missingPhotosByYear[yr]?.length > 0) {
      console.log(`\n  🚨 Names without profile picture for ${yr}:`);
      missingPhotosByYear[yr].forEach((m, idx) => {
        console.log(`    ${idx + 1}. ${m.name} (${m.category})`);
      });
    } else {
      console.log(`  🎉 All honorees in ${yr} have profile pictures!`);
    }
  }
}

sync2024Awards().catch(console.error);
