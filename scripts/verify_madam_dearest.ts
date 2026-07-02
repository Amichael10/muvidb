import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data: films } = await supabase
    .from('films')
    .select('id, title, streaming_links, source, release_type, poster_url, synopsis')
    .ilike('title', '%Madam Dearest%');

  console.log('🔍 Madam Dearest Search Results:');
  console.log(JSON.stringify(films, null, 2));
}

run();
