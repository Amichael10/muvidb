import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function createSlug(name) {
  if (!name) return null;
  return name.toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateSqlForChannels() {
  const { data: rows, error: fetchError } = await supabase
    .from('channels')
    .select('id, name')
    .is('mubi_slug', null);

  if (fetchError || !rows) {
    console.error("Error fetching channels:", fetchError);
    return;
  }

  let sqlStatements = "";
  const usedSlugs = new Set();

  for (const row of rows) {
    let baseSlug = createSlug(row.name);
    if (!baseSlug) continue;

    let finalSlug = baseSlug;
    let counter = 1;
    while (usedSlugs.has(finalSlug)) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    // Check if it already exists in the DB just in case
    const { data: existing } = await supabase
      .from('channels')
      .select('id')
      .eq('mubi_slug', finalSlug)
      .maybeSingle();

    if (existing) {
       counter++;
       finalSlug = `${baseSlug}-${counter}`;
    }

    usedSlugs.add(finalSlug);
    sqlStatements += `UPDATE channels SET mubi_slug = '${finalSlug.replace(/'/g, "''")}' WHERE id = '${row.id}';\n`;
  }

  fs.writeFileSync('update_channels.sql', sqlStatements);
  console.log("update_channels.sql created with " + rows.length + " statements.");
}

generateSqlForChannels();
