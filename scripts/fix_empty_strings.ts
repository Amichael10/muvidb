import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Fix empty string photo_url → null
  const r1 = await s.from('people').update({ photo_url: null }).eq('photo_url', '')
  console.log('Fixed empty photo_url:', r1.error?.message || 'OK')

  // Fix empty string biography → null
  const r2 = await s.from('people').update({ biography: null }).eq('biography', '')
  console.log('Fixed empty biography:', r2.error?.message || 'OK')

  // Fix empty string synopsis on films → null
  const r3 = await s.from('films').update({ synopsis: null }).eq('synopsis', '')
  console.log('Fixed empty film synopsis:', r3.error?.message || 'OK')

  console.log('Done.')
}
main().catch(console.error)
