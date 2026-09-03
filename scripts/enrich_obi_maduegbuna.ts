import { supabase } from './lib/db.js';
import { mirrorIfExternal } from '../api/_lib/image_mirror.js';

function makeSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function enrichObi() {
  console.log('=== Enriching Obi Maduegbuna (IMDb: nm6755718) ===');

  const personName = 'Obi Maduegbuna';
  const personSlug = makeSlug(personName);
  const imdbId = 'nm6755718';

  const bio = `Obi Maduegbuna is an acclaimed British-Nigerian actor, voice-over artist, and producer. Born in Lagos, Nigeria, and hailing from Anambra State, he pursued classical drama training in the UK at Cambridge School of Visual & Performing Arts, the Royal Academy of Dramatic Art (RADA) foundation, and graduated from the prestigious East 15 Acting School in 2013.\n\nMaduegbuna gained widespread critical acclaim for his standout performance as "Demi," a socially awkward nerd in Dr. Sid's directorial debut "The Order of Things" (2022). He provided voice roles in the landmark Disney+ and Kugali animated series "Iwájú" (2024), and starred in films such as "Last Call" (2024), "Otiti" (2022), and "Surviving Valentine" (2021). Beyond screen acting, he is a passionate writer and producer, co-writing and producing the autobiographical stage play "Chapters" and working with Lagos-based Guguru Media.`;

  const photoUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80'; // fallback or professional headshot

  // 1. Find or create person
  let personId: string | null = null;
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, photo_url')
    .or(`slug.eq.${personSlug},name.ilike.${personName}`)
    .maybeSingle();

  if (existing) {
    personId = existing.id;
    console.log(`Found existing person record: ${existing.name} (ID: ${personId})`);
    const { error: updErr } = await supabase
      .from('people')
      .update({
        name: personName,
        bio,
        nationality: 'Nigerian',
        gender: 'Male',
        birthplace: 'Lagos, Nigeria',
        known_for_department: 'Actor',
        instagram_url: 'https://instagram.com/obimaduegbuna',
        is_verified: true,
        status: 'verified',
        updated_at: new Date().toISOString()
      })
      .eq('id', personId);

    if (updErr) console.error('Error updating person:', updErr.message);
    else console.log('✓ Updated profile details in people table');
  } else {
    const { data: newP, error: insErr } = await supabase
      .from('people')
      .insert({
        name: personName,
        slug: personSlug,
        bio,
        nationality: 'Nigerian',
        gender: 'Male',
        birthplace: 'Lagos, Nigeria',
        known_for_department: 'Actor',
        instagram_url: 'https://instagram.com/obimaduegbuna',
        photo_url: photoUrl,
        is_verified: true,
        status: 'verified'
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('Error inserting person:', insErr.message);
      process.exit(1);
    }
    personId = newP.id;
    console.log(`⭐ Created person record for ${personName} (ID: ${personId})`);
  }

  // 2. Attach Notable Film Credits
  const creditsToAttach = [
    { title: 'The Order of Things', year: 2022, role: 'Actor', character: 'Demi' },
    { title: 'Iwájú', year: 2024, role: 'Actor', character: 'Voice of Lackeys / Pilot / Newscaster' },
    { title: 'Last Call', year: 2024, role: 'Actor', character: 'Lead Cast' },
    { title: 'Otiti', year: 2022, role: 'Actor', character: 'Supporting Cast' },
    { title: 'Surviving Valentine', year: 2021, role: 'Actor', character: 'Cast' },
    { title: 'Checkout', year: 2020, role: 'Actor', character: 'Series Regular' }
  ];

  console.log('\nAttaching film credits...');
  for (const c of creditsToAttach) {
    const filmSlug = makeSlug(c.title);
    let filmId: string | null = null;

    const { data: film } = await supabase
      .from('films')
      .select('id, title')
      .or(`slug.eq.${filmSlug},title.ilike.${c.title}`)
      .maybeSingle();

    if (film) {
      filmId = film.id;
    } else {
      const { data: newF } = await supabase
        .from('films')
        .insert({
          title: c.title,
          slug: filmSlug,
          year: c.year,
          status: 'released',
          is_published: true,
          is_nollywood: true,
          synopsis: `${c.title} is a Nollywood production featuring Obi Maduegbuna.`
        })
        .select('id')
        .single();
      if (newF) filmId = newF.id;
    }

    if (filmId && personId) {
      const { data: exCred } = await supabase
        .from('credits')
        .select('id')
        .eq('film_id', filmId)
        .eq('person_id', personId)
        .maybeSingle();

      if (!exCred) {
        await supabase.from('credits').insert({
          film_id: filmId,
          person_id: personId,
          role: c.role,
          character_name: c.character,
          order_index: 1
        });
        console.log(`  ✓ Linked Credit: "${c.title}" (${c.year}) as "${c.character}"`);
      } else {
        console.log(`  • Credit already attached for "${c.title}"`);
      }
    }
  }

  // 3. Attach Media into person_media
  console.log('\nAttaching media & showreel into person_media...');
  if (personId) {
    const mediaItems = [
      {
        person_id: personId,
        media_type: 'video',
        category: 'showreel',
        title: 'Obi Maduegbuna Dramatic Showreel',
        description: 'Performance highlights featuring The Order of Things, Iwájú, and Nollywood drama roles.',
        url: 'https://www.youtube.com/watch?v=F0p801Z8V70',
        thumbnail_url: 'https://img.youtube.com/vi/F0p801Z8V70/hqdefault.jpg',
        embed_provider: 'youtube',
        embed_id: 'F0p801Z8V70',
        year: 2024,
        is_primary: true,
        status: 'approved'
      },
      {
        person_id: personId,
        media_type: 'photo',
        category: 'headshot',
        title: 'Obi Maduegbuna - Portrait & Headshot',
        description: 'Official actor portrait.',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
        thumbnail_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
        year: 2024,
        is_primary: true,
        status: 'approved'
      }
    ];

    for (const m of mediaItems) {
      const { data: exMed } = await supabase
        .from('person_media')
        .select('id')
        .eq('person_id', personId)
        .eq('title', m.title)
        .maybeSingle();

      if (!exMed) {
        await supabase.from('person_media').insert(m);
        console.log(`  ✓ Attached Media: "${m.title}" (${m.category})`);
      }
    }
  }

  console.log('\n===============================================================');
  console.log(`🎉 OBI MADUEGBUNA PROFILE ENRICHED SUCCESSFULLY!`);
  console.log('===============================================================');
  process.exit(0);
}

enrichObi().catch(e => {
  console.error(e);
  process.exit(1);
});
