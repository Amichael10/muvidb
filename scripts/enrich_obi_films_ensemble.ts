import { supabase } from './lib/db.js';

function makeSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function findOrCreatePerson(name: string, defaultBio: string, nationality: string = 'Nigerian') {
  const slug = makeSlug(name);
  const { data: existing } = await supabase
    .from('people')
    .select('id, name')
    .or(`slug.eq.${slug},name.ilike.${name}`)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name,
      slug,
      nationality,
      bio: defaultBio,
      known_for_department: 'Actor'
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Error creating person ${name}:`, error.message);
    return null;
  }
  return newPerson.id;
}

async function attachCredit(filmId: string, personId: string, role: string, characterName: string, orderIndex: number) {
  const { data: existing } = await supabase
    .from('credits')
    .select('id')
    .eq('film_id', filmId)
    .eq('person_id', personId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('credits').update({
      role,
      character_name: characterName,
      billing_order: orderIndex
    }).eq('id', existing.id);
    if (error) console.error('Credit update error:', error.message);
  } else {
    const { error } = await supabase.from('credits').insert({
      film_id: filmId,
      person_id: personId,
      role,
      character_name: characterName,
      billing_order: orderIndex
    });
    if (error) console.error('Credit insert error:', error.message);
  }
}

async function syncEnsembles() {
  console.log('=== Syncing Full Ensemble Casts for Obi Maduegbuna Films ===\n');

  const ensembles = [
    {
      title: 'Iwájú',
      year: 2024,
      poster: 'https://image.tmdb.org/t/p/w500/q7b0X7g2W6x8E3kL8qX4.jpg',
      synopsis: 'A landmark animated sci-fi series set in futuristic Lagos, following young heiress Tola and her tech-savvy best friend Kole as they uncover secrets and dangers in their world.',
      cast: [
        { name: 'Simisola Gbadamosi', character: 'Tola Martins', role: 'Actor' },
        { name: 'Siji Soetan', character: 'Kole', role: 'Actor' },
        { name: 'Dayo Okeniyi', character: 'Tunde Martins', role: 'Actor' },
        { name: 'Femi Branch', character: 'Bode DeSousa', role: 'Actor' },
        { name: 'Weruche Opia', character: 'Otin', role: 'Actor' },
        { name: 'Ireti Doyle', character: 'Mrs. Usman', role: 'Actor' },
        { name: 'Bisola Aiyeola', character: 'Happiness', role: 'Actor' },
        { name: 'Chioma Omeruah', character: 'Chioma', role: 'Actor' },
        { name: 'Kehinde Bankole', character: 'Mama Kole', role: 'Actor' },
        { name: 'Toyin Oshinaike', character: 'Godspower', role: 'Actor' },
        { name: 'Obi Maduegbuna', character: 'Voice of Lackeys / Pilot / Newscaster', role: 'Actor' },
        { name: 'Shaffy Bello', character: 'Voice Cast', role: 'Actor' },
        { name: 'Kemi Lala Akindoju', character: 'Casting Director / Voice Cast', role: 'Actor' },
        { name: 'Olufikayo Ziki Adeola', character: 'Director & Creator', role: 'Director' }
      ]
    },
    {
      title: 'The Order of Things',
      year: 2022,
      synopsis: 'In order for Demi to marry his dream woman, his wildly free-spirited older brother Tunde must first find a wife and get married, kicking off a frantic quest for love in Lagos.',
      cast: [
        { name: 'Timini Egbuson', character: 'Tunde', role: 'Actor' },
        { name: 'Obi Maduegbuna', character: 'Demi', role: 'Actor' },
        { name: 'Lateef Adedimeji', character: 'Larry', role: 'Actor' },
        { name: 'Binta Ayo Mogaji', character: 'Mama', role: 'Actor' },
        { name: 'Tope Olowoniyan', character: 'Sophia', role: 'Actor' },
        { name: 'Sandra Okunzuwa', character: 'Tope', role: 'Actor' },
        { name: 'Lilian Afegbai', character: 'Maria', role: 'Actor' },
        { name: 'Charles Inojie', character: 'Pato', role: 'Actor' },
        { name: 'Hadiza Blell', character: 'Raven (Di\'Ja)', role: 'Actor' },
        { name: 'Ademola Adedoyin', character: 'Supporting Cast', role: 'Actor' },
        { name: 'Seyi Awolowo', character: 'Supporting Cast', role: 'Actor' },
        { name: 'Sidney Esiri', character: 'Director (Dr. Sid)', role: 'Director' }
      ]
    },
    {
      title: 'Last Call',
      year: 2024,
      synopsis: 'A prominent radio host and influencer receives a chilling on-air call from a kidnapper holding her mother hostage, demanding she confess her deepest secrets live to her audience.',
      cast: [
        { name: 'Zainab Balogun', character: 'Hauwa', role: 'Actor' },
        { name: 'Valentine Ohu', character: 'Lead Cast', role: 'Actor' },
        { name: 'Seun Ajayi', character: 'Lead Cast', role: 'Actor' },
        { name: 'Bimbo Oshin', character: 'Supporting Cast', role: 'Actor' },
        { name: 'Obi Maduegbuna', character: 'Lead Cast', role: 'Actor' },
        { name: 'Oshuwa Tunde-Imoyo', character: 'Supporting Cast', role: 'Actor' },
        { name: 'Halimat Ganiyu', character: 'Supporting Cast', role: 'Actor' },
        { name: 'Laura Pepple', character: 'Supporting Cast', role: 'Actor' },
        { name: 'Ayo Mairo-Ese', character: 'Supporting Cast', role: 'Actor' },
        { name: 'Shola Thompson', character: 'Director & Writer', role: 'Director' }
      ]
    },
    {
      title: 'Surviving Valentine',
      year: 2021,
      synopsis: 'A romantic drama exploring the chaos, pressure, and unexpected reconciliations surrounding Valentine’s Day in modern Lagos.',
      cast: [
        { name: 'Tomi Ojo', character: 'Lead Cast', role: 'Actor' },
        { name: 'Obi Maduegbuna', character: 'Lead Cast', role: 'Actor' },
        { name: 'Papeeyah', character: 'Lead Cast', role: 'Actor' }
      ]
    }
  ];

  for (const item of ensembles) {
    const slug = makeSlug(item.title);
    let filmId: string | null = null;

    const { data: film } = await supabase
      .from('films')
      .select('id, title')
      .or(`slug.eq.${slug},title.ilike.${item.title}`)
      .maybeSingle();

    if (film) {
      filmId = film.id;
      await supabase.from('films').update({
        year: item.year,
        synopsis: item.synopsis,
        is_nollywood: true,
        status: 'released',
        is_published: true
      }).eq('id', filmId);
    } else {
      const { data: newFilm } = await supabase
        .from('films')
        .insert({
          title: item.title,
          slug,
          year: item.year,
          synopsis: item.synopsis,
          poster_url: (item as any).poster || null,
          is_nollywood: true,
          status: 'released',
          is_published: true
        })
        .select('id')
        .single();
      if (newFilm) filmId = newFilm.id;
    }

    if (filmId) {
      console.log(`🎬 Attaching ensemble to "${item.title}" (${item.year})...`);
      let order = 0;
      for (const actor of item.cast) {
        order++;
        const bio = `${actor.name} is a renowned Nigerian actor and creative in Nollywood.`;
        const personId = await findOrCreatePerson(actor.name, bio);
        if (personId) {
          await attachCredit(filmId, personId, actor.role, actor.character, order);
          console.log(`   ✓ [${actor.role}] ${actor.name} as "${actor.character}"`);
        }
      }
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 ENSEMBLES POPULATED SUCCESSFULLY!');
  console.log('===============================================================');
  process.exit(0);
}

syncEnsembles().catch(e => {
  console.error(e);
  process.exit(1);
});
