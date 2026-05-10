import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { cleanTitle } from '../api/_lib/yt_service.ts';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function autoMapBuffer() {
  console.log('🚀 Starting Buffer Auto-Mapper...');

  let mappedCount = 0;
  let createdCount = 0;
  let errorCount = 0;

  while (true) {
    const { data: signals, error: signalError } = await supabase
      .from('channel_videos')
      .select('*')
      .is('film_id', null)
      .order('published_at', { ascending: false })
      .limit(1000);

    if (signalError) {
      console.error('❌ Error fetching signals:', signalError.message);
      break;
    }

    if (!signals || signals.length === 0) {
      console.log('✅ Buffer is empty. Nothing to map.');
      break;
    }

    console.log(`📋 Processing batch of ${signals.length} unmapped signals...\n`);

    for (const signal of signals) {
    try {
      const rawTitle = signal.title;
      const cleanedTitle = cleanTitle(rawTitle);
      
      if (!cleanedTitle || cleanedTitle.length < 2) {
        console.log(`  ⚠️ Skipping "${rawTitle}" - cleaned title too short.`);
        continue;
      }

      console.log(`🔍 Processing: "${rawTitle}"`);
      console.log(`   -> Cleaned: "${cleanedTitle}"`);

      // 2. Check if film exists (case-insensitive)
      const { data: existingFilms, error: searchError } = await supabase
        .from('films')
        .select('id, title, streaming_links')
        .ilike('title', cleanedTitle);

      if (searchError) {
        console.error(`  ❌ Error searching for "${cleanedTitle}":`, searchError.message);
        errorCount++;
        continue;
      }

      let filmId: string;

      if (existingFilms && existingFilms.length > 0) {
        // Link to existing film
        const existing = existingFilms[0];
        filmId = existing.id;
        console.log(`  🔗 Found existing film: "${existing.title}" (ID: ${filmId})`);
        
        // Update existing film's streaming links if needed
        const currentLinks = existing.streaming_links || {};
        if (!currentLinks.youtube) {
          await supabase.from('films').update({
            streaming_links: { ...currentLinks, youtube: `https://www.youtube.com/watch?v=${signal.video_id}` },
            youtube_watch_url: `https://www.youtube.com/watch?v=${signal.video_id}`
          }).eq('id', filmId);
        }
        
        mappedCount++;
      } else {
        // Create new film record
        console.log(`  ✨ No match found. Creating new film record...`);
        const { data: newFilm, error: createError } = await supabase
          .from('films')
          .insert({
            title: cleanedTitle,
            synopsis: signal.description || '',
            poster_url: signal.thumbnail_url || '',
            backdrop_url: signal.thumbnail_url || '',
            source: 'youtube_buffer',
            source_video_id: signal.video_id,
            youtube_watch_url: `https://www.youtube.com/watch?v=${signal.video_id}`,
            status: 'released',
            release_type: 'youtube',
            needs_review: false,
            countries: ['Nigeria'],
            streaming_links: {
              youtube: `https://www.youtube.com/watch?v=${signal.video_id}`
            }
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`  ❌ Error creating film for "${cleanedTitle}":`, createError.message);
          errorCount++;
          continue;
        }

        filmId = newFilm.id;
        console.log(`  ✅ Created: (ID: ${filmId})`);
        createdCount++;
      }

      // 3. Update signal with film_id to remove it from buffer
      const { error: linkError } = await supabase
        .from('channel_videos')
        .update({ film_id: filmId })
        .eq('id', signal.id);

      if (linkError) {
        console.error(`  ❌ Error linking signal ${signal.id} to film ${filmId}:`, linkError.message);
        errorCount++;
      } else {
        console.log(`  📍 Linked and removed from buffer.`);
      }
      
      console.log('---');
    } catch (err) {
      console.error(`  ❌ Unexpected error processing signal ${signal.id}:`, err);
      errorCount++;
    }
  }
  // small delay between batches
  await new Promise(resolve => setTimeout(resolve, 500));
}

  console.log('\n======================================');
  console.log('✅ Buffer Auto-Mapping Complete!');
  console.log(`✨ New Films Created:       ${createdCount}`);
  console.log(`🔗 Existing Films Linked:   ${mappedCount}`);
  console.log(`❌ Errors Encountered:      ${errorCount}`);
  console.log('======================================\n');
}

autoMapBuffer().catch(console.error);
