
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkFilms() {
  const { data, error } = await supabase.from('films').select('*').limit(1)
  if (error) console.error(error)
  else {
    console.log('Film keys:', Object.keys(data[0]).sort())
    console.log('First film:', JSON.stringify(data[0], null, 2))
  }
}

checkFilms()
