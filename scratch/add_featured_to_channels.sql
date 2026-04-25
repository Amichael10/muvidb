import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const sql = `
ALTER TABLE youtube_channels ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
`;

async function update() {
  console.log("Please run this SQL in the Supabase Dashboard SQL Editor.");
  console.log(sql);
}

update()
