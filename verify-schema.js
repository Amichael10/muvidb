import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const tables = [
  'films', 
  'people', 
  'cinemas', 
  'companies', 
  'credits', 
  'showtimes', 
  'genres', 
  'film_genres'
]

async function verifyAllSchemas() {
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1)
      if (error) {
        console.log(`Auditing: ${table} -> Error: ${error.message}`)
      } else if (data && data.length > 0) {
        const columns = Object.keys(data[0])
        console.log(`Auditing: ${table} -> Columns: ${columns.join(', ')}`)
      } else {
        console.log(`Auditing: ${table} -> Empty Table`)
      }
    } catch (e) {
      console.log(`Auditing: ${table} -> Exception: ${e.message}`)
    }
  }
}

verifyAllSchemas()
