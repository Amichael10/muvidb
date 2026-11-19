import fs from 'fs';
import path from 'path';

type NewSongSeed = {
  title: string;
  artist: string;
  genre: string;
  mood: string;
  energyLevel: 'chill' | 'medium' | 'high';
};

const NEW_TRACKS: NewSongSeed[] = [
  // OSIBISA & GHANAIAN HIGHLIFE / AFRO-ROCK
  { title: 'Woyaya', artist: 'Osibisa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Sunshine Day', artist: 'Osibisa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Welcome Home', artist: 'Osibisa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'The Warrior', artist: 'Osibisa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Coffee Song', artist: 'Osibisa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Music for Gong Gong', artist: 'Osibisa', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Simigwa-Do', artist: 'Gyedu-Blay Ambolley', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Highlife Time', artist: 'Gyedu-Blay Ambolley', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Gyae Su', artist: 'Pat Thomas', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Yamona', artist: 'Pat Thomas & Kwashibu Area Band', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Kyenkyen Bi Adi M Awu', artist: 'Alhaji K. Frimpong', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'All For You', artist: 'E.T. Mensah', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'chill' },
  { title: 'Ghana Freedom', artist: 'E.T. Mensah', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Iron Boy', artist: 'Amakye Dede', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Bebrebe Yi', artist: 'Amakye Dede', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Dabi Dabi Ebeye Yie', artist: 'Amakye Dede', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Aben Wo Aha', artist: 'Daddy Lumba', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Yentie Obiaa', artist: 'Daddy Lumba', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Theresa', artist: 'Daddy Lumba', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Anokye', artist: 'Daddy Lumba', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },

  // MODERN GHANAIAN AFROBEATS & HIGHLIFE GIANTS
  { title: 'Angela', artist: 'Kuami Eugene', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Wish Me Well', artist: 'Kuami Eugene', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Confusion', artist: 'Kuami Eugene', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Monica', artist: 'Kuami Eugene', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Terminator', artist: 'King Promise', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'high' },
  { title: 'Paris', artist: 'King Promise', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'CCTV', artist: 'King Promise', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Favorite Story', artist: 'King Promise & Sarkodie', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Touch It', artist: 'KiDi', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'high' },
  { title: 'Enjoyment', artist: 'KiDi', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'high' },
  { title: 'Say Cheese', artist: 'KiDi', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Odo', artist: 'KiDi', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'medium' },
  { title: 'Mon Bebe', artist: 'KiDi', genre: 'romance_drama', mood: 'romance_drama', energyLevel: 'chill' },
  { title: 'Jejereje', artist: 'Stonebwoy', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Into The Future', artist: 'Stonebwoy', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Therapy', artist: 'Stonebwoy', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Activate', artist: 'Stonebwoy & Davido', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
  { title: 'Adonai (Remix)', artist: 'Sarkodie & Castro', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Country Side', artist: 'Sarkodie & Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Lucky', artist: 'Sarkodie & Rudeboy', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Pain Killer', artist: 'Sarkodie & Runtown', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Sugarcane (Remix)', artist: 'Camidoh', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'medium' },
  { title: 'Kwaku the Traveller', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Soja', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: '45', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Konongo Zongo', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'medium' },
  { title: 'Oil in My Head', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Simmer Down', artist: 'Black Sherif', genre: 'cinematic_thriller', mood: 'cinematic_thriller', energyLevel: 'high' },
  { title: 'Slow Down', artist: 'R2Bees & Wizkid', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'chill' },
  { title: 'Over', artist: 'R2Bees', genre: 'afrobeats_hits', mood: 'afrobeats_hits', energyLevel: 'high' },
  { title: 'Life (Walahi)', artist: 'R2Bees', genre: 'cultural_highlife', mood: 'cultural_highlife', energyLevel: 'high' },
  { title: 'Survivor', artist: 'Wendy Shay', genre: 'upbeat_energy', mood: 'upbeat_energy', energyLevel: 'high' },
];

async function queryItunes(title: string, artist: string) {
  try {
    const cleanTitle = title.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    const firstArtist = artist.split(/[,&]/)[0].trim();
    const term = `${cleanTitle} ${firstArtist}`;
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', term);
    url.searchParams.set('entity', 'song');
    url.searchParams.set('limit', '1');

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const hit = json?.results?.[0];
    if (!hit) return null;
    return {
      streamUrl: typeof hit.previewUrl === 'string' ? hit.previewUrl : null,
      artworkUrl: typeof hit.artworkUrl100 === 'string' ? hit.artworkUrl100.replace('100x100bb', '300x300bb') : null,
      durationMs: typeof hit.trackTimeMillis === 'number' ? hit.trackTimeMillis : null,
      actualTitle: typeof hit.trackName === 'string' ? hit.trackName : title,
      actualArtist: typeof hit.artistName === 'string' ? hit.artistName : artist,
    };
  } catch {
    return null;
  }
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function run() {
  const catalogPath = path.resolve(process.cwd(), 'api/_lib/social-studio/platforms/audio-catalog.ts');
  const code = fs.readFileSync(catalogPath, 'utf-8');

  // Parse existing catalog
  const match = code.match(/export const CURATED_AUDIO_CATALOG: CuratedAudioTrack\[\] = (\[[\s\S]*\]);/);
  if (!match) {
    throw new Error('Could not find CURATED_AUDIO_CATALOG array in audio-catalog.ts');
  }

  const existingTracks: any[] = JSON.parse(match[1]);
  console.log(`Current catalog has ${existingTracks.length} tracks.`);

  const seen = new Set(existingTracks.map(t => `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`));
  const added: any[] = [];

  for (const s of NEW_TRACKS) {
    const key = `${s.title.toLowerCase()}::${s.artist.toLowerCase()}`;
    if (seen.has(key)) {
      console.log(`Already in catalog: ${s.title} by ${s.artist}`);
      continue;
    }

    const hit = await queryItunes(s.title, s.artist);
    const audioId = `cat_${slugify(s.artist)}_${slugify(s.title)}`.slice(0, 60);

    const track = {
      audioId,
      audioType: 'music',
      title: hit?.actualTitle || s.title,
      artist: hit?.actualArtist || s.artist,
      genre: s.genre,
      mood: s.mood,
      energyLevel: s.energyLevel,
      durationMs: hit?.durationMs || 30000,
      artworkUrl: hit?.artworkUrl || null,
      previewUrl: hit?.streamUrl || null,
      isCurated: true,
    };

    added.push(track);
    seen.add(key);
    console.log(`+ Added: "${track.title}" by ${track.artist} (stream: ${Boolean(track.previewUrl)})`);
    await new Promise(r => setTimeout(r, 120));
  }

  const merged = [...existingTracks, ...added];
  const streamCount = merged.filter(t => t.previewUrl).length;

  console.log(`\nNew Total: ${merged.length} tracks (${streamCount} with playable preview streams).`);

  const tsContent = `// Auto-generated verified African & Nollywood Cinema Audio Catalog
// Total tracks: ${merged.length} (${streamCount} with verified instant playable audio streams)
// Covers Cultural Highlife & Epic Traditional (Nigeria & Ghana), Nollywood Soundtracks, Romance/Drama, Afrobeats Hits, Amapiano, Faith/Gospel, Cinematic Thriller.

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

export const CURATED_AUDIO_CATALOG: CuratedAudioTrack[] = ${JSON.stringify(merged, null, 2)};
`;

  fs.writeFileSync(catalogPath, tsContent, 'utf-8');
  console.log(`Successfully updated ${catalogPath}!`);
}

run().catch(console.error);
