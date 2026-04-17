import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function checkCompanies() {
  const { data, error } = await supabase.from('companies').select('*').limit(1)
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Sample Data Key Names:', Object.keys(data[0] || {}))
  }
}

checkCompanies()
