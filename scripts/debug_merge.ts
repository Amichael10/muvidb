import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function run() {
  console.log('Querying all films added or updated recently to see if the title got messed up.')
  
  // Try to find the film by parts of its title, or missing title
  const { data: noTitle } = await supabase.from('films').select('id, title').eq('title', '')
  console.log('Films with empty title:', noTitle)

  const { data: nullTitle } = await supabase.from('films').select('id, title').is('title', null)
  console.log('Films with null title:', nullTitle)

  const { data: lowercaseOwo } = await supabase.from('films').select('id, title').ilike('title', '%owo%')
  console.log('Films with "owo":', lowercaseOwo)

}
run()
