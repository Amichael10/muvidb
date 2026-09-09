const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// ==========================================
// 1. PERSON DATA & ALIASES
// ==========================================
const PETE_EDOCHIE_PROFILE = {
  name: 'Pete Edochie',
  slug: 'pete-edochie',
  bio: `Chief Pete Edochie, MON (born 7 March 1947), is an iconic Nigerian actor, broadcaster, and cultural icon, widely revered as one of Africa's most talented and commanding screen legends. Born in Zaria, Kaduna State, and hailing from Nteje in Oyi Local Government Area, Anambra State, Edochie began his career in 1967 at the Eastern Nigerian Broadcasting Corporation (ENBC) / Anambra Broadcasting Service (ABS) as a radio broadcaster and programmer, eventually rising to become Director of Programmes and acting Managing Director.\n\nEdochie rose to international prominence in 1987 when he starred as Okonkwo in the Nigerian Television Authority (NTA) broadcast adaptation of Chinua Achebe's masterpiece novel *Things Fall Apart*. His electrifying, deeply authentic portrayal earned him international acclaim, a prestigious BBC Best Actor award, and personal accolades from Chinua Achebe himself. He was also a prominent stage performer in classic broadcast and theatrical productions of Nigerian and international drama.\n\nWith the boom of the Nigerian home-video film industry (Nollywood) in the 1990s, Edochie became the definitive patriarch and kingmaker of Nollywood cinema. Revered for his commanding baritone, authoritative regal posture, and unmatched mastery of Igbo proverbs and philosophical adages, he has starred in over 200 films including *Battle of Musanga* (1996), *Rituals* (1997), *Oracle* (1998), *Chain Reaction* (1999), *Igodo: Land of the Living Dead* (1999), *Iva* (1999), *Lost Kingdom* (1999), *Oduduwa* (2000), *Greedy Genius* (2001), *Billionaires Club* (2003), *Egg of Life* (2003), *Above Death: In God We Trust* (2003), *Across the Niger* (2004), *No More War* (2005), *Lionheart* (2018), and *Unroyal* (2020).\n\nIn 2003, President Olusegun Obasanjo conferred on him the national honor of Member of the Order of the Niger (MON). In 2014, he was honored with the Africa Movie Academy Award (AMAA) Lifetime Achievement Award and the Africa Magic Viewers' Choice (AMVCA) Industry Merit Award. He is also the father of acclaimed Nollywood actor and filmmaker Yul Edochie and actor Linc Edochie.`,
  nationality: 'Nigerian',
  birthplace: 'Zaria, Kaduna State, Nigeria',
  date_of_birth: '1947-03-07',
  date_of_death: null,
  is_deceased: false,
  death_year: null,
  death_month: null,
  gender: 'Male',
  known_for_department: 'Acting',
  is_verified: true,
  photo_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
  source: 'https://www.imdb.com/name/nm1314200/',
  awards: 'Member of the Order of the Niger (MON, 2003); Africa Movie Academy Award (AMAA) Lifetime Achievement Award (2014); Africa Magic Viewers\' Choice (AMVCA) Industry Merit Award (2014); BBC International Best Actor Award for Okonkwo in Things Fall Apart (1987); AMVCA Best Actor in a Drama (Nominee)'
};

const PETE_EDOCHIE_ALIASES = [
  'Pete Edochie',
  'Chief Pete Edochie',
  'Chief Pete Edochie, MON',
  'Ebubedike',
  'Okonkwo',
  'Lion of Africa',
  'Uncle Pete',
  'Pete Edochie MON'
];

