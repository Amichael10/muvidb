/**
 * Filmhouse recon (run from Nigeria, plain node):
 *   node scripts/test_filmhouse.mjs
 * Saves the raw server HTML to scripts/_fh_dump.html and reports where the
 * schedule lives (server-rendered vs client XHR vs RSC stream).
 */
import fs from 'fs'
const url = process.argv[2] || 'https://www.filmhouseng.com/buy-tickets'
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Accept-Language': 'en-NG,en;q=0.9' } })
const html = await res.text()
fs.writeFileSync('scripts/_fh_dump.html', html)
console.log(`HTTP ${res.status}  finalUrl=${res.url}  size=${html.length}`)

const timeHits = (html.match(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/gi) || [])
console.log(`\n[A] times in RAW server HTML: ${timeHits.length}  e.g. ${[...new Set(timeHits)].slice(0,5).join(', ')}`)
console.log(`    __NEXT_DATA__: ${html.includes('__NEXT_DATA__')}   __next_f (App Router RSC): ${html.includes('__next_f')}`)

// [B] candidate data endpoints referenced anywhere in the HTML/JS
const apis = [...new Set([
  ...(html.match(/https?:\/\/[a-z0-9.-]*(api|backend|service)[a-z0-9._/-]*/gi) || []),
  ...(html.match(/["'`]\/api\/[a-z0-9._/-]+/gi) || []),
])].slice(0, 20)
console.log(`\n[B] data-endpoint URLs found in source:`)
apis.forEach(a => console.log('   ' + a.replace(/^["'`]/, '')))

// [C] inline JSON script blocks (some apps inline state without __NEXT_DATA__)
const scripts = [...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]{0,120})/gi)].map(m => m[1])
console.log(`\n[C] inline application/json script blocks: ${scripts.length}`)
scripts.slice(0,3).forEach((s,i)=>console.log(`   #${i}: ${s.slice(0,80)}`))
console.log('\nSaved raw HTML to scripts/_fh_dump.html')
