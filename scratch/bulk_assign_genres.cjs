const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Fetching all films...');
  let allFilms = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, synopsis')
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (error) {
      console.error('Error fetching films:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    allFilms = allFilms.concat(data);
    page++;
    console.log(`Fetched ${allFilms.length} films...`);
  }

  console.log(`Total films to process: ${allFilms.length}`);

  console.log('Fetching existing genres...');
  const { data: dbGenres, error: genreError } = await supabase.from('genres').select('id, name');
  if (genreError) {
    console.error('Error fetching genres:', genreError);
    return;
  }
  
  const genreMap = {};
  for (const g of dbGenres) {
    genreMap[g.name.toLowerCase()] = g.id;
  }

  // Keywords map
  const genreKeywords = {
    'action': ['action', 'fight', 'revenge', 'survival', 'combat', 'war', 'battle', 'police', 'agent', 'assassin', 'gun', 'kidnap', 'shoot', 'chase'],
    'comedy': ['comedy', 'humor', 'satire', 'funny', 'laugh', 'hilarious', 'joke', 'wedding', 'crazy'],
    'drama': ['drama', 'family', 'betrayal', 'relationships', 'struggle', 'life', 'marriage', 'tear', 'emotional', 'tragedy', 'mother', 'father', 'sister', 'brother'],
    'horror': ['horror', 'supernatural', 'juju', 'spirit', 'witchcraft', 'ghost', 'scary', 'demon', 'curse', 'evil', 'blood', 'ritual', 'shrine'],
    'romance': ['romance', 'love', 'heartbreak', 'marriage', 'lover', 'wedding', 'kiss', 'passion', 'couple', 'wife', 'husband', 'fiance'],
    'crime': ['crime', 'fraud', 'kidnapping', 'corruption', 'thief', 'robber', 'steal', 'drug', 'cartel', 'murder', 'killer', 'gang', 'police', 'detective', 'investigation'],
    'thriller': ['thriller', 'psychological', 'suspense', 'tension', 'mystery', 'mind games', 'secret', 'hide', 'dark', 'twist'],
    'epic': ['epic', 'historical', 'kings', 'warriors', 'tradition', 'village', 'kingdom', 'prince', 'princess', 'royal', 'throne', 'crown', 'palace', 'chief', 'igwe', 'oba'],
    'faith': ['religious', 'faith', 'church', 'pastor', 'pray', 'god', 'miracle', 'prophet', 'belief', 'christian', 'islam', 'muslim'],
    'social issue': ['social', 'advocacy', 'poverty', 'injustice', 'society', 'struggle', 'rights', 'abuse', 'protest'],
    'melodrama': ['melodrama', 'tears', 'emotional', 'heartbreak', 'tragedy', 'sad', 'crying', 'sorrow'],
    'urban': ['urban', 'lifestyle', 'city', 'lagos', 'modern', 'rich', 'wealth', 'party', 'club', 'hustle', 'street'],
    'romcom': ['romantic comedy', 'romcom', 'love', 'funny', 'laugh', 'couple', 'dating'],
    'mystery': ['mystery', 'secret', 'investigation', 'clue', 'hidden', 'truth', 'detective', 'murder'],
    'musical': ['musical', 'music', 'song', 'sing', 'dance', 'band', 'artist', 'choir'],
    'family': ['family', 'kids', 'children', 'parents', 'home', 'together', 'bonding']
  };

  // Find films that already have genres
  console.log('Fetching existing film_genres...');
  const { data: existingAssignments } = await supabase.from('film_genres').select('film_id');
  const assignedFilmIds = new Set((existingAssignments || []).map(a => a.film_id));
  console.log(`${assignedFilmIds.size} films already have genres assigned.`);

  const unassignedFilms = allFilms.filter(f => !assignedFilmIds.has(f.id));
  console.log(`${unassignedFilms.length} films need genre assignments.`);

  const newAssignments = [];
  
  for (const film of unassignedFilms) {
    const textToSearch = `${film.title || ''} ${film.synopsis || ''}`.toLowerCase();
    
    // Check all genres
    const matchedGenres = new Set();
    
    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (textToSearch.includes(genre)) {
        matchedGenres.add(genre);
      }
      
      for (const kw of keywords) {
        // Use word boundaries to avoid partial matches like "scary" matching "car"
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(textToSearch)) {
          matchedGenres.add(genre);
          break; // Stop checking keywords for this genre if one matched
        }
      }
    }
    
    // Default to Drama if nothing matched
    if (matchedGenres.size === 0) {
      matchedGenres.add('drama');
    }
    
    // Pick at most 3 genres
    let genresToAssign = Array.from(matchedGenres).slice(0, 3);
    
    // Some specific mapping adjustments
    if (genresToAssign.includes('romcom')) {
      genresToAssign = genresToAssign.filter(g => g !== 'romcom');
      genresToAssign.push('romcom'); // Ensure we use the exact key if mapped differently in DB
    }
    
    for (const g of genresToAssign) {
      let dbName = g;
      if (g === 'social issue') dbName = 'social issue';
      
      // Match with DB names
      const genreId = genreMap[dbName] || genreMap['drama']; // Fallback
      
      newAssignments.push({
        film_id: film.id,
        genre_id: genreId
      });
    }
  }

  // Deduplicate new assignments just in case
  const uniqueAssignmentsMap = new Map();
  for (const item of newAssignments) {
    const key = `${item.film_id}_${item.genre_id}`;
    uniqueAssignmentsMap.set(key, item);
  }
  const uniqueAssignments = Array.from(uniqueAssignmentsMap.values());

  console.log(`Ready to insert ${uniqueAssignments.length} genre assignments.`);

  // Insert in batches of 1000
  const insertBatchSize = 1000;
  for (let i = 0; i < uniqueAssignments.length; i += insertBatchSize) {
    const batch = uniqueAssignments.slice(i, i + insertBatchSize);
    console.log(`Inserting batch ${Math.floor(i / insertBatchSize) + 1} of ${Math.ceil(uniqueAssignments.length / insertBatchSize)}...`);
    
    const { error } = await supabase.from('film_genres').upsert(batch, { onConflict: 'film_id,genre_id', ignoreDuplicates: true });
    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / insertBatchSize) + 1}:`, error);
    } else {
      console.log(`Batch ${Math.floor(i / insertBatchSize) + 1} inserted successfully.`);
    }
  }

  console.log('All done!');
}

run();
