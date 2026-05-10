import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const TMDB_KEY = process.env.TMDB_API_KEY!

async function testTMDB() {
  const query = encodeURIComponent('Gangs of Lagos')
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${query}`
  console.log(`Searching: ${url}`)
  
  try {
    const r = await fetch(url)
    if (r.ok) {
      const data = await r.json()
      console.log('Results:', data.results?.slice(0, 2).map((m: any) => ({ title: m.title, overview: m.overview?.slice(0, 50) })))
    } else {
      console.error('TMDB Error:', r.status, await r.text())
    }
  } catch (e) {
    console.error('Fetch Error:', e)
  }
}

testTMDB()
