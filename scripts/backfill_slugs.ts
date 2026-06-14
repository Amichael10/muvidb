import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function backfillTable(tableName: string, nameColumn: string) {
  console.log(`\nBackfilling ${tableName}...`);
  const { data, error } = await supabase
    .from(tableName)
    .select(`id, ${nameColumn}, mubi_slug`)
    .is('mubi_slug', null);

  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return;
  }

  if (!data || data.length === 0) {
    console.log(`No records need backfilling in ${tableName}`);
    return;
  }

  console.log(`Found ${data.length} records to update in ${tableName}`);

  const batchSize = 3;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    console.log(`Processing ${tableName} batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(data.length / batchSize)}...`);
    
    await Promise.all(batch.map(async (record) => {
      const rawName = record[nameColumn];
      if (!rawName) return;
      
      let baseSlug = generateSlug(rawName);
      let finalSlug = baseSlug;
      let counter = 1;
      let success = false;

      while (!success) {
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ mubi_slug: finalSlug })
          .eq('id', record.id);

        if (updateError) {
          if (updateError.code === '23505') { // Unique violation
            finalSlug = `${baseSlug}-${counter}`;
            counter++;
          } else {
            console.error(`Error updating ${record.id}:`, updateError);
            break; // Stop retrying on non-unique errors
          }
        } else {
          success = true;
        }
      }
    }));
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  console.log(`Finished backfilling ${tableName}!`);
}

async function main() {
  await backfillTable('films', 'title');
  await backfillTable('people', 'name');
  await backfillTable('companies', 'name');
  await backfillTable('channels', 'name');
  console.log('\nBackfill complete!');
}

main().catch(console.error);
