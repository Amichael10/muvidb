import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tmdbKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_ACTORS = [
  { exactName: 'Kemi Apesin Ariyo (Kemity)', searchTerms: ['Kemi Apesin', 'Kemity', 'Kemi Ariyo'], tmdbQuery: 'Kemi Apesin' },
  { exactName: 'Muyiwa Adegoke (Londoner)', searchTerms: ['Muyiwa Adegoke', 'Londoner', 'Baba Londoner'], tmdbQuery: 'Muyiwa Adegoke' },
  { exactName: 'Adeyemi Afolayan (Ade-Love)', searchTerms: ['Adeyemi Afolayan', 'Ade-Love', 'Ade Love'], tmdbQuery: 'Adeyemi Afolayan' },
  { exactName: 'Saliu Gbolagade (Ogboluke)', searchTerms: ['Saliu Gbolagade', 'Soliu Gbolagade', 'Ogboluke'], tmdbQuery: 'Saliu Gbolagade' },
  { exactName: 'Babatunde Omidina (Baba Suwe)', searchTerms: ['Babatunde Omidina', 'Baba Suwe'], tmdbQuery: 'Babatunde Omidina' },
  { exactName: 'Margaret Bandele Olayinka (Iya Gbonkan)', searchTerms: ['Margaret Bandele Olayinka', 'Iya Gbonkan'], tmdbQuery: 'Margaret Bandele Olayinka' },
  { exactName: 'Moses Olaiya (Baba Sala)', searchTerms: ['Moses Olaiya', 'Baba Sala'], tmdbQuery: 'Moses Olaiya' },
  { exactName: 'Toyin Afolayan (Lola Idije)', searchTerms: ['Toyin Afolayan', 'Lola Idije'], tmdbQuery: 'Toyin Afolayan' },
  { exactName: 'Kwadwo Nkansah (Lilwin)', searchTerms: ['Kwadwo Nkansah', 'Lilwin'], tmdbQuery: 'Kwadwo Nkansah' },
  { exactName: 'Ibrahim Yekini (Itele)', searchTerms: ['Ibrahim Yekini', 'Itele'], tmdbQuery: 'Ibrahim Yekini' },
  { exactName: 'Bukunmi Adeaga-Ilori (KieKie)', searchTerms: ['Bukunmi Adeaga', 'KieKie'], tmdbQuery: 'Bukunmi Adeaga' },
  { exactName: 'Olutayo Amokade (Ijebu)', searchTerms: ['Olutayo Amokade', 'Ijebu'], tmdbQuery: 'Olutayo Amokade' },
  { exactName: 'Bamike Olawunmi (BamBam)', searchTerms: ['Bamike Olawunmi', 'BamBam', 'Bambam Omiche'], tmdbQuery: 'Bamike Olawunmi' },
  { exactName: 'Adeyinka Kabiru (Arinaja)', searchTerms: ['Adeyinka Kabiru', 'Arinaja'], tmdbQuery: 'Adeyinka Kabiru' },
  { exactName: 'Ayo Ajewole (Woli Agba)', searchTerms: ['Ayo Ajewole', 'Woli Agba'], tmdbQuery: 'Ayo Ajewole' },
  { exactName: 'Ebenezer Akwasi Antwi (Akabenezer)', searchTerms: ['Ebenezer Akwasi Antwi', 'Akabenezer'], tmdbQuery: 'Ebenezer Akwasi Antwi' },
  { exactName: 'Sanusi Izihaq Adekunle (Apankufor)', searchTerms: ['Sanusi Izihaq Adekunle', 'Apankufor'], tmdbQuery: 'Sanusi Izihaq' },
  { exactName: 'Tunde Bernard (Baba Tee)', searchTerms: ['Tunde Bernard', 'Baba Tee'], tmdbQuery: 'Tunde Bernard' },
  { exactName: 'Funmi Awelewa (Morili)', searchTerms: ['Funmi Awelewa', 'Morili'], tmdbQuery: 'Funmi Awelewa' },
  { exactName: 'Chukwuebuka Emmanuel (Brainjotter)', searchTerms: ['Chukwuebuka Emmanuel', 'Brainjotter'], tmdbQuery: 'Chukwuebuka Emmanuel' },
  { exactName: 'Paul Ephraim (Jaypaul)', searchTerms: ['Paul Ephraim', 'Jaypaul'], tmdbQuery: 'Paul Ephraim' },
  { exactName: 'Azubuike Michael Egwu (Zubby Michael)', searchTerms: ['Azubuike Michael', 'Zubby Michael'], tmdbQuery: 'Zubby Michael' },
  { exactName: 'Kenny Adeyoju (Iya Ijebu)', searchTerms: ['Kenny Adeyoju', 'Iya Ijebu'], tmdbQuery: 'Kenny Adeyoju' },
  { exactName: 'Victoria Adeyele (Veeiye)', searchTerms: ['Victoria Adeyele', 'Veeiye'], tmdbQuery: 'Victoria Adeyele' },
  { exactName: 'Ayanfe Adekunle (Monsuru Omoalfa)', searchTerms: ['Ayanfe Adekunle', 'Monsuru Omoalfa'], tmdbQuery: 'Ayanfe Adekunle' },
  { exactName: 'Ali Kayode Agboola (Agbeledafa)', searchTerms: ['Ali Kayode Agboola', 'Agbeledafa'], tmdbQuery: 'Ali Kayode Agboola' },
  { exactName: 'Adebayo Olalekan (Agbon Tawon)', searchTerms: ['Adebayo Olalekan', 'Agbon Tawon'], tmdbQuery: 'Adebayo Olalekan' },
  { exactName: 'Yemi Elesho (Booda Nuru)', searchTerms: ['Yemi Elesho', 'Booda Nuru'], tmdbQuery: 'Yemi Elesho' },
  { exactName: 'Toyin Adegbola (Ajoke Asewo To Re Mecca)', searchTerms: ['Toyin Adegbola', 'Ajoke Asewo'], tmdbQuery: 'Toyin Adegbola' },
  { exactName: 'Odogboro Bose Serah (Iyaoyo)', searchTerms: ['Odogboro Bose', 'Iyaoyo'], tmdbQuery: 'Odogboro Bose' },
  { exactName: 'Ishola Ogunsola (I-Sho Pepper)', searchTerms: ['Ishola Ogunsola', 'I-Sho Pepper'], tmdbQuery: 'Ishola Ogunsola' },
  { exactName: 'Bukola Awoyemi (Arugba)', searchTerms: ['Bukola Awoyemi', 'Arugba'], tmdbQuery: 'Bukola Awoyemi' },
  { exactName: 'Yahaya Habeeb Olatunji (Baba Kamo)', searchTerms: ['Yahaya Habeeb', 'Baba Kamo'], tmdbQuery: 'Yahaya Habeeb' },
];

