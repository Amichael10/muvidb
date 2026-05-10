
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function listColumns() {
  const { data, error } = await supabase.from('films').select('*').limit(1)
  if (error) {
    console.error('Error fetching film:', error)
    return
  }
  if (data && data.length > 0) {
    console.log('Columns in films table:', Object.keys(data[0]))
  } else {
    console.log('No films found in table.')
  }
}

listColumns()
