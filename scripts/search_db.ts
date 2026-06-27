import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function run() {
  console.log('Searching for Ile owo...')
  const { data, error } = await supabase
    .from('films')
    .select('*')
    .ilike('title', '%ile owo%')
  
  if (error) console.error(error)
  else console.log(data)

  console.log('Searching for any films with tmdb_id = NULL or similar...')
  const { count } = await supabase.from('films').select('*', { count: 'exact', head: true })
  console.log('Total films:', count)
}
run()
