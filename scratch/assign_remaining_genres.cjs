const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pkenrmorywmuvnzfoylp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZW5ybW9yeXdtdXZuemZveWxwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIyODE1NCwiZXhwIjoyMDkwODA0MTU0fQ.yy7yeue7zZe6nsa-UmZUiPtw0tjF_6QgdA4rsLBLYEE'
);

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

async function fetchAllFilms() {
  const allFilms = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, synopsis')
      .range(from, from + pageSize - 1)
      .order('id');
    
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    
    allFilms.push(...data);
    console.log(`  Fetched ${allFilms.length} films...`);
    
    if (data.length < pageSize) break;
    from += pageSize;
  }
  
  return allFilms;
}

async function run() {
  // Get genre map
  const { data: allGenres } = await supabase.from('genres').select('*');
  const genreMap = {};
  allGenres.forEach(g => { genreMap[g.name] = g.id; });

  // Get existing assignments
  const { data: existingAssignments } = await supabase.from('film_genres').select('film_id, genre_id');
  const existingKeys = new Set(existingAssignments?.map(a => `${a.film_id}:${a.genre_id}`) || []);
  const filmsWithGenres = new Set(existingAssignments?.map(a => a.film_id) || []);
  
  console.log(`Films already with genres: ${filmsWithGenres.size}`);

  // Get ALL films (paginated)
  console.log('Fetching all films...');
  const allFilms = await fetchAllFilms();
  console.log(`Total films: ${allFilms.length}`);

  const filmsWithoutGenres = allFilms.filter(f => !filmsWithGenres.has(f.id));
  console.log(`Films without genres: ${filmsWithoutGenres.length}`);

  if (filmsWithoutGenres.length === 0) {
    console.log('All films already have genres!');
    return;
  }

  const assignments = [];
  for (const film of filmsWithoutGenres) {
    const searchText = `${film.title || ''} ${film.synopsis || ''}`.toLowerCase();
    const matchedGenres = [];

    for (const [genreName, keywords] of Object.entries(GENRE_KEYWORDS)) {
      const genreId = genreMap[genreName];
      if (!genreId) continue;
      const key = `${film.id}:${genreId}`;
      if (existingKeys.has(key)) continue;

      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          matchedGenres.push({ film_id: film.id, genre_id: genreId });
          break;
        }
      }
    }

    if (matchedGenres.length === 0) {
      matchedGenres.push({ film_id: film.id, genre_id: genreMap['Drama'] });
    }

    assignments.push(...matchedGenres.slice(0, 3));
  }

  console.log(`Generated ${assignments.length} new assignments`);

  const BATCH_SIZE = 500;
  let total = 0;
  for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
    const batch = assignments.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('film_genres').insert(batch);
    if (error) {
      console.error(`Batch error:`, error.message);
      // Try singles
      let ok = 0;
      for (const item of batch) {
        const { error: e } = await supabase.from('film_genres').insert(item);
        if (!e) ok++;
      }
      total += ok;
    } else {
      total += batch.length;
    }
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} done (${total} total)`);
  }

  console.log(`\n✅ Assigned genres to ${filmsWithoutGenres.length} remaining films (${total} assignments)`);

  // Final distribution
  const { data: finalGenres } = await supabase.from('film_genres').select('genre_id, genres(name)');
  const dist = {};
  (finalGenres || []).forEach(fg => {
    const name = fg.genres?.name || 'Unknown';
    dist[name] = (dist[name] || 0) + 1;
  });
  console.log('\n📊 Final Genre Distribution:');
  Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log(`  ${name}: ${count} films`);
  });
}

run().catch(console.error);
