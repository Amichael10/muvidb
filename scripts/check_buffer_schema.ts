
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkChannelVideosSchema() {
  const { data, error } = await supabase.from('channel_videos').select('*').limit(1)
  if (error) {
    console.error('Error:', error)
  } else if (data && data.length > 0) {
    console.log('Channel Videos columns:', Object.keys(data[0]))
  } else {
    console.log('No data in channel_videos table.')
    // Try to get columns anyway if possible, but limit 1 might fail if empty.
    // In Supabase/PostgREST we can't easily get schema without query.
  }
}

checkChannelVideosSchema()
