import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fixCorruptedWords() {
  console.log('🛠️ Repairing any corrupted word patterns in film titles...');

  // 1. Fix "birt ay" -> "birthday"
  const { data: bFilms } = await supabase.from('films').select('id, title').ilike('title', '%birt ay%');
  if (bFilms && bFilms.length > 0) {
    for (const f of bFilms) {
      const fixedTitle = f.title.replace(/birt ay/gi, 'birthday');
      await supabase.from('films').update({ title: fixedTitle }).eq('id', f.id);
      console.log(`  Fixed title: "${f.title}" -> "${fixedTitle}"`);
    }
  }

  console.log('✅ Word repair finished!');
}

fixCorruptedWords();
