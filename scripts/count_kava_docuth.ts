import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { count: kavaCount } = await supabase
    .from('films')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'kava');

  const { data: docuthFilms } = await supabase
    .from('films')
    .select('title, streaming_links')
    .or('release_type.eq.docuth,source.eq.docuth_sync');

  console.log(`📊 Films in database:`);
  console.log(`   - Kava.tv source count: ${kavaCount}`);
  console.log(`   - Docuth source count: ${docuthFilms?.length || 0}`);
  
  if (docuthFilms && docuthFilms.length > 0) {
    console.log('\n📄 Docuth films:');
    docuthFilms.forEach((f, idx) => {
      console.log(`     ${idx + 1}. ${f.title}`);
    });
  }
}

run();