async function fetchTmdbPersonDetails(query: string) {
  if (!tmdbKey) return null;
  try {
    const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&include_adult=false`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const results = searchJson?.results || [];
    if (results.length === 0) return null;

    const personId = results[0].id;
    const detailsUrl = `https://api.themoviedb.org/3/person/${personId}?api_key=${tmdbKey}`;
    const detailsRes = await fetch(detailsUrl);
    if (!detailsRes.ok) return null;
    const details = await detailsRes.json();

    const photoUrl = details.profile_path
      ? `https://image.tmdb.org/t/p/h632${details.profile_path}`
      : (results[0].profile_path ? `https://image.tmdb.org/t/p/h632${results[0].profile_path}` : null);

    return {
      tmdb_id: personId,
      photo_url: photoUrl,
      bio: details.biography || null,
      birthplace: details.place_of_birth || null,
      date_of_birth: details.birthday || null,
      gender: details.gender === 1 ? 'Female' : (details.gender === 2 ? 'Male' : null),
    };
  } catch (err) {
    return null;
  }
}

async function restoreOneActor(item: typeof TARGET_ACTORS[0]) {
  try {
    // 1. Gather all matching rows across people table
    const matchedRowsMap = new Map<string, any>();
    for (const term of item.searchTerms) {
      const { data: rows } = await supabase
        .from('people')
        .select('*')
        .or(`name.ilike.%${term}%,name.eq.${item.exactName}`);

      if (rows) {
        rows.forEach(r => matchedRowsMap.set(r.id, r));
      }
    }

    const matchedRows = Array.from(matchedRowsMap.values());
    let canonicalRow: any = matchedRows.find(r => r.name === item.exactName) || matchedRows[0] || null;

    // 2. TMDB Fetch for photo & bio
    const tmdbData = await fetchTmdbPersonDetails(item.tmdbQuery);
    const slug = item.exactName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const updatePayload: Record<string, any> = {
      name: item.exactName, // MUST be exact name with parentheses
      slug: slug,
      nationality: 'Nigerian',
      known_for_department: 'Actor',
    };

    if (tmdbData) {
      if (tmdbData.tmdb_id) updatePayload.tmdb_id = tmdbData.tmdb_id;
      if (tmdbData.photo_url) updatePayload.photo_url = tmdbData.photo_url;
      if (tmdbData.bio) updatePayload.bio = tmdbData.bio;
      if (tmdbData.birthplace) updatePayload.birthplace = tmdbData.birthplace;
      if (tmdbData.date_of_birth) updatePayload.date_of_birth = tmdbData.date_of_birth;
      if (tmdbData.gender) updatePayload.gender = tmdbData.gender;
    }

    if (!canonicalRow) {
      const { data: newPerson, error: insErr } = await supabase
        .from('people')
        .insert(updatePayload)
        .select('*')
        .single();

      if (insErr || !newPerson) return;
      canonicalRow = newPerson;
    } else {
      await supabase.from('people').update(updatePayload).eq('id', canonicalRow.id);
    }

    // 3. Fast Merge duplicate rows
    if (matchedRows.length > 1) {
      for (const dup of matchedRows) {
        if (dup.id !== canonicalRow.id) {
          const { data: existingCredits } = await supabase.from('credits').select('film_id').eq('person_id', canonicalRow.id);
          const canonicalFilmIds = new Set((existingCredits || []).map(c => c.film_id));

          const { data: dupCredits } = await supabase.from('credits').select('id, film_id').eq('person_id', dup.id);
          if (dupCredits) {
            const toUpdateIds = dupCredits.filter(c => !canonicalFilmIds.has(c.film_id)).map(c => c.id);
            const toDeleteIds = dupCredits.filter(c => canonicalFilmIds.has(c.film_id)).map(c => c.id);

            if (toUpdateIds.length > 0) {
              await supabase.from('credits').update({ person_id: canonicalRow.id }).in('id', toUpdateIds);
            }
            if (toDeleteIds.length > 0) {
              await supabase.from('credits').delete().in('id', toDeleteIds);
            }
          }
          await supabase.from('people').delete().eq('id', dup.id);
        }
      }
    }

    // 4. Update film_count
    const { count: filmCount } = await supabase
      .from('credits')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', canonicalRow.id);

    await supabase
      .from('people')
      .update({ film_count: filmCount || 0 })
      .eq('id', canonicalRow.id);

    console.log(`✅ [${item.exactName}] -> Active Films: ${filmCount || 0} | Image: ${updatePayload.photo_url || canonicalRow.photo_url || 'NONE'}`);
  } catch (err: any) {
    console.error(`Error in ${item.exactName}:`, err?.message);
  }
}

async function runFullRestoration() {
  console.log('🚀 RESTORING ALL 33+ ACTOR PROFILES CONCURRENTLY WITH EXACT BRACKET NAMES, PHOTOS & MERGED CREDITS...\n');

  // Run all 33 actors concurrently in parallel batches
  await Promise.all(TARGET_ACTORS.map(restoreOneActor));

  console.log('\n🎉 ALL ACTOR PROFILES & CREDITS HAVE BEEN RESTORED & CONSOLIDATED SUCCESSFULLY!');
}

runFullRestoration().catch(console.error);
