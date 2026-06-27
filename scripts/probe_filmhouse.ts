/**
 * Run this from Nigeria (where filmhouseng.com is reachable):
 *   npx tsx scripts/probe_filmhouse.ts
 * Then paste the console output back to the assistant, OR send the saved file
 * scripts/_filmhouse_dump.html. This reveals how showtimes are embedded so the
 * Filmhouse adapter can be built precisely.
 */
import fs from 'fs'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const URLS = [
  'https://www.filmhouseng.com/en/cinemas/lekki/movies',
  'https://filmhouseng.com/en/cinemas/lekki/movies',
  'https://www.filmhouseng.com/en/cinemas/lekki',
]
async function probe(url: string) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-NG,en;q=0.9' }, redirect: 'follow' })
    const html = await r.text()
    console.log(`\n### ${url}\n  HTTP ${r.status}  size=${html.length}  finalUrl=${(r as any).url || url}`)
    fs.writeFileSync('scripts/_filmhouse_dump.html', html)
    // Next.js data?
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (m) {
      console.log('  __NEXT_DATA__: FOUND')
      try {
        const j = JSON.parse(m[1])
        const walk = (o: any, path: string, depth: number): void => {
          if (depth > 6 || !o || typeof o !== 'object') return
          if (Array.isArray(o)) {
            const s = o[0]
            if (s && typeof s === 'object') {
              const keys = Object.keys(s).join(',')
              if (/time|date|session|show|film|movie|title|perf/i.test(keys)) console.log(`    array @ ${path} (${o.length}) sample keys: ${keys}`)
            }
            return
          }
          for (const k of Object.keys(o)) walk(o[k], `${path}.${k}`, depth + 1)
        }
        walk(j, '$', 0)
      } catch (e: any) { console.log('  (could not parse __NEXT_DATA__: ' + e.message + ')') }
    } else {
      console.log('  __NEXT_DATA__: not found')
    }
    // signals
    const sig = (re: RegExp) => (html.match(re) || []).length
    console.log(`  signals: showtime=${sig(/showtime/gi)} session=${sig(/session/gi)} api-calls=${[...new Set((html.match(/\/api\/[a-z0-9/_-]+/gi)||[]))].slice(0,8).join(' ')}`)
  } catch (e: any) {
    console.log(`\n### ${url}\n  FETCH ERROR: ${e.message}`)
  }
}
;(async () => { for (const u of URLS) await probe(u) ; console.log('\nSaved last page to scripts/_filmhouse_dump.html') })()
