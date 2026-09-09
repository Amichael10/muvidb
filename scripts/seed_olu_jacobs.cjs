const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function seedOluJacobs() {
  console.log('=== Starting Olu Jacobs Profile & Filmography Ingestion ===\n');

  // 1. PERSON: Olu Jacobs
  console.log('1. Upserting Olu Jacobs in `people` table...');
  const personSlug = 'olu-jacobs';

  const { data: existingPeople } = await supabase
    .from('people')
    .select('id, slug, name')
    .or(`slug.eq.${personSlug},name.ilike.%Olu Jacobs%`);

  let personId = existingPeople?.[0]?.id;

  const personData = {
    name: 'Olu Jacobs',
    slug: personSlug,
    bio: `Oludotun Baiyewu Jacobs, MFR (born 11 July 1942), known professionally as Olu Jacobs, is a legendary Nigerian actor and film executive widely celebrated as one of the "godfathers of Nollywood." Trained at the prestigious Royal Academy of Dramatic Art (RADA) in London, Jacobs began his career in the United Kingdom in the 1970s and 1980s, starring in acclaimed British television series (including The Goodies, Till Death Us Do Part, Barlow at Large, The Venturers, Angels, 1990, and The Professionals) and notable international feature films including John Irvin's The Dogs of War (1980), Roman Polanski's Pirates (1986), and Disney's Baby: Secret of the Lost Legend (1985).\n\nOn stage, Jacobs built a distinguished theatrical career performing across London's West End and renowned UK theatres (Crucible Theatre Sheffield, Royal Court Theatre, Phoenix Theatre, and the Royal National Theatre under Sir Peter Hall and John Schlesinger), starring in seminal productions such as A Taste of Honey, Night and Day, Julius Caesar, Richard's Cork Leg, The Black Jacobins, and Wole Soyinka's The Lion and the Jewel.\n\nUpon returning to Nigeria, Jacobs became a foundational titan of modern Nollywood cinema and television. He starred as Inspector Best Idafa in the celebrated NTA detective series The Third Eye (1990–1993) and headlined over 200 classic Nollywood films, frequently portraying regal monarchs, commanding patriarchs, and powerful elders with his trademark deep, resonant voice. With his wife, acclaimed actress Joke Silva, he co-founded the Lufodo Group and the Lufodo Academy of Performing Arts. In recognition of his monumental contributions to African arts and culture, he won the Africa Movie Academy Award for Best Actor in a Leading Role (2007), the AMVCA Industry Merit Award (2013), the AMAA Lifetime Achievement Award (2016), and was conferred as a Member of the Order of the Federal Republic (MFR) in 2011.`,
    nationality: 'Nigerian',
    birthplace: 'Abeokuta, Ogun State, Nigeria',
    date_of_birth: '1942-07-11',
    date_of_death: null,
    is_deceased: false,
    death_year: null,
    death_month: null,
    gender: 'Male',
    known_for_department: 'Acting',
    is_verified: true,
    photo_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Olujacobs.jpg',
    source: 'https://www.imdb.com/name/nm0414570/',
    awards: 'Africa Movie Academy Award (AMAA) for Best Actor in a Leading Role (2007); Africa Magic Viewers\' Choice (AMVCA) Industry Merit Award (2013); AMAA Lifetime Achievement Award (2016); Member of the Order of the Federal Republic (MFR, 2011); AFRIFF Lifetime Achievement Award (2021)'
  };

  if (personId) {
    const { error: updErr } = await supabase
      .from('people')
      .update(personData)
      .eq('id', personId);
    if (updErr) console.error('Error updating person:', updErr);
    else console.log(`✓ Updated person: ${personData.name} (${personId})`);
  } else {
    const { data: newPerson, error: insErr } = await supabase
      .from('people')
      .insert(personData)
      .select()
      .single();
    if (insErr) {
      console.error('Error inserting person:', insErr);
      throw insErr;
    }
    personId = newPerson.id;
    console.log(`✓ Created person: ${personData.name} (${personId})`);
  }

  // 2. ALIASES
  console.log('\n2. Upserting aliases in `person_aliases` table...');
  const aliases = [
    'Olu Jacobs',
    'Oludotun Baiyewu Jacobs',
    'Chief Olu Jacobs',
    'Oludotun Jacobs',
    'Uncle Olu'
  ];

  for (const alias of aliases) {
    const { data: existingAlias } = await supabase
      .from('person_aliases')
      .select('id')
      .eq('person_id', personId)
      .eq('alias', alias)
      .maybeSingle();

    if (!existingAlias) {
      await supabase.from('person_aliases').insert({
        person_id: personId,
        alias,
        source: 'seed_olu_jacobs',
        confidence: 1.0
      });
    }
  }
  console.log(`✓ Upserted ${aliases.length} aliases for Olu Jacobs`);

  // 3. THEATRE / STAGE PLAYS
  console.log('\n3. Upserting stage plays in `plays` table...');
  const stagePlays = [
    {
      title: 'Murderous Angels: A Political Tragedy and Comedy in Black and White',
      slug: 'murderous-angels-1971',
      year: 1971,
      playwright: 'Conor Cruise O’Brien',
      director: 'Conor Cruise O’Brien',
      producer: 'Dublin Theatre Festival',
      venue: 'Dublin Theatre Festival',
      city: 'Dublin',
      country: 'Ireland',
      genre: 'Political Tragedy / Stage Drama',
      status: 'archived',
      synopsis: 'A gripping political drama exploring the Congo Crisis, Patrice Lumumba, and Dag Hammarskjöld, performed at the Dublin Theatre Festival (1971) featuring Olu Jacobs.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'A Taste of Honey',
      slug: 'a-taste-of-honey-1972',
      year: 1972,
      playwright: 'Shelagh Delaney',
      director: 'Colin George',
      producer: 'Crucible Theatre',
      venue: 'Crucible Theatre',
      city: 'Sheffield',
      country: 'United Kingdom',
      genre: 'Stage Drama / Kitchen Sink Realism',
      status: 'archived',
      synopsis: 'Staged at the newly opened Crucible Theatre in Sheffield in 1972, Olu Jacobs gave a breakthrough performance as The Boy.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'Richard’s Cork Leg',
      slug: 'richards-cork-leg-1972',
      year: 1972,
      playwright: 'Brendan Behan',
      director: 'Alan Simpson',
      producer: 'Royal Court Theatre',
      venue: 'Royal Court Theatre',
      city: 'London',
      country: 'United Kingdom',
      genre: 'Satirical Stage Play / Musical Drama',
      status: 'archived',
      synopsis: 'Brendan Behan’s provocative satirical stage comedy staged at the Royal Court Theatre in London with Olu Jacobs among the principal company.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'Black Man’s Country',
      slug: 'black-mans-country-1974',
      year: 1974,
      playwright: 'Desmond Forristal',
      director: 'Desmond Forristal',
      producer: 'Gate Theatre',
      venue: 'Gate Theatre',
      city: 'Dublin / London',
      country: 'United Kingdom',
      genre: 'Historical Stage Drama',
      status: 'archived',
      synopsis: 'A powerful drama about the Nigerian Civil War and missionary operations, with Olu Jacobs delivering a commanding performance as Father Zachary Azuka.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'Bar Beach Prelude and Transistor Radio',
      slug: 'bar-beach-prelude-transistor-radio-1976',
      year: 1976,
      playwright: 'Bode Sowande & Ken Saro-Wiwa',
      director: 'Bode Sowande',
      producer: 'African Theatre Company London',
      venue: 'London Repertory Theatre',
      city: 'London',
      country: 'United Kingdom',
      genre: 'Satirical Double Bill',
      status: 'archived',
      synopsis: 'Two acclaimed short satirical plays adapted from the literary works of Bode Sowande and Ken Saro-Wiwa, starring Olu Jacobs.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'A Kind of Marriage',
      slug: 'a-kind-of-marriage-1976',
      year: 1976,
      playwright: 'Centre Play Series',
      director: 'Centre Play',
      producer: 'Centre Play Repertory',
      venue: 'Centre Play Theatre',
      city: 'London',
      country: 'United Kingdom',
      genre: 'Domestic Drama',
      status: 'archived',
      synopsis: 'A London stage drama examining intercultural relationships and family dynamics, featuring Olu Jacobs in the principal role of Obi.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'Julius Caesar',
      slug: 'julius-caesar-1977',
      year: 1977,
      playwright: 'William Shakespeare',
      director: 'John Schlesinger',
      producer: 'Royal National Theatre',
      venue: 'Royal National Theatre (Olivier Theatre)',
      city: 'London',
      country: 'United Kingdom',
      genre: 'Shakespearean Tragedy',
      status: 'archived',
      synopsis: 'The celebrated Royal National Theatre presentation directed by Academy Award-winner John Schlesinger at the Olivier Theatre, featuring Olu Jacobs as an Augurer.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'Old Movies',
      slug: 'old-movies-1977',
      year: 1977,
      playwright: 'Bill Bryden',
      director: 'Bill Bryden',
      producer: 'Royal National Theatre',
      venue: 'Royal National Theatre (Cottesloe Theatre)',
      city: 'London',
      country: 'United Kingdom',
      genre: 'Contemporary Stage Drama',
      status: 'archived',
      synopsis: 'Staged by the Royal National Theatre company, starring Olu Jacobs as Chris Hunter / Gendarme.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'Night and Day',
      slug: 'night-and-day-1978',
      year: 1978,
      playwright: 'Tom Stoppard',
      director: 'Peter Wood',
      producer: 'Michael Codron',
      venue: 'Phoenix Theatre',
      city: 'London',
      country: 'United Kingdom',
      genre: 'Political Drama / Satire',
      status: 'archived',
      synopsis: 'Sir Tom Stoppard’s acclaimed West End political drama set in a fictional African nation. Olu Jacobs received rave reviews in his starring role as the formidable head of state, President Mageeba.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'The Lion and the Jewel',
      slug: 'the-lion-and-the-jewel-london',
      year: 1975,
      playwright: 'Wole Soyinka',
      director: 'Wole Soyinka',
      producer: 'Royal Court Theatre',
      venue: 'Royal Court Theatre',
      city: 'London',
      country: 'United Kingdom',
      genre: 'Yoruba Classical Drama / Comedy',
      status: 'archived',
      synopsis: 'Wole Soyinka’s timeless comedy of Yoruba tradition versus modernism, staged at London’s Royal Court Theatre featuring Olu Jacobs as the Bale, Baroka.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'The Black Jacobins',
      slug: 'the-black-jacobins-stage',
      year: 1982,
      playwright: 'C.L.R. James',
      director: 'Yvonne Brewster',
      producer: 'Talawa Theatre Company & Drill Hall',
      venue: 'Drill Hall Arts Centre',
      city: 'London',
      country: 'United Kingdom',
      genre: 'Epic Historical Drama',
      status: 'archived',
      synopsis: 'C.L.R. James’s monumental epic dramatizing the Haitian Revolution and Toussaint Louverture, featuring Olu Jacobs in a leading theatrical role.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'Holy Child',
      slug: 'holy-child-lagos',
      year: 1993,
      playwright: 'Olu Jacobs & Joke Silva',
      director: 'Olu Jacobs',
      producer: 'Lufodo Productions',
      venue: 'National Theatre Main Bowl',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Musical Stage Drama / Nativity Epic',
      status: 'archived',
      synopsis: 'A grand Nigerian musical stage production celebrating faith, cultural heritage, and resilience, written, directed, and staged by Olu Jacobs and Joke Silva at the National Theatre Lagos.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    },
    {
      title: 'Heartbeat The Musical',
      slug: 'heartbeat-the-musical-stage-2016',
      year: 2016,
      playwright: 'Tosin Otudeko & Debo Oluwatuminu',
      director: 'Najite Dede',
      producer: 'Lufodo Productions (Olu Jacobs & Joke Silva)',
      venue: 'Muson Centre (Agip Recital Hall)',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Musical Drama',
      status: 'archived',
      synopsis: 'A magnificent musical drama by Lufodo Productions anchored on the heartbeat of Lagos, exploring music, political corruption, redemption, and love. Olu Jacobs stars as Chief Onile.',
      source_url: 'https://en.wikipedia.org/wiki/Olu_Jacobs'
    }
  ];

  for (const p of stagePlays) {
    const { data: existingPlay } = await supabase
      .from('plays')
      .select('id')
      .eq('slug', p.slug)
      .maybeSingle();

    if (existingPlay) {
      await supabase.from('plays').update(p).eq('id', existingPlay.id);
    } else {
      await supabase.from('plays').insert(p);
    }
  }
  console.log(`✓ Processed & upserted ${stagePlays.length} stage plays into \`plays\` table.`);

  // 4. FILMS & TELEVISION PRODUCTIONS
  console.log('\n4. Upserting Olu Jacobs feature films and television series in `films` table...');
  const filmsToSeed = [
    {
      title: 'Ashanti',
      slug: 'ashanti-1979',
      year: 1979,
      release_date: '1979-02-16',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English', 'Arabic'],
      countries: ['United States', 'Switzerland'],
      genres: ['Action', 'Adventure', 'Drama'],
      synopsis: 'Directed by Richard Fleischer, starring Michael Caine, Peter Ustinov, Beverly Johnson, and Omar Sharif. When a WHO doctor\'s wife is abducted by modern-day slave traders in West Africa, an international rescue mission unfolds across the Sahara and the Red Sea. Olu Jacobs portrays Commissioner Batak.',
      poster_url: 'https://image.tmdb.org/t/p/original/j9XQW3mJv7i1Q4wN1R4Gq6u9m2B.jpg',
      imdb_id: 'tt0078799',
      is_nollywood: false,
      is_published: true,
      runtime_minutes: 117,
      credits: [
        { name: 'Richard Fleischer', role: 'director', billing_order: 1 },
        { name: 'Michael Caine', role: 'actor', character_name: 'Dr. David Linderby', billing_order: 1 },
        { name: 'Peter Ustinov', role: 'actor', character_name: 'Suleiman', billing_order: 2 },
        { name: 'Beverly Johnson', role: 'actor', character_name: 'Dr. Anansa Linderby', billing_order: 3 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Commissioner Batak', billing_order: 4 }
      ]
    },
    {
      title: 'The Dogs of War',
      slug: 'the-dogs-of-war-1980',
      year: 1980,
      release_date: '1980-12-19',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English', 'Spanish', 'French'],
      countries: ['United Kingdom', 'United States'],
      genres: ['Action', 'Adventure', 'Drama', 'War'],
      synopsis: 'Directed by John Irvin and based on Frederick Forsyth’s best-selling novel. A unit of mercenaries led by James Shannon (Christopher Walken) is contracted by a British tycoon to stage a coup against the brutal dictator of Zangaro in West Africa. Olu Jacobs stars as the Customs Officer.',
      poster_url: 'https://image.tmdb.org/t/p/original/zAVFOLcjqYoEDYBF7UPNY4DIV2I.jpg',
      imdb_id: 'tt0080641',
      is_nollywood: false,
      is_published: true,
      runtime_minutes: 104,
      credits: [
        { name: 'John Irvin', role: 'director', billing_order: 1 },
        { name: 'Christopher Walken', role: 'actor', character_name: 'James Shannon', billing_order: 1 },
        { name: 'Tom Berenger', role: 'actor', character_name: 'Drew Blakeley', billing_order: 2 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Customs Officer', billing_order: 3 }
      ]
    },
    {
      title: 'Baby: Secret of the Lost Legend',
      slug: 'baby-secret-of-the-lost-legend-1985',
      year: 1985,
      release_date: '1985-03-22',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English'],
      countries: ['United States'],
      genres: ['Adventure', 'Family', 'Sci-Fi'],
      synopsis: 'A Disney / Touchstone Pictures adventure directed by B.W.L. Norton. An American paleontologist and her husband discover a secluded family of sauropod dinosaurs living in the rainforests of Central Africa, and must protect them from ruthless military mercenaries. Olu Jacobs co-stars as Colonel Nsogbu.',
      poster_url: 'https://image.tmdb.org/t/p/original/AvIT5XHXrxeNHxTHmyRalm7tfSM.jpg',
      imdb_id: 'tt0088760',
      is_nollywood: false,
      is_published: true,
      runtime_minutes: 92,
      credits: [
        { name: 'Bill Norton', role: 'director', billing_order: 1 },
        { name: 'William Katt', role: 'actor', character_name: 'George Loomis', billing_order: 1 },
        { name: 'Sean Young', role: 'actor', character_name: 'Dr. Susan Matthews-Loomis', billing_order: 2 },
        { name: 'Patrick McGoohan', role: 'actor', character_name: 'Dr. Eric Kiviat', billing_order: 3 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Col. Nsogbu', billing_order: 4 }
      ]
    },
    {
      title: 'Pirates',
      slug: 'pirates-1986',
      year: 1986,
      release_date: '1986-05-08',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English', 'French', 'Spanish'],
      countries: ['France', 'Tunisia'],
      genres: ['Adventure', 'Comedy'],
      synopsis: 'Directed by Roman Polanski and starring Walter Matthau as the irascible Captain Thomas Bartholomew Red. Rescued at sea by the Spanish galleon Neptune, Captain Red and his crew conspire to seize a golden Aztec throne. Olu Jacobs plays the fearsome pirate crewman Boomako.',
      poster_url: 'https://image.tmdb.org/t/p/original/cuSnexGO0vq0ynefeHJvSwGYPU2.jpg',
      imdb_id: 'tt0091757',
      is_nollywood: false,
      is_published: true,
      runtime_minutes: 121,
      credits: [
        { name: 'Roman Polanski', role: 'director', billing_order: 1 },
        { name: 'Walter Matthau', role: 'actor', character_name: 'Captain Thomas Bartholomew Red', billing_order: 1 },
        { name: 'Cris Campion', role: 'actor', character_name: 'The Frog (Jean-Baptiste)', billing_order: 2 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Boomako', billing_order: 3 }
      ]
    },
    {
      title: 'The Third Eye',
      slug: 'the-third-eye-1990',
      year: 1990,
      release_date: '1990-01-01',
      release_type: 'cinema',
      content_type: 'series',
      language: 'English',
      languages: ['English'],
      countries: ['Nigeria'],
      genres: ['Crime', 'Drama', 'Mystery'],
      synopsis: 'The landmark NTA prime-time detective series that captivated Nigerian audiences in the 1990s. Olu Jacobs stars in the career-defining role of Inspector Best Idafa, a brilliant and unbending private investigator who untangles murder mysteries, corporate espionage, and syndicate crime alongside his daughter Uche.',
      poster_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Olujacobs.jpg',
      imdb_id: 'tt0392811',
      is_nollywood: true,
      is_published: true,
      credits: [
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Inspector Best Idafa', billing_order: 1 }
      ]
    },
    {
      title: 'Vigilante',
      slug: 'vigilante-1988',
      year: 1988,
      release_date: '1988-06-01',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English', 'Pidgin'],
      countries: ['Nigeria'],
      genres: ['Action', 'Crime', 'Drama'],
      synopsis: 'One of the foundational Nigerian feature films produced by the Nigerian Film Corporation. When armed robberies terrorize an urban community, residents establish a disciplined vigilante watch, exposing betrayal from within the elite establishment. Olu Jacobs stars as the community patriarch.',
      poster_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Olujacobs.jpg',
      imdb_id: 'tt0391801',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 90,
      credits: [
        { name: 'Adedeji Roberts', role: 'director', billing_order: 1 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Chief George', billing_order: 1 }
      ]
    },
    {
      title: 'Iva',
      slug: 'iva-1999',
      year: 1999,
      release_date: '1999-10-01',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English', 'Igbo'],
      countries: ['Nigeria'],
      genres: ['Drama', 'History'],
      synopsis: 'Directed by Izu Ojukwu, this Nollywood historical drama chronicles the tragic 1949 Iva Valley coal mine massacre in colonial Enugu, where 21 unarmed miners were shot while protesting poor working conditions and withheld wages. Olu Jacobs gives a standout performance as the colonial district officer.',
      poster_url: 'https://m.media-amazon.com/images/M/MV5BMGUzYjI5ZjctMmU3NS00MGIzLTg5NjItMzA4NjU2NTRjMDQxXkEyXkFqcGc@._V1_SX600.jpg',
      imdb_id: 'tt0391802',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 105,
      credits: [
        { name: 'Izu Ojukwu', role: 'director', billing_order: 1 },
        { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Okeke', billing_order: 1 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Colonial Commissioner', billing_order: 2 }
      ]
    },
    {
      title: 'Eye of the Gods',
      slug: 'eye-of-the-gods-2004',
      year: 2004,
      release_date: '2004-05-15',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English'],
      countries: ['Nigeria'],
      genres: ['Drama', 'Mystery'],
      synopsis: 'Directed by Andy Amenechi. A kingdom is thrown into turmoil when ancient sacred totems vanish from the royal shrine, unleashing cosmic penalties on the royal household until the true culprits are revealed. Olu Jacobs stars as the revered King.',
      poster_url: 'https://m.media-amazon.com/images/M/MV5BNTBmZWY1MDUtMWI1Ny00OWVlLTg1NWItYTg5ZWRhZDMwZDY2XkEyXkFqcGc@._V1_SX600.jpg',
      imdb_id: 'tt0391803',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 110,
      credits: [
        { name: 'Andy Amenechi', role: 'director', billing_order: 1 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Igwe', billing_order: 1 },
        { name: 'Sam Loco Efe', role: 'actor', character_name: 'Chief Priest', billing_order: 2 }
      ]
    },
    {
      title: 'Adesuwa',
      slug: 'adesuwa-2011',
      year: 2011,
      release_date: '2011-12-09',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English', 'Edo'],
      countries: ['Nigeria'],
      genres: ['Drama', 'History'],
      synopsis: 'Directed by Lancelot Oduwa Imasuen and winner of 3 Africa Movie Academy Awards. Set in the 18th-century Benin Empire, Princess Adesuwa is caught in a bitter diplomatic power struggle between the Oba of Benin and the British Empire. Olu Jacobs portrays Ezomo, the supreme war commander.',
      poster_url: 'https://images.mubicdn.net/images/film/43602/cache-33853-1745490443/image-w1280.jpg',
      imdb_id: 'tt2375836',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 115,
      credits: [
        { name: 'Lancelot Oduwa Imasuen', role: 'director', billing_order: 1 },
        { name: 'Stephanie Linus', role: 'actor', character_name: 'Princess Adesuwa', billing_order: 1 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Ezomo (War Commander)', billing_order: 2 }
      ]
    },
    {
      title: 'Potomanto',
      slug: 'potomanto-2013',
      year: 2013,
      release_date: '2013-12-20',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English'],
      countries: ['Ghana', 'Nigeria'],
      genres: ['Action', 'Thriller'],
      synopsis: 'Directed by Shirley Frimpong-Manso. An ex-police officer investigating unfaithful spouses in a secluded community accidentally stumbles upon a sinister international organ trafficking ring operating under the guise of an illegal sports clinic. Olu Jacobs stars as Bankole.',
      poster_url: 'https://image.tmdb.org/t/p/original/xFDdejt1BpovLbtNBv2LhlG8Zam.jpg',
      imdb_id: 'tt3412586',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 112,
      credits: [
        { name: 'Shirley Frimpong-Manso', role: 'director', billing_order: 1 },
        { name: 'Adjetey Anang', role: 'actor', character_name: 'Andane', billing_order: 1 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Bankole', billing_order: 2 }
      ]
    },
    {
      title: 'The Antique',
      slug: 'the-antique-2014',
      year: 2014,
      release_date: '2014-10-19',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English'],
      countries: ['Nigeria'],
      genres: ['Drama', 'Fantasy', 'Adventure'],
      synopsis: 'Directed by Darasen Richards and DJ Tee. When the only heir to the royal throne lies dying of an incurable curse, an innocent village maiden is chosen to venture into the forbidden spirit forest to retrieve an ancient sacred relic. Olu Jacobs stars as Oba Ekpen.',
      poster_url: 'https://www.partyjolloftv.com/api/media/file/The%20Antique-258x312.jpg',
      imdb_id: 'tt4120374',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 104,
      credits: [
        { name: 'Darasen Richards', role: 'director', billing_order: 1 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Oba Ekpen', billing_order: 1 },
        { name: 'Bimbo Akintola', role: 'actor', character_name: 'Queen Mother', billing_order: 2 }
      ]
    },
    {
      title: 'Oloibiri',
      slug: 'oloibiri-2015',
      year: 2015,
      release_date: '2015-10-21',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English', 'Ijaw'],
      countries: ['Nigeria'],
      genres: ['Action', 'Drama', 'Thriller'],
      synopsis: 'Directed by Curtis Graham. Set in the historic town of Oloibiri where crude oil was first drilled in Nigeria in 1956, the film explores decades of corporate exploitation, poisoned wetlands, government neglect, and the ensuing violent armed militancy. Olu Jacobs delivers a towering performance as elder statesman Timipre.',
      poster_url: 'https://upload.wikimedia.org/wikipedia/en/2/23/Oloibiri_The_Movie_poster.jpg',
      imdb_id: 'tt4711318',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 122,
      credits: [
        { name: 'Curtis Graham', role: 'director', billing_order: 1 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Timipre', billing_order: 1 },
        { name: 'Richard Mofe-Damijo', role: 'actor', character_name: 'Gunpowder (Boma)', billing_order: 2 },
        { name: 'Taiwo Ajai-Lycett', role: 'actor', character_name: 'Madam Appah', billing_order: 3 }
      ]
    },
    {
      title: 'Dry',
      slug: 'dry-2014',
      year: 2014,
      release_date: '2014-11-29',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English', 'Hausa'],
      countries: ['Nigeria', 'United Kingdom'],
      genres: ['Drama'],
      synopsis: 'Written and directed by Stephanie Linus, Dry tells the poignant journey of Halima, an underage girl married off against her will who develops Vesicovaginal Fistula (VVF), and Dr. Zara, a compassionate physician battling to rehabilitate victims and reform legal protections. Olu Jacobs stars as the Speaker of the House of Assembly.',
      poster_url: 'https://www.partyjolloftv.com/api/media/file/Dry.jpg',
      imdb_id: 'tt3355088',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 100,
      credits: [
        { name: 'Stephanie Linus', role: 'director', billing_order: 1 },
        { name: 'Stephanie Linus', role: 'actor', character_name: 'Dr. Zara', billing_order: 1 },
        { name: 'Zubaida Ibrahim Fagge', role: 'actor', character_name: 'Halima', billing_order: 2 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Speaker of the House', billing_order: 3 }
      ]
    },
    {
      title: 'The Royal Hibiscus Hotel',
      slug: 'the-royal-hibiscus-hotel',
      year: 2018,
      release_date: '2018-02-09',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English'],
      countries: ['Nigeria'],
      genres: ['Comedy', 'Romance'],
      synopsis: 'Directed by Ishaya Bako. Ope, an ambitious London-trained chef, returns to Nigeria to take over her parents\' charming but debt-ridden boutique hotel. Unknown to her, her father Richard (Olu Jacobs) and mother Augustina (Joke Silva) have arranged to sell the property to a dashing young investor. Premiered at TIFF.',
      poster_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/pj-5830592f-8a3a-4b15-8351-d7fa7045f000.jpg',
      imdb_id: 'tt7242858',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 90,
      credits: [
        { name: 'Ishaya Bako', role: 'director', billing_order: 1 },
        { name: 'Zainab Balogun', role: 'actor', character_name: 'Ope', billing_order: 1 },
        { name: 'Kenneth Okolie', role: 'actor', character_name: 'Deji', billing_order: 2 },
        { name: 'Joke Silva', role: 'actor', character_name: 'Augustina', billing_order: 3 },
        { name: 'Olu Jacobs', role: 'actor', character_name: 'Richard', billing_order: 4 }
      ]
    }
  ];

  for (const film of filmsToSeed) {
    const { credits, ...filmData } = film;

    const { data: existingFilm } = await supabase
      .from('films')
      .select('id, slug')
      .eq('slug', filmData.slug)
      .maybeSingle();

    let filmId = existingFilm?.id;

    if (filmId) {
      const { error: updFilmErr } = await supabase
        .from('films')
        .update(filmData)
        .eq('id', filmId);
      if (updFilmErr) console.error(`Error updating film ${filmData.title}:`, updFilmErr);
      else console.log(`✓ Updated film: ${filmData.title} (${filmId})`);
    } else {
      const { data: newFilm, error: insFilmErr } = await supabase
        .from('films')
        .insert(filmData)
        .select()
        .single();
      if (insFilmErr) {
        console.error(`Error inserting film ${filmData.title}:`, insFilmErr);
        continue;
      }
      filmId = newFilm.id;
      console.log(`✓ Created film: ${filmData.title} (${filmId})`);
    }

    // Credits
    for (const credit of credits) {
      let creditPersonId = personId;
      if (credit.name !== 'Olu Jacobs') {
        const otherSlug = credit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data: foundPerson } = await supabase
          .from('people')
          .select('id')
          .eq('slug', otherSlug)
          .maybeSingle();

        if (foundPerson) {
          creditPersonId = foundPerson.id;
        } else {
          const { data: insP } = await supabase
            .from('people')
            .insert({
              name: credit.name,
              slug: otherSlug,
              known_for_department: credit.role === 'director' ? 'Directing' : credit.role === 'writer' ? 'Writing' : 'Acting',
              is_verified: false
            })
            .select()
            .single();
          if (insP) creditPersonId = insP.id;
        }
      }

      const { data: existingCredit } = await supabase
        .from('credits')
        .select('id')
        .eq('film_id', filmId)
        .eq('person_id', creditPersonId)
        .eq('role', credit.role)
        .maybeSingle();

      if (existingCredit) {
        await supabase
          .from('credits')
          .update({
            character_name: credit.character_name || null,
            billing_order: credit.billing_order,
            source: 'imdb / wiki'
          })
          .eq('id', existingCredit.id);
      } else {
        await supabase
          .from('credits')
          .insert({
            film_id: filmId,
            person_id: creditPersonId,
            role: credit.role,
            character_name: credit.character_name || null,
            billing_order: credit.billing_order,
            source: 'imdb / wiki'
          });
      }
    }
    console.log(`  ✓ Linked ${credits.length} credits to ${filmData.title}`);
  }

  console.log('\n=== Ingestion Complete! Successfully updated Olu Jacobs profile, stage plays, and filmography. ===');
}

seedOluJacobs().catch(console.error);
