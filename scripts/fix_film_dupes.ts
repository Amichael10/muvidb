/**
 * fix_film_dupes.ts
 *
 * Merges duplicate films (same title + same year).
 * Picks the "best" record (one with most data), reassigns all channel_videos
 * and credits to the survivor, then deletes the duplicates.
 * 
 * Run: npx tsx scripts/fix_film_dupes.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function scoreFilm(f: Record<string, any>): number {
  return (f.synopsis ? 4 : 0)
    + (f.poster_url && !f.poster_url.includes('ytimg') ? 3 : 0)  // prefer non-YT thumbnail
    + (f.poster_url ? 2 : 0)
    + (f.backdrop_url ? 1 : 0)
    + (f.tmdb_id ? 5 : 0)
    + (f.tmdb_rating ? 1 : 0)
    + (f.runtime_minutes ? 1 : 0)
}

async function main() {
  console.log('=== Film Deduplication ===\n')
  
  // Fetch all films
  let allFilms: any[] = []
  let offset = 0
  const PAGE = 1000
  
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, year, synopsis, poster_url, backdrop_url, tmdb_id, tmdb_rating, runtime_minutes, source_video_id, streaming_links, source, created_at')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) { console.error('Error fetching films:', error); break }
    if (!data || data.length === 0) break
    allFilms.push(...data)
    offset += data.length
    if (data.length < PAGE) break
  }
  
  console.log(`Loaded ${allFilms.length} films`)
  
  // Group by normalized title + year
  const groups = new Map<string, typeof allFilms>()
  for (const f of allFilms) {
    const normTitle = (f.title || '').toLowerCase().trim()
      .replace(/[^\w\s]/g, '') // remove punctuation
      .replace(/\s+/g, ' ')
      .trim()
    const key = `${normTitle}__${f.year ?? 'unknown'}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(f)
  }
  
  const dupeGroups = [...groups.entries()].filter(([, g]) => g.length > 1)
  console.log(`Found ${dupeGroups.length} duplicate groups\n`)
  
  let merged = 0
  let errors = 0
  
  for (const [key, group] of dupeGroups) {
    // Sort: best data first
    const sorted = [...group].sort((a, b) => scoreFilm(b) - scoreFilm(a))
    const survivor = sorted[0]
    const dupes = sorted.slice(1)
    const dupeIds = dupes.map(d => d.id)
    
    // Merge streaming_links from all dupes into survivor
    const mergedLinks = { ...(survivor.streaming_links || {}) }
    for (const d of dupes) {
      if (d.streaming_links) Object.assign(mergedLinks, d.streaming_links)
    }
    
    // Build best update for survivor
    const survivorUpdate: Record<string, any> = { streaming_links: mergedLinks }
    if (!survivor.synopsis) {
      const withSynopsis = dupes.find(d => d.synopsis)
      if (withSynopsis) survivorUpdate.synopsis = withSynopsis.synopsis
    }
    if (!survivor.tmdb_id) {
      const withTmdb = dupes.find(d => d.tmdb_id)
      if (withTmdb) survivorUpdate.tmdb_id = withTmdb.tmdb_id
    }
    if (!survivor.poster_url || survivor.poster_url.includes('ytimg')) {
      const withPoster = dupes.find(d => d.poster_url && !d.poster_url.includes('ytimg'))
      if (withPoster) survivorUpdate.poster_url = withPoster.poster_url
    }
    
    // Update survivor with merged data
    if (Object.keys(survivorUpdate).length > 0) {
      await supabase.from('films').update(survivorUpdate).eq('id', survivor.id)
    }
    
    // Reassign credits and channel_videos from dupes to survivor
    await supabase.from('credits').update({ film_id: survivor.id }).in('film_id', dupeIds)
    await supabase.from('channel_videos').update({ film_id: survivor.id }).in('film_id', dupeIds)
    
    // Delete duplicate film records
    const { error } = await supabase.from('films').delete().in('id', dupeIds)
    if (error) {
      console.error(`  ✗ Could not delete dupes of "${survivor.title}" (${key}):`, error.message)
      errors++
    } else {
      merged += dupeIds.length
    }
  }
  
  // Final count
  const { count } = await supabase.from('films').select('*', { count: 'exact', head: true })
  console.log(`Deduplication complete!`)
  console.log(`  Removed: ${merged} duplicate films`)
  console.log(`  Errors:  ${errors}`)
  console.log(`  Remaining films: ${count}`)
}

main().catch(console.error)
