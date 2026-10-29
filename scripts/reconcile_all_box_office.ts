import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { normalizeTitleStrict, titleMatchScore, instalmentKey } from './lib/yearbook_title_match';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface MasterBoxOffice {
  title: string;
  gross_ngn: number;
  opening_weekend_ngn?: number;
  year?: number;
  source: string;
}

async function reconcileAllBoxOffice() {
  console.log('🎬 Starting Precision Universal Nollywood Box Office Reconciliation...');

  const masterList: MasterBoxOffice[] = [];

  function addEntry(title: string, gross: number, source: string, year?: number, opening?: number) {
    if (!title || !gross || isNaN(gross) || gross <= 0) return;
    const cleanTitle = title.trim();
    const existing = masterList.find(m => normalizeTitleStrict(m.title) === normalizeTitleStrict(cleanTitle) && instalmentKey(m.title) === instalmentKey(cleanTitle));
    if (existing) {
      if (gross > existing.gross_ngn) {
        existing.gross_ngn = Math.round(gross);
        existing.source = source || existing.source;
      }
      if (opening && (!existing.opening_weekend_ngn || opening > existing.opening_weekend_ngn)) {
        existing.opening_weekend_ngn = Math.round(opening);
      }
      if (year && !existing.year) existing.year = year;
    } else {
      masterList.push({
        title: cleanTitle,
        gross_ngn: Math.round(gross),
        opening_weekend_ngn: opening ? Math.round(opening) : undefined,
        year,
        source: source || 'Verified CEAN / FilmOne'
      });
    }
  }

  // 1. FilmOne 2024 Yearbook Extract (XLSX)
  const xlsxPath = path.join(process.cwd(), 'outputs', 'boxoffice_yearbook_2024', 'filmone_boxoffice_yearbook_2024_extract.xlsx');
  if (fs.existsSync(xlsxPath)) {
    console.log('📊 Loading 2024 Yearbook Extract XLSX...');
    const buffer = fs.readFileSync(xlsxPath);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    
    // Movies 2024
    if (wb.Sheets['Movies 2024']) {
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Movies 2024']);
      for (const r of rows) {
        const title = r.title;
        const gross = parseFloat(String(r.box_office_ngn || '').replace(/,/g, ''));
        addEntry(title, gross, 'FilmOne Nigerian Box Office Yearbook 2024', 2024);
      }
    }

    // Movies All Time
    if (wb.Sheets['Movies All Time']) {
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Movies All Time']);
      for (const r of rows) {
        const title = r.title;
        const gross = parseFloat(String(r.box_office_ngn || '').replace(/,/g, ''));
        addEntry(title, gross, 'FilmOne Nigerian Box Office Yearbook (All-Time Record)');
      }
    }
  }

  // 2. FilmOne 2019-2023 Workbook Data (JSON)
  const wbJsonPath = path.join(process.cwd(), 'outputs', 'boxoffice_yearbooks_2019_2023', 'workbook_data.json');
  if (fs.existsSync(wbJsonPath)) {
    console.log('📊 Loading 2019-2023 Yearbook Data JSON...');
    const wb = JSON.parse(fs.readFileSync(wbJsonPath, 'utf8'));
    for (const m of wb.movies || []) {
      const title = m.title;
      const gross = parseFloat(String(m.gross_ngn || '').replace(/,/g, ''));
      addEntry(title, gross, `FilmOne Box Office Yearbook (${m.year || '2019-2023'})`, m.year);
    }
  }

  // 3. Verified Nollywood Blockbusters
  const curated = [
    { title: 'Starlomo', gross: 89400000, opening: 45800000, year: 2026, source: 'CEAN / FilmOne' },
    { title: 'A Tribe Called Judah', gross: 1408277541, year: 2023, source: 'CEAN Official / Comscore' },
    { title: 'Everybody Loves Jenifa', gross: 1880000000, year: 2024, source: 'CEAN / FilmOne 2024/2025' },
    { title: 'Battle on Buka Street', gross: 668423056, year: 2022, source: 'CEAN Official' },
    { title: 'Omo Ghetto: The Saga', gross: 636129120, year: 2020, source: 'CEAN Official' },
    { title: 'The Wedding Party 2: Destination Dubai', gross: 502400000, year: 2017, source: 'CEAN Official' },
    { title: 'The Wedding Party', gross: 452288605, year: 2016, source: 'CEAN Official' },
    { title: 'Chief Daddy', gross: 387500000, year: 2018, source: 'CEAN Official' },
    { title: 'Queen Lateefah', gross: 365518067, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Brotherhood', gross: 328881120, year: 2022, source: 'CEAN Official' },
    { title: 'King of Thieves (Agesinkole)', gross: 320805150, year: 2022, source: 'CEAN Official' },
    { title: 'Sugar Rush', gross: 287053270, year: 2019, source: 'CEAN Official' },
    { title: 'Ijakumo: The Born Again Stripper', gross: 278496584, year: 2022, source: 'CEAN Official' },
    { title: 'Ajosepo', gross: 257254189, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Beast of Two Worlds (Ajakaju)', gross: 252801675, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Alakada: Bad and Boujee', gross: 230180725, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Lakatabu', gross: 202253250, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'The Waiter', gross: 184706738, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: "Farmer's Bride", gross: 167194970, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Funmilayo Ransome Kuti', gross: 157096847, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Muri and Ko', gross: 136021936, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: "All's Fair in Love", gross: 132020689, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Wives on Strike: The Uprising', gross: 127146697, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'What About Us', gross: 111462141, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Ghetto Love Story', gross: 94824996, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Thin Line', gross: 87874601, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Blacksmith: Alagbede', gross: 65136725, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Criminal', gross: 55850416, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'The Silent Intruder', gross: 52659076, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'The Betrayed', gross: 46103750, year: 2024, source: 'FilmOne Box Office Yearbook 2024' },
    { title: 'Saving Onome', gross: 43406630, year: 2024, source: 'FilmOne Box Office Yearbook 2024' }
  ];

  for (const c of curated) {
    addEntry(c.title, c.gross, c.source, c.year, c.opening);
  }

  console.log(`\n✅ Compiled ${masterList.length} verified blockbuster entries.\n`);

  let totalUpdated = 0;

  for (const item of masterList) {
    // Exact search query: first main title token or exact clean title
    const searchToken = item.title.split(/[:(]/)[0].trim();
    if (searchToken.length < 3) continue;

    const { data: candidates, error } = await supabase
      .from('films')
      .select('id, slug, title, year, box_office_domestic, box_office_opening_weekend, streaming_links')
      .ilike('title', `%${searchToken}%`);

    if (error || !candidates || candidates.length === 0) continue;

    for (const film of candidates) {
      // Use STRICT title matcher: score must be >= 70 (exact match or exact subtitle match)
      const score = titleMatchScore(film.title, item.title);
      if (score == null || score < 70) continue;

      // Ensure instalment keys match (no matching sequel to original)
      if (instalmentKey(film.title) !== instalmentKey(item.title)) continue;

      // If both have release years, ensure they are within 1 year of each other
      if (item.year && film.year && Math.abs(Number(film.year) - Number(item.year)) > 1) {
        continue;
      }

      const currentGross = Number(film.box_office_domestic || film.streaming_links?.box_office?.domestic || 0);
      const currentOpening = Number(film.box_office_opening_weekend || film.streaming_links?.box_office?.opening_weekend || 0);

      const needGross = currentGross < item.gross_ngn;
      const needOpening = item.opening_weekend_ngn && currentOpening < item.opening_weekend_ngn;

      if (needGross || needOpening) {
        const targetGross = Math.max(currentGross, item.gross_ngn);
        const targetOpening = item.opening_weekend_ngn || currentOpening || undefined;

        const currentLinks = film.streaming_links || {};
        const updatedLinks = {
          ...currentLinks,
          box_office: {
            domestic: targetGross,
            opening_weekend: targetOpening,
            currency: 'NGN',
            source: item.source,
            updated_at: new Date().toISOString()
          }
        };

        const payload: any = {
          box_office_domestic: targetGross,
          box_office_currency: 'NGN',
          box_office_source: item.source,
          box_office_updated_at: new Date().toISOString(),
          streaming_links: updatedLinks,
          updated_at: new Date().toISOString()
        };

        if (targetOpening) {
          payload.box_office_opening_weekend = targetOpening;
        }

        const { error: upErr } = await supabase
          .from('films')
          .update(payload)
          .eq('id', film.id);

        if (!upErr) {
          totalUpdated++;
          console.log(`  ✓ Updated "${film.title}" (${film.slug}) -> ₦${targetGross.toLocaleString()}${targetOpening ? ` (Opening: ₦${targetOpening.toLocaleString()})` : ''}`);
        } else {
          console.error(`  ❌ Failed updating "${film.title}":`, upErr.message);
        }
      }
    }
  }

  console.log(`\n🎉 Reconciled all box office entries! Total films updated: ${totalUpdated}\n`);
}

reconcileAllBoxOffice().catch(err => {
  console.error('Fatal error during reconciliation:', err);
  process.exit(1);
});
