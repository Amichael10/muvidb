/**
 * fix_all_issues.ts
 * 
 * Fixes three problems:
 * 1. Films with empty synopsis (sets to null so they look correct OR enriches from TMDB if possible)
 * 2. Deduplicates people with the same name
 * 3. Enriches recently added people (no photo/bio) with TMDB data
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const TMDB_API_KEY = process.env.TMDB_API_KEY!

// ===== STEP 1: Fix films with empty synopsis =====
async function fixEmptySynopsis() {
  console.log('\n=== STEP 1: Fixing films with empty synopsis ===')
  
  // Get films with empty synopsis
  const { data: badFilms, error } = await supabase
    .from('films')
    .select('id, title, year, tmdb_id, synopsis')
    .eq('synopsis', '')
    .limit(500)

  if (error || !badFilms) {
    console.error('Error fetching bad films:', error)
    return
  }

  console.log(`Found ${badFilms.length} films with empty synopsis`)

  let fixed = 0
  let nulled = 0

  for (const film of badFilms) {
    let newSynopsis: string | null = null

    // Try to get synopsis from TMDB if we have a tmdb_id
    if (film.tmdb_id) {
      try {
        const resp = await fetch(
          `https://api.themoviedb.org/3/movie/${film.tmdb_id}?api_key=${TMDB_API_KEY}`
        )
        if (resp.ok) {
          const data = await resp.json()
          if (data.overview && data.overview.trim().length > 20) {
            newSynopsis = data.overview.trim()
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // If no TMDB synopsis, search by title+year
    if (!newSynopsis && film.title) {
      try {
        const query = encodeURIComponent(film.title)
        const yearParam = film.year ? `&year=${film.year}` : ''
        const resp = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${query}${yearParam}`
        )
        if (resp.ok) {
          const data = await resp.json()
          const result = data.results?.[0]
          if (result?.overview && result.overview.trim().length > 20) {
            newSynopsis = result.overview.trim()
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // Update the film - set to null if no synopsis found (better than empty string)
    const { error: updateError } = await supabase
      .from('films')
      .update({ synopsis: newSynopsis })
      .eq('id', film.id)

    if (!updateError) {
      if (newSynopsis) {
        fixed++
        console.log(`  ✓ Fixed: "${film.title}" => "${newSynopsis.substring(0, 60)}..."`)
      } else {
        nulled++
      }
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\nSynopsis fix complete: ${fixed} enriched from TMDB, ${nulled} set to null`)
}

// ===== STEP 2: Deduplicate people =====
async function deduplicatePeople() {
  console.log('\n=== STEP 2: Deduplicating people ===')

  // Fetch all people
  const PAGE_SIZE = 1000
  let offset = 0
  const allPeople: Array<{ id: string, name: string, photo_url: string | null, biography: string | null, tmdb_id: number | null, created_at: string }> = []

  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, photo_url, biography, tmdb_id, created_at')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error || !data || data.length === 0) break
    allPeople.push(...data)
    offset += data.length
    if (data.length < PAGE_SIZE) break
  }

  console.log(`Loaded ${allPeople.length} people records`)

  // Group by normalized name
  const nameGroups = new Map<string, typeof allPeople>()
  for (const p of allPeople) {
    const key = p.name?.toLowerCase().trim()
    if (!key) continue
    if (!nameGroups.has(key)) nameGroups.set(key, [])
    nameGroups.get(key)!.push(p)
  }

  const dupeGroups = [...nameGroups.values()].filter(g => g.length > 1)
  console.log(`Found ${dupeGroups.length} duplicate name groups`)

  let merged = 0
  let errors = 0

  for (const group of dupeGroups) {
    // Pick the best survivor: prefer one with photo, then bio, then tmdb_id, then oldest
    const survivor = group.sort((a, b) => {
      const scoreA = (a.photo_url ? 4 : 0) + (a.biography ? 2 : 0) + (a.tmdb_id ? 1 : 0)
      const scoreB = (b.photo_url ? 4 : 0) + (b.biography ? 2 : 0) + (b.tmdb_id ? 1 : 0)
      return scoreB - scoreA
    })[0]

    const duplicates = group.filter(p => p.id !== survivor.id)

    for (const dupe of duplicates) {
      // Move credits from dupe to survivor
      const { error: creditErr } = await supabase
        .from('credits')
        .update({ person_id: survivor.id })
        .eq('person_id', dupe.id)

      if (creditErr) {
        // Conflict — credit with same film+person might exist, just delete the dupe credits
        await supabase.from('credits').delete().eq('person_id', dupe.id)
      }

      // Delete the duplicate person
      const { error: deleteErr } = await supabase
        .from('people')
        .delete()
        .eq('id', dupe.id)

      if (deleteErr) {
        console.error(`  ✗ Failed to delete dupe "${dupe.name}":`, deleteErr.message)
        errors++
      } else {
        merged++
      }
    }
  }

  console.log(`Deduplication complete: ${merged} duplicates removed, ${errors} errors`)
}

// ===== STEP 3: Enrich people missing photo/bio using TMDB =====
async function enrichPeopleMissingData() {
  console.log('\n=== STEP 3: Enriching people missing photo or biography ===')

  // Get people with no photo but have a tmdb_id
  const { data: peopleWithTmdb, error } = await supabase
    .from('people')
    .select('id, name, tmdb_id, photo_url, biography')
    .not('tmdb_id', 'is', null)
    .or('photo_url.is.null,photo_url.eq.,biography.is.null')
    .limit(500)

  if (error || !peopleWithTmdb) {
    console.error('Error fetching people:', error)
    return
  }

  console.log(`Found ${peopleWithTmdb.length} people with TMDB ID but missing data`)

  let enriched = 0
  let notFound = 0

  for (const person of peopleWithTmdb) {
    try {
      const resp = await fetch(
        `https://api.themoviedb.org/3/person/${person.tmdb_id}?api_key=${TMDB_API_KEY}`
      )
      if (!resp.ok) {
        notFound++
        continue
      }
      const data = await resp.json()

      const updates: Record<string, string | null> = {}
      if (!person.photo_url && data.profile_path) {
        updates.photo_url = `https://image.tmdb.org/t/p/w185${data.profile_path}`
      }
      if (!person.biography && data.biography && data.biography.trim().length > 10) {
        updates.biography = data.biography.trim()
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('people').update(updates).eq('id', person.id)
        enriched++
        console.log(`  ✓ Enriched "${person.name}"`)
      }
    } catch (e) {
      // ignore
    }

    // Rate limit TMDB
    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`Enrichment complete: ${enriched} people enriched, ${notFound} TMDB IDs not found`)

  // Also try to enrich people WITHOUT tmdb_id by searching TMDB
  console.log('\n  Searching TMDB for people without TMDB ID...')
  const { data: peopleNoTmdb } = await supabase
    .from('people')
    .select('id, name, photo_url, biography, tmdb_id')
    .is('tmdb_id', null)
    .or('photo_url.is.null,biography.is.null')
    .limit(200)

  let searchEnriched = 0

  for (const person of (peopleNoTmdb || [])) {
    if (!person.name) continue
    try {
      const query = encodeURIComponent(person.name)
      const resp = await fetch(
        `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${query}`
      )
      if (!resp.ok) continue
      const data = await resp.json()
      const result = data.results?.[0]
      if (!result) continue

      // Fetch full person details
      const detailResp = await fetch(
        `https://api.themoviedb.org/3/person/${result.id}?api_key=${TMDB_API_KEY}`
      )
      if (!detailResp.ok) continue
      const detail = await detailResp.json()

      const updates: Record<string, string | number | null> = { tmdb_id: result.id }
      if (!person.photo_url && detail.profile_path) {
        updates.photo_url = `https://image.tmdb.org/t/p/w185${detail.profile_path}`
      }
      if (!person.biography && detail.biography && detail.biography.trim().length > 10) {
        updates.biography = detail.biography.trim()
      }

      if (Object.keys(updates).length > 1) { // more than just tmdb_id
        await supabase.from('people').update(updates).eq('id', person.id)
        searchEnriched++
        console.log(`  ✓ Search-enriched "${person.name}"`)
      } else {
        // At least save the TMDB ID
        await supabase.from('people').update({ tmdb_id: result.id }).eq('id', person.id)
      }
    } catch (e) {
      // ignore
    }

    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`Search enrichment complete: ${searchEnriched} people enriched from TMDB search`)
}

async function main() {
  console.log('Starting fix_all_issues...')
  await fixEmptySynopsis()
  await deduplicatePeople()
  await enrichPeopleMissingData()
  console.log('\n=== ALL DONE ===')
}

main().catch(console.error)