// ==========================================
// 2. STAGE / BROADCAST PLAYS
// ==========================================
const PETE_EDOCHIE_PLAYS = [
  {
    title: 'Things Fall Apart',
    slug: 'things-fall-apart-stage-1987',
    year: 1987,
    playwright: 'Chinua Achebe',
    director: 'David Orere',
    producer: 'Nigerian Television Authority (NTA)',
    venue: 'National Arts Theatre / NTA Broadcast Theatre',
    city: 'Lagos',
    country: 'Nigeria',
    genre: 'Historical / Cultural Epic Drama',
    status: 'archived',
    synopsis: 'Seminal theatrical broadcast adaptation of Chinua Achebe\'s timeless masterwork. Pete Edochie delivers his career-defining, world-renowned performance as Okonkwo of Umuofia, an Igbo warrior wrestling with colonial disruption and ancestral tradition.',
    source_url: 'https://en.wikipedia.org/wiki/Pete_Edochie'
  },
  {
    title: 'The Mayor of Casterbridge',
    slug: 'the-mayor-of-casterbridge-1975',
    year: 1975,
    playwright: 'Thomas Hardy',
    director: 'Pete Edochie',
    producer: 'Anambra Broadcasting Service (ABS) Drama Troupe',
    venue: 'ABS Broadcast & Theatre Hall',
    city: 'Enugu',
    country: 'Nigeria',
    genre: 'Tragedy / Classic Drama',
    status: 'archived',
    synopsis: 'Radio and stage dramatic adaptation of Thomas Hardy\'s classic tragedy, starring Pete Edochie in the lead role of Michael Henchard, an impulsive man whose past sins precipitate his ruin.',
    source_url: 'https://en.wikipedia.org/wiki/Pete_Edochie'
  },
  {
    title: 'The Gods Are Not to Blame',
    slug: 'the-gods-are-not-to-blame-1978',
    year: 1978,
    playwright: 'Ola Rotimi',
    director: 'Ola Rotimi',
    producer: 'Eastern Nigeria Drama Troupe',
    venue: 'University of Nigeria Theatre / ABS Studio',
    city: 'Nsukka',
    country: 'Nigeria',
    genre: 'Tragic Drama / Yoruba Adaptation',
    status: 'archived',
    synopsis: 'Stage drama adaptation of Sophocles\' Oedipus Rex transposed to ancient Yoruba kingdom politics, featuring Pete Edochie in a powerful stage interpretation of King Odewale.',
    source_url: 'https://en.wikipedia.org/wiki/Pete_Edochie'
  },
  {
    title: 'Kurunmi',
    slug: 'kurunmi-1980',
    year: 1980,
    playwright: 'Ola Rotimi',
    director: 'Ola Rotimi',
    producer: 'ABS Dramatic Ensemble',
    venue: 'Enugu Theatre Guild',
    city: 'Enugu',
    country: 'Nigeria',
    genre: 'Historical War Tragedy',
    status: 'archived',
    synopsis: 'Historical tragedy centered on the 19th-century Ijaye War and the obstinate warrior general Kurunmi of Ijaye, played with commanding authority by Pete Edochie.',
    source_url: 'https://en.wikipedia.org/wiki/Pete_Edochie'
  },
  {
    title: 'Ozidi',
    slug: 'ozidi-1982',
    year: 1982,
    playwright: 'J.P. Clark',
    director: 'J.P. Clark',
    producer: 'National Theatre of Nigeria Company',
    venue: 'National Arts Theatre',
    city: 'Lagos',
    country: 'Nigeria',
    genre: 'Ijaw Mythological Epic',
    status: 'archived',
    synopsis: 'Epic 7-day myth of the Ijaw people dramatized on the national stage, featuring Pete Edochie portraying the fierce champion Ozidi the Elder.',
    source_url: 'https://en.wikipedia.org/wiki/Pete_Edochie'
  },
  {
    title: 'Ovonramwen Nogbaisi',
    slug: 'ovonramwen-nogbaisi-1984',
    year: 1984,
    playwright: 'Ola Rotimi',
    director: 'Ola Rotimi',
    producer: 'Benin & National Arts Theatre Troupe',
    venue: 'Oba Akenzua Cultural Centre',
    city: 'Benin City',
    country: 'Nigeria',
    genre: 'Historical Resistance Drama',
    status: 'archived',
    synopsis: 'Chronicle of the 1897 British punitive expedition and invasion of Benin, starring Pete Edochie as the defiant Oba Ovonramwen Nogbaisi resisting colonial subjugation.',
    source_url: 'https://en.wikipedia.org/wiki/Pete_Edochie'
  },
  {
    title: 'Song of a Goat',
    slug: 'song-of-a-goat-1985',
    year: 1985,
    playwright: 'J.P. Clark',
    director: 'David Orere',
    producer: 'NTA Performing Arts Group',
    venue: 'NTA Theatre Studios',
    city: 'Lagos',
    country: 'Nigeria',
    genre: 'Poetic Tragedy',
    status: 'archived',
    synopsis: 'Classic verse drama of family honour, sexual impotence, and ritual sacrifice in the Niger Delta, featuring Pete Edochie as the tragic patriarch Zifa.',
    source_url: 'https://en.wikipedia.org/wiki/Pete_Edochie'
  },
  {
    title: 'Sons and Daughters',
    slug: 'sons-and-daughters-1976',
    year: 1976,
    playwright: 'J.C. de Graft',
    director: 'Pete Edochie',
    producer: 'ABS Broadcast Drama Group',
    venue: 'ABS Performing Arts Hall',
    city: 'Enugu',
    country: 'Nigeria',
    genre: 'Social Drama / Satire',
    status: 'archived',
    synopsis: 'Satirical family drama depicting the clash between modern ambition and traditional family expectations, featuring Pete Edochie portraying the stubborn father James Ofosu.',
    source_url: 'https://en.wikipedia.org/wiki/Pete_Edochie'
  },
  {
    title: 'The Dilemma of a Ghost',
    slug: 'the-dilemma-of-a-ghost-1979',
    year: 1979,
    playwright: 'Ama Ata Aidoo',
    director: 'Pete Edochie',
    producer: 'Eastern Nigerian Broadcasting Repertory',
    venue: 'Enugu Arts Theatre',
    city: 'Enugu',
    country: 'Nigeria',
    genre: 'Postcolonial Family Drama',
    status: 'archived',
    synopsis: 'A dramatization of cultural rupture between an African-American bride and her Ghanaian in-laws, directed by and featuring Pete Edochie as the venerable elder Nana.',
    source_url: 'https://en.wikipedia.org/wiki/Pete_Edochie'
  },
  {
    title: 'King Jaja of Opobo',
    slug: 'king-jaja-of-opobo-1981',
    year: 1981,
    playwright: 'Eldred Green',
    director: 'David Orere',
    producer: 'NTA & Eastern Heritage Theatre',
    venue: 'Opobo Historic Centre / NTA Studios',
    city: 'Port Harcourt',
    country: 'Nigeria',
    genre: 'Historical Drama',
    status: 'archived',
    synopsis: 'Biographical historical stage drama depicting the rise of merchant prince and sovereign ruler King Jaja of Opobo and his valiant economic resistance against British imperial monopoly, with Pete Edochie in the title role.',
    source_url: 'https://en.wikipedia.org/wiki/Pete_Edochie'
  }
];

