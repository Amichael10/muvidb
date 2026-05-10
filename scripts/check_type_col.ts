
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function addTypeColumn() {
  console.log('Attempting to add "type" column to "films" table...')
  // We can't run raw SQL easily via the JS client unless there's an RPC.
  // Let's check if we can just try to insert a row with a 'type' field and see if it fails.
  const { error } = await supabase.from('films').select('type').limit(1)
  if (error) {
    if (error.code === '42703') { // undefined_column
      console.log('Column "type" does not exist. Please add it via Supabase SQL Editor:')
      console.log('ALTER TABLE films ADD COLUMN type text DEFAULT \'movie\';')
    } else {
      console.error('Error checking column:', error)
    }
  } else {
    console.log('Column "type" already exists.')
  }
}

addTypeColumn()
