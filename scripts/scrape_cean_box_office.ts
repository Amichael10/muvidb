import { createClient } from '@supabase/supabase-js';
import cheerio from 'cheerio';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface CEANBoxOfficeEntry {
  rank?: number;
  title: string;
  weekendGross?: number;
  cumulativeGross: number;
  weeksReleased?: number;
  distributor?: string;
}

/**
 * Scrapes & parses weekly box office figures from CEAN (Cinema Exhibitors Association of Nigeria)
 * and syncs updated gross earnings to MuviDB Supabase films.
 */
export async function syncCEANBoxOffice() {
  console.log('---------------------------------------------------------');
  console.log('🍿 CEAN & COMSCORE WEEKLY BOX OFFICE MONITORING SYNC 🇳🇬');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('---------------------------------------------------------');

  const targets = [
    { url: 'https://ceanigeria.com/box-office/', type: 'cean_official' },
    { url: 'https://ceanigeria.com/news/', type: 'cean_news' }
  ];

  let totalUpdated = 0;

  for (const target of targets) {
    try {
      console.log(`Fetching CEAN data from: ${target.url}...`);
      const response = await fetch(target.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (!response.ok) {
        console.warn(`Failed to fetch ${target.url}: HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const entries: CEANBoxOfficeEntry[] = [];

      // Parse box office tables or lists on CEAN website
      $('table tr, .box-office-item, .entry-content p').each((_, elem) => {
        const text = $(elem).text().trim();
        // Look for Naira figures like ₦120,500,000 or N120.5M
        const nairaMatch = text.match(/(?:₦|N|\bNGN\b)\s*([\d,]+(?:\.\d+)?(?:\s*[mMkK])?)/i);
        if (nairaMatch && text.length > 5 && text.length < 200) {
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length >= 1) {
            const rawAmount = nairaMatch[1].replace(/,/g, '');
            let amount = parseFloat(rawAmount);
            if (nairaMatch[1].toLowerCase().includes('m')) {
              amount = amount * 1_000_000;
            } else if (nairaMatch[1].toLowerCase().includes('k')) {
              amount = amount * 1_000;
            }

            if (amount > 1_000_000) {
              const titleCandidate = lines[0].replace(/^\d+[\.\s-]*/, '').trim();
              if (titleCandidate.length > 2 && !titleCandidate.toLowerCase().includes('total')) {
                entries.push({
                  title: titleCandidate,
                  cumulativeGross: amount,
                });
              }
            }
          }
        }
      });

      console.log(`Extracted ${entries.length} raw box office entries from ${target.url}`);

      // Sync matched entries to Supabase
      for (const entry of entries) {
        const cleanTitle = entry.title.replace(/[\(\):]/g, '').trim();
        
        const { data: matchedFilms } = await supabase
          .from('films')
          .select('id, title, box_office_domestic')
          .ilike('title', `%${cleanTitle}%`)
          .limit(3);

        if (matchedFilms && matchedFilms.length > 0) {
          for (const film of matchedFilms) {
            // Only update if cumulative gross is higher than current record
            if (!film.box_office_domestic || entry.cumulativeGross > film.box_office_domestic) {
              const { error } = await supabase
                .from('films')
                .update({
                  box_office_domestic: entry.cumulativeGross,
                  box_office_currency: 'NGN',
                  box_office_source: 'CEAN Weekly Automated Monitor',
                  box_office_updated_at: new Date().toISOString()
                })
                .eq('id', film.id);

              if (!error) {
                console.log(`✅ [CEAN MONITOR] Updated "${film.title}" -> ₦${entry.cumulativeGross.toLocaleString('en-NG')}`);
                totalUpdated++;
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error(`Error during CEAN monitoring fetch for ${target.url}:`, err.message || err);
    }
  }

  console.log(`---------------------------------------------------------`);
  console.log(`🍿 CEAN & Comscore Monitor completed: ${totalUpdated} film box office records updated.`);
  console.log(`---------------------------------------------------------`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncCEANBoxOffice();
}