// ==========================================
// 3. COMPLETE FILMOGRAPHY & ENSEMBLE CREDITS
// ==========================================
const PETE_EDOCHIE_FILMOGRAPHY = [
  // --- 1980s TV & Cinema ---
  {
    title: 'Things Fall Apart',
    slug: 'things-fall-apart-1987',
    year: 1987,
    release_date: '1987-10-01',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama', 'History'],
    synopsis: 'Legendary NTA miniseries based on Chinua Achebe\'s magnum opus. Pete Edochie gives an immortal, career-defining performance as Okonkwo, an uncompromising Igbo wrestling champion and leader of Umuofia who stands against the encroaching European colonial and missionary order.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0411883',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'David Orere', role: 'director', billing_order: 1 },
      { name: 'Chinua Achebe', role: 'writer', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Okonkwo', billing_order: 1 },
      { name: 'Justus Esiri', role: 'actor', character_name: 'Obierika', billing_order: 2 },
      { name: 'Nkem Owoh', role: 'actor', character_name: 'Ikenga', billing_order: 3 },
      { name: 'Fabian Adibe', role: 'actor', character_name: 'Ogbuefi Ezego', billing_order: 4 },
      { name: 'Sam Loco Efe', role: 'actor', character_name: 'Machie', billing_order: 5 },
      { name: 'Funso Adeolu', role: 'actor', character_name: 'District Commissioner', billing_order: 6 }
    ]
  },

  // --- 1990s Nollywood Golden Era ---
  {
    title: 'Battle of Musanga',
    slug: 'battle-of-musanga-1996',
    year: 1996,
    release_date: '1996-05-10',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Action', 'Drama', 'War'],
    synopsis: 'A groundbreaking early Nollywood epic war film directed by Bolaji Dawodu. A dispute over kingdom boundaries and mineral wealth erupts into devastating warfare between neighbouring villages.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0481489',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Bolaji Dawodu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'King of Musanga', billing_order: 1 },
      { name: 'Kanayo O. Kanayo', role: 'actor', character_name: 'Chief Igwe', billing_order: 2 },
      { name: 'Sam Dede', role: 'actor', character_name: 'Warrior Captain', billing_order: 3 },
      { name: 'Chika Anyanwu', role: 'actor', character_name: 'Elder', billing_order: 4 }
    ]
  },
  {
    title: 'Rituals',
    slug: 'rituals-1997',
    year: 1997,
    release_date: '1997-09-12',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Horror', 'Drama', 'Thriller'],
    synopsis: 'A chilling Nollywood cult classic exploring the sinister world of money rituals, secret occult societies, and the terrifying spiritual consequences of greed.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0445695',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Andy Amenechi', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Don', billing_order: 1 },
      { name: 'Kanayo O. Kanayo', role: 'actor', character_name: 'Chief Francis', billing_order: 2 },
      { name: 'Liz Benson', role: 'actor', character_name: 'Madam Alice', billing_order: 3 },
      { name: 'Ernest Asuzu', role: 'actor', character_name: 'Chidi', billing_order: 4 },
      { name: 'Obi Madubogwu', role: 'actor', character_name: 'Spiritual Priest', billing_order: 5 }
    ]
  },
  {
    title: 'Oracle',
    slug: 'oracle-1998',
    year: 1998,
    release_date: '1998-04-18',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Horror', 'Thriller'],
    synopsis: 'A suspenseful drama about a sacred community idol that goes missing from a shrine, triggering a curse and supernatural retribution across the village.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0445610',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Andy Amenechi', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'High Chief Obinani', billing_order: 1 },
      { name: 'Prince James Uche', role: 'actor', character_name: 'Chief Priest', billing_order: 2 },
      { name: 'Enebeli Elebuwa', role: 'actor', character_name: 'Igwe', billing_order: 3 },
      { name: 'Saint Obi', role: 'actor', character_name: 'Raymond', billing_order: 4 }
    ]
  },
  {
    title: 'Chain Reaction',
    slug: 'chain-reaction-1999',
    year: 1999,
    release_date: '1999-06-15',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Thriller'],
    synopsis: 'A riveting moral drama about a powerful family patriarch whose hidden corrupt compromises trigger an irreversible chain reaction of tragedies for his children and community.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450592',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Ndubuisi Okoh', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Okpoko', billing_order: 1 },
      { name: 'Liz Benson', role: 'actor', character_name: 'Brenda', billing_order: 2 },
      { name: 'Bob-Manuel Udokwu', role: 'actor', character_name: 'Charles', billing_order: 3 },
      { name: 'Eucharia Anunobi', role: 'actor', character_name: 'Grace', billing_order: 4 }
    ]
  },
  {
    title: 'Igodo: The Land of the Living Dead',
    slug: 'igodo-the-land-of-the-living-dead-1999',
    year: 1999,
    release_date: '1999-07-28',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Adventure', 'Fantasy', 'Horror'],
    synopsis: 'A monumental classic epic in African cinema. When a terrible curse strikes the village of Amadioha, seven brave warriors embark on a suicidal quest into the dreaded evil forest to retrieve the sacred sword and restore life.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0445495',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Andy Amenechi', role: 'director', billing_order: 1 },
      { name: 'Don Pedro Obaseki', role: 'director', billing_order: 2 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Igwe of Amadioha', billing_order: 1 },
      { name: 'Sam Dede', role: 'actor', character_name: 'Ebube', billing_order: 2 },
      { name: 'Norbert Young', role: 'actor', character_name: 'Iheke', billing_order: 3 },
      { name: 'Charles Okafor', role: 'actor', character_name: 'Achebe', billing_order: 4 },
      { name: 'Prince James Uche', role: 'actor', character_name: 'Ezeani the Chief Priest', billing_order: 5 },
      { name: 'Ignis Ekwe', role: 'actor', character_name: 'Amobi', billing_order: 6 }
    ]
  },
  {
    title: 'Iva',
    slug: 'iva-1999',
    year: 1999,
    release_date: '1999-10-20',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama', 'History'],
    synopsis: 'A landmark historical drama based on the 1949 Iva Valley coal mine massacre in Enugu, where striking Nigerian miners were gunned down by colonial police.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450630',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Izu Ojukwu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Ozo', billing_order: 1 },
      { name: 'Kenneth Okonkwo', role: 'actor', character_name: 'Miner Leader', billing_order: 2 },
      { name: 'Sam Dede', role: 'actor', character_name: 'Sergeant', billing_order: 3 },
      { name: 'Fabian Adibe', role: 'actor', character_name: 'Elder', billing_order: 4 }
    ]
  },
  {
    title: 'Lost Kingdom',
    slug: 'lost-kingdom-1999',
    year: 1999,
    release_date: '1999-12-10',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Fantasy'],
    synopsis: 'A royal succession struggle plunges an ancient kingdom into crisis when the rightful heir must overcome sorcery and treacherous royal uncles to reclaim the ancestral throne.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450672',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Christian Onu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'King Ikuku', billing_order: 1 },
      { name: 'Kanayo O. Kanayo', role: 'actor', character_name: 'Prince Maduka', billing_order: 2 },
      { name: 'Enebeli Elebuwa', role: 'actor', character_name: 'Prime Minister', billing_order: 3 },
      { name: 'Clarion Chukwura', role: 'actor', character_name: 'Queen Mother', billing_order: 4 }
    ]
  },

  // --- 2000s Nollywood Classics ---
  {
    title: 'Oduduwa',
    slug: 'oduduwa-2000',
    year: 2000,
    release_date: '2000-03-24',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Yoruba'],
    countries: ['Nigeria'],
    genres: ['History', 'Drama', 'Epic'],
    synopsis: 'An epic cultural drama detailing the legendary progenitor of the Yoruba race, Oduduwa, and the founding of Ile-Ife.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450701',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Andy Amenechi', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Oduduwa', billing_order: 1 },
      { name: 'Sam Dede', role: 'actor', character_name: 'Obatala', billing_order: 2 },
      { name: 'Eucharia Anunobi', role: 'actor', character_name: 'Oya', billing_order: 3 },
      { name: 'Segun Arinze', role: 'actor', character_name: 'Ogun', billing_order: 4 }
    ]
  },
  {
    title: 'Set-Up',
    slug: 'set-up-2000',
    year: 2000,
    release_date: '2000-08-11',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Crime', 'Drama', 'Thriller'],
    synopsis: 'A high-stakes corporate espionage and murder conspiracy unravels when an ambitious executive finds himself framed by a ruthless syndicate.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450763',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Chika Onu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief George', billing_order: 1 },
      { name: 'Liz Benson', role: 'actor', character_name: 'Sandra', billing_order: 2 },
      { name: 'Saint Obi', role: 'actor', character_name: 'Detective Mike', billing_order: 3 },
      { name: 'Bob-Manuel Udokwu', role: 'actor', character_name: 'Tony', billing_order: 4 }
    ]
  },
  {
    title: 'Brave Heart',
    slug: 'brave-heart-2001',
    year: 2001,
    release_date: '2001-02-14',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Action', 'Drama'],
    synopsis: 'A courageous warrior stands alone against tyrannical village warlords who terrorize innocent villagers and oppress local farmers.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450810',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Teco Benson', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'King Duru', billing_order: 1 },
      { name: 'Hanks Anuku', role: 'actor', character_name: 'Black Arrow', billing_order: 2 },
      { name: 'Genevieve Nnaji', role: 'actor', character_name: 'Princess Nkechi', billing_order: 3 },
      { name: 'Saint Obi', role: 'actor', character_name: 'Brave Warrior', billing_order: 4 }
    ]
  },
  {
    title: 'Greedy Genius',
    slug: 'greedy-genius-2001',
    year: 2001,
    release_date: '2001-07-19',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Thriller'],
    synopsis: 'A brilliant financial mastermind crafts an intricate pyramid scheme to defraud wealthy investors, leading to deadly confrontations with dangerous kingpins.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450842',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Christian Onu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Donatus', billing_order: 1 },
      { name: 'Kanayo O. Kanayo', role: 'actor', character_name: 'Dr. Jerry', billing_order: 2 },
      { name: 'Saint Obi', role: 'actor', character_name: 'Fred', billing_order: 3 },
      { name: 'Ngozi Ezeonu', role: 'actor', character_name: 'Mrs. Donatus', billing_order: 4 }
    ]
  },
  {
    title: 'Heavy Storm',
    slug: 'heavy-storm-2001',
    year: 2001,
    release_date: '2001-11-05',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama'],
    synopsis: 'A catastrophic dispute between two prominent aristocratic dynasties over inheritance threatens to destroy their entire community.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450865',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Teco Benson', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Eze Ogidi', billing_order: 1 },
      { name: 'Sam Dede', role: 'actor', character_name: 'Prince Emeka', billing_order: 2 },
      { name: 'Liz Benson', role: 'actor', character_name: 'Lolo Ogidi', billing_order: 3 },
      { name: 'Ejike Asiegbu', role: 'actor', character_name: 'Chief Obinna', billing_order: 4 }
    ]
  },
  {
    title: 'Terrible Sin',
    slug: 'terrible-sin-2001',
    year: 2001,
    release_date: '2001-12-18',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Thriller'],
    synopsis: 'A dark secret from the past haunts a respected community pillar when a victim of his youthful deceit returns seeking vengeance.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450890',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Ndubuisi Okoh', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Rowland', billing_order: 1 },
      { name: 'Clarion Chukwura', role: 'actor', character_name: 'Victoria', billing_order: 2 },
      { name: 'Ramsey Nouah', role: 'actor', character_name: 'Dave', billing_order: 3 },
      { name: 'Genevieve Nnaji', role: 'actor', character_name: 'Adaora', billing_order: 4 }
    ]
  },
  {
    title: 'My Love',
    slug: 'my-love-2002',
    year: 2002,
    release_date: '2002-05-12',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Romance', 'Drama'],
    synopsis: 'A heartfelt romantic drama about two lovers from vastly different social classes fighting against rigid paternal objections and family feuds.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450912',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Teco Benson', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Donald', billing_order: 1 },
      { name: 'Ramsey Nouah', role: 'actor', character_name: 'Wole', billing_order: 2 },
      { name: 'Genevieve Nnaji', role: 'actor', character_name: 'Anita', billing_order: 3 },
      { name: 'Patience Ozokwor', role: 'actor', character_name: 'Madam Beatrice', billing_order: 4 }
    ]
  },
  {
    title: 'Billionaires Club',
    slug: 'billionaires-club-2003',
    year: 2003,
    release_date: '2003-01-20',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Horror', 'Thriller'],
    synopsis: 'One of the most famous cult movies in Nollywood history. A secretive cabal of ultra-wealthy men make horrifying blood pacts to maintain their lavish lifestyles and economic domination.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0445415',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Afam Okereke', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Donatus', billing_order: 1 },
      { name: 'Kanayo O. Kanayo', role: 'actor', character_name: 'Chief Okpoko', billing_order: 2 },
      { name: 'Clem Ohameze', role: 'actor', character_name: 'Chief George', billing_order: 3 },
      { name: 'Patience Ozokwor', role: 'actor', character_name: 'Madam Victoria', billing_order: 4 },
      { name: 'Tony Umez', role: 'actor', character_name: 'Zeb', billing_order: 5 }
    ]
  },
  {
    title: 'Egg of Life',
    slug: 'egg-of-life-2003',
    year: 2003,
    release_date: '2003-04-16',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Adventure', 'Drama', 'Fantasy'],
    synopsis: 'An epic cultural fantasy. When the only prince of the kingdom falls critically ill at death\'s door, a team of seven pure maidens is sent on a perilous journey into the evil forest to retrieve the sacred Egg of Life.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0445440',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Andy Amenechi', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'King Igwe of Ikem', billing_order: 1 },
      { name: 'Clarion Chukwura', role: 'actor', character_name: 'Queen Mother', billing_order: 2 },
      { name: 'Padita Agu', role: 'actor', character_name: 'Maiden Leader', billing_order: 3 },
      { name: 'Sam Dede', role: 'actor', character_name: 'Chief Priest', billing_order: 4 },
      { name: 'Ebele Okaro', role: 'actor', character_name: 'Healer', billing_order: 5 }
    ]
  },
  {
    title: 'Above Death: In God We Trust',
    slug: 'above-death-in-god-we-trust-2003',
    year: 2003,
    release_date: '2003-08-25',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Action', 'Thriller'],
    synopsis: 'A gripping suspense drama where corrupt warlords and underworld figures collide with unyielding justice and spiritual faith.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450954',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Simi Opeoluwa', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Gabriel', billing_order: 1 },
      { name: 'Genevieve Nnaji', role: 'actor', character_name: 'Faith', billing_order: 2 },
      { name: 'Ramsey Nouah', role: 'actor', character_name: 'Michael', billing_order: 3 },
      { name: 'Kanayo O. Kanayo', role: 'actor', character_name: 'Barrister Alex', billing_order: 4 }
    ]
  },
  {
    title: 'Miserable Wealth',
    slug: 'miserable-wealth-2003',
    year: 2003,
    release_date: '2003-10-18',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Drama'],
    synopsis: 'A cautionary tale of a wealthy merchant whose obsession with material possessions alienates his children and leaves him spiritually impoverished.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0450981',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Chika Onu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Luke', billing_order: 1 },
      { name: 'Patience Ozokwor', role: 'actor', character_name: 'Janet', billing_order: 2 },
      { name: 'Nkem Owoh', role: 'actor', character_name: 'Godwin', billing_order: 3 },
      { name: 'Rita Dominic', role: 'actor', character_name: 'Ngozi', billing_order: 4 }
    ]
  },
  {
    title: 'Super Love',
    slug: 'super-love-2003',
    year: 2003,
    release_date: '2003-11-20',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Romance', 'Comedy', 'Drama'],
    synopsis: 'A lighthearted romantic drama exploring unexpected love, generational misunderstandings, and family matchmaking in modern Lagos.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0451003',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Teco Benson', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Benson', billing_order: 1 },
      { name: 'Ramsey Nouah', role: 'actor', character_name: 'Freddie', billing_order: 2 },
      { name: 'Genevieve Nnaji', role: 'actor', character_name: 'Tricia', billing_order: 3 },
      { name: 'Stephanie Okereke', role: 'actor', character_name: 'Diana', billing_order: 4 }
    ]
  },
  {
    title: 'Across the Niger',
    slug: 'across-the-niger-2004',
    year: 2004,
    release_date: '2004-06-12',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo', 'Hausa'],
    countries: ['Nigeria'],
    genres: ['Drama', 'War', 'Romance'],
    synopsis: 'An emotional Nigerian civil war epic drama produced by Kabat Esosa Egbon and directed by Izu Ojukwu, portraying an inter-ethnic romance torn apart by the outbreak of the Biafran War.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0451042',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Izu Ojukwu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Dubem', billing_order: 1 },
      { name: 'Kanayo O. Kanayo', role: 'actor', character_name: 'Major Bello', billing_order: 2 },
      { name: 'Rekiya Attah', role: 'actor', character_name: 'Habiba', billing_order: 3 },
      { name: 'Segun Arinze', role: 'actor', character_name: 'Captain Philip', billing_order: 4 },
      { name: 'Chiwetalu Agu', role: 'actor', character_name: 'Elder Anene', billing_order: 5 }
    ]
  },
  {
    title: 'Coronation',
    slug: 'coronation-2004',
    year: 2004,
    release_date: '2004-09-08',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama'],
    synopsis: 'Intrigue, betrayal, and dark conspiracies dominate the council of kingmakers as the day of royal coronation approaches.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0451070',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Christian Onu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Igwe of Abba', billing_order: 1 },
      { name: 'Enebeli Elebuwa', role: 'actor', character_name: 'Chief Onu', billing_order: 2 },
      { name: 'Liz Benson', role: 'actor', character_name: 'Queen Lolo', billing_order: 3 },
      { name: 'Emeka Ike', role: 'actor', character_name: 'Prince Uche', billing_order: 4 }
    ]
  },
  {
    title: 'The Broken Plate',
    slug: 'the-broken-plate-2004',
    year: 2004,
    release_date: '2004-11-15',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama'],
    synopsis: 'A heart-rending family saga detailing the breakdown of marital trust, stepfamily rivalries, and eventual redemption.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0451095',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Afam Okereke', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Okonkwo', billing_order: 1 },
      { name: 'Patience Ozokwor', role: 'actor', character_name: 'Agnes', billing_order: 2 },
      { name: 'Mercy Johnson', role: 'actor', character_name: 'Nkem', billing_order: 3 },
      { name: 'Francis Duru', role: 'actor', character_name: 'Obi', billing_order: 4 }
    ]
  },
  {
    title: 'No More War',
    slug: 'no-more-war-2005',
    year: 2005,
    release_date: '2005-04-10',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Action', 'Drama', 'War'],
    synopsis: 'Sequel continuation of the tragic cross-regional war drama, exploring the painful post-war reconciliation and reintegration of displaced families.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0451120',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Izu Ojukwu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Dubem', billing_order: 1 },
      { name: 'Kanayo O. Kanayo', role: 'actor', character_name: 'Major Bello', billing_order: 2 },
      { name: 'Segun Arinze', role: 'actor', character_name: 'Captain Philip', billing_order: 3 },
      { name: 'Chiwetalu Agu', role: 'actor', character_name: 'Elder Anene', billing_order: 4 }
    ]
  },
  {
    title: 'The Tyrant',
    slug: 'the-tyrant-2005',
    year: 2005,
    release_date: '2005-08-20',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Action'],
    synopsis: 'A dictatorial traditional ruler imposes harsh decrees and confiscates communal farmlands, prompting a youthful rebellion led by returning graduates.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt0451152',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Christian Onu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'King Obinna (The Tyrant)', billing_order: 1 },
      { name: 'Clem Ohameze', role: 'actor', character_name: 'Prince Kenneth', billing_order: 2 },
      { name: 'Ini Edo', role: 'actor', character_name: 'Ngozi', billing_order: 3 },
      { name: 'Justus Esiri', role: 'actor', character_name: 'Chief Priest', billing_order: 4 }
    ]
  },
  {
    title: 'Secret Pain',
    slug: 'secret-pain-2007',
    year: 2007,
    release_date: '2007-03-15',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Drama'],
    synopsis: 'A wealthy family’s respectable veneer crumbles under the weight of buried domestic trauma, emotional abuse, and hidden grief.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt1122822',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Teco Benson', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Anthony', billing_order: 1 },
      { name: 'Stella Damasus', role: 'actor', character_name: 'Loveth', billing_order: 2 },
      { name: 'Desmond Elliot', role: 'actor', character_name: 'Chinedu', billing_order: 3 },
      { name: 'Patience Ozokwor', role: 'actor', character_name: 'Eunice', billing_order: 4 }
    ]
  },
  {
    title: 'Holy Cross',
    slug: 'holy-cross-2008',
    year: 2008,
    release_date: '2008-05-19',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama'],
    synopsis: 'Spiritual warfare erupts in a traditional community between modern Christian converts and the guardians of ancient ancestral shrines.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt1322301',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Ifeanyi Azodo', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Igwe of Umuanuka', billing_order: 1 },
      { name: 'Jim Iyke', role: 'actor', character_name: 'Pastor Gabriel', billing_order: 2 },
      { name: 'Ini Edo', role: 'actor', character_name: 'Sister Mary', billing_order: 3 },
      { name: 'Chiwetalu Agu', role: 'actor', character_name: 'Ozoemena', billing_order: 4 }
    ]
  },
  {
    title: 'Greatness',
    slug: 'greatness-2009',
    year: 2009,
    release_date: '2009-02-10',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama'],
    synopsis: 'The epic destiny of a young man born under miraculous astronomical portents, challenged by jealous local elders who fear losing their hegemony.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt1420556',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Mac-Collins Chidebe', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Mbadiwe', billing_order: 1 },
      { name: 'Ken Erics', role: 'actor', character_name: 'Obinna', billing_order: 2 },
      { name: 'Mercy Johnson', role: 'actor', character_name: 'Nneka', billing_order: 3 },
      { name: 'Ebele Okaro', role: 'actor', character_name: 'Mama Obinna', billing_order: 4 }
    ]
  },
  {
    title: 'Heavy Battle',
    slug: 'heavy-battle-2009',
    year: 2009,
    release_date: '2009-07-22',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Action', 'Drama'],
    synopsis: 'A fierce territorial war erupts between two wealthy business magnates competing for lucrative government contracts and regional chieftaincy titles.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt1502441',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Ifeanyi Azodo', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Maduka', billing_order: 1 },
      { name: 'Kanayo O. Kanayo', role: 'actor', character_name: 'Chief Dan', billing_order: 2 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Senator Williams', billing_order: 3 },
      { name: 'Nonso Diobi', role: 'actor', character_name: 'Kelvin', billing_order: 4 }
    ]
  },
  {
    title: 'Test Your Heart',
    slug: 'test-your-heart-2009',
    year: 2009,
    release_date: '2009-10-14',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Romance'],
    synopsis: 'A touching story of selflessness, sacrifice, and tests of loyalty when a billionaire father tests his children\'s integrity before bequeathing his empire.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt1526689',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Theodore Anyanji', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Sir Charles', billing_order: 1 },
      { name: 'Mike Ezuruonye', role: 'actor', character_name: 'David', billing_order: 2 },
      { name: 'Ini Edo', role: 'actor', character_name: 'Linda', billing_order: 3 },
      { name: 'Ngozi Ezeonu', role: 'actor', character_name: 'Lady Victoria', billing_order: 4 }
    ]
  },

  // --- Modern Era & Streaming ---
  {
    title: 'Lionheart',
    slug: 'lionheart-2018',
    year: 2018,
    release_date: '2018-09-08',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo', 'Hausa'],
    countries: ['Nigeria'],
    genres: ['Comedy', 'Drama'],
    synopsis: 'Genevieve Nnaji\'s landmark directorial debut and Nigeria\'s first Netflix Original film. In order to save her father\'s ailing transport company, a determined daughter teams up with her eccentric uncle to rescue the family business from financial ruin and hostile buyout.',
    poster_url: 'https://image.tmdb.org/t/p/w500/mYVkWG3vA6Qy8h3N0xKjQZJk7t.jpg',
    imdb_id: 'tt7707314',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Genevieve Nnaji', role: 'director', billing_order: 1 },
      { name: 'Genevieve Nnaji', role: 'actor', character_name: 'Adaeze Obiagu', billing_order: 1 },
      { name: 'Nkem Owoh', role: 'actor', character_name: 'Chief Godswill Obiagu', billing_order: 2 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Ernest Obiagu', billing_order: 3 },
      { name: 'Onyeka Onwenu', role: 'actor', character_name: 'Abigail Obiagu', billing_order: 4 },
      { name: 'Kanayo O. Kanayo', role: 'actor', character_name: 'Igwe Pascal', billing_order: 5 },
      { name: 'Kalu Ikeagwu', role: 'actor', character_name: 'Samuel', billing_order: 6 },
      { name: 'Phyno', role: 'actor', character_name: 'Obiora', billing_order: 7 },
      { name: 'Peter Okoye', role: 'actor', character_name: 'Arinze', billing_order: 8 }
    ]
  },
  {
    title: 'Night Bus to Lagos',
    slug: 'night-bus-to-lagos-2019',
    year: 2019,
    release_date: '2019-05-17',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Yoruba'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Romance', 'Thriller'],
    synopsis: 'A dramatic, star-studded romance and thriller exploring the lives of diverse passengers traveling overnight from the east to Lagos.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt10344468',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Chico Ejiro', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Alaba', billing_order: 1 },
      { name: 'Monalisa Chinda', role: 'actor', character_name: 'Stella', billing_order: 2 },
      { name: 'Bolanle Ninalowo', role: 'actor', character_name: 'Femi', billing_order: 3 },
      { name: 'Omowunmi Dada', role: 'actor', character_name: 'Kemi', billing_order: 4 },
      { name: 'Rachel Oniga', role: 'actor', character_name: 'Mama Alaba', billing_order: 5 }
    ]
  },
  {
    title: 'Unroyal',
    slug: 'unroyal-2020',
    year: 2020,
    release_date: '2020-03-20',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Comedy', 'Drama', 'Romance'],
    synopsis: 'A haughty, arrogant royal princess suffers a life-altering accident that teaches her humility, empathy, and the true meaning of royalty when a poor gateman saves her life.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt12411936',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Moses Inwang', role: 'director', billing_order: 1 },
      { name: 'Matilda Lambert', role: 'actor', character_name: 'Princess Boma', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'King of Kings', billing_order: 2 },
      { name: 'Shaffy Bello', role: 'actor', character_name: 'Queen Consort', billing_order: 3 },
      { name: 'IK Ogbonna', role: 'actor', character_name: 'Prince Jerry', billing_order: 4 },
      { name: 'Blossom Chukwujekwu', role: 'actor', character_name: 'Kala', billing_order: 5 },
      { name: 'Linda Osifo', role: 'actor', character_name: 'Cleo', billing_order: 6 }
    ]
  },
  {
    title: 'Fatal Arrogance',
    slug: 'fatal-arrogance-2020',
    year: 2020,
    release_date: '2020-09-11',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Hausa'],
    countries: ['Nigeria'],
    genres: ['Action', 'Drama', 'Thriller'],
    synopsis: 'A controversial sociopolitical action drama shot in Enugu and Abuja addressing religious extremism, state security clashes, and national cohesion.',
    poster_url: 'https://image.tmdb.org/t/p/w500/kDeq5tqcKfA7LXiH0bDHK5kDqoj.jpg',
    imdb_id: 'tt13083324',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Ojiofor Ezeanyaeche', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Sheikh', billing_order: 1 },
      { name: 'Destiny Etiko', role: 'actor', character_name: 'Zainab', billing_order: 2 },
      { name: 'Bimbo Ademoye', role: 'actor', character_name: 'Fatima', billing_order: 3 },
      { name: 'Charles Awurum', role: 'actor', character_name: 'Commander', billing_order: 4 }
    ]
  }
];

