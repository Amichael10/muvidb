import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function cleanSynopsis(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // 1. Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '');
  
  // 2. Remove common YouTube boilerplate phrases (case-insensitive)
  const boilerplates = [
    /subscribe (to|here)[\s\S]*/gi,
    /follow (us|me) on[\s\S]*/gi,
    /don't forget to subscribe[\s\S]*/gi,
    /watch more (videos|movies)[\s\S]*/gi,
    /click (here )?to subscribe[\s\S]*/gi,
    /instagram:[\s\S]*/gi,
    /twitter:[\s\S]*/gi,
    /facebook:[\s\S]*/gi,
    /tiktok:[\s\S]*/gi,
    /all rights reserved[\s\S]*/gi,
    /copyright[\s\S]*/gi,
    /starring:[\s\S]*/gi,  // We have structured cast data
    /cast:[\s\S]*/gi,
    /directed by:[\s\S]*/gi,
    /produced by:[\s\S]*/gi,
    /written by:[\s\S]*/gi,
    /executive producer:[\s\S]*/gi,
    /crew:[\s\S]*/gi,
    /business inquiries:[\s\S]*/gi,
    /sponsored by:[\s\S]*/gi,
    /support us on:[\s\S]*/gi,
    /support our channel:[\s\S]*/gi,
    /join our members[\s\S]*/gi,
    /join this channel[\s\S]*/gi,
    /buy merchandise[\s\S]*/gi,
    /merch store[\s\S]*/gi,
  ];

  for (const regex of boilerplates) {
    cleaned = cleaned.replace(regex, '');
  }

  // 3. Remove hashtags
  cleaned = cleaned.replace(/#[a-z0-9_]+/gi, '');

  // 4. Remove dashed lines or repeating characters that usually denote the end of synopsis
  cleaned = cleaned.replace(/[-=_*~]{4,}[\s\S]*/g, '');

  // 5. Clean up extra newlines and whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

async function runCleanup() {
  console.log('Starting synopsis cleanup for YouTube films...');

  let updatedCount = 0;
  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  let hasMore = true;
  let lastId = '00000000-0000-0000-0000-000000000000'; // Assuming UUIDs, but we can just order by ID

  while (hasMore) {
    const { data: films, error: fetchErr } = await supabase
      .from('films')
      .select('id, title, synopsis')
      .eq('source', 'youtube')
      .not('synopsis', 'is', null)
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      console.error('Error fetching films:', fetchErr);
      process.exit(1);
    }

    if (!films || films.length === 0) {
      hasMore = false;
      break;
    }

    totalProcessed += films.length;
    lastId = films[films.length - 1].id;

    console.log(`Processing batch of ${films.length}...`);

    for (const film of films) {
      if (!film.synopsis) continue;
      
      const cleaned = cleanSynopsis(film.synopsis);
      
      // Only update if there was a change
      if (cleaned !== film.synopsis) {
        console.log(`Cleaning: ${film.title}`);
        
        const { error: updateErr } = await supabase
          .from('films')
          .update({ synopsis: cleaned })
          .eq('id', film.id);
          
        if (updateErr) {
          console.error(`Failed to update ${film.title}:`, updateErr);
        } else {
          updatedCount++;
        }
      }
    }
  }

  console.log(`\nCleanup complete! Processed ${totalProcessed} films, updated ${updatedCount} films.`);
}

runCleanup();
