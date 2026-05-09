
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  const { data: film, error: filmError } = await supabase.from('films').select('*').limit(1)
  if (filmError) console.error('Film error:', filmError)
  else console.log('Film columns:', Object.keys(film[0]))

  const { data: person, error: personError } = await supabase.from('people').select('*').limit(1)
  if (personError) console.error('Person error:', personError)
  else console.log('Person columns:', Object.keys(person[0]))
}

checkSchema()
