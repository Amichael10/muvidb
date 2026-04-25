import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function check() {
  const { data: people } = await supabase.from('people').select('*').limit(1)
  console.log('People columns:', Object.keys(people?.[0] || {}))
  
  const { data: channels } = await supabase.from('youtube_channels').select('*').limit(1)
  console.log('Channel columns:', Object.keys(channels?.[0] || {}))
}

check()
