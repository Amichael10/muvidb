/**
 * enrich_films_synopsis.ts
 *
 * For films with null synopsis (not empty string), attempt to find
 * them on TMDB and pull synopsis + better poster/backdrop.
 * 
 * Run: npx tsx scripts/enrich_films_synopsis.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { pickTmdbMatch } from '../api/_lib/tmdb_match.js'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const TMDB_KEY = process.env.TMDB_API_KEY!

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('=== Enrich Films with Null Synopsis ===\n')

  // Fetch films with null synopsis in batches
  let offset = 0
  const PAGE = 200
  let allFilms: any[] = []

  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, year, synopsis, poster_url, backdrop_url, tmdb_id')
      .or('synopsis.is.null,synopsis.eq."",poster_url.is.null,poster_url.ilike.%ytimg%')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
      .limit(100)
    
    if (error) {
      console.error('Error fetching films:', error)
      break
    }
    if (!data || data.length === 0) break
    allFilms.push(...data)
    offset += data.length
    if (data.length < PAGE) break
    if (allFilms.length >= 500) break // Don't try to do 5000 at once
  }

  console.log(`Found ${allFilms.length} films needing metadata enrichment\n`)

  let enriched = 0
  let notFound = 0

  for (let i = 0; i < allFilms.length; i++) {
    const film = allFilms[i]
    let result: any = null

    // Pass 1: use existing tmdb_id
    if (film.tmdb_id) {
      const r = await fetch(`https://api.themoviedb.org/3/movie/${film.tmdb_id}?api_key=${TMDB_KEY}`)
      if (r.ok) {
        const data = await r.json()
        if (data.overview?.trim()) result = data
      }
      await sleep(80)
    }

    // Pass 2: search by title (possibly with year)
    if (!result) {
      const query = encodeURIComponent(film.title)
      const yearStr = film.year ? `&year=${film.year}` : ''
      const r = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${query}${yearStr}`)
      if (r.ok) {
        const data = await r.json()
        result = pickTmdbMatch(data.results, { title: film.title, year: film.year })
      }
      await sleep(120)
    }

    if (!result || !result.overview?.trim()) {
      notFound++
      continue
    }

    // Build update payload
    const updates: Record<string, any> = {
      synopsis: result.overview.trim()
    }
    if (!film.tmdb_id && result.id) updates.tmdb_id = result.id
    if ((!film.poster_url || film.poster_url.includes('ytimg')) && result.poster_path) {
      updates.poster_url = `https://image.tmdb.org/t/p/w500${result.poster_path}`
    }
    if ((!film.backdrop_url || film.backdrop_url.includes('ytimg')) && result.backdrop_path) {
      updates.backdrop_url = `https://image.tmdb.org/t/p/w780${result.backdrop_path}`
    }
    if (result.vote_average) updates.tmdb_rating = result.vote_average

    await supabase.from('films').update(updates).eq('id', film.id)
    enriched++
    console.log(`  ✅ Enriched: ${film.title}`)

    if ((i + 1) % 5 === 0 || i === allFilms.length - 1) {
      process.stdout.write(`\r  Progress: ${i + 1}/${allFilms.length} — enriched: ${enriched}, not found: ${notFound}`)
    }
  }

  console.log('\n')

  // Final count
  const { count: stillNull } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .is('synopsis', null)

  console.log('=== Results ===')
  console.log(`  Enriched from TMDB: ${enriched}`)
  console.log(`  Not found on TMDB:  ${notFound}`)
  console.log(`  Still null synopsis: ${stillNull}`)
}

main().catch(console.error)
