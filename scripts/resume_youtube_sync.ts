import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function resumeSync() {
  const jsonPath = path.resolve(__dirname, 'data/previously_enabled_channels.json');
  if (!fs.existsSync(jsonPath)) {
    console.error("No backup file found at:", jsonPath);
    process.exit(1);
  }

  const channels: { id: string; name: string }[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${channels.length} previously enabled channel IDs from backup.`);

  const channelIds = channels.map(c => c.id);
  
  // Batch update in chunks of 200
  let updatedCount = 0;
  const chunkSize = 200;
  for (let i = 0; i < channelIds.length; i += chunkSize) {
    const chunk = channelIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('channels')
      .update({ sync_enabled: true })
      .in('id', chunk)
      .select('id');
    
    if (error) {
      console.error(`Error updating chunk ${i}:`, error.message);
    } else {
      updatedCount += data?.length || 0;
    }
  }

  console.log(`✅ Successfully restored sync_enabled = true for exactly ${updatedCount} active channels.`);
}

resumeSync();
