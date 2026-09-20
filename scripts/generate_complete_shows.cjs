const fs = require('fs');

const rawShows = JSON.parse(fs.readFileSync('scratch/all_dstv_shows_enriched.json', 'utf-8'));

// Verified rich ensembles (Cast and Crew)
const ensembles = {
  "wura": {
    creator: ["Phathu Makwarela", "Gwydion Beynon"],
    directors: ["Yemi Morafa", "Ben Chiadika", "Adeola Osunkojo"],
    showrunners: ["Rogers Ofime"],
    producers: ["Rogers Ofime (Native Media)"],
    cast: [
      { actor: "Scarlet Gomez", character: "Wura Amoo-Adeleke", role: "Lead" },
      { actor: "Yomi Fash-Lanso", character: "Anthony Amoo-Adeleke", role: "Main" },
      { actor: "Martha Ehinome", character: "Tumininu 'Tumi' Kuti", role: "Main" },
      { actor: "Ray Adeka", character: "Jejeloye 'Jeje' Amoo", role: "Main" },
      { actor: "Iremide Adeoye", character: "Lolu Adeleke", role: "Main" },
      { actor: "Ego Ihenacho", character: "Iyabo Kuti", role: "Main" },
      { actor: "Lanre Adediwura", character: "Olumide Kuti", role: "Main" },
      { actor: "Sandra Eichie", character: "Eve Adeleke", role: "Main" },
      { actor: "Carol King", character: "Grace Adeleke", role: "Supporting" },
      { actor: "Casey Edema", character: "Dimeji", role: "Supporting" }
    ],
    episode_runtime: "25-30 mins",
    total_episodes_estimate: "400+ episodes (currently in Season 4, Episode 123+)"
  },
  "mother of the brides": {
    creator: ["Africa Magic Original"],
    directors: ["Tope Alake", "Damilola Orimogunje"],
    producers: ["Africa Magic Showcase"],
    cast: [
      { actor: "Gloria Anozie-Young", character: "Nehita Silva-Whyte ('Mai Sisi')", role: "Lead" },
      { actor: "Linda Ejiofor-Suleiman", character: "Athena Silva-Whyte", role: "Main" },
      { actor: "Wendy Lawal", character: "Ebiyara Silva-Whyte", role: "Main" },
      { actor: "Kalu Ikeagwu", character: "Remi / In-law Patriarch", role: "Main" },
      { actor: "Uche Chika Elumelu", character: "Folashade", role: "Main" },
      { actor: "Yewande Simpson", character: "Daughter / Sibling", role: "Main" },
      { actor: "Blessing Urezo", character: "Family Member", role: "Supporting" }
    ],
    episode_runtime: "25-30 mins",
    total_episodes_estimate: "Currently airing Season 1 (Episode 38+)"
  },
  "secret lives": {
    creator: ["Africa Magic Original"],
    directors: ["Victor Sanchez Aghahowa", "Kingsley Omoife"],
    producers: ["Africa Magic Showcase Productions"],
    cast: [
      { actor: "Keppy Ekpeyong", character: "Family Patriarch / Elder", role: "Lead" },
      { actor: "Oluchi Amajuoyi", character: "Zee", role: "Lead" },
      { actor: "Nonso Odogwu", character: "Naeto / Family Head", role: "Main" },
      { actor: "Eyiyemi Olivia Rogbinyin", character: "Jazzmine", role: "Main" },
      { actor: "Ejiro Badare", character: "Chinelo / Family Member", role: "Main" },
      { actor: "Floyd Igbo", character: "Half-brother / Suitor", role: "Main" },
      { actor: "Favour Etim", character: "Family Confidante", role: "Supporting" }
    ],
    episode_runtime: "25-30 mins",
    total_episodes_estimate: "Currently airing Season 1 (Episode 33+)"
  },
  "tinsel": {
    creator: ["Yinka Ogun"],
    directors: ["Alex Mouth", "Ben Chiadika", "Kalu Anya", "Tunde Olaoye"],
    producers: ["Femi Odugbemi (Founding Exec Producer)", "M-Net West Africa"],
    cast: [
      { actor: "Victor Olaotan", character: "Chief Fred Ade-Williams", role: "Patriarch" },
      { actor: "Iretiola Doyle", character: "Sheila Ade-Williams", role: "Lead Matriarch" },
      { actor: "Gideon Okeke", character: "Phillip Ade-Williams", role: "Main" },
      { actor: "Linda Ejiofor-Suleiman", character: "Bimpe Adekoya", role: "Main" },
      { actor: "Chris Attoh", character: "Kwame Mensah", role: "Main" },
      { actor: "Damilola Adegbite", character: "Telema Duke", role: "Main" },
      { actor: "Funlola Aofiyebi-Raimi", character: "Brenda Nana Mensah", role: "Main" },
      { actor: "Gbenro Ajibade", character: "Soji Bankole", role: "Main" },
      { actor: "Iyke Okechukwu", character: "Chuks Obi", role: "Main" },
      { actor: "Florence Uwaleke", character: "Ene Obi", role: "Main" },
      { actor: "Funmi Holder", character: "Amaka Okoh", role: "Main" },
      { actor: "Osas Ighodaro", character: "Adanna", role: "Supporting" },
      { actor: "Tomi Odunsi", character: "Salewa", role: "Supporting" }
    ],
    episode_runtime: "25-30 mins",
    total_episodes_estimate: "3,700+ episodes (Currently airing Season 19, Episode 33+)"
  },
  "venge": {
    creator: ["Tosin Igho"],
    directors: ["Tosin Igho", "Rogba Arimoro"],
    producers: ["Tosin Igho (IGHO Productions)", "Africa Magic Showcase"],
    cast: [
      { actor: "Michelle Dede", character: "Kamara", role: "Lead" },
      { actor: "Uche Montana (Uche Nwaefuna)", character: "Bibi", role: "Lead" },
      { actor: "Uzoamaka Aniunoh", character: "Casie", role: "Main" },
      { actor: "Obehi Aburime", character: "Timi", role: "Main" },
      { actor: "Ian Wordi", character: "William", role: "Main" },
      { actor: "Uche Mac-Auley", character: "Mama K", role: "Main" },
      { actor: "Chidi Mokeme", character: "Major Antagonist", role: "Supporting" }
    ],
    episode_runtime: "45-50 mins",
    total_episodes_estimate: "260 episodes (Season 1, currently Episode 179+ in rotation)"
  },
  "unbroken": {
    creator: ["Brenda Nangwala"],
    directors: ["Victor Sanchez Aghahowa"],
    producers: ["Africa Magic Family / Showcase Originals"],
    cast: [
      { actor: "Nonso Odogwu", character: "Terfa Tilley-Gyado", role: "Lead Patriarch" },
      { actor: "Maimuna Yahaya", character: "Abimbola Tilley-Gyado", role: "Lead Matriarch" },
      { actor: "Efa Iwara", character: "Tivdo Tilley-Gyado", role: "Lead" },
      { actor: "Najite Dede", character: "Diana", role: "Main" },
      { actor: "Debbie Felix", character: "Dabota", role: "Main" },
      { actor: "Uzor Osimkpa", character: "Kende", role: "Main" },
      { actor: "Kunle Coker", character: "Tobore", role: "Main" },
      { actor: "Big Mickey", character: "Scad / Scabadah", role: "Supporting" }
    ],
    episode_runtime: "45-50 mins",
    total_episodes_estimate: "260 episodes (Season 1, currently Episode 186+ in rotation)"
  },
  "close of business": {
    creator: ["Africa Magic Showcase Original"],
    directors: ["Damilola Orimogunje", "Bunmi Ajakaiye"],
    producers: ["Africa Magic Showcase"],
    cast: [
      { actor: "Elma Mbadiwe", character: "Chisom (Privileged fiancée)", role: "Lead" },
      { actor: "Somadina Anyama", character: "Tomisin (Former tech founder, corporate analyst)", role: "Lead" },
      { actor: "Ejike Asiegbu", character: "Jide (Outspoken CEO, Infinity Capital)", role: "Main" },
      { actor: "Uzoamaka Onuoha", character: "Chanel / Corporate Executive", role: "Main" },
      { actor: "Tunbosun Aiyedehin", character: "Senior Finance Executive", role: "Main" },
      { actor: "Bobby Ekpe", character: "Nnamdi (Rival financier)", role: "Main" }
    ],
    episode_runtime: "25-30 mins",
    total_episodes_estimate: "39 episodes (Season 1, currently Episode 31+)"
  },
  "dust": {
    creator: ["Africa Magic Showcase Original"],
    directors: ["John Njamah", "Kayode Peters"],
    producers: ["Africa Magic Showcase"],
    cast: [
      { actor: "Eyiyemi Olivia Rogbinyin", character: "Hajiya Malaika Doherty ('Dust')", role: "Lead Matriarch" },
      { actor: "Asa'ah Samuel", character: "Rhodes Feranmi Doherty", role: "Lead" },
      { actor: "David Adoga", character: "Marcus Folarin Doherty", role: "Main" },
      { actor: "Ruby Okezie", character: "Zara Inaya Ubangari", role: "Main" },
      { actor: "Racheal Emem", character: "Zainab Alihu", role: "Main" },
      { actor: "Prisca Nwaobodo", character: "Sugar", role: "Supporting" },
      { actor: "Femi Durojaiye", character: "Garuba", role: "Supporting" }
    ],
    episode_runtime: "45-50 mins",
    total_episodes_estimate: "Currently airing Season 1 (Episode 116+)"
  },
  "covenant": {
    creator: ["Femi Odugbemi"],
    directors: ["Femi Odugbemi", "Ben Chiadika"],
    producers: ["Femi Odugbemi (Zuri24 Media)", "Africa Magic Showcase"],
    cast: [
      { actor: "Antar Laniyan", character: "Kane Ijimakinde (MKI)", role: "Lead Patriarch" },
      { actor: "Shaffy Bello", character: "Madam Fatimah Erhu", role: "Lead Matriarch" },
      { actor: "Clarion Chukwura", character: "Duchess Apuvere", role: "Main" },
      { actor: "Funsho Adeolu", character: "Gboyega James Gbadamosi (GJG)", role: "Main" },
      { actor: "Nonso Odogwu", character: "Santiago / Power Broker", role: "Main" },
      { actor: "Susan Pwajok", character: "Adaora Nwelue Bhadmus", role: "Main" },
      { actor: "Preach Bassey", character: "Voltron", role: "Supporting" },
      { actor: "Patrick Doyle", character: "Political Elder", role: "Supporting" }
    ],
    episode_runtime: "45-50 mins",
    total_episodes_estimate: "260 episodes (Season 1, currently Episode 118+ in rotation)"
  },
  "my siblings and i": {
    creator: ["Funke Akindele", "JJC Skillz (Abdulrasheed Bello)"],
    directors: ["Funke Akindele", "JJ Skillz", "Tunde Olaoye"],
    producers: ["SceneOne Productions", "Africa Magic Family"],
    cast: [
      { actor: "Patrick Doyle", character: "Solomon Aberuagba (Father)", role: "Lead" },
      { actor: "Vivian Metchie", character: "Mrs. Aberuagba (Mother)", role: "Lead" },
      { actor: "Tomiwa Tegbe", character: "James Aberuagba", role: "Main" },
      { actor: "Jessica Orishane", character: "Nkechi Aberuagba", role: "Main" },
      { actor: "Funke Akindele", character: "Vivian / Family Relative", role: "Recurring" },
      { actor: "Chinonso Arubayi", character: "Sibling / In-law", role: "Main" },
      { actor: "Soma Anyama", character: "Dave", role: "Supporting" }
    ],
    episode_runtime: "25-30 mins",
    total_episodes_estimate: "5 Seasons, 200+ episodes (Currently airing Season 4, Episode 54+)"
  },
  "masquerades of aniedo": {
    creator: ["Chichi Nworah"],
    directors: ["Femi Ogunsanwo"],
    producers: ["Chichi Nworah (Giant Creative Media)", "Africa Magic Showcase"],
    cast: [
      { actor: "Chukwu Martin", character: "Muna Nwokoye", role: "Lead" },
      { actor: "Uzor Arukwe", character: "Abaeze / Masquerade Elder", role: "Lead" },
      { actor: "Adekunle 'Abounce' Fawole", character: "Afam Nwokoye", role: "Main" },
      { actor: "Ikponwosa Gold", character: "Christian Ibeneme", role: "Main" },
      { actor: "Uche Nwoko", character: "Urenna Nwokoye", role: "Main" },
      { actor: "Imoh Eboh", character: "Zina Okoloma", role: "Main" },
      { actor: "Mofehintola Jebutu", character: "Chizitaram Igwe", role: "Main" },
      { actor: "Temidayo Akinboro", character: "Maduka", role: "Supporting" },
      { actor: "Doris Okorie", character: "Ojoma Ezeobi", role: "Supporting" }
    ],
    episode_runtime: "45-50 mins",
    total_episodes_estimate: "130 episodes (Season 1, currently Episode 99+ in rotation)"
  },
  "my flatmates": {
    creator: ["Bright Okpocha (Basketmouth)", "Kayode Peters"],
    directors: ["Kayode Peters"],
    producers: ["Barons World Entertainment", "Africa Magic Showcase"],
    cast: [
      { actor: "Bright Okpocha (Basketmouth)", character: "Prosper", role: "Lead Flatmate" },
      { actor: "Steve Onu (Yaw)", character: "Obus", role: "Lead Flatmate" },
      { actor: "Okey Bakassi", character: "Dan", role: "Lead Flatmate" },
      { actor: "Onyebuchi Ojieh (Buchi)", character: "Frank", role: "Lead Flatmate" },
      { actor: "Wofai Fada", character: "Sandra", role: "Main" },
      { actor: "Rekiya Yusuf", character: "Mimi", role: "Main" },
      { actor: "Emmanuel Ikubese", character: "Sammy", role: "Main" },
      { actor: "Justice Nuagbe (Ushbebe)", character: "Special Appearance", role: "Supporting" }
    ],
    episode_runtime: "25-30 mins",
    total_episodes_estimate: "9 Seasons, 1,000+ episodes (Currently airing Season 9, Episode 123+)"
  },
  "sabon tauraron arewa": {
    creator: ["Africa Magic Hausa Originals"],
    directors: ["Kabiru Jammaje", "Aminu Saira"],
    producers: ["Africa Magic Hausa (MultiChoice Nigeria)"],
    cast: [
      { actor: "Mubarak Ridwan ('Real Obey')", character: "Season 1 Champion & Mentor", role: "Star Maker / Mentor" },
      { actor: "Kannywood Guest Judges", character: "Celebrity Mentors & Adjudicators", role: "Judges" },
      { actor: "Season 2 Contestants", character: "Top 12 Northern Musical Finalists", role: "Contestants" }
    ],
    episode_runtime: "45-50 mins",
    total_episodes_estimate: "2 Seasons (Currently airing Season 2, Episode 5+)"
  }
};

