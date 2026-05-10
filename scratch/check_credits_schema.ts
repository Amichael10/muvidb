
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCreditsSchema() {
  const { data, error } = await supabase.from('credits').select('*').limit(1)
  if (error) console.error('Credits error:', error)
  else if (data && data.length > 0) console.log('Credits columns:', Object.keys(data[0]))
  else console.log('Credits table is empty, but it exists.')
}

checkCreditsSchema()
