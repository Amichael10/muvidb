import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries) throw err;
      await sleep(delay * i);
    }
  }
  throw new Error('Retries exceeded');
}

function normalizeTitleStrict(t: string): string {
  return t
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/\*+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesExact(dbTitle: string, targetTitle: string): boolean {
  const d = normalizeTitleStrict(dbTitle);
  const t = normalizeTitleStrict(targetTitle);

  if (d === t) return true;

  // Never match across sequel boundaries (e.g. 2, 3, part 2)
  const dNum = /\b(2|3|4|5|two|three|part\s*\d+)\b/i.test(d);
  const tNum = /\b(2|3|4|5|two|three|part\s*\d+)\b/i.test(t);
  if (dNum !== tNum) return false;

  // Subtitle variants (e.g. "Omo Ghetto" vs "Omo Ghetto: The Saga", "Agesinkole: King of Thieves" vs "King of Thieves")
  if (d.includes(':') || t.includes(':')) {
    const dMain = d.split(':')[0].trim();
    const tMain = t.split(':')[0].trim();
    if (dMain === tMain && dMain.length > 5) return true;
    if (d.includes(t) || t.includes(d)) return true;
  }

  return false;
}

async function runReconciliation() {
  console.log('🎬 Starting Precision Box Office & Credit Reconciliation across Productions...\n');

  const movieGrossList: Array<{ rawTitle: string; gross: number; year?: number; source: string }> = [];

  // 1. All-Time Nollywood Box Office
  const allTimeCsvPath = path.join(process.cwd(), 'scratch', 'boxoffice_yearbook_2024', 'movies_all_time_boxoffice.csv');
  if (fs.existsSync(allTimeCsvPath)) {
    const lines = fs.readFileSync(allTimeCsvPath, 'utf8').split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols: string[] = [];
      let inQuotes = false;
      let cur = '';
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === ',' && !inQuotes) {
          cols.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      cols.push(cur.trim());

      const raw = (cols[2] || '').replace(/^"|"$/g, '').replace(/\*$/, '').trim();
      const gross = Number(cols[5]);
      if (raw && gross > 0) {
        movieGrossList.push({
          rawTitle: raw,
          gross,
          source: 'FilmOne Nigerian Box Office Yearbook (All-Time Record)'
        });
      }
    }
  }

  // 2. 2019-2023 Workbook Data
  const wbPath = path.join(process.cwd(), 'outputs', 'boxoffice_yearbooks_2019_2023', 'workbook_data.json');
  if (fs.existsSync(wbPath)) {
    const wb = JSON.parse(fs.readFileSync(wbPath, 'utf8'));
    for (const m of wb.movies || []) {
      if (!m.title || !m.gross_ngn) continue;
      movieGrossList.push({
        rawTitle: m.title.trim(),
        gross: Number(m.gross_ngn),
        year: m.year,
        source: `FilmOne Nigerian Box Office Yearbook (${m.year || '2019-2023'})`
      });
    }
  }

  // Deduplicate movie list taking highest confirmed gross
  const bestMovieMap = new Map<string, { rawTitle: string; gross: number; year?: number; source: string }>();
  for (const m of movieGrossList) {
    const key = normalizeTitleStrict(m.rawTitle);
    const existing = bestMovieMap.get(key);
    if (!existing || m.gross > existing.gross) {
      bestMovieMap.set(key, m);
    }
  }

  console.log(`📦 Compiled ${bestMovieMap.size} unique verified blockbuster grosses from FilmOne Yearbooks.\n`);

  let updatedCount = 0;
  for (const item of bestMovieMap.values()) {
    const searchPart = normalizeTitleStrict(item.rawTitle).split(':')[0].trim();
    if (searchPart.length < 3) continue;

    try {
      const { data: films, error: fErr } = await retry(async () => {
        return await supabase
          .from('films')
          .select('id, title, year, release_type, box_office_domestic, streaming_links')
          .ilike('title', `%${searchPart}%`);
      });

      if (fErr) {
        console.error(`  ❌ Error querying "${item.rawTitle}":`, fErr.message);
        continue;
      }

      for (const film of films || []) {
        if (!matchesExact(film.title, item.rawTitle)) continue;

        const currentGross = Number(film.streaming_links?.box_office?.domestic || film.box_office_domestic || 0);
        if (currentGross < item.gross) {
          const currentLinks = film.streaming_links || {};
          const updatedLinks = {
            ...currentLinks,
            box_office: {
              domestic: item.gross,
              currency: 'NGN',
              source: item.source,
              updated_at: new Date().toISOString()
            }
          };

          const { error: upErr } = await retry(async () => {
            return await supabase
              .from('films')
              .update({
                box_office_domestic: item.gross,
                box_office_currency: 'NGN',
                box_office_source: item.source,
                box_office_updated_at: new Date().toISOString(),
                streaming_links: updatedLinks,
                updated_at: new Date().toISOString()
              })
              .eq('id', film.id);
          });

          if (!upErr) {
            updatedCount++;
            console.log(`  ✓ Updated "${film.title}" -> ₦${item.gross.toLocaleString()}`);
          }
        }
      }
      await sleep(60);
    } catch (err: any) {
      console.error(`  ⚠️ Skipped "${item.rawTitle}":`, err.message);
    }
  }

  console.log(`\n✅ Synced ${updatedCount} cinema productions with official FilmOne gross numbers.\n`);

  // 3. Reconcile Cast Credits on Blockbusters (Mr Macaroni & core cast)
  console.log('🎭 Reconciling Adebowale Adedayo (Mr Macaroni) credits on verified blockbusters...');
  const MACARONI_ID = '36e57a94-0193-4b6e-8813-94755d9bafff';

  const macFilms = [
    {
      titlePattern: '%Battle on Buka Street%',
      character: "Kafayat's Brother / Customer",
      order: 6
    },
    {
      titlePattern: '%Alakada: Bad and Boujee%',
      character: 'Mr Macaroni',
      order: 5
    },
    {
      titlePattern: '%Fate of Alakada%',
      character: 'Mr Macaroni (Cameo)',
      order: 6
    },
    {
      titlePattern: '%A Simple Lie%',
      character: 'Donna',
      order: 5
    }
  ];

  for (const mf of macFilms) {
    const { data: films } = await retry(async () => {
      return await supabase
        .from('films')
        .select('id, title, box_office_domestic')
        .ilike('title', mf.titlePattern);
    });

    for (const f of films || []) {
      // Exclude sequels like "Fate of Alakada 2" or "Alakada Gen Z"
      const lower = f.title.toLowerCase();
      if (lower.includes('gen z') || lower.includes('part 2') || lower.includes('part 3')) continue;

      const { data: existingCredits } = await retry(async () => {
        return await supabase
          .from('credits')
          .select('id, character_name, billing_order')
          .eq('film_id', f.id)
          .eq('person_id', MACARONI_ID);
      });

      if (existingCredits && existingCredits.length > 0) {
        const ec = existingCredits[0];
        if (!ec.character_name) {
          await supabase
            .from('credits')
            .update({ character_name: mf.character, billing_order: ec.billing_order ?? mf.order })
            .eq('id', ec.id);
          console.log(`  ✓ Enriched existing credit in-place for "${f.title}"`);
        } else {
          console.log(`  ℹ️ Credit already attached for "${f.title}" (${ec.character_name})`);
        }
      } else {
        const { error: insErr } = await retry(async () => {
          return await supabase
            .from('credits')
            .insert([{
              film_id: f.id,
              person_id: MACARONI_ID,
              role: 'actor',
              character_name: mf.character,
              billing_order: mf.order
            }]);
        });
        if (!insErr) {
          console.log(`  ✓ Linked credit: "${f.title}" as ${mf.character}`);
        }
      }
      await sleep(60);
    }
  }

  // 4. Verify Mr Macaroni's final totals
  console.log('\n📊 Final Verification of Adebowale Adedayo (Mr Macaroni) Box Office:');
  const { data: credits } = await retry(async () => {
    return await supabase
      .from('credits')
      .select('id, role, character_name, billing_order, films(id, title, year, box_office_domestic, streaming_links)')
      .eq('person_id', MACARONI_ID);
  });

  const finalMap = new Map<string, { title: string; year: number; bo: number; char: string; order: number }>();
  for (const c of credits || []) {
    const f: any = c.films;
    if (!f) continue;
    const bo = Number(f.streaming_links?.box_office?.domestic || f.box_office_domestic || 0);
    if (bo > 0) {
      if (!finalMap.has(f.id) || bo > finalMap.get(f.id)!.bo) {
        finalMap.set(f.id, {
          title: f.title,
          year: f.year,
          bo,
          char: c.character_name || c.role,
          order: c.billing_order ?? 99
        });
      }
    }
  }

  let cumulativeTotal = 0;
  console.log('\nActive Box Office Films on Profile:');
  const sorted = Array.from(finalMap.values()).sort((a, b) => b.bo - a.bo);
  for (const row of sorted) {
    cumulativeTotal += row.bo;
    console.log(`  • ${row.title} (${row.year || 'N/A'}): ₦${row.bo.toLocaleString()} [${row.char}, Order: ${row.order}]`);
  }
  console.log('--------------------------------------------------');
  console.log(`🏆 FINAL RECONCILED THEATRICAL GROSS: ₦${cumulativeTotal.toLocaleString()} (~₦${(cumulativeTotal / 1_000_000_000).toFixed(2)}B)`);
  console.log('--------------------------------------------------\n');
}

runReconciliation().catch(console.error);
