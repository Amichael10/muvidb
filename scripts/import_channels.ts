import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

const CATEGORY_MAP: Record<string, string> = {
  'Film': 'Movies',
  'Entertainment': 'Movies',
  'Television_program': 'Series',
  'Politics': 'Movies',
  'Society': 'Movies',
  'Comedy': 'Comedy',
  'Movies': 'Movies',
  'Series': 'Series',
  'Yoruba': 'Yoruba',
  'Faith': 'Faith',
  'Celebrity': 'Celebrity',
  'Network': 'Network',
  'Music': 'Music',
  'Studio': 'Studio',
  'skit_maker': 'skit_maker'
};

async function run() {
  const csvPath = path.resolve(__dirname, '../public/assets/african-film-channels-1782082402928.csv');
  console.log('Reading CSV file from:', csvPath);
  
  if (!fs.existsSync(csvPath)) {
    console.error('Error: CSV file not found.');
    return;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  console.log('Parsing CSV content...');
  
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data as any[];
  console.log(`Parsed ${rows.length} channels from CSV.`);

  console.log('Fetching existing channels from Supabase...');
  const { data: existing, error: fetchErr } = await supabase
    .from('channels')
    .select('channel_id, slug');

  if (fetchErr) {
    console.error('Error fetching existing channels:', fetchErr.message);
    return;
  }

  const existingChannelIds = new Set(existing?.map(c => c.channel_id).filter(Boolean) || []);
  const existingSlugs = new Set(existing?.map(c => c.slug).filter(Boolean) || []);

  console.log(`Found ${existingChannelIds.size} existing channels in DB.`);

  const channelsToInsert = [];
  let skippedDuplicates = 0;

  for (const row of rows) {
    if (!row.channel_id) continue;
    
    // Deduplicate by channel_id
    if (existingChannelIds.has(row.channel_id)) {
      skippedDuplicates++;
      continue;
    }

    // Generate unique slug
    let baseSlug = slugify(row.title || 'channel');
    if (!baseSlug) baseSlug = 'channel';
    
    let slug = baseSlug;
    let count = 1;
    while (existingSlugs.has(slug)) {
      slug = `${baseSlug}-${count}`;
      count++;
    }
    existingSlugs.add(slug);

    const channelUrl = row.handle 
      ? `https://youtube.com/${row.handle}` 
      : `https://youtube.com/channel/${row.channel_id}`;

    channelsToInsert.push({
      name: row.title || 'Unnamed Channel',
      channel_handle: row.handle || null,
      channel_url: channelUrl,
      description: row.description || null,
      category: CATEGORY_MAP[row.category] || 'Movies',
      country: row.country || 'Nigeria',
      subscriber_count: row.subscriber_count ? parseInt(row.subscriber_count, 10) : null,
      thumbnail_url: row.logo_url || null,
      banner_url: row.backdrop_url || null,
      channel_id: row.channel_id,
      slug: slug,
      is_featured: false,
    });
  }

  console.log(`Deduplication complete:`);
  console.log(`- Skipped ${skippedDuplicates} existing channels.`);
  console.log(`- Prepared ${channelsToInsert.length} new channels for import.`);

  if (channelsToInsert.length === 0) {
    console.log('No new channels to import.');
    return;
  }

  // Batch insert in chunks of 100
  const BATCH_SIZE = 100;
  let insertedCount = 0;

  for (let i = 0; i < channelsToInsert.length; i += BATCH_SIZE) {
    const batch = channelsToInsert.slice(i, i + BATCH_SIZE);
    console.log(`Inserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(channelsToInsert.length / BATCH_SIZE)} (${batch.length} channels)...`);
    
    const { error: insertErr } = await supabase
      .from('channels')
      .insert(batch);

    if (insertErr) {
      console.error(`Error inserting batch starting at index ${i}:`, insertErr.message);
    } else {
      insertedCount += batch.length;
    }
  }

  console.log(`\n🎉 Import Complete! Successfully imported ${insertedCount} new channels.`);
}

run().catch(console.error);
