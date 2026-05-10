import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data: films } = await s.from('films').select('*').limit(1)
  console.log('Films columns:', Object.keys(films?.[0] || {}).join(', '))
  
  const { data: credits } = await s.from('credits').select('*').limit(1)
  console.log('Credits columns:', Object.keys(credits?.[0] || {}).join(', '))
}

check()
