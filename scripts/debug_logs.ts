import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function run() {
  console.log('Querying specific films...')
  const { data, error } = await supabase
    .from('films')
    .select('*')
    .in('id', ['6d68df0a-b34c-41b4-9c1c-0f8cc2fa61ef', '436b7d42-883d-4bbc-bc51-a3a9d37fdec8'])
  
  if (error) console.error(error)
  else console.log(JSON.stringify(data, null, 2))
  
  if (error) console.error(error)
  else console.log(JSON.stringify(data, null, 2))
}
run()
