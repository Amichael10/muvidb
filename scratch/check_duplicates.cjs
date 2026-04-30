
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDuplicates() {
  const { data, error } = await supabase
    .from('films')
    .select('id, title, source_video_id')
    .not('source_video_id', 'is', null);

  if (error) {
    console.error('Error fetching films:', error);
    return;
  }

  console.log(`Found ${data.length} films with source_video_id`);
  
  const counts = {};
  data.forEach(f => {
    counts[f.source_video_id] = (counts[f.source_video_id] || 0) + 1;
    if (f.source_video_id === '') {
        console.log('Found film with empty string source_video_id:', f.id, f.title);
    }
  });

  const duplicates = Object.entries(counts).filter(([id, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('Duplicates found:', duplicates);
  } else {
    console.log('No duplicates found in the fetched data (this is expected if the constraint is working)');
  }

  // Check if any has null but maybe we should check for 'null' as string?
  const { data: weird } = await supabase
    .from('films')
    .select('id, title')
    .eq('source_video_id', '');
  
  if (weird && weird.length > 0) {
    console.log('Found records with empty string as source_video_id:', weird);
  }
}

checkDuplicates();
