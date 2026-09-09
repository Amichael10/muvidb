import { supabase } from './lib/db';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function seedHubertOgunde() {
  console.log('=== Starting Chief Hubert Ogunde Data Ingestion ===\n');

  // 1. PERSON: Chief Hubert Ogunde
  console.log('1. Upserting Chief Hubert Ogunde in `people` table...');
  const personSlug = 'hubert-ogunde';

  // Check if person exists
  const { data: existingPeople, error: pFindErr } = await supabase
    .from('people')
    .select('id, slug, name')
    .eq('slug', personSlug);

  if (pFindErr) {
    console.error('Error finding person:', pFindErr);
  }

  let personId = existingPeople?.[0]?.id;

  const personData = {
    name: 'Chief Hubert Ogunde',
    slug: personSlug,
    bio: `Chief Hubert Adedeji Ogunde (10 July 1916 – 4 April 1990) was a Nigerian actor, playwright, theatre manager, director, producer, musician, and composer. Widely revered as the "Father of Nigerian Theatre" and the "Father of Contemporary Yoruba Theatre," he founded the Ogunde Concert Party in 1945, which was the first professional contemporary theatre company in Nigeria.\n\nThroughout a prolific career spanning nearly half a century, Ogunde authored and staged more than 50 iconic operas, folk dramas, and plays that blended traditional Yoruba folklore, dramatic satire, music, dance, and sharp anti-colonial political commentary (notably *Strike and Hunger*, *Bread and Bullet*, and *Yoruba Ronu*).\n\nIn the late 1970s and 1980s, Ogunde transitioned into celluloid cinema, pioneering Nigeria's golden age of celluloid filmmaking with box-office phenomenons including *Aiye* (1979), *Jaiyesimi* (1980), *Aropin N'tenia* (1982), and *Ayanmo* (1989), where he famously portrayed the venerable chief priest Osetura. Shortly before his passing in 1990, he starred as Brimah in Bruce Beresford's international film adaptation *Mister Johnson* alongside Pierce Brosnan, and was appointed the founding Artistic Director of the National Troupe of Nigeria.`,
    nationality: 'Nigerian',
    birthplace: 'Ososa, Ogun State, Nigeria',
    date_of_birth: '1916-07-10',
    date_of_death: '1990-04-04',
    is_deceased: true,
    death_year: 1990,
    death_month: 4,
    gender: 'Male',
    known_for_department: 'Directing',
    is_verified: true,
    photo_url: 'https://upload.wikimedia.org/wikipedia/en/9/9c/Hubert_ogunde.jpg',
    source: 'https://ogundemuseum.org',
    awards: 'Founding Artistic Director of National Troupe of Nigeria; Member of the Order of the Niger (MON); D.Litt (Honoris Causa) Obafemi Awolowo University; D.Litt (Honoris Causa) University of Lagos'
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

  // 2. PERSON ALIASES
  console.log('\n2. Upserting aliases in `person_aliases` table...');
  const aliases = [
    'Hubert Ogunde',
    'Chief Hubert Ogunde',
    'Hubert Adedeji Ogunde',
    'Ogunde',
    'Baba Ogunde',
    'Osetura'
  ];

  for (const alias of aliases) {
    const aliasKey = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
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
        source: 'seed_ogunde',
        confidence: 1.0
      });
    }
  }
  console.log(`✓ Upserted ${aliases.length} aliases for Chief Hubert Ogunde`);

  // 3. PLAYS: Parse and upsert all 56 stage plays/operas
  console.log('\n3. Upserting 56 historical plays/operas in `plays` table...');
  const playsHtml = fs.readFileSync('scratch/plays.html', 'utf-8');
  const $ = cheerio.load(playsHtml);

  const rawPlays: Array<{
    num: number;
    title: string;
    year: number;
    venue: string;
    city: string;
    country: string;
    records: string;
  }> = [];

  $('table.table tr').each((i, el) => {
    const tds = $(el).find('td');
    if (tds.length >= 4) {
      const num = parseInt($(tds[0]).text().trim(), 10);
      const title = $(tds[1]).text().trim();
      const year = parseInt($(tds[2]).text().trim(), 10);
      const venueRaw = $(tds[3]).text().trim();
      const records = tds.length >= 5 ? $(tds[4]).text().trim() : '';

      let city = 'Lagos';
      let country = 'Nigeria';
      let venue = venueRaw;

      if (venueRaw.toLowerCase().includes('london')) {
        city = 'London';
        country = 'United Kingdom';
        venue = 'London';
      } else if (venueRaw.toLowerCase().includes('ibadan')) {
        city = 'Ibadan';
        country = 'Nigeria';
        venue = 'Obisesan Hall';
      } else if (venueRaw.toLowerCase().includes('ilorin')) {
        city = 'Ilorin';
        country = 'Nigeria';
        venue = 'Ilorin';
      } else if (venueRaw.toLowerCase().includes('glover')) {
        venue = 'Glover Memorial Hall';
        city = 'Lagos';
      } else if (venueRaw.toLowerCase().includes('national theatre')) {
        venue = 'National Theatre';
        city = 'Lagos';
      }

      rawPlays.push({
        num,
        title,
        year,
        venue,
        city,
        country,
        records
      });
    }
  });

  // Pre-fetch all plays by Hubert Ogunde to do fast in-memory matching
  const { data: allExistingPlays } = await supabase
    .from('plays')
    .select('id, slug, title')
    .ilike('playwright', '%Ogunde%');

  const existingPlaySlugMap = new Map<string, string>();
  for (const ep of allExistingPlays || []) {
    if (ep.slug) existingPlaySlugMap.set(ep.slug, ep.id);
  }

  let playsInserted = 0;
  for (const p of rawPlays) {
    const cleanTitle = p.title.replace(/\s+/g, ' ').trim();
    const slugBase = cleanTitle
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const slug = `${slugBase}-${p.year}`;

    let genre = 'Folk Opera';
    if (cleanTitle.toLowerCase().includes('(film)')) {
      genre = 'Celluloid Film / Stage Premiere';
    } else if (['strike and hunger', 'bread and bullet', 'yoruba ronu', 'herbert macaulay', 'towards liberty'].some(k => cleanTitle.toLowerCase().includes(k))) {
      genre = 'Political Satire / Historical Drama';
    } else if (['adam and eve', 'israel in egypt', 'king solomon', 'nebuchadnezzar'].some(k => cleanTitle.toLowerCase().includes(k))) {
      genre = 'Biblical Folk Opera';
    } else {
      genre = 'Folk Opera / Stage Drama';
    }

    let synopsis = `Written, produced, and directed by Chief Hubert Ogunde. Premiered at ${p.venue} in ${p.city}, ${p.country} (${p.year}).`;
    if (p.records) {
      synopsis += ` Associated musical records / discography: ${p.records}.`;
    }

    const playPayload = {
      title: cleanTitle,
      slug,
      playwright: 'Chief Hubert Ogunde',
      director: 'Chief Hubert Ogunde',
      producer: 'Ogunde Concert Party / Ogunde Theatre',
      venue: p.venue,
      city: p.city,
      country: p.country,
      genre,
      year: p.year,
      status: 'archived',
      synopsis,
      source_url: 'https://ogundemuseum.org/plays.html',
      poster_url: 'https://ogundemuseum.org/assets/images/aiye.jpg'
    };

    const existingId = existingPlaySlugMap.get(slug);

    if (existingId) {
      await supabase.from('plays').update(playPayload).eq('id', existingId);
    } else {
      const { data: insPlay, error: insPlayErr } = await supabase.from('plays').insert(playPayload).select('id').single();
      if (!insPlayErr && insPlay) {
        existingPlaySlugMap.set(slug, insPlay.id);
      }
    }
    playsInserted++;
  }
  console.log(`✓ Processed & upserted ${playsInserted} stage plays into \`plays\` table.`);

  // 4. FILMS: Seed the 5 feature movies
  console.log('\n4. Upserting Chief Hubert Ogunde Celluloid Films in `films` table...');
  const filmsToSeed = [
    {
      title: 'Aiye',
      slug: 'aiye-1979',
      year: 1979,
      release_date: '1979-12-01',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'Yoruba',
      languages: ['Yoruba'],
      countries: ['Nigeria'],
      genres: ['Fantasy', 'Drama', 'Horror', 'Mystery'],
      synopsis: 'In this seminal Yoruba supernatural epic, Chief Priest Osetura wages a relentless spiritual war against a clandestine coven of witches threatening to destroy the peace and wellbeing of the village community. Ogunde financed the groundbreaking celluloid production by selling personal properties, exploring Yoruba cosmic balance, witchcraft, and traditional spirituality to unprecedented commercial and critical triumph.',
      poster_url: 'https://ogundemuseum.org/assets/images/aiye.jpg',
      imdb_id: 'tt0391741',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 110,
      credits: [
        { name: 'Ola Balogun', role: 'Director', billing_order: 1 },
        { name: 'Chief Hubert Ogunde', role: 'Writer', billing_order: 1 },
        { name: 'Chief Hubert Ogunde', role: 'Producer', billing_order: 1 },
        { name: 'Chief Hubert Ogunde', role: 'Actor', character_name: 'Osetura (Chief Priest)', billing_order: 1 }
      ]
    },
    {
      title: 'Jaiyesimi',
      slug: 'jaiyesimi-1980',
      year: 1980,
      release_date: '1980-11-15',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'Yoruba',
      languages: ['Yoruba'],
      countries: ['Nigeria'],
      genres: ['Fantasy', 'Drama', 'Mystery'],
      synopsis: 'A direct sequel to the blockbuster Aiye. Chief Priest Osetura, the revered traditional and spiritual head of the village, confronts vengeful covens of witches who regroup to strike back at the community. Through intense spiritual battles and divine wisdom, Osetura conquers the occult forces to bring lasting serenity and restoration.',
      poster_url: 'https://ogundemuseum.org/assets/images/jaiyesimi.jpg',
      imdb_id: 'tt0392176',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 105,
      credits: [
        { name: 'Chief Hubert Ogunde', role: 'Director', billing_order: 1 },
        { name: 'Freddie Goode', role: 'Director', billing_order: 2 },
        { name: 'Chief Hubert Ogunde', role: 'Writer', billing_order: 1 },
        { name: 'Chief Hubert Ogunde', role: 'Producer', billing_order: 1 },
        { name: 'Chief Hubert Ogunde', role: 'Actor', character_name: 'Osetura', billing_order: 1 }
      ]
    },
    {
      title: "Aropin N'tenia",
      slug: 'aropin-ntenia-1982',
      year: 1982,
      release_date: '1982-10-01',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'Yoruba',
      languages: ['Yoruba'],
      countries: ['Nigeria'],
      genres: ['Drama', 'Historical'],
      synopsis: 'Adapted from Ogunde’s famous 1964 stage masterpiece. A righteous and beloved monarch ruling with his two wives, Oyenubi and Adesola, faces severe societal crisis because he lacks a male heir. Treacherous palace chiefs Abore and Pamipami conspire to overthrow him because of his unwavering honesty and refusal of corruption.',
      poster_url: 'https://ogundemuseum.org/assets/images/aropin1.jpg',
      imdb_id: 'tt0391775',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 115,
      credits: [
        { name: 'Chief Hubert Ogunde', role: 'Director', billing_order: 1 },
        { name: 'Freddie Goode', role: 'Director', billing_order: 2 },
        { name: 'Chief Hubert Ogunde', role: 'Writer', billing_order: 1 },
        { name: 'Chief Hubert Ogunde', role: 'Producer', billing_order: 1 },
        { name: 'Chief Hubert Ogunde', role: 'Actor', character_name: 'The King (Oba)', billing_order: 1 }
      ]
    },
    {
      title: 'Ayanmo',
      slug: 'ayanmo-1989',
      year: 1989,
      release_date: '1989-08-20',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'Yoruba',
      languages: ['Yoruba'],
      countries: ['Nigeria'],
      genres: ['Fantasy', 'Drama', 'Horror'],
      synopsis: 'Osetura, the ageless High Priest and mediator between humanity and Olodumare (the Creator), believes he has vanquished all demonic forces from the realm. However, the deadly Black Witch descends into the abyss before Satan himself, obtaining the terrifying \'Dreaded Bird of Darkness\' to unleash an apocalyptic final showdown against Osetura and mankind.',
      poster_url: 'https://ogundemuseum.org/assets/images/ayanmo.jpg',
      imdb_id: 'tt0391789',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 120,
      credits: [
        { name: 'Chief Hubert Ogunde', role: 'Director', billing_order: 1 },
        { name: 'Chief Hubert Ogunde', role: 'Writer', billing_order: 1 },
        { name: 'Chief Hubert Ogunde', role: 'Producer', billing_order: 1 },
        { name: 'Chief Hubert Ogunde', role: 'Actor', character_name: 'Osetura', billing_order: 1 }
      ]
    },
    {
      title: 'Mister Johnson',
      slug: 'mister-johnson-1990',
      year: 1990,
      release_date: '1990-09-15',
      release_type: 'cinema',
      content_type: 'movie',
      language: 'English',
      languages: ['English', 'Hausa'],
      countries: ['Nigeria', 'United States'],
      genres: ['Drama'],
      synopsis: 'Directed by Academy Award-nominee Bruce Beresford and adapted from Joyce Cary’s novel, the film chronicles the turbulent story of Mister Johnson, an exuberant Nigerian government clerk torn between his African identity and the rigid British colonial bureaucracy in 1920s Nigeria. Chief Hubert Ogunde delivers his poignant final screen appearance as Brimah alongside Pierce Brosnan.',
      poster_url: 'https://m.media-amazon.com/images/M/MV5BMjA1OTY1MzEyN15BMl5BanBnXkFtZTcwNDY2MTQyMQ@@._V1_FMjpg_UX1000_.jpg',
      imdb_id: 'tt0100160',
      is_nollywood: true,
      is_published: true,
      runtime_minutes: 101,
      credits: [
        { name: 'Bruce Beresford', role: 'Director', billing_order: 1 },
        { name: 'Pierce Brosnan', role: 'Actor', character_name: 'Harry Rudbeck', billing_order: 1 },
        { name: 'Maynard Eziashi', role: 'Actor', character_name: 'Mister Johnson', billing_order: 2 },
        { name: 'Edward Woodward', role: 'Actor', character_name: 'Sargison', billing_order: 3 },
        { name: 'Chief Hubert Ogunde', role: 'Actor', character_name: 'Brimah', billing_order: 4 }
      ]
    }
  ];

  for (const film of filmsToSeed) {
    const { credits, ...filmData } = film;

    // Check if film exists by slug
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

    // Upsert credits
    for (const credit of credits) {
      let creditPersonId = personId;
      if (credit.name !== 'Chief Hubert Ogunde') {
        const personSlugOther = credit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data: foundPerson } = await supabase
          .from('people')
          .select('id')
          .eq('slug', personSlugOther)
          .maybeSingle();

        if (foundPerson) {
          creditPersonId = foundPerson.id;
        } else {
          const { data: insertedPerson } = await supabase
            .from('people')
            .insert({
              name: credit.name,
              slug: personSlugOther,
              known_for_department: credit.role === 'Director' ? 'Directing' : credit.role === 'Writer' ? 'Writing' : 'Acting',
              is_verified: false
            })
            .select()
            .single();
          if (insertedPerson) creditPersonId = insertedPerson.id;
        }
      }

      // Check credit existence
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
            source: 'ogundemuseum / imdb'
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
            source: 'ogundemuseum / imdb'
          });
      }
    }
    console.log(`  ✓ Linked ${credits.length} credits to ${filmData.title}`);
  }

  console.log('\n=== Ingestion Complete! Successfully populated Chief Hubert Ogunde profile, plays, and films. ===');
}

seedHubertOgunde().catch(console.error);
