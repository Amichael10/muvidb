/**
 * Run from Nigeria (no tsx needed — avoids the NUL/ACL error):
 *   node scripts/test_filmhouse.mjs
 *   node scripts/test_filmhouse.mjs "https://www.filmhouseng.com/en/cinemas/lekki/movies"
 *
 * Prints parsed showtimes. If it can't parse, it dumps the __NEXT_DATA__ shape so
 * we can map the exact field names.
 */
import * as cheerio from 'cheerio'
const url = process.argv[2] || 'https://www.filmhouseng.com/buy-tickets'

function parseTime(raw){
  if(raw==null) return null
  const s=String(raw).trim()
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)){const d=new Date(s);if(isNaN(d))return null;const l=new Date(d.getTime()+3600000);return{date:l.toISOString().slice(0,10),time:l.toISOString().slice(11,19)}}
  const m=s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i); if(!m) return null
  let h=+m[1]; const ap=m[3]?.toUpperCase(); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0
  return {time:`${String(h).padStart(2,'0')}:${m[2]}:00`}
}
function extract(root){
  const out=[],seen=new Set()
  const TK=['title','name','filmTitle','movieTitle','filmName'], SK=['sessions','showtimes','performances','times','screenings','schedules','showTimes']
  const titleOf=o=>{for(const k of TK)if(typeof o?.[k]==='string'&&o[k].trim())return o[k].trim();if(typeof o?.film?.title==='string')return o.film.title.trim();return null}
  const sessOf=o=>{for(const k of SK)if(Array.isArray(o?.[k]))return o[k];return null}
  const visit=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return}
    const t=titleOf(n),ss=sessOf(n)
    if(t&&ss){for(const s of ss){const rt=typeof s==='string'?s:(s?.time??s?.startTime??s?.showTime??s?.start);const p=parseTime(rt);if(!p)continue;const key=t+'|'+p.time;if(seen.has(key))continue;seen.add(key);out.push({title:t,time:p.time,date:p.date})}}
    for(const k of Object.keys(n))visit(n[k])}
  visit(root); return out
}

const res = await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Chrome/120','Accept-Language':'en-NG,en;q=0.9'}})
console.log(`HTTP ${res.status}  url=${res.url}`)
const html = await res.text()
const $ = cheerio.load(html)
const raw = $('#__NEXT_DATA__').first().contents().text()
console.log('__NEXT_DATA__:', raw? 'FOUND ('+raw.length+' chars)':'NOT FOUND')
if(raw){
  const json = JSON.parse(raw)
  const st = extract(json)
  console.log(`\nParsed ${st.length} showtimes:`)
  st.slice(0,15).forEach(s=>console.log(`  ${s.date||'(no date)'} ${s.time}  ${s.title}`))
  if(st.length===0){
    console.log('\n--- could not parse; dumping structure under props.pageProps ---')
    const pp = json?.props?.pageProps ?? json?.props ?? json
    const peek=(o,p,d)=>{if(d>4||!o||typeof o!=='object')return;if(Array.isArray(o)){const s=o[0];if(s&&typeof s==='object')console.log(`  array @ ${p} (${o.length}) keys: ${Object.keys(s).join(',')}`);return}for(const k of Object.keys(o))peek(o[k],p+'.'+k,d+1)}
    peek(pp,'pageProps',0)
  }
}
