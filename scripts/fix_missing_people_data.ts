/**
 * fix_missing_people_data.ts
 * 
 * Fixes people who have a tmdb_id but are still missing photo/bio.
 * Also tries TMDB name search for people without tmdb_id who have no photo.
 * 
 * Run: npx tsx scripts/fix_missing_people_data.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const TMDB_KEY = process.env.TMDB_API_KEY!

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function tmdbGet(url: string) {
  const r = await fetch(`https://api.themoviedb.org/3${url}`)
  if (!r.ok) return null
  return await r.json()
}

async function main() {
  // === PASS 1: people with tmdb_id but missing photo or bio ===
  console.log('=== Pass 1: People with TMDB ID but missing photo/bio ===')
  
  const { data: withId } = await supabase
    .from('people')
    .select('id, name, tmdb_id, photo_url, biography')
    .not('tmdb_id', 'is', null)
    .or('photo_url.is.null,biography.is.null')
    .limit(500)

  console.log(`Found ${withId?.length ?? 0} people with tmdb_id but missing data`)
  
  let pass1Fixed = 0
  for (const p of withId ?? []) {
    const data = await tmdbGet(`/person/${p.tmdb_id}?api_key=${TMDB_KEY}`)
    if (!data) continue
    
    const updates: Record<string, string | null> = {}
    if (!p.photo_url && data.profile_path) {
      updates.photo_url = `https://image.tmdb.org/t/p/w185${data.profile_path}`
    }
    if (!p.biography && data.biography?.trim().length > 20) {
      updates.biography = data.biography.trim()
    }
    
    if (Object.keys(updates).length > 0) {
      await supabase.from('people').update(updates).eq('id', p.id)
      pass1Fixed++
    }
    await sleep(80)
  }
  console.log(`Pass 1 done: Fixed ${pass1Fixed} people`)

  // === PASS 2: people WITHOUT tmdb_id and missing photo ===
  console.log('\n=== Pass 2: People without TMDB ID, missing photo ===')
  
  const { data: withoutId } = await supabase
    .from('people')
    .select('id, name, photo_url, biography, tmdb_id')
    .is('tmdb_id', null)
    .is('photo_url', null)
    .not('name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(300)

  console.log(`Found ${withoutId?.length ?? 0} people without tmdb_id and no photo`)

  let pass2Fixed = 0
  let pass2NotFound = 0

  for (const p of withoutId ?? []) {
    if (!p.name) continue
    
    const searchData = await tmdbGet(`/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(p.name)}`)
    await sleep(150)
    
    const result = searchData?.results?.[0]
    if (!result) {
      pass2NotFound++
      continue
    }

    const detailData = await tmdbGet(`/person/${result.id}?api_key=${TMDB_KEY}`)
    await sleep(80)
    
    const updates: Record<string, string | number | null> = {
      tmdb_id: result.id
    }
    if (result.profile_path) {
      updates.photo_url = `https://image.tmdb.org/t/p/w185${result.profile_path}`
    }
    if (detailData?.biography?.trim().length > 20) {
      updates.biography = detailData.biography.trim()
    }
    
    await supabase.from('people').update(updates).eq('id', p.id)
    pass2Fixed++
    
    if (pass2Fixed % 20 === 0) {
      process.stdout.write(`\r  Found ${pass2Fixed}, not found: ${pass2NotFound}`)
    }
  }
  
  console.log(`\nPass 2 done: Fixed ${pass2Fixed} people, ${pass2NotFound} not found on TMDB`)

  // Final stats
  const [r1, r2, r3] = await Promise.all([
    supabase.from('people').select('*', { count: 'exact', head: true }).is('photo_url', null),
    supabase.from('people').select('*', { count: 'exact', head: true }).is('biography', null),
    supabase.from('people').select('*', { count: 'exact', head: true })
  ])
  
  console.log('\n=== Final Stats ===')
  console.log(`Total people: ${r3.count}`)
  console.log(`Still missing photo: ${r1.count}`)
  console.log(`Still missing bio: ${r2.count}`)
}

main().catch(console.error)
