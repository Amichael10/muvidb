import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function createSlug(name) {
  if (!name) return null;
  return name.toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with a single hyphen
    .replace(/^-+|-+$/g, ''); // Trim hyphens
}

async function processTable(tableName, nameColumn) {
  console.log(`Processing ${tableName}...`);
  
  // Fetch all rows where mubi_slug is null
  const { data: rows, error: fetchError } = await supabase
    .from(tableName)
    .select(`id, ${nameColumn}`)
    .is('mubi_slug', null);

  if (fetchError) {
    console.error(`Error fetching ${tableName}:`, fetchError);
    return;
  }

  if (!rows || rows.length === 0) {
    console.log(`No records in ${tableName} need a slug.`);
    return;
  }

  console.log(`Found ${rows.length} ${tableName} to update.`);

  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    const baseSlug = createSlug(row[nameColumn]);
    if (!baseSlug) continue;

    let finalSlug = baseSlug;
    let counter = 1;
    let isUnique = false;

    // Keep checking until we find a unique slug
    while (!isUnique) {
      const { data: existing, error: checkError } = await supabase
        .from(tableName)
        .select('id')
        .eq('mubi_slug', finalSlug)
        .neq('id', row.id)
        .maybeSingle();
      
      if (checkError) {
        console.error(`Error checking slug for ${row.id}:`, checkError);
        break;
      }

      if (!existing) {
        isUnique = true;
      } else {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    if (isUnique) {
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ mubi_slug: finalSlug })
        .eq('id', row.id);

      if (updateError) {
        console.error(`Error updating ${row.id} (${row[nameColumn]}):`, updateError);
        errorCount++;
      } else {
        console.log(`Updated ${tableName}: ${row[nameColumn]} -> ${finalSlug}`);
        successCount++;
      }
    }
  }

  console.log(`Finished ${tableName}. Success: ${successCount}, Errors: ${errorCount}`);
}

async function main() {
  await processTable('companies', 'name');
  await processTable('channels', 'name');
  console.log('All done!');
}

main().catch(console.error);
