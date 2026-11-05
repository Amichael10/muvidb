import fs from 'fs';
import path from 'path';
import dns from 'dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch {}

type SeedSong = {
  title: string;
  artist: string;
  genre: string;
  mood: string;
  energyLevel: 'chill' | 'medium' | 'high';
  knownAudioId?: string;
};

const SEED_CATALOG: SeedSong[] = [
  // 1. Romance & Melodic Drama (20)
  { title: 'Running To You', artist: 'Chike & Simi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Roju', artist: 'Chike', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Egwu', artist: 'Chike & Mohbad', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Believe Me', artist: 'Johnny Drille', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'How Are You (My Friend)', artist: 'Johnny Drille', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Count On You', artist: 'Johnny Drille', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Duduke', artist: 'Simi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Joromi', artist: 'Simi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Stranger', artist: 'Simi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Only You', artist: 'Ric Hassani', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Gentleman', artist: 'Ric Hassani', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Baby Riddim', artist: 'Fave', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Scobiero', artist: 'Fave', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Tonight', artist: 'Nonso Amadi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Mad', artist: 'Wurld & Sarz', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Know You', artist: 'Ladipoe & Simi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Free Mind', artist: 'Tems', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Love Me JeJe', artist: 'Tems', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'medium' },
  { title: 'Reason', artist: 'Omah Lay', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Like I Do', artist: 'Fireboy DML', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },

  // 2. Upbeat Energy & Box Office Blockbuster (20)
  { title: 'Lonely At The Top', artist: 'Asake', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Active', artist: 'Asake & Travis Scott', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'MMS', artist: 'Asake & Wizkid', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Remember', artist: 'Asake', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: '2:30', artist: 'Asake', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'City Boys', artist: 'Burna Boy', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Tested, Approved & Trusted', artist: 'Burna Boy', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Last Last', artist: 'Burna Boy', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Cast', artist: 'Shallipopi & Odumodublvck', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Ex Convict', artist: 'Shallipopi', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Elon Musk', artist: 'Shallipopi', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Declan Rice', artist: 'Odumodublvck', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Blood On The Dance Floor', artist: 'Odumodublvck', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Unavailable', artist: 'Davido & Musa Keys', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Feel', artist: 'Davido', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Buga (Lo Lo Lo)', artist: 'Kizz Daniel & Tekno', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Twe Twe', artist: 'Kizz Daniel', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Bullion Van', artist: 'Seyi Vibez', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Chance (Na Ham)', artist: 'Seyi Vibez', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Sharpally', artist: 'Young Jonn', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },

  // 3. Nollywood Soundtracks & Cinema (15)
  { title: 'Billionaire (Happy Day)', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Money Power', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Cast Aside', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'chill' },
  { title: 'Fine Lady', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'I Go Pay', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Chai Chai', artist: 'Stanley Okorie', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'chill' },
  { title: 'African Royal Theme', artist: 'Austin Erowele', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'chill' },
  { title: 'Naija Jungle', artist: 'Sound Sultan', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Ordinary People', artist: 'Cobhams Asuquo', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'chill' },
  { title: 'Ara', artist: 'Brymo', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Iyawo Mi', artist: 'Timi Dakolo', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'chill' },
  { title: 'Great Nation', artist: 'Timi Dakolo', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'chill' },
  { title: 'Stupid Song', artist: 'Bez', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Pray For Me', artist: 'Darey', genre: 'nollywood_soundtrack', mood: 'nollywood_soundtrack', energyLevel: 'medium' },
  { title: 'Burukutu', artist: 'Olamide', genre: 'nollywood_soundtrack', mood: 'upbeat_energy', energyLevel: 'high', knownAudioId: '28587614390888603' },

  // 4. Cultural Highlife & Traditional (15)
  { title: 'Selense', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Anita', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Me You I', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Osondu', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Beautiful Stranger', artist: 'The Cavemen.', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Game Changer (Dike)', artist: 'Flavour', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Levels', artist: 'Flavour', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Ariva', artist: 'Flavour', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Doings', artist: 'Flavour & Phyno', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Do I', artist: 'Phyno', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Fada Fada', artist: 'Phyno & Olamide', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Culture', artist: 'Umu Obiligbo, Flavour & Phyno', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Chisom', artist: 'Umu Obiligbo', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Osondi Owendi', artist: 'Chief Stephen Osita Osadebe', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Ndewo', artist: 'Phyno & Wande Coal', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium', knownAudioId: '2940358503007841' },

  // 5. Amapiano & Street Dance Grooves (15)
  { title: 'Mnike', artist: 'Tyler ICU', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Ke Star (Remix)', artist: 'Focalistic & Davido', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Tanzania', artist: 'Uncle Waffles & Tony Duardo', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Amapiano', artist: 'Asake & Olamide', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Organise', artist: 'Asake', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Terminator', artist: 'Asake', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Abracadabra', artist: 'Rexxie & Naira Marley', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Kilofeshe', artist: 'Zinoleesky', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Ma Pariwo', artist: 'Zinoleesky', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Peace', artist: 'Mohbad', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Ask About Me', artist: 'Mohbad', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Water', artist: 'Tyla', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'medium' },
  { title: 'Tshwala Bam', artist: 'Titom & Yuppe', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'INFERNO', artist: 'Peruzzi, Zlatan, Shoday', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high', knownAudioId: '1460041869341936' },
  { title: 'African Baddie', artist: 'Tiwa Savage', genre: 'amapiano_energy', mood: 'upbeat_energy', energyLevel: 'high', knownAudioId: '1123275036806266' },

  // 6. Faith, Gospel & Inspirational (20)
  { title: 'Tobechukwu', artist: 'Nathaniel Bassey & Mercy Chinwo', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Imela', artist: 'Nathaniel Bassey & Enitan Adaba', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Onise Iyanu', artist: 'Nathaniel Bassey', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Yahweh Sabaoth', artist: 'Nathaniel Bassey', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'YOU ARE GOOD', artist: 'Greatman Takit, Nathaniel Bassey', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium', knownAudioId: '1183349438199315' },
  { title: 'Excess Love', artist: 'Mercy Chinwo', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Confidence', artist: 'Mercy Chinwo', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Chinedum', artist: 'Mercy Chinwo', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Obinasom', artist: 'Mercy Chinwo', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Fragrance to Fire', artist: 'Dunsin Oyekan', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'The Blood and The Fire', artist: 'Dunsin Oyekan', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Yah', artist: 'Dunsin Oyekan', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Miracle No Dey Tire Jesus', artist: 'Moses Bliss', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Too Faithful', artist: 'Moses Bliss', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Way Maker', artist: 'Sinach', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'I Know Who I Am', artist: 'Sinach', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Congratulations', artist: 'Ada Ehi & Buchi', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'medium' },
  { title: 'Only You Jesus', artist: 'Ada Ehi', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'I Will Pray', artist: 'Ebuka Songs', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill' },
  { title: 'Prophetic Worship Medley', artist: 'Mabel Omajuwa', genre: 'faith_inspirational', mood: 'faith_inspirational', energyLevel: 'chill', knownAudioId: '1109032288358823' },

  // 7. Cinematic Thriller, Suspense & Dark Drama (15)
  { title: 'Basquiat', artist: 'Asake', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Gbona', artist: 'Burna Boy', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'medium' },
  { title: 'Heis', artist: 'Rema', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Ozeba', artist: 'Rema', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Firegun', artist: 'Odumodublvck & Fireboy DML', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'How To Kill A Man', artist: 'Bloody Civilian', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'medium' },
  { title: 'I Don\'t Like You', artist: 'Bloody Civilian', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'medium' },
  { title: 'Kwaku The Traveller', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Konongo Zongo', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'medium' },
  { title: 'Different Pattern', artist: 'Seyi Vibez', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'medium' },
  { title: 'Broken Pieces', artist: 'Onos', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'chill', knownAudioId: '1641081827526324' },
  { title: 'Emiliana', artist: 'CKay', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'medium' },
  { title: 'Soweto', artist: 'Victony & Tempoe', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'medium' },
  { title: 'Gratitude', artist: 'Asake', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'medium', knownAudioId: '1433601271772319' },
  { title: 'Dr. Love', artist: 'L.A.X & Young Jonn', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high', knownAudioId: '2876380729219466' },

  // 8. General Global Afrobeats Hits (15)
  { title: 'Calm Down', artist: 'Rema', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'medium' },
  { title: 'Rush', artist: 'Ayra Starr', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'medium' },
  { title: 'Commas', artist: 'Ayra Starr', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'medium' },
  { title: 'Sability', artist: 'Ayra Starr', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'high' },
  { title: 'Soso', artist: 'Omah Lay', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'medium' },
  { title: 'Holy Ghost', artist: 'Omah Lay', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'medium' },
  { title: 'Peru', artist: 'Fireboy DML', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'medium' },
  { title: 'Everyday', artist: 'Fireboy DML', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'chill' },
  { title: 'Love Nwantiti (Ahit)', artist: 'CKay', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'chill' },
  { title: 'Cough (Odo)', artist: 'Kizz Daniel', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'medium' },
  { title: 'Stubborn', artist: 'Victony & Asake', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'high' },
  { title: 'Asiwaju', artist: 'Ruger', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'high' },
  { title: 'Ogaranya', artist: 'Adekunle Gold', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'medium' },
  { title: 'Party No Dey Stop', artist: 'Adekunle Gold & Zinoleesky', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'high' },
  { title: 'Aquafina', artist: 'Young Jonn', genre: 'afrobeats_hits', mood: 'general_afrobeats', energyLevel: 'medium' },
];

async function resolveSong(song: SeedSong) {
  try {
    const cleanTitle = song.title.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    const firstArtist = song.artist.split(/[&,]/)[0].trim();
    const term = `${cleanTitle} ${firstArtist}`;
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', term);
    url.searchParams.set('entity', 'song');
    url.searchParams.set('limit', '1');

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json: any = await res.json().catch(() => ({}));
    const hit = json?.results?.[0];
    if (!hit) return null;

    return {
      title: hit.trackName || song.title,
      artist: hit.artistName || song.artist,
      durationMs: hit.trackTimeMillis || 30000,
      artworkUrl: hit.artworkUrl100 ? hit.artworkUrl100.replace('100x100bb', '300x300bb') : null,
      previewUrl: hit.previewUrl || null,
    };
  } catch {
    return null;
  }
}

async function run() {
  console.log(`Starting resolution for ${SEED_CATALOG.length} catalog songs in controlled batches...`);
  const resolvedCatalog: any[] = [];

  for (let i = 0; i < SEED_CATALOG.length; i += 6) {
    const batch = SEED_CATALOG.slice(i, i + 6);
    const resolvedBatch = await Promise.all(
      batch.map(async (song) => {
        const hit = await resolveSong(song);
        const slug = `${song.artist}_${song.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
        const audioId = song.knownAudioId || `cat_${slug}`;
        return {
          audioId,
          audioType: 'music' as const,
          title: hit?.title || song.title,
          artist: hit?.artist || song.artist,
          genre: song.genre,
          mood: song.mood,
          energyLevel: song.energyLevel,
          durationMs: hit?.durationMs || 30000,
          artworkUrl: hit?.artworkUrl || null,
          previewUrl: hit?.previewUrl || null,
          isCurated: true,
        };
      })
    );
    resolvedCatalog.push(...resolvedBatch);
    console.log(`Resolved batch ${Math.floor(i / 6) + 1} / ${Math.ceil(SEED_CATALOG.length / 6)} (total: ${resolvedCatalog.length})`);
    // Brief pause to stay polite to iTunes
    await new Promise((r) => setTimeout(r, 200));
  }

  const outPath = path.join(process.cwd(), 'api', '_lib', 'social-studio', 'platforms', 'audio-catalog.ts');
  const fileContent = `// Auto-generated verified African & Nollywood Cinema Audio Catalog
// Total tracks: ${resolvedCatalog.length}
// Covers Afrobeats, Nollywood Soundtracks, Romance/Drama, Cultural Highlife, Amapiano, Faith/Gospel, Cinematic Thriller.

export type CuratedAudioTrack = {
  audioId: string;
  audioType: 'music' | 'original_sound';
  title: string;
  artist: string;
  genre: string;
  mood: string;
  energyLevel: 'chill' | 'medium' | 'high';
  durationMs: number | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  isCurated: boolean;
};

export const CURATED_AUDIO_CATALOG: CuratedAudioTrack[] = ${JSON.stringify(resolvedCatalog, null, 2)};
`;

  fs.writeFileSync(outPath, fileContent, 'utf8');
  console.log(`Successfully generated audio catalog at ${outPath} with ${resolvedCatalog.length} tracks!`);
}

run().catch(console.error);
