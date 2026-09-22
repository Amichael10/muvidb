import { supabase } from './lib/db';

async function enrichDearAjayi() {
  console.log('🚀 Starting enrichment for "Dear Ajayi"...');

  const filmId = 'c886f1e3-ecd3-4c41-87fd-e9dc5c4d4da8';

  // 1. Verify film exists
  const { data: film, error: filmErr } = await supabase
    .from('films')
    .select('id, title, slug, awards')
    .eq('id', filmId)
    .single();

  if (filmErr || !film) {
    console.error('❌ Could not find Dear Ajayi in films table:', filmErr);
    process.exit(1);
  }

  console.log(`🎬 Found film: "${film.title}" (${film.slug})`);

  // 2. Full Ensemble: Cast and Characters
  const ensembleCast = [
    { name: 'Bimbo Akintola', character: 'Ade', billing: 1 },
    { name: 'Tosin Adeyemi', character: 'Titi Ajayi', billing: 2 },
    { name: 'Lanre Hassan', character: 'Mama', billing: 3 },
    { name: 'William Benson', character: 'Michael', billing: 4 },
    { name: 'Antar Laniyan', character: 'Alhaji', billing: 5 },
    { name: 'Uzoamaka Power', character: 'Lizzy', billing: 6 },
    { name: 'Michelle Dede', character: 'Victoria', billing: 7 },
    { name: 'Chioma Omeruah', character: 'Cassandra', billing: 8 },
    { name: 'Baaj Adebule', character: null, billing: 9 },
    { name: 'Tope Tedela', character: null, billing: 10 },
  ];

  // 3. Complete Crew Ensemble
  const ensembleCrew = [
    { name: 'Damilola Orimogunje', role: 'director', character: null, billing: 1 },
    { name: 'Damilola Orimogunje', role: 'writer', character: null, billing: 2 },
    { name: 'Damilola Orimogunje', role: 'producer', character: null, billing: 3 },
    { name: 'Ajah Enene-Orimogunje', role: 'producer', character: null, billing: 4 },
    { name: 'Bose Oshin', role: 'producer', character: null, billing: 5 },
    { name: 'Joshua Alabi', role: 'producer', character: 'Co-Producer / Casting Director', billing: 6 },
    { name: 'Zorana Musikic', role: 'producer', character: 'Co-Producer (Germany)', billing: 7 },
    { name: 'May Odeh', role: 'producer', character: 'Co-Producer', billing: 8 },
    { name: 'KC Obiajulu', role: 'cinematographer', character: null, billing: 9 },
    { name: 'Olalekan Afolabi', role: 'editor', character: null, billing: 10 },
    { name: 'Kolade Morakinyo', role: 'sound', character: 'Sound Designer', billing: 11 },
    { name: 'Adrian Baumeister', role: 'sound', character: 'Sound Mixer', billing: 12 },
    { name: 'Abisola Omolade', role: 'crew', character: 'Production Designer', billing: 13 },
    { name: 'Ajah Enene-Orimogunje', role: 'costume', character: 'Costume Designer', billing: 14 },
    { name: 'Ré Olunuga', role: 'crew', character: 'Composer (Original Score)', billing: 15 },
  ];

  // Helper to get or create person
  async function getOrCreatePerson(name: string, defaultNationality = 'Nigerian') {
    let { data: existing } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', name)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: created, error } = await supabase
        .from('people')
        .insert({
          name,
          slug,
          nationality: defaultNationality,
          source: 'imdb_cineuropa_enrichment'
        })
        .select('id, name')
        .single();

      if (error) {
        console.error(`  ⚠️ Failed to create person "${name}":`, error.message);
        return null;
      }
      console.log(`  👤 Created new person profile: "${name}" (${created.id})`);
      return created.id;
    }

    return existing.id;
  }

  // 4. Upsert Cast
  console.log('🎭 Linking Cast Ensemble...');
  for (const c of ensembleCast) {
    const personId = await getOrCreatePerson(c.name);
    if (!personId) continue;

    // Check if credit exists
    const { data: existingCred } = await supabase
      .from('credits')
      .select('id')
      .eq('film_id', filmId)
      .eq('person_id', personId)
      .eq('role', 'actor')
      .maybeSingle();

    if (existingCred) {
      await supabase
        .from('credits')
        .update({
          character_name: c.character,
          billing_order: c.billing,
        })
        .eq('id', existingCred.id);
      console.log(`  ✓ Updated cast: ${c.name} as ${c.character || '(Actor)'} [order ${c.billing}]`);
    } else {
      await supabase
        .from('credits')
        .insert({
          film_id: filmId,
          person_id: personId,
          role: 'actor',
          character_name: c.character,
          billing_order: c.billing,
          source: 'imdb_cineuropa_enrichment'
        });
      console.log(`  + Inserted cast: ${c.name} as ${c.character || '(Actor)'} [order ${c.billing}]`);
    }
  }

  // 5. Upsert Crew
  console.log('🎬 Linking Crew Ensemble...');
  for (const cr of ensembleCrew) {
    const nationality = ['Zorana Musikic', 'Adrian Baumeister'].includes(cr.name) ? 'German' : 'Nigerian';
    const personId = await getOrCreatePerson(cr.name, nationality);
    if (!personId) continue;

    const { data: existingCred } = await supabase
      .from('credits')
      .select('id')
      .eq('film_id', filmId)
      .eq('person_id', personId)
      .eq('role', cr.role)
      .maybeSingle();

    if (existingCred) {
      await supabase
        .from('credits')
        .update({
          character_name: cr.character,
          billing_order: cr.billing,
        })
        .eq('id', existingCred.id);
      console.log(`  ✓ Updated crew: ${cr.name} (${cr.role}${cr.character ? ` - ${cr.character}` : ''})`);
    } else {
      await supabase
        .from('credits')
        .insert({
          film_id: filmId,
          person_id: personId,
          role: cr.role,
          character_name: cr.character,
          billing_order: cr.billing,
          source: 'imdb_cineuropa_enrichment'
        });
      console.log(`  + Inserted crew: ${cr.name} (${cr.role}${cr.character ? ` - ${cr.character}` : ''})`);
    }
  }

  // 6. Complete Awards and Nominations (Venice Film Festival 2026 - Giornate degli Autori)
  const awardsData = [
    {
      won: true,
      work: 'Dear Ajayi',
      year: 2026,
      title: 'CICT-UNESCO Enrico Fulchignoni Award - 83rd Venice International Film Festival (2026)',
      season: null,
      film_id: filmId,
      category: 'CICT-UNESCO Enrico Fulchignoni Award',
      recipients: ['Damilola Orimogunje'],
      organization: 'Venice International Film Festival / CICT-UNESCO'
    },
    {
      won: true,
      work: 'Dear Ajayi',
      year: 2026,
      title: 'Premio Bisato d\'Oro (Best Cast & Performances) - 83rd Venice International Film Festival (2026)',
      season: null,
      film_id: filmId,
      category: 'Best Cast & Performances',
      recipients: [
        'Bimbo Akintola',
        'Tosin Adeyemi',
        'Lanre Hassan',
        'William Benson',
        'Antar Laniyan',
        'Uzoamaka Power',
        'Michelle Dede',
        'Chioma Omeruah'
      ],
      organization: 'Venice International Film Critics (Bisato d\'Oro)'
    },
    {
      won: false,
      work: 'Dear Ajayi',
      year: 2026,
      title: 'GdA Director\'s Award - Giornate degli Autori (Venice Days 2026)',
      season: null,
      film_id: filmId,
      category: 'GdA Director\'s Award',
      recipients: ['Damilola Orimogunje'],
      organization: 'Giornate degli Autori (Venice Days)'
    },
    {
      won: false,
      work: 'Dear Ajayi',
      year: 2026,
      title: 'People\'s Choice Award - Giornate degli Autori (Venice Days 2026)',
      season: null,
      film_id: filmId,
      category: 'People\'s Choice Award',
      recipients: ['Damilola Orimogunje'],
      organization: 'Giornate degli Autori (Venice Days)'
    },
    {
      won: false,
      work: 'Dear Ajayi',
      year: 2026,
      title: 'Europa Cinemas Label - Giornate degli Autori (Venice Days 2026)',
      season: null,
      film_id: filmId,
      category: 'Europa Cinemas Label',
      recipients: ['Damilola Orimogunje'],
      organization: 'Europa Cinemas'
    }
  ];

  // 7. Update Film Record with Awards, IMDb metadata, and Distributor
  console.log('🏆 Updating Film Metadata & Awards...');
  const { error: updateErr } = await supabase
    .from('films')
    .update({
      imdb_id: 'tt43701760',
      imdb_rating: 7.6,
      imdb_vote_count: 8,
      distributor: 'FilmOne Entertainment',
      awards: awardsData,
      countries: ['Nigeria', 'Germany'],
      updated_at: new Date().toISOString()
    })
    .eq('id', filmId);

  if (updateErr) {
    console.error('❌ Failed to update film record:', updateErr.message);
  } else {
    console.log('✅ Film record successfully updated with IMDb metadata, distributor, and awards/nominations!');
  }

  // 8. Verification query
  const { data: finalFilm } = await supabase
    .from('films')
    .select('id, title, imdb_id, imdb_rating, distributor, awards')
    .eq('id', filmId)
    .single();

  const { data: finalCredits } = await supabase
    .from('credits')
    .select('role, character_name, billing_order, people(name)')
    .eq('film_id', filmId)
    .order('role', { ascending: true })
    .order('billing_order', { ascending: true });

  console.log('\n📊 Final Enrichment Status:');
  console.log(`Film: ${finalFilm?.title}`);
  console.log(`IMDb ID: ${finalFilm?.imdb_id} (Rating: ${finalFilm?.imdb_rating})`);
  console.log(`Distributor: ${finalFilm?.distributor}`);
  console.log(`Awards Count: ${finalFilm?.awards?.length}`);
  console.log(`Total Credits: ${finalCredits?.length}`);

  for (const cr of finalCredits || []) {
    console.log(` - [${cr.role.toUpperCase()}] ${(cr.people as any)?.name} ${cr.character_name ? `as "${cr.character_name}"` : ''} (#${cr.billing_order || '-'})`);
  }

  console.log('\n🎉 "Dear Ajayi" enrichment finished successfully!');
}

enrichDearAjayi().catch(console.error);
