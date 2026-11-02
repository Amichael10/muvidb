import { supabase, sleep } from './lib/supabase_reliable.mjs';

const CRITIC_ID = '5d192d72-4836-4e98-908b-b1578e3facea'; // The Nigerian Stage Review

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Helper to look up or create a person respecting Zero-Duplicate Guarantee
async function getOrCreatePerson(name) {
  const cleanName = name.trim();
  if (!cleanName) return null;

  // 1. Search exact or case-insensitive name match
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, slug')
    .ilike('name', cleanName)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  // 2. Check aliases if table exists
  try {
    const { data: aliasMatch } = await supabase
      .from('person_aliases')
      .select('person_id, people(id, name, slug)')
      .ilike('alias', cleanName)
      .limit(1);

    if (aliasMatch && aliasMatch.length > 0 && aliasMatch[0].people) {
      return aliasMatch[0].people;
    }
  } catch (err) {
    // Ignore if table not present
  }

  // 3. Create new person
  let slug = slugify(cleanName);
  // Ensure unique slug
  const { data: slugCheck } = await supabase.from('people').select('id').eq('slug', slug).maybeSingle();
  if (slugCheck) {
    slug = `${slug}-${Math.floor(Math.random() * 8999 + 1000)}`;
  }

  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug: slug,
      known_for_department: 'Acting',
      bio: null
    })
    .select('id, name, slug')
    .single();

  if (error) {
    console.error(`Error creating person "${cleanName}":`, error.message);
    return null;
  }
  console.log(`Created new person: ${created.name} (${created.slug})`);
  return created;
}

