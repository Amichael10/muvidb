const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pkenrmorywmuvnzfoylp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZW5ybW9yeXdtdXZuemZveWxwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIyODE1NCwiZXhwIjoyMDkwODA0MTU0fQ.yy7yeue7zZe6nsa-UmZUiPtw0tjF_6QgdA4rsLBLYEE'
);

// All 16 genres the user wants
const ALL_GENRES = [
  'Drama', 'Romance', 'Comedy', 'Horror', 'Crime', 'Action',
  'Thriller', 'Epic', 'Faith', 'Social Issue',
  'Melodrama', 'Urban', 'RomCom', 'Mystery',
  'Musical', 'Family'
];

// Keyword patterns for auto-genre assignment (case-insensitive matching on title + synopsis)
const GENRE_KEYWORDS = {
  'Action': ['action', 'fight', 'battle', 'war', 'warrior', 'combat', 'revenge', 'eagle wings', 'brotherhood', 'black book', 'bloody', 'blood war', 'fire force', 'cobra', 'attack'],
  'Comedy': ['comedy', 'funny', 'laugh', 'hilarious', 'humor', 'humour', 'comic', 'skit', 'brainjotter', 'chief daddy', 'my village people', 'trip to jamaica', 'sabinus', 'mr macaroni', 'mark angel', 'brodashaggi', 'broda shaggi', 'xploit'],
  'Drama': ['drama', 'family', 'betrayal', 'survival', 'relationship', 'life', 'story', 'tale', 'journey', 'struggle', 'tears', 'sorrow', 'pain', 'heart', 'destiny', 'fate'],
  'Romance': ['romance', 'love', 'lover', 'heart', 'wedding', 'marry', 'marriage', 'husband', 'wife', 'girlfriend', 'boyfriend', 'dating', 'crush', 'fell in love', 'true love', 'romantic', 'isoken', 'sylvia'],
  'Horror': ['horror', 'ghost', 'spirit', 'demon', 'evil', 'witch', 'witchcraft', 'juju', 'voodoo', 'ritual', 'curse', 'haunted', 'scary', 'living in bondage', 'nneka', 'koi koi', 'skull', 'dark magic', 'occult'],
  'Crime': ['crime', 'criminal', 'fraud', 'kidnap', 'corrupt', 'gangster', 'gang', 'robbery', 'thief', 'steal', 'police', 'detective', 'drug', 'cartel', 'mafia', 'king of boys', 'omo ghetto', 'shanty town', 'yahoo'],
  'Thriller': ['thriller', 'suspense', 'tension', 'mystery', 'mind game', 'psychological', 'figurine', 'gone', 'twist', 'dangerous', 'deadly', 'secret'],
  'Epic': ['epic', 'historical', 'history', 'king', 'queen', 'kingdom', 'palace', 'throne', 'warrior', 'tradition', 'ancient', 'anikulapo', 'invasion 1897', 'amina', 'maiden', 'virgin', 'gods', 'deity', 'oracle'],
  'Faith': ['faith', 'christian', 'church', 'pray', 'prayer', 'god', 'jesus', 'pastor', 'miracle', 'spiritual', 'mount zion', 'abejoye', 'grace', 'salvation', 'redemption', 'religious'],
  'Social Issue': ['social', 'issue', 'society', 'rape', 'abuse', 'violence', 'domestic', 'poverty', 'injustice', 'justice', 'rights', 'corruption', 'advocacy', 'oloture', 'dry'],
  'Melodrama': ['melodrama', 'emotion', 'tragedy', 'tragic', 'weep', 'cry', 'painful', 'agony', 'suffering', 'ije'],
  'Urban': ['urban', 'lagos', 'city life', 'hustle', 'wealth', 'rich', 'billionaire', 'millionaire', 'money', 'sugar rush', 'smart money'],
  'RomCom': ['romcom', 'rom-com', 'romantic comedy', 'hire a woman', 'set up', 'funny love'],
  'Mystery': ['mystery', 'clue', 'investigate', 'investigation', 'detective', 'whodunit', 'october 1', 'uncover', 'secret'],
  'Musical': ['musical', 'music', 'song', 'sing', 'concert', 'dance', 'flower girl'],
  'Family': ['family', 'kid', 'kids', 'children', 'child', 'cartoon', 'animation', 'makemation', 'family-friendly', 'wholesome']
};

