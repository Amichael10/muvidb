import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CLASSIC_ACTOR_FILM_MAPS = [
  {
    exactName: 'Adeyemi Afolayan (Ade-Love)',
    filmQueryPatterns: ['%Kadara%', '%Taxi Driver%', '%Ija Orogun%', '%Iya Ni Wura%', '%Eyin Oku%'],
    role: 'actor'
  },
  {
    exactName: 'Moses Olaiya (Baba Sala)',
    filmQueryPatterns: ['%Orun Mooru%', '%Mosebolatan%', '%Aare Agbaye%', '%Ana Gba%', '%Obe Gbona%', '%Baba Sala%'],
    role: 'actor'
  },
  {
    exactName: 'Babatunde Omidina (Baba Suwe)',
    filmQueryPatterns: ['%Baba Suwe%', '%Obelomo%', '%Larinlodu%', '%Oruko%', '%N150 Million%'],
    role: 'actor'
  },
  {
    exactName: 'Margaret Bandele Olayinka (Iya Gbonkan)',
    filmQueryPatterns: ['%Koto Orun%', '%Koto Aaye%', '%Eran Iya Oshogbo%', '%Iya Gbonkan%'],
    role: 'actor'
  },
  {
    exactName: 'Ishola Ogunsola (I-Sho Pepper)',
    filmQueryPatterns: ['%I-Sho Pepper%', '%Ogunsola%', '%Efunsetan%'],
    role: 'actor'
  },
  {
    exactName: 'Adebayo Olalekan (Agbon Tawon)',
    filmQueryPatterns: ['%Agbon Tawon%'],
    role: 'actor'
  },
  {
    exactName: 'Odogboro Bose Serah (Iyaoyo)',
    filmQueryPatterns: ['%Iyaoyo%'],
    role: 'actor'
  },
  {
    exactName: 'Paul Ephraim (Jaypaul)',
    filmQueryPatterns: ['%Jaypaul%', '%Jay Paul%'],
    role: 'actor'
  },
  {
    exactName: 'Ali Kayode Agboola (Agbeledafa)',
    filmQueryPatterns: ['%Agbeledafa%'],
    role: 'actor'
  },
  {
    exactName: 'Ayanfe Adekunle (Monsuru Omoalfa)',
    filmQueryPatterns: ['%Monsuru%', '%Omoalfa%'],
    role: 'actor'
  }
];

async function relinkOneActor(item: typeof CLASSIC_ACTOR_FILM_MAPS[0]) {
  const { data: person } = await supabase
    .from('people')
    .select('id, name')
    .eq('name', item.exactName)
    .maybeSingle();

  if (!person) return;

  const matchedFilmIds = new Set<string>();
  for (const pattern of item.filmQueryPatterns) {
    const { data: matchedFilms } = await supabase
      .from('films')
      .select('id, title')
      .ilike('title', pattern);

    if (matchedFilms) {
      matchedFilms.forEach(f => matchedFilmIds.add(f.id));
    }
  }

  let newlyLinked = 0;
  for (const filmId of Array.from(matchedFilmIds)) {
    const { data: existing } = await supabase
      .from('credits')
      .select('id')
      .match({ film_id: filmId, person_id: person.id, role: item.role })
      .maybeSingle();

    if (!existing) {
      await supabase.from('credits').insert({
        film_id: filmId,
        person_id: person.id,
        role: item.role,
        character_name: '',
        billing_order: 2,
      });
      newlyLinked++;
    }
  }

  const { count: filmCount } = await supabase
    .from('credits')
    .select('*', { count: 'exact', head: true })
    .eq('person_id', person.id);

  await supabase
    .from('people')
    .update({ film_count: filmCount || 0 })
    .eq('id', person.id);

  console.log(`✅ [${item.exactName}] -> Total Film Credits Now: ${filmCount || 0} (+${newlyLinked} new links)`);
}

async function relinkClassicCredits() {
  console.log('🚀 RE-LINKING CLASSIC FILM CREDITS TO ACTOR PROFILES...\n');
  await Promise.all(CLASSIC_ACTOR_FILM_MAPS.map(relinkOneActor));
  console.log('\n🎉 ALL CLASSIC ACTOR CREDITS RE-LINKED SUCCESSFULLY!');
}

relinkClassicCredits().catch(console.error);