const STAGE_PLAYS = [
  {
    title: 'Oga Inspector',
    slug: 'oga-inspector',
    playwright: 'E. O. Asanlu',
    director: 'E. O. Asanlu',
    producer: 'Adeola Oyedepo',
    venue: 'Agip Hall, Muson Centre, Onikan, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '4:00 PM',
    run_start_date: '2026-10-11',
    run_end_date: '2026-10-11',
    year: 2026,
    genre: 'Political Satire / Comedy',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!p_0a!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F96188755-d2b7-4419-b141-694cf442922c_685x895.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/the-inspector-has-arrived-or-has',
    rating: 3.0,
    quote: 'A satirical adaptation of Nikolai Gogol’s The Government Inspector transplanted into contemporary Nigeria. The production lands sharp political jabs at local government hypocrisy, fueled by strong comic turns and lively ensemble energy.',
    cast: [
      { name: 'Oreoluwa Moses', character: 'Messenger (Moja)' },
      { name: 'Peculiar Adunni', character: 'Mama Iyabo' },
      { name: 'Ezekiel Abayomi', character: 'Ade Josh' },
      { name: 'Olaniran Wuraola', character: 'Nnena Press' },
      { name: 'Tomisin Samson', character: 'Alhaja Aminat (Treasurer)' },
      { name: 'Adeola Adewole', character: 'Sade Olohunwa' },
      { name: 'Adeshina Adedamola', character: 'Engineer Dee' },
      { name: 'Akintunde Odeyemi', character: 'Pastor Ajanaku' },
      { name: 'Ayandele Nurudeen Ajibola', character: 'Baba Arigbabuwo / Security' },
      { name: 'E. O. Asanlu', character: 'Otunba Chairman' }
    ],
    crew: [
      { name: 'E. O. Asanlu', role: 'director' },
      { name: 'E. O. Asanlu', role: 'playwright' },
      { name: 'Adeola Oyedepo', role: 'producer' }
    ]
  },
  {
    title: 'The Things We Kept',
    slug: 'the-things-we-kept',
    playwright: 'KelvinMary Ndukwe',
    director: 'KelvinMary Ndukwe',
    producer: 'Mimi Chaka',
    venue: 'The Rustic Deck, Lekki, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '5:00 PM',
    run_start_date: '2026-10-04',
    run_end_date: '2026-10-04',
    year: 2026,
    genre: 'Family Drama',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!_0ij!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F8d715ec1-e0aa-48c8-b068-069830d342fc_979x1009.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/the-things-we-kept-one-night-one',
    rating: 3.5,
    quote: 'A tender, devastating chamber drama about a family fractured by unacknowledged grief. Led by Gloria Anozie-Young’s towering performance as Franca, the play probes the heavy silence kept between mothers, daughters, and estranged fathers.',
    cast: [
      { name: 'Gloria Anozie-Young', character: 'Franca' },
      { name: 'Deborah Victor-Okhai', character: 'Anwuli' },
      { name: 'Nonso Odogwu', character: 'Daniel' }
    ],
    crew: [
      { name: 'KelvinMary Ndukwe', role: 'director' },
      { name: 'KelvinMary Ndukwe', role: 'playwright' },
      { name: 'Mimi Chaka', role: 'producer' }
    ]
  },
  {
    title: 'Who Killed the President',
    slug: 'who-killed-the-president',
    playwright: 'Qudus Ibrahim',
    director: 'Qudus Ibrahim',
    producer: 'Qudus Ibrahim',
    venue: 'The Garden, Ikoyi, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '6:00 PM',
    run_start_date: '2026-09-20',
    run_end_date: '2026-09-20',
    year: 2026,
    genre: 'Political Thriller / Whodunit',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!6g4J!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F62c3e1e2-b94f-4dcb-986c-4861ae6195c6_713x960.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/the-candidates-take-the-stage',
    rating: 3.0,
    quote: 'A high-stakes whodunit set within the claustrophobic corridors of power following the assassination of the head of state. Mawuyon Ogun anchors the tension as Inspector Ojo surrounded by ambitious suspects.',
    cast: [
      { name: 'Mawuyon Ogun', character: 'Inspector Ojo' },
      { name: 'Durotimi Okutagidi', character: 'Dr. Kolapo' },
      { name: 'Patrick Dante Oke', character: 'General Bello' },
      { name: 'Taiwo Familoni', character: 'Comrade Danladi' },
      { name: 'Femi Branch', character: 'Chief Adisa' },
      { name: 'Miriam Peters', character: 'Madam Funke' },
      { name: 'Jennifer Osammor', character: 'Madam Florence' },
      { name: 'Manuela Obianuju', character: 'Sandra' }
    ],
    crew: [
      { name: 'Qudus Ibrahim', role: 'director' },
      { name: 'Maryam Ibrahim', role: 'director' },
      { name: 'Qudus Ibrahim', role: 'playwright' },
      { name: 'Qudus Ibrahim', role: 'producer' }
    ]
  },
  {
    title: 'The Comeback',
    slug: 'the-comeback',
    playwright: 'Tobee Awosika',
    director: 'Tobee Awosika',
    producer: 'Tobee Awosika',
    venue: 'The Rustic Deck, Lekki, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '5:00 PM',
    run_start_date: '2026-08-16',
    run_end_date: '2026-08-16',
    year: 2026,
    genre: 'Relationship Drama',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!kXF_!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F0906be13-ea9c-4dc2-b362-e64e528a4746_1080x1080.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/everyone-has-something-to-answer',
    rating: 3.5,
    quote: 'A resonant character study on reconciliation, pride, and the costs of starting over after betrayal. The four-hander cast brings vulnerability and sharp emotional timing to modern romantic and domestic conflicts.',
    cast: [
      { name: 'Tobee Awosika', character: 'Femi' },
      { name: 'Omattutee James', character: 'Linda' },
      { name: 'Deborah Victor-Okhai', character: 'Tola' },
      { name: 'Riyo David', character: 'Segun' }
    ],
    crew: [
      { name: 'Tobee Awosika', role: 'director' },
      { name: 'Tobee Awosika', role: 'playwright' },
      { name: 'Tobee Awosika', role: 'producer' },
      { name: 'Riyo David', role: 'producer' }
    ]
  },
  {
    title: 'In the Room Where It Happened',
    slug: 'in-the-room-where-it-happened',
    playwright: 'Adedapo Treasure',
    director: 'Adedapo Treasure',
    producer: 'Fadaka Studio',
    venue: 'Alliance Française / Mike Adenuga Centre, Ikoyi, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '6:00 PM',
    run_start_date: '2026-08-09',
    run_end_date: '2026-08-09',
    year: 2026,
    genre: 'Espionage / Psychological Drama',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!r9jF!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6146c59b-c438-4e8c-851f-d748f2c2fe4d_720x897.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/after-the-rescue',
    rating: 3.5,
    quote: 'A tense interrogation room two-hander unpacking state secrecy, covert operations, and moral culpability in the wake of a botched hostage extraction. Temitope Agoro and Atilola Omotehinse spar with compelling psychological nuance.',
    cast: [
      { name: 'Temitope Agoro', character: 'Agent Cole' },
      { name: 'Atilola Omotehinse', character: 'Agent Bamidele' }
    ],
    crew: [
      { name: 'Adedapo Treasure', role: 'director' },
      { name: 'Adedapo Treasure', role: 'playwright' }
    ]
  },
  {
    title: 'Project X… Almost Famous',
    slug: 'project-x-almost-famous',
    playwright: 'Chiemeka Osuagwu',
    director: 'Goodness Emmanuel',
    producer: 'Light & Lens / Muson Centre',
    venue: 'Agip Hall, Muson Centre, Onikan, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '4:00 PM & 7:00 PM',
    run_start_date: '2026-07-26',
    run_end_date: '2026-07-26',
    year: 2026,
    genre: 'Musical Drama',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!c5vA!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F3ea219e5-9e66-41f2-95f3-c5ebc0879612_1080x1350.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/project-x-almost-famous-when-the',
    rating: 3.5,
    quote: 'A vibrant musical journey exploring young musical aspirants wrestling with stardom, artistic exploitation, and brotherhood in Lagos. Boasts powerhouse performances by Tomiwa Tegbe, Emeka Nwagbaraocha, Chimezie Imo, and Mike Afolarin.',
    cast: [
      { name: 'Tomiwa Tegbe', character: 'Tobi' },
      { name: 'Emeka Nwagbaraocha', character: 'Folarin' },
      { name: 'Chimezie Imo', character: 'Kunle' },
      { name: 'Mike Afolarin', character: 'Bolaji' }
    ],
    crew: [
      { name: 'Chiemeka Osuagwu', role: 'playwright' },
      { name: 'Goodness Emmanuel', role: 'director' }
    ]
  },
  {
    title: 'Mary the Musical',
    slug: 'mary-the-musical',
    playwright: 'Opeyemi Akande',
    director: 'Ice Nweke & Dr. Iyadunni Gbadebo',
    producer: 'Dr. Iyadunni Gbadebo',
    venue: 'Eko Convention Centre, Victoria Island, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '5:00 PM',
    run_start_date: '2026-07-12',
    run_end_date: '2026-07-12',
    year: 2026,
    genre: 'Biblical Musical / Drama',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!c1_s!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fb356886e-8a1a-4954-ab4f-80ae661152a5_1080x1350.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/mary-the-musical-a-yes-that-needed',
    rating: 3.5,
    quote: 'A grand theatrical spectacle reinterpreting the nativity story from Mary of Nazareth’s intimate perspective. Rubee Agwu delivers a moving, pitch-perfect vocal performance with stunning choreography by Ice Nweke.',
    cast: [
      { name: 'Rubee Agwu', character: 'Mary' }
    ],
    crew: [
      { name: 'Opeyemi Akande', role: 'playwright' },
      { name: 'Ice Nweke', role: 'director' },
      { name: 'Dr. Iyadunni Gbadebo', role: 'director' },
      { name: 'Dr. Iyadunni Gbadebo', role: 'producer' }
    ]
  },
  {
    title: 'Table 11: Ebo, the offering',
    slug: 'table-11-ebo-the-offering',
    playwright: 'Bimbo Olorunmola',
    director: 'Jerry Adesewo',
    producer: 'Tosin Adeyemi',
    venue: 'GQ Lagos / Terra Lawn, Victoria Island, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '5:30 PM',
    run_start_date: '2026-06-28',
    run_end_date: '2026-06-28',
    year: 2026,
    genre: 'Experimental Folklore Drama',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!n1yZ!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fd6ec9ea4-486a-4c28-98e3-f09f5a34bfdb_828x1034.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/table-11-ebo-the-offering',
    rating: 3.0,
    quote: 'An evocative site-specific production weaving Yoruba rituals of sacrifice and spiritual reckoning into a modern dining space. Tosin Adeyemi leads with fierce ritual conviction alongside Bimbo Olorunmola.',
    cast: [
      { name: 'Tosin Adeyemi', character: 'Morenike' },
      { name: 'Bimbo Olorunmola', character: 'Priest' }
    ],
    crew: [
      { name: 'Bimbo Olorunmola', role: 'playwright' },
      { name: 'Jerry Adesewo', role: 'director' },
      { name: 'Tosin Adeyemi', role: 'producer' }
    ]
  },
  {
    title: 'Freedom Songs: A Cabaret',
    slug: 'freedom-songs-a-cabaret',
    playwright: 'Oluwatomilola Adeniran',
    director: 'Oluwatomilola Adeniran',
    producer: 'Oluwatomilola Adeniran',
    venue: 'Fired & Iced, Lekki / Muson Centre, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '6:00 PM',
    run_start_date: '2026-06-14',
    run_end_date: '2026-06-14',
    year: 2026,
    genre: 'Musical Cabaret / Political Drama',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!7n3x!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6b7261d7-2195-46ff-a5ee-bc54a938c5b9_960x1200.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/freedom-songs-a-cabaret',
    rating: 4.0,
    quote: 'A galvanizing, intimate cabaret exploring post-colonial struggle, democratic protest, and civic hope through music and spoken word. Oluwatomilola Adeniran and Valerine Abiola create an electrifying communion with the audience.',
    cast: [
      { name: 'Oluwatomilola Adeniran', character: 'Lead Performer / Vocalist' },
      { name: 'Valerine Abiola', character: 'Vocalist / Co-Performer' }
    ],
    crew: [
      { name: 'Oluwatomilola Adeniran', role: 'director' },
      { name: 'Oluwatomilola Adeniran', role: 'playwright' },
      { name: 'Oluwatomilola Adeniran', role: 'producer' }
    ]
  },
  {
    title: 'The Other Side',
    slug: 'the-other-side',
    playwright: 'Wole Oguntokun',
    director: 'Austine Onuoha',
    producer: 'Nevana Productions',
    venue: 'Terra Lawn, Victoria Island, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '5:30 PM & 7:30 PM',
    run_start_date: '2026-06-07',
    run_end_date: '2026-06-07',
    year: 2026,
    genre: 'Social Drama',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!5LgX!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F2f4ce204-6101-4434-b2c6-48cb82efdcf2_1080x1350.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/the-other-side-of-elsewhere',
    rating: 3.5,
    quote: 'Austine Onuoha directs Wole Oguntokun’s sharp dialogue on class mobility, illegal emigration, and the disillusionment waiting on foreign shores. Rodiah Lawal and Justin Ben provide strong dramatic contrast.',
    cast: [
      { name: 'Rodiah Lawal', character: 'Ify' },
      { name: 'Justin Ben', character: 'Tunde' },
      { name: 'Debby White', character: 'Sade' },
      { name: 'Toyin Braimoh', character: 'Mrs. Peters' },
      { name: 'Stanley Okeke', character: 'Chief Peters' },
      { name: 'Olawale Lampejo', character: 'Emeka' }
    ],
    crew: [
      { name: 'Wole Oguntokun', role: 'playwright' },
      { name: 'Austine Onuoha', role: 'director' }
    ]
  },
  {
    title: 'And You Call Yourself a Man',
    slug: 'and-you-call-yourself-a-man',
    playwright: 'Brooks Etiinyene',
    director: 'Emmanuel Duntoye',
    producer: 'Shola Ogundele',
    venue: 'Terra Lawn, Victoria Island, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '6:00 PM',
    run_start_date: '2026-05-24',
    run_end_date: '2026-05-24',
    year: 2026,
    genre: 'One-Man Show / Psychological Monologue',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!eGv8!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc9a6ca21-7649-43c2-af38-fe6bb76b5d9d_1080x1350.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/and-you-call-yourself-a-man-the-review',
    rating: 4.0,
    quote: 'A tour de force solo performance dissecting modern Nigerian masculinity, economic desperation, and mental health. Shola Ogundele commands the stage with vulnerability and unsparing emotional honesty under Emmanuel Duntoye’s focused direction.',
    cast: [
      { name: 'Shola Ogundele', character: 'Solo Performer / The Man' }
    ],
    crew: [
      { name: 'Brooks Etiinyene', role: 'playwright' },
      { name: 'Emmanuel Duntoye', role: 'director' },
      { name: 'Shola Ogundele', role: 'producer' }
    ]
  },
  {
    title: 'Before You Said Yes',
    slug: 'before-you-said-yes',
    playwright: 'Victor Orji',
    director: 'Victor Orji',
    producer: 'Eazy Wave Production',
    venue: 'Terra Lawn, Victoria Island, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '5:30 PM',
    run_start_date: '2026-05-17',
    run_end_date: '2026-05-17',
    year: 2026,
    genre: 'Romantic Comedy / Drama',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!mH9a!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa9652a23-1d07-42da-a0ee-6da7d922bc37_1080x1350.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/before-you-said-yes-the-trap-of-potential',
    rating: 3.0,
    quote: 'A witty, relatable cautionary tale about the pitfalls of marrying potential over character. Busayo Bankole and Olaoluwa Loto exhibit organic chemistry that makes the marital discord both funny and cautionary.',
    cast: [
      { name: 'Busayo Bankole', character: 'Ronke' },
      { name: 'Olaoluwa Loto', character: 'David' },
      { name: 'Omotayo Ogunrombi', character: 'Tola' },
      { name: 'Nnamdi Agbo', character: 'Pastor Mike' }
    ],
    crew: [
      { name: 'Victor Orji', role: 'director' },
      { name: 'Victor Orji', role: 'playwright' }
    ]
  },
  {
    title: 'The Wedding in Ikoyi',
    slug: 'the-wedding-in-ikoyi',
    playwright: 'Qudus IB (Qudus Ibrahim)',
    director: 'Qudus IB (Qudus Ibrahim)',
    producer: 'QIB Productions',
    venue: 'The Garden, Ikoyi, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '5:00 PM',
    run_start_date: '2026-05-10',
    run_end_date: '2026-05-10',
    year: 2026,
    genre: 'Dark Comedy / Ensemble Drama',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!ZzD_!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6b377b06-444f-4d94-9a00-1c9f446bc5f6_1080x1350.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/the-wedding-in-ikoyi',
    rating: 3.5,
    quote: 'An immersive, high-society wedding disaster where decade-long resentments boil over into shocking confrontation. Tomi Ojo shines as the jilted ex-partner in an ensemble featuring Chinonso Young and Akorede Ajayi.',
    cast: [
      { name: 'Tomi Ojo', character: 'Bisi' },
      { name: 'Ejiro Badare', character: 'Dapo' },
      { name: 'Akorede Ajayi', character: 'Usman' },
      { name: 'Chinonso Young', character: 'Iya Dapo' },
      { name: 'Favour Etim', character: 'Ada' },
      { name: 'Nonso Odogwu', character: 'Otunba' }
    ],
    crew: [
      { name: 'Qudus Ibrahim', role: 'director' },
      { name: 'Qudus Ibrahim', role: 'playwright' },
      { name: 'Qudus Ibrahim', role: 'producer' }
    ]
  },
  {
    title: 'The Will',
    slug: 'the-will',
    playwright: 'Moshood Fattah',
    director: 'Moshood Fattah',
    producer: 'Oluchi Odii',
    venue: 'The Rustic Deck Bar & Bistro, Lekki, Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    performance_time: '5:00 PM',
    run_start_date: '2026-05-05',
    run_end_date: '2026-05-05',
    year: 2026,
    genre: 'Intimate Family Thriller',
    poster_url: 'https://substackcdn.com/image/fetch/$s_!9klM!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fb5515ac2-2676-4324-870f-0d2f58f92de9_793x1009.png',
    source_url: 'https://thenigerianstagereviews.substack.com/p/a-will-a-room-no-way-out',
    rating: 4.0,
    quote: 'A gripping, claustrophobic drama centered on an inheritance reading between estranged siblings. Moshood Fattah and Oluchi Odii deliver masterclass performances packed with simmering resentment, guilt, and buried secrets.',
    cast: [
      { name: 'Moshood Fattah', character: 'Banji Martins' },
      { name: 'Oluchi Odii', character: 'Tolani Martins' }
    ],
    crew: [
      { name: 'Moshood Fattah', role: 'director' },
      { name: 'Moshood Fattah', role: 'playwright' },
      { name: 'Oluchi Odii', role: 'producer' }
    ]
  }
];