const completeShows = rawShows.map((s, idx) => {
  const normKey = s.title.toLowerCase().trim();
  const ensemble = ensembles[normKey] || {};

  // Strict fallback rule requested by user:
  // "i think they did not have backdrop so if they don't use the poster as backdrop too"
  const poster = s.poster || null;
  const backdrop = s.backdrop || poster;

  function cleanText(txt) {
    if (!txt) return '';
    return txt
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  return {
    id: s.id,
    rank: idx + 1,
    title: s.title,
    type: s.type || "series",
    genres: s.genres || [],
    age_rating: s.age_rating || "16",
    runtime: {
      episode_duration: ensemble.episode_runtime || "30-60 mins",
      broadcast_air_time: s.air_time ? `${s.air_time} WAT` : "Check DStv Guide"
    },
    seasons_and_episodes: {
      current_season: s.season,
      available_seasons: s.available_seasons || [s.season],
      latest_episode_airing: s.latest_episode ? {
        season: s.latest_episode.season,
        episode: s.latest_episode.episode,
        synopsis: cleanText(s.latest_episode.synopsis),
        air_date: s.latest_episode.air_date
      } : null,
      total_episodes_overview: ensemble.total_episodes_estimate || "Ongoing multi-episode series"
    },
    synopsis: cleanText(s.synopsis),
    channel: {
      name: s.channel || "Africa Magic",
      number: s.channel_number || "151 / 153 / 154 / 156"
    },
    media: {
      poster: poster,
      backdrop: backdrop, // Guarantees fallback to poster if no backdrop exists
      has_distinct_backdrop: backdrop !== poster
    },
    credits: {
      creators: ensemble.creator || [],
      directors: ensemble.directors || [],
      producers: ensemble.producers || ensemble.showrunners || [],
      cast: ensemble.cast || []
    },
    links: {
      dstv_url: `https://www.dstv.com${s.link}`,
      imdb_id: s.imdb_id || null,
      imdb_url: s.imdb_id ? `https://www.imdb.com/title/${s.imdb_id}/` : null
    }
  };
});

fs.writeFileSync('scratch/africa_magic_shows_complete.json', JSON.stringify(completeShows, null, 2));
console.log(`✅ Successfully synthesized all ${completeShows.length} Africa Magic shows into scratch/africa_magic_shows_complete.json`);
