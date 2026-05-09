import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function audit() {
  console.log('=== DATABASE AUDIT ===\n')

  // --- COUNTS ---
  const { count: filmCount } = await supabase.from('films').select('*', { count: 'exact', head: true })
  const { count: personCount } = await supabase.from('people').select('*', { count: 'exact', head: true })
  const { count: creditCount } = await supabase.from('credits').select('*', { count: 'exact', head: true })
  console.log(`Total Films:   ${filmCount}`)
  console.log(`Total People:  ${personCount}`)
  console.log(`Total Credits: ${creditCount}\n`)

  // --- FILMS MISSING DATA ---
  // Films with null or empty synopsis
  const { count: nullSynopsis } = await supabase
    .from('films').select('*', { count: 'exact', head: true }).is('synopsis', null)
  const { count: emptySynopsis } = await supabase
    .from('films').select('*', { count: 'exact', head: true }).eq('synopsis', '')

  // Films with null or empty poster_url
  const { count: nullPoster } = await supabase
    .from('films').select('*', { count: 'exact', head: true }).is('poster_url', null)
  const { count: emptyPoster } = await supabase
    .from('films').select('*', { count: 'exact', head: true }).eq('poster_url', '')

  console.log('--- Films Missing Data ---')
  console.log(`Null synopsis:  ${nullSynopsis}`)
  console.log(`Empty synopsis: ${emptySynopsis}`)
  console.log(`Null poster:    ${nullPoster}`)
  console.log(`Empty poster:   ${emptyPoster}`)

  const totalBadFilms = (nullSynopsis || 0) + (nullPoster || 0) + (emptyPoster || 0)
  console.log(`=> Films needing attention (rough): ${totalBadFilms}\n`)

  // Sample of films with null poster_url
  const { data: filmsSample } = await supabase
    .from('films')
    .select('id, title, synopsis, poster_url')
    .is('poster_url', null)
    .limit(15)
  console.log('Sample films with null poster_url:')
  console.table(filmsSample?.map(f => ({ title: f.title, hasSynopsis: !!f.synopsis })))

  // --- PEOPLE MISSING DATA ---
  const { count: nullPhoto } = await supabase
    .from('people').select('*', { count: 'exact', head: true }).is('photo_url', null)
  const { count: emptyPhoto } = await supabase
    .from('people').select('*', { count: 'exact', head: true }).eq('photo_url', '')
  const { count: nullBio } = await supabase
    .from('people').select('*', { count: 'exact', head: true }).is('biography', null)
  const { count: emptyBio } = await supabase
    .from('people').select('*', { count: 'exact', head: true }).eq('biography', '')

  console.log('\n--- People Missing Data ---')
  console.log(`Null photo_url: ${nullPhoto}`)
  console.log(`Empty photo_url: ${emptyPhoto}`)
  console.log(`Null biography: ${nullBio}`)
  console.log(`Empty biography: ${emptyBio}`)

  // People with no credits (orphans)
  // Get all people IDs in credits
  const { count: peopleWithCredits } = await supabase
    .from('credits').select('person_id', { count: 'exact', head: true })
  console.log(`\nCredits total: ${peopleWithCredits}`)

  // --- DUPLICATE CHECKS ---
  console.log('\n--- Checking for duplicate films (same title+year) ---')
  const { data: allFilmTitles } = await supabase
    .from('films')
    .select('title, year')
    .order('title')

  if (allFilmTitles) {
    const seen = new Map<string, number>()
    for (const f of allFilmTitles) {
      const key = `${f.title?.toLowerCase().trim()}__${f.year}`
      seen.set(key, (seen.get(key) || 0) + 1)
    }
    const dupes = [...seen.entries()].filter(([, count]) => count > 1)
    console.log(`Duplicate title+year combos: ${dupes.length}`)
    if (dupes.length > 0) {
      console.log('Top duplicates:')
      dupes.slice(0, 10).forEach(([key, count]) => console.log(`  ${key}: ${count}x`))
    }
  }

  console.log('\n--- Checking for duplicate people (same name) ---')
  const { data: allPeopleNames } = await supabase
    .from('people')
    .select('name')
    .order('name')

  if (allPeopleNames) {
    const seen = new Map<string, number>()
    for (const p of allPeopleNames) {
      const key = p.name?.toLowerCase().trim()
      if (!key) continue
      seen.set(key, (seen.get(key) || 0) + 1)
    }
    const dupes = [...seen.entries()].filter(([, count]) => count > 1)
    console.log(`Duplicate person names: ${dupes.length}`)
    if (dupes.length > 0) {
      console.log('Top duplicates:')
      dupes.slice(0, 10).forEach(([key, count]) => console.log(`  ${key}: ${count}x`))
    }
  }

  // --- RECENTLY ADDED PEOPLE ---
  console.log('\n--- 10 Most Recently Added People ---')
  const { data: recentPeople } = await supabase
    .from('people')
    .select('id, name, photo_url, biography, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  console.table(recentPeople?.map(p => ({
    name: p.name,
    hasPhoto: !!p.photo_url,
    hasBio: !!p.biography,
    added: p.created_at?.substring(0, 16)
  })))

  // --- RECENTLY ADDED FILMS ---
  console.log('\n--- 10 Most Recently Added Films ---')
  const { data: recentFilms } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, source, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  console.table(recentFilms?.map(f => ({
    title: f.title,
    source: f.source,
    hasPoster: !!f.poster_url,
    hasSynopsis: !!f.synopsis,
    added: f.created_at?.substring(0, 16)
  })))
}

audit().catch(console.error)