async function ingestAll() {
  console.log(`Starting ingestion of ${STAGE_PLAYS.length} stage plays...`);

  for (const playData of STAGE_PLAYS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Processing play: ${playData.title} (${playData.slug})`);
    await sleep(200);

    // 1. Check if play exists or insert
    const { data: existingPlay } = await supabase
      .from('plays')
      .select('id, title, slug')
      .eq('slug', playData.slug)
      .maybeSingle();

    let playId = existingPlay?.id;

    if (!playId) {
      const { data: newPlay, error: playError } = await supabase
        .from('plays')
        .insert({
          title: playData.title,
          slug: playData.slug,
          playwright: playData.playwright,
          director: playData.director,
          producer: playData.producer,
          venue: playData.venue,
          city: playData.city,
          country: playData.country,
          poster_url: playData.poster_url,
          banner_url: playData.poster_url, // user requirement: use poster as both poster and backdrop
          synopsis: playData.quote,
          genre: playData.genre,
          year: playData.year,
          run_start_date: playData.run_start_date,
          run_end_date: playData.run_end_date,
          performance_time: playData.performance_time,
          source_url: playData.source_url,
          status: 'archived'
        })
        .select('id, title, slug')
        .single();

      if (playError) {
        console.error(`Failed to insert play "${playData.title}":`, playError.message);
        continue;
      }
      playId = newPlay.id;
      console.log(`✓ Inserted play "${newPlay.title}" (ID: ${playId})`);
    } else {
      console.log(`✓ Play already exists: "${existingPlay.title}" (ID: ${playId})`);
      // Update poster and banner
      await supabase.from('plays').update({
        poster_url: playData.poster_url,
        banner_url: playData.poster_url
      }).eq('id', playId);
    }

    // 2. Ingest cast members into stage_credits
    let billing = 1;
    for (const actor of playData.cast) {
      const person = await getOrCreatePerson(actor.name);
      if (!person) continue;

      // Check if credit already exists for this person in this play
      const { data: existingCredit } = await supabase
        .from('stage_credits')
        .select('id, role, character_name')
        .eq('play_id', playId)
        .eq('person_id', person.id)
        .eq('role', 'actor')
        .maybeSingle();

      if (existingCredit) {
        // Update character_name in-place
        await supabase
          .from('stage_credits')
          .update({ character_name: actor.character, billing_order: billing })
          .eq('id', existingCredit.id);
        console.log(`  - Updated cast: ${person.name} as "${actor.character}"`);
      } else {
        await supabase
          .from('stage_credits')
          .insert({
            play_id: playId,
            person_id: person.id,
            role: 'actor',
            character_name: actor.character,
            billing_order: billing
          });
        console.log(`  + Added cast: ${person.name} as "${actor.character}"`);
      }
      billing++;
    }

    // 3. Ingest crew members into stage_credits
    for (const crew of playData.crew) {
      const person = await getOrCreatePerson(crew.name);
      if (!person) continue;

      const { data: existingCrewCredit } = await supabase
        .from('stage_credits')
        .select('id, role')
        .eq('play_id', playId)
        .eq('person_id', person.id)
        .eq('role', crew.role)
        .maybeSingle();

      if (!existingCrewCredit) {
        await supabase
          .from('stage_credits')
          .insert({
            play_id: playId,
            person_id: person.id,
            role: crew.role,
            character_name: null,
            billing_order: 99
          });
        console.log(`  + Added crew: ${person.name} (${crew.role})`);
      } else {
        console.log(`  - Crew credit exists: ${person.name} (${crew.role})`);
      }
    }

    // 4. Attach critic review to critic_reviews
    const { data: existingReview } = await supabase
      .from('critic_reviews')
      .select('id')
      .eq('play_id', playId)
      .eq('critic_id', CRITIC_ID)
      .maybeSingle();

    if (!existingReview) {
      const { error: revErr } = await supabase
        .from('critic_reviews')
        .insert({
          play_id: playId,
          critic_id: CRITIC_ID,
          critic_name: 'The Nigerian Stage Review',
          publication: 'The Nigerian Stage Review',
          quote: playData.quote,
          rating: playData.rating,
          review_url: playData.source_url,
          review_type: 'article',
          is_featured: true
        });

      if (revErr) {
        console.error(`Failed to insert review for "${playData.title}":`, revErr.message);
      } else {
        console.log(`✓ Attached review from The Nigerian Stage Review (Rating: ${playData.rating})`);
      }
    } else {
      console.log(`✓ Review already exists for "${playData.title}"`);
    }
  }

  console.log(`\nAll ${STAGE_PLAYS.length} stage plays successfully processed!`);
}

ingestAll();