async function run() {
  console.log('🎭 Step 1: Adding missing genres to DB...');

  // Get existing genres
  const { data: existingGenres } = await supabase.from('genres').select('*');
  const existingNames = new Set(existingGenres.map(g => g.name));

  const missingGenres = ALL_GENRES.filter(g => !existingNames.has(g));
  console.log('  Missing genres:', missingGenres);

  if (missingGenres.length > 0) {
    const { data: inserted, error } = await supabase
      .from('genres')
      .insert(missingGenres.map(name => ({ name })))
      .select();
    if (error) {
      console.error('  Error inserting genres:', error.message);
    } else {
      console.log(`  ✅ Inserted ${inserted.length} new genres`);
    }
  }

  // Re-fetch all genres for mapping
  const { data: allGenres } = await supabase.from('genres').select('*');
  const genreMap = {};
  allGenres.forEach(g => { genreMap[g.name] = g.id; });
  console.log('\n📋 All genres in DB:', Object.keys(genreMap).join(', '));

  // Step 2: Get all films without genres
  console.log('\n🎬 Step 2: Fetching films without genre assignments...');
  
  // Get all film_genres to know which films already have genres
  const { data: existingAssignments } = await supabase.from('film_genres').select('film_id');
  const filmsWithGenres = new Set(existingAssignments?.map(a => a.film_id) || []);

  // Get all films
  const { data: allFilms } = await supabase
    .from('films')
    .select('id, title, synopsis')
    .order('title');

  const filmsWithoutGenres = allFilms.filter(f => !filmsWithGenres.has(f.id));
  console.log(`  Total films: ${allFilms.length}`);
  console.log(`  Films without genres: ${filmsWithoutGenres.length}`);

  // Step 3: Auto-assign genres based on keywords
  console.log('\n🏷️ Step 3: Auto-assigning genres based on title/synopsis keywords...');
  
  const assignments = [];
  let assignedCount = 0;

  for (const film of filmsWithoutGenres) {
    const searchText = `${film.title || ''} ${film.synopsis || ''}`.toLowerCase();
    const matchedGenres = [];

    for (const [genreName, keywords] of Object.entries(GENRE_KEYWORDS)) {
      const genreId = genreMap[genreName];
      if (!genreId) continue;

      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          matchedGenres.push({ film_id: film.id, genre_id: genreId });
          break; // Only match once per genre
        }
      }
    }

    // If no specific genre matched, assign Drama as default (most Nollywood films are drama)
    if (matchedGenres.length === 0) {
      matchedGenres.push({ film_id: film.id, genre_id: genreMap['Drama'] });
    }

    // Limit to max 3 genres per film
    assignments.push(...matchedGenres.slice(0, 3));
    assignedCount++;
  }

  console.log(`  Generated ${assignments.length} genre assignments for ${assignedCount} films`);

  // Insert in batches of 500
  const BATCH_SIZE = 500;
  let insertedTotal = 0;
  for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
    const batch = assignments.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('film_genres').upsert(batch, { onConflict: 'film_id,genre_id', ignoreDuplicates: true });
    if (error) {
      console.error(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      // Try inserting one by one for this batch
      let singles = 0;
      for (const item of batch) {
        const { error: singleErr } = await supabase.from('film_genres').insert(item);
        if (!singleErr) singles++;
      }
      insertedTotal += singles;
      console.log(`    Recovered ${singles}/${batch.length} via single insert`);
    } else {
      insertedTotal += batch.length;
      console.log(`  ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} assignments`);
    }
  }

  console.log(`\n✅ Done! Total genre assignments created: ${insertedTotal}`);
  
  // Summary of genre distribution
  console.log('\n📊 Genre Distribution:');
  const { data: finalGenres } = await supabase
    .from('film_genres')
    .select('genre_id, genres(name)');
  
  const distribution = {};
  (finalGenres || []).forEach(fg => {
    const name = fg.genres?.name || 'Unknown';
    distribution[name] = (distribution[name] || 0) + 1;
  });
  
  Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      console.log(`  ${name}: ${count} films`);
    });
}

run().catch(console.error);
