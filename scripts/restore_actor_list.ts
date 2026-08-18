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

const DELETED_ACTORS = [
  { name: 'Kemi Apesin Ariyo (Kemity)', searchTerms: ['Kemi Apesin', 'Kemity'] },
  { name: 'Saliu Gbolagade (Ogboluke)', searchTerms: ['Saliu Gbolagade', 'Ogboluke'] },
  { name: 'Layi Wasabi', searchTerms: ['Layi Wasabi', 'Isaac Ayomide Olayiwola'] },
  { name: 'Kwadwo Nkansah (Lilwin)', searchTerms: ['Kwadwo Nkansah', 'Lilwin'] },
  { name: 'Ibrahim Yekini (Itele)', searchTerms: ['Ibrahim Yekini', 'Itele'] },
  { name: 'Bukunmi Adeaga-Ilori (KieKie)', searchTerms: ['Bukunmi Adeaga', 'KieKie'] },
  { name: 'Olutayo Amokade (Ijebu)', searchTerms: ['Olutayo Amokade', 'Ijebu'] },
  { name: 'Babatunde Omidina (Baba Suwe)', searchTerms: ['Babatunde Omidina', 'Baba Suwe'] },
  { name: 'Margaret Bandele Olayinka (Iya Gbonkan)', searchTerms: ['Margaret Bandele Olayinka', 'Iya Gbonkan'] },
  { name: 'Moses Olaiya (Baba Sala)', searchTerms: ['Moses Olaiya', 'Baba Sala'] },
  { name: 'Bamike Olawunmi (BamBam)', searchTerms: ['Bamike Olawunmi', 'BamBam'] },
  { name: 'Adeyinka Kabiru (Arinaja)', searchTerms: ['Adeyinka Kabiru', 'Arinaja'] },
  { name: 'Toyin Afolayan (Lola Idije)', searchTerms: ['Toyin Afolayan', 'Lola Idije'] },
  { name: 'Ayo Ajewole (Woli Agba)', searchTerms: ['Ayo Ajewole', 'Woli Agba'] },
  { name: 'Ebenezer Akwasi Antwi (Akabenezer)', searchTerms: ['Ebenezer Akwasi Antwi', 'Akabenezer'] },
  { name: 'Sanusi Izihaq Adekunle (Apankufor)', searchTerms: ['Sanusi Izihaq Adekunle', 'Apankufor'] },
  { name: 'Muyiwa Adegoke (Londoner)', searchTerms: ['Muyiwa Adegoke', 'Londoner'] },
  { name: 'Tunde Bernard (Baba Tee)', searchTerms: ['Tunde Bernard', 'Baba Tee'] },
  { name: 'Funmi Awelewa (Morili)', searchTerms: ['Funmi Awelewa', 'Morili'] },
  { name: 'Chukwuebuka Emmanuel (Brainjotter)', searchTerms: ['Chukwuebuka Emmanuel', 'Brainjotter'] },
  { name: 'Paul Ephraim (Jaypaul)', searchTerms: ['Paul Ephraim', 'Jaypaul'] },
  { name: 'Azubuike Michael Egwu (Zubby Michael)', searchTerms: ['Zubby Michael', 'Azubuike Michael'] },
  { name: 'Kenny Adeyoju (Iya Ijebu)', searchTerms: ['Kenny Adeyoju', 'Iya Ijebu'] },
  { name: 'Victoria Adeyele (Veeiye)', searchTerms: ['Victoria Adeyele', 'Veeiye'] },
  { name: 'Ayanfe Adekunle (Monsuru Omoalfa)', searchTerms: ['Ayanfe Adekunle', 'Monsuru Omoalfa'] },
  { name: 'Ali Kayode Agboola (Agbeledafa)', searchTerms: ['Ali Kayode Agboola', 'Agbeledafa'] },
  { name: 'Adebayo Olalekan (Agbon Tawon)', searchTerms: ['Adebayo Olalekan', 'Agbon Tawon'] },
  { name: 'Yemi Elesho (Booda Nuru)', searchTerms: ['Yemi Elesho', 'Booda Nuru'] },
  { name: 'Toyin Adegbola (Ajoke Asewo To Re Mecca)', searchTerms: ['Toyin Adegbola', 'Ajoke Asewo'] },
  { name: 'Odogboro Bose Serah (Iyaoyo)', searchTerms: ['Odogboro Bose', 'Iyaoyo'] },
  { name: 'Ishola Ogunsola (I-Sho Pepper)', searchTerms: ['Ishola Ogunsola', 'I-Sho Pepper'] },
  { name: 'Bukola Awoyemi (Arugba)', searchTerms: ['Bukola Awoyemi', 'Arugba'] },
  { name: 'Yahaya Habeeb Olatunji (Baba Kamo)', searchTerms: ['Yahaya Habeeb', 'Baba Kamo'] },
  { name: 'Adeyemi Afolayan (Ade-Love)', searchTerms: ['Adeyemi Afolayan', 'Ade-Love'] },
];

async function processActor(actor: typeof DELETED_ACTORS[0]) {
  try {
    let personId: string | null = null;
    let personName = actor.name;

    for (const term of actor.searchTerms) {
      const { data: exactMatch } = await supabase
        .from('people')
        .select('id, name')
        .eq('name', term)
        .limit(1)
        .maybeSingle();

      if (exactMatch) {
        personId = exactMatch.id;
        personName = exactMatch.name;
        break;
      }
    }

    if (!personId) {
      const { data: newPerson } = await supabase
        .from('people')
        .insert({
          name: actor.name,
          slug: actor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          nationality: 'Nigerian',
          known_for_department: 'Actor',
          source: 'restoration',
        })
        .select('id, name')
        .single();

      if (!newPerson) return;
      personId = newPerson.id;
      personName = newPerson.name;
    }

    // Collect matching film IDs
    const filmIds: string[] = [];
    for (const term of actor.searchTerms) {
      const { data: matchedFilms } = await supabase
        .from('films')
        .select('id')
        .ilike('title', `%${term}%`)
        .limit(50);

      if (matchedFilms) {
        filmIds.push(...matchedFilms.map(f => f.id));
      }
    }

    const uniqueFilmIds = Array.from(new Set(filmIds));

    // Batch insert credits
    let creditsAdded = 0;
    if (uniqueFilmIds.length > 0) {
      for (const filmId of uniqueFilmIds) {
        const { data: existingCredit } = await supabase
          .from('credits')
          .select('id')
          .match({ film_id: filmId, person_id: personId, role: 'actor' })
          .maybeSingle();

        if (!existingCredit) {
          const { error: insErr } = await supabase.from('credits').insert({
            film_id: filmId,
            person_id: personId,
            role: 'actor',
            character_name: '',
            billing_order: 2,
          });
          if (!insErr) creditsAdded++;
        }
      }
    }

    // Update film count
    const { count: filmCount } = await supabase
      .from('credits')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', personId);

    await supabase
      .from('people')
      .update({ film_count: filmCount || 0 })
      .eq('id', personId);

    console.log(`✅ [${personName}] -> Active Films: ${filmCount || 0} (New: ${creditsAdded})`);
  } catch (e: any) {
    console.warn(`Error processing ${actor.name}:`, e?.message);
  }
}

async function restoreActorList() {
  console.log('🚀 RESTORING DELETED ACTOR PROFILES & CREDITS...');

  for (let i = 0; i < DELETED_ACTORS.length; i += 3) {
    const chunk = DELETED_ACTORS.slice(i, i + 3);
    await Promise.all(chunk.map(processActor));
  }

  console.log(`\n🎉 ACTOR RESTORATION FINISHED!`);
}

restoreActorList().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
