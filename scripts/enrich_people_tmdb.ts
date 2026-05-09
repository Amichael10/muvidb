/**
 * enrich_people_tmdb.ts
 * 
 * Enriches people records missing photo_url or biography by querying TMDB.
 * - First pass: people WITH tmdb_id but missing photo/bio
 * - Second pass: people WITHOUT tmdb_id (search by name, get data)
 * 
 * Runs in parallel batches of 10 to be fast but not hammer TMDB.
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const TMDB_KEY = process.env.TMDB_API_KEY!

async function tmdbFetch(url: string) {
  try {
    const r = await fetch(`https://api.themoviedb.org/3${url}?api_key=${TMDB_KEY}`)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

async function enrichWithTmdbId() {
  console.log('\n=== Pass 1: Enriching people who have TMDB ID ===')

  const { data: people } = await supabase
    .from('people')
    .select('id, name, tmdb_id, photo_url, biography')
    .not('tmdb_id', 'is', null)
    .or('photo_url.is.null,biography.is.null')
    .limit(1000)

  if (!people || people.length === 0) {
    console.log('No people with TMDB ID need enrichment.')
    return
  }

  console.log(`Found ${people.length} people to enrich via TMDB ID`)

  let enriched = 0
  const BATCH = 10

  for (let i = 0; i < people.length; i += BATCH) {
    const batch = people.slice(i, i + BATCH)
    
    await Promise.all(batch.map(async (person) => {
      const data = await tmdbFetch(`/person/${person.tmdb_id}`)
      if (!data) return

      const updates: Record<string, string | null> = {}
      if (!person.photo_url && data.profile_path) {
        updates.photo_url = `https://image.tmdb.org/t/p/w185${data.profile_path}`
      }
      if (!person.biography && data.biography?.trim().length > 20) {
        updates.biography = data.biography.trim()
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('people').update(updates).eq('id', person.id)
        enriched++
      }
    }))

    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, people.length)}/${people.length} — enriched: ${enriched}`)
    await new Promise(r => setTimeout(r, 100)) // rate limit
  }

  console.log(`\n  Done: ${enriched} people enriched via TMDB ID`)
}

async function enrichByNameSearch() {
  console.log('\n=== Pass 2: Searching TMDB for people without TMDB ID ===')

  const { data: people } = await supabase
    .from('people')
    .select('id, name, photo_url, biography, tmdb_id')
    .is('tmdb_id', null)
    .or('photo_url.is.null,biography.is.null')
    .limit(500)

  if (!people || people.length === 0) {
    console.log('No people without TMDB ID need enrichment.')
    return
  }

  console.log(`Found ${people.length} people to search for in TMDB`)

  let enriched = 0
  let notFound = 0
  const BATCH = 5 // smaller batch for search (rate limits)

  for (let i = 0; i < people.length; i += BATCH) {
    const batch = people.slice(i, i + BATCH)

    await Promise.all(batch.map(async (person) => {
      if (!person.name) return

      const searchData = await tmdbFetch(`/search/person?query=${encodeURIComponent(person.name)}`)
      const result = searchData?.results?.[0]
      if (!result) {
        notFound++
        return
      }

      const detailData = await tmdbFetch(`/person/${result.id}`)
      if (!detailData) return

      const updates: Record<string, string | number | null> = {
        tmdb_id: result.id
      }

      if (!person.photo_url && detailData.profile_path) {
        updates.photo_url = `https://image.tmdb.org/t/p/w185${detailData.profile_path}`
      }
      if (!person.biography && detailData.biography?.trim().length > 20) {
        updates.biography = detailData.biography.trim()
      }

      if (Object.keys(updates).length > 1) {
        await supabase.from('people').update(updates).eq('id', person.id)
        enriched++
      } else {
        // At least save the tmdb_id
        await supabase.from('people').update({ tmdb_id: result.id }).eq('id', person.id)
      }
    }))

    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, people.length)}/${people.length} — enriched: ${enriched}, not found: ${notFound}`)
    await new Promise(r => setTimeout(r, 300)) // be more careful with search rate limits
  }

  console.log(`\n  Done: ${enriched} people enriched via TMDB search, ${notFound} not found`)
}

async function main() {
  await enrichWithTmdbId()
  await enrichByNameSearch()

  // Final stats
  const { count: nullPhoto } = await supabase.from('people').select('*', { count: 'exact', head: true }).is('photo_url', null)
  const { count: nullBio } = await supabase.from('people').select('*', { count: 'exact', head: true }).is('biography', null)
  console.log(`\n=== Final People Stats ===`)
  console.log(`People with null photo_url: ${nullPhoto}`)
  console.log(`People with null biography:  ${nullBio}`)
}

main().catch(console.error)