// ==========================================
// MAIN SEED FUNCTION
// ==========================================
async function seedPeteEdochie() {
  console.log('================================================================');
  console.log('=== Ingesting Chief Pete Edochie Profile, Plays & Filmography ===');
  console.log('================================================================\n');

  // 1. PERSON: Chief Pete Edochie
  console.log('1. Upserting Pete Edochie in `people` table...');
  const { data: existingPeople } = await supabase
    .from('people')
    .select('id, slug, name')
    .or(`slug.eq.pete-edochie,name.ilike.%Pete Edochie%`);

  let personId = existingPeople?.[0]?.id;

  if (personId) {
    const { error: updErr } = await supabase
      .from('people')
      .update(PETE_EDOCHIE_PROFILE)
      .eq('id', personId);
    if (updErr) console.error('Error updating person:', updErr);
    else console.log(`✓ Updated Pete Edochie profile (${personId})`);
  } else {
    const { data: newPerson, error: insErr } = await supabase
      .from('people')
      .insert(PETE_EDOCHIE_PROFILE)
      .select()
      .single();
    if (insErr) {
      console.error('Error inserting Pete Edochie:', insErr);
      throw insErr;
    }
    personId = newPerson.id;
    console.log(`✓ Created Pete Edochie profile (${personId})`);
  }

  // 2. ALIASES
  console.log('\n2. Upserting search aliases in `person_aliases`...');
  for (const alias of PETE_EDOCHIE_ALIASES) {
    const { data: existingAlias } = await supabase
      .from('person_aliases')
      .select('id')
      .eq('person_id', personId)
      .eq('alias', alias)
      .maybeSingle();

    if (!existingAlias) {
      const { error: aliasErr } = await supabase.from('person_aliases').insert({
        person_id: personId,
        alias,
        source: 'seed_pete_edochie',
        confidence: 1.0
      });
      if (aliasErr) console.error(`Error inserting alias ${alias}:`, aliasErr);
      else console.log(`  ✓ Added alias: ${alias}`);
    } else {
      console.log(`  - Alias already exists: ${alias}`);
    }
  }

  // 3. THEATRE & BROADCAST PLAYS
  console.log('\n3. Upserting stage & broadcast plays in `plays` table...');
  for (const play of PETE_EDOCHIE_PLAYS) {
    const { data: existingPlay } = await supabase
      .from('plays')
      .select('id')
      .eq('slug', play.slug)
      .maybeSingle();

    if (existingPlay) {
      const { error: updPlayErr } = await supabase
        .from('plays')
        .update(play)
        .eq('id', existingPlay.id);
      if (updPlayErr) console.error(`Error updating play ${play.title}:`, updPlayErr);
      else console.log(`  ✓ Updated play: ${play.title}`);
    } else {
      const { error: insPlayErr } = await supabase
        .from('plays')
        .insert(play);
      if (insPlayErr) console.error(`Error inserting play ${play.title}:`, insPlayErr);
      else console.log(`  ✓ Created play: ${play.title}`);
    }
  }

  // 4. FILMS & ENSEMBLE CREDITS
  console.log('\n4. Upserting complete screen filmography & ensemble cast...');
  for (const film of PETE_EDOCHIE_FILMOGRAPHY) {
    const { credits, ...filmData } = film;

    // Check if film exists
    const { data: existingFilm } = await supabase
      .from('films')
      .select('id, slug')
      .eq('slug', filmData.slug)
      .maybeSingle();

    let filmId = existingFilm ? existingFilm.id : null;

    if (filmId) {
      const { error: updErr } = await supabase
        .from('films')
        .update(filmData)
        .eq('id', filmId);
      if (updErr) console.error(`Error updating film ${filmData.title}:`, updErr);
      else console.log(`✓ Updated film: ${filmData.title} (${filmId})`);
    } else {
      const { data: newFilm, error: insErr } = await supabase
        .from('films')
        .insert(filmData)
        .select()
        .single();
      if (insErr) {
        console.error(`Error inserting film ${filmData.title}:`, insErr);
        continue;
      }
      filmId = newFilm.id;
      console.log(`✓ Created film: ${filmData.title} (${filmId})`);
    }

    // Credits / Ensemble
    for (const credit of credits) {
      let creditPersonId = personId;
      if (credit.name !== 'Pete Edochie') {
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

      if (!creditPersonId) continue;

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
            source: 'imdb_full_ensemble'
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
            source: 'imdb_full_ensemble'
          });
      }
    }
    console.log(`  ✓ Linked ${credits.length} ensemble cast/crew credits to ${filmData.title}`);
  }

  console.log('\n================================================================');
  console.log('=== Successfully Populated Pete Edochie Profile & Filmography ===');
  console.log('================================================================');
}

seedPeteEdochie().catch(console.error);
