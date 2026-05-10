import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkEmptyFilms() {
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, poster_url, backdrop_url, synopsis')
    .or('poster_url.is.null,backdrop_url.is.null,synopsis.is.null,synopsis.eq.""')

  if (error) {
    console.error('Error fetching films:', error)
    return
  }

  console.log(`Found ${films?.length || 0} films with missing metadata.`)
  
  if (films && films.length > 0) {
    console.log('Sample of empty films:')
    films.slice(0, 10).forEach(f => {
      console.log(`- [${f.id}] ${f.title} (Poster: ${!!f.poster_path}, Backdrop: ${!!f.backdrop_path}, Synopsis: ${!!f.synopsis})`)
    })
  }
}

checkEmptyFilms()
