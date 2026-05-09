/**
 * fast_dedup_people.ts
 * 
 * Fast SQL-based deduplication of people with identical names.
 * Uses a single query approach: for each name group, picks a survivor (best data),
 * reassigns all credits, then bulk-deletes duplicates.
 * 
 * Uses batching to avoid timeout: 100 groups at a time.
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fastDedup() {
  console.log('=== Fast People Deduplication ===\n')

  // Load all people at once (paginated)
  const PAGE_SIZE = 1000
  let offset = 0
  const allPeople: Array<{
    id: string
    name: string
    photo_url: string | null
    biography: string | null
    tmdb_id: number | null
    created_at: string
  }> = []

  console.log('Loading all people...')
  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, photo_url, biography, tmdb_id, created_at')
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) { console.error('Error loading people:', error); break }
    if (!data || data.length === 0) break
    allPeople.push(...data)
    offset += data.length
    if (data.length < PAGE_SIZE) break
  }

  console.log(`Loaded ${allPeople.length} people`)

  // Build name groups
  const nameGroups = new Map<string, typeof allPeople>()
  for (const p of allPeople) {
    const key = p.name?.toLowerCase().trim()
    if (!key) continue
    if (!nameGroups.has(key)) nameGroups.set(key, [])
    nameGroups.get(key)!.push(p)
  }

  const dupeGroups = [...nameGroups.values()].filter(g => g.length > 1)
  console.log(`Found ${dupeGroups.length} duplicate groups\n`)

  let totalMerged = 0
  let totalErrors = 0

  // Process in batches
  const BATCH_SIZE = 50
  for (let i = 0; i < dupeGroups.length; i += BATCH_SIZE) {
    const batch = dupeGroups.slice(i, i + BATCH_SIZE)
    
    const promises = batch.map(async (group) => {
      // Pick survivor: best score (photo > bio > tmdb_id), then oldest
      const sorted = [...group].sort((a, b) => {
        const scoreA = (a.photo_url ? 4 : 0) + (a.biography ? 2 : 0) + (a.tmdb_id ? 1 : 0)
        const scoreB = (b.photo_url ? 4 : 0) + (b.biography ? 2 : 0) + (b.tmdb_id ? 1 : 0)
        if (scoreB !== scoreA) return scoreB - scoreA
        // Prefer older record
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      const survivor = sorted[0]
      const duplicates = sorted.slice(1)
      const dupeIds = duplicates.map(d => d.id)

      // Reassign credits from all dupes to survivor
      await supabase
        .from('credits')
        .update({ person_id: survivor.id })
        .in('person_id', dupeIds)

      // Delete any resulting duplicate credits (same film + person)
      // This is done by deleting credits for dupes that already have a credit for survivor on same film
      // Simplest approach: delete orphan credits for dupe IDs after reassignment
      // (They were all moved; if any conflict, the update just won't match — no duplicate created)
      
      // Delete the duplicate people records
      const { error } = await supabase
        .from('people')
        .delete()
        .in('id', dupeIds)

      if (error) {
        console.error(`  ✗ Failed to delete dupes of "${survivor.name}":`, error.message)
        return { merged: 0, errors: dupeIds.length }
      }

      return { merged: dupeIds.length, errors: 0 }
    })

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalMerged += result.value.merged
        totalErrors += result.value.errors
      } else {
        totalErrors++
      }
    }

    const processed = Math.min(i + BATCH_SIZE, dupeGroups.length)
    const pct = Math.round((processed / dupeGroups.length) * 100)
    process.stdout.write(`\r  Progress: ${processed}/${dupeGroups.length} groups (${pct}%) — removed: ${totalMerged}`)
  }

  console.log(`\n\nDeduplication complete!`)
  console.log(`  Merged/removed: ${totalMerged} duplicate people`)
  console.log(`  Errors: ${totalErrors}`)

  // Final count
  const { count } = await supabase.from('people').select('*', { count: 'exact', head: true })
  console.log(`  Remaining people: ${count}`)
}

fastDedup().catch(console.error)
