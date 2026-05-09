
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnose() {
  console.log('--- Database Diagnosis ---')
  
  const { count: filmCount } = await supabase.from('films').select('*', { count: 'exact', head: true })
  const { count: personCount } = await supabase.from('people').select('*', { count: 'exact', head: true })
  
  console.log(`Total Films: ${filmCount}`)
  console.log(`Total People: ${personCount}`)

  // Films with missing or poor metadata
  const { data: badFilms, error: filmError } = await supabase
    .from('films')
    .select('id, title, synopsis, poster_path, backdrop_path')
    .or('synopsis.is.null,poster_path.is.null,backdrop_path.is.null,synopsis.eq.,poster_path.eq.')
    .limit(100)

  if (filmError) console.error('Film error:', filmError)
  
  console.log(`Films with missing/empty synopsis, poster, or backdrop (first 100): ${badFilms?.length || 0}`)
  
  // More detailed check
  const { data: emptySynopsisCount } = await supabase.from('films').select('id').eq('synopsis', '')
  const { data: nullSynopsisCount } = await supabase.from('films').select('id').is('synopsis', null)
  const { data: emptyPosterCount } = await supabase.from('films').select('id').eq('poster_path', '')
  const { data: nullPosterCount } = await supabase.from('films').select('id').is('poster_path', null)

  console.log(`- Null Synopsis: ${nullSynopsisCount?.length || 0}`)
  console.log(`- Empty Synopsis: ${emptySynopsisCount?.length || 0}`)
  console.log(`- Null Poster: ${nullPosterCount?.length || 0}`)
  console.log(`- Empty Poster: ${emptyPosterCount?.length || 0}`)

  // People with missing or poor metadata
  const { data: badPeople, error: peopleError } = await supabase
    .from('people')
    .select('id, name, biography, profile_path')
    .or('biography.is.null,profile_path.is.null,biography.eq.,profile_path.eq.')
    .limit(100)

  if (peopleError) console.error('People error:', peopleError)

  console.log(`People with missing/empty biography or profile (first 100): ${badPeople?.length || 0}`)

  const { data: emptyBioCount } = await supabase.from('people').select('id').eq('biography', '')
  const { data: nullBioCount } = await supabase.from('people').select('id').is('biography', null)
  
  console.log(`- Null Bio: ${nullBioCount?.length || 0}`)
  console.log(`- Empty Bio: ${emptyBioCount?.length || 0}`)

  // Check for the 400+ actors added recently
  const { data: recentPeople } = await supabase
    .from('people')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('Most recent people added:')
  console.table(recentPeople)
}

diagnose()
