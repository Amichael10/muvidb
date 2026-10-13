import dotenv from 'dotenv';
import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as https from 'https';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Custom DNS lookup to prevent Supabase connection drops on Windows
const customLookup = (hostname: string, options: any, callback: any) => {
  if (hostname === 'pkenrmorywmuvnzfoylp.supabase.co') {
    if (options && options.all) {
      return callback(null, [{ address: '172.64.149.246', family: 4 }]);
    }
    return callback(null, '172.64.149.246', 4);
  }
  return (dns.lookup as any)(hostname, options, callback);
};

setGlobalDispatcher(new Agent({
  connect: {
    lookup: customLookup,
    timeout: 30000
  },
  headersTimeout: 30000,
  bodyTimeout: 30000,
  keepAliveTimeout: 10000
}));

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co').trim();
const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const companyCache = new Map<string, string>();

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function stripParentheses(str: string): string {
  let res = str.replace(/\([^)]*\)/g, '');
  res = res.replace(/[()]/g, '');
  return res.trim();
}

function cleanCompanyName(raw: string): string {
  let name = stripParentheses(raw);
  name = name.replace(/^[•\s\-_.,;:]+|[•\s\-_.,;:]+$/g, '');
  return name.trim().replace(/\s+/g, ' ');
}

function isInvalidCompanyName(name: string): boolean {
  if (!name || name.length < 3) return true;
  const lower = name.toLowerCase().trim();
  const invalidExact = [
    'uganda', 'english', 'luganda', 'kinyarwanda', 'swahili', 'french',
    'the film', 'the cast', 'the crew', 'photos', 'reviews', 'date of release',
    'premiere', 'awards', 'news', 'watch', 'none', 'n/a', 'tba', 'unknown',
    'distributors', 'distributor', 'distribution', 'production', 'productions',
    'producers', 'producer', 'executive producer', 'executive producers', 'company',
    'directors', 'director', 'writers', 'writer'
  ];
  if (invalidExact.includes(lower)) return true;
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(lower)) return true;
  if (/^\d{4}/.test(lower)) return true;
  return false;
}

function parseCompanyNames(raw: string): string[] {
  const cleanRaw = stripParentheses(raw);
  // Split on commas, slashes, or ampersand
  const parts = cleanRaw.split(/,|\/|\s+&\s+|\s+and\s+/i);
  return parts
    .map(p => cleanCompanyName(p))
    .filter(name => !isInvalidCompanyName(name));
}

async function fetchWithHttps(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise<string>((resolve, reject) => {
        https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
          }
        }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP Status ${res.statusCode}`));
            return;
          }
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.warn(`⚠️ [Attempt ${attempt}/${retries}] Fetch failed for ${url}: ${e.message}. Retrying in 2s...`);
      await sleep(2000);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

async function callWithRetry<T>(fn: () => Promise<{ data: T | null; error: any }>, retries = 5, delay = 2000): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await fn();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('fetch failed') || msg.includes('timeout') || error.code === '40001' || error.status === 503) {
          throw error;
        }
        console.error(`❌ DB Error: ${error.message}`);
        return null;
      }
      return data;
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.warn(`⚠️ [Attempt ${attempt}/${retries}] DB call failed: ${e.message}. Retrying in ${delay / 1000}s...`);
      await sleep(delay);
      delay *= 1.5;
    }
  }
  throw new Error('Retries exhausted');
}

async function getOrCreateCompany(rawName: string, role: 'production' | 'distribution'): Promise<string | null> {
  const clean = cleanCompanyName(rawName);
  if (isInvalidCompanyName(clean)) return null;

  const cacheKey = clean.toLowerCase();
  if (companyCache.has(cacheKey)) {
    return companyCache.get(cacheKey)!;
  }

  // 1. Check existing company by case-insensitive name match
  const existing = await callWithRetry<any[]>(async () => {
    return await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', clean)
      .limit(1);
  });

  if (existing && existing.length > 0) {
    const compId = existing[0].id;
    companyCache.set(cacheKey, compId);
    return compId;
  }

  // 2. Create company record
  const created = await callWithRetry<any>(async () => {
    return await supabase
      .from('companies')
      .insert({
        name: clean,
        company_type: role === 'distribution' ? 'distributor' : 'production',
        description: '.',
        website: '.',
        logo_url: null
      })
      .select('id')
      .single();
  });

  if (!created) {
    console.error(`    ❌ Failed to create company "${clean}"`);
    return null;
  }

  companyCache.set(cacheKey, created.id);
  console.log(`    ✨ Created new company: "${clean}" (${role}) [${created.id}]`);
  return created.id;
}

interface ScrapedCompanies {
  title: string;
  year: number | null;
  productionCompanies: string[];
  distributionCompanies: string[];
}

function parseCompaniesFromHtml(html: string): ScrapedCompanies | null {
  const $ = cheerio.load(html);
  const postBody = $('.post-body').clone();
  if (!postBody.length) return null;

  postBody.find('script, style').remove();
  postBody.find('br').replaceWith('\n');
  postBody.find('p, div, h1, h2, h3, h4, h5, h6, li, tr').prepend('\n').append('\n');

  const lines = postBody.text().split('\n').map(l => l.trim()).filter(Boolean);

  let title = '';
  let year: number | null = null;
  const prodComps: Set<string> = new Set();
  const distComps: Set<string> = new Set();

  let inCrew = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('The FILM:')) {
      const filmLine = line.replace('The FILM:', '').trim();
      const yearMatch = filmLine.match(/\((\d{4})\)/);
      if (yearMatch) {
        year = parseInt(yearMatch[1]);
        const index = filmLine.indexOf(yearMatch[0]);
        title = filmLine.substring(0, index).trim();
      } else {
        title = filmLine;
      }
      continue;
    }

    if (line.startsWith('The CREW:')) {
      inCrew = true;
      continue;
    }

    if (inCrew && (
      line.startsWith('The CAST:') ||
      line.startsWith('PHOTOS:') ||
      line.startsWith('AWARDS:') ||
      line.startsWith('NEWS:') ||
      line.startsWith('WATCH:') ||
      line.startsWith('Reviews:')
    )) {
      inCrew = false;
      continue;
    }

    if (inCrew) {
      const lower = line.toLowerCase();

      // Check for Production Company line
      if (lower.startsWith('production company:') || lower.startsWith('production companies:') || lower.startsWith('studio:') || lower.startsWith('studios:')) {
        const val = line.substring(line.indexOf(':') + 1).trim();
        parseCompanyNames(val).forEach(c => prodComps.add(c));
      }
      // Check for Distribution line
      else if (lower.startsWith('distribution:') || lower.startsWith('distributor:') || lower.startsWith('distributors:')) {
        let val = line.substring(line.indexOf(':') + 1).trim();
        // Sometimes "Victoria Film" is followed on next line by "Distributors, NTV Uganda, ..."
        if (i + 1 < lines.length && !lines[i + 1].includes(':') && !lines[i + 1].startsWith('The ') && !lines[i + 1].startsWith('Country')) {
          const next = lines[i + 1].trim();
          if (next.toLowerCase().startsWith('distributors,')) {
            val += ' ' + next;
          } else {
            val += ', ' + next;
          }
        }
        // Handle "Victoria Film Distributors" cleanly if split
        val = val.replace(/Victoria Film\s+Distributors/gi, 'Victoria Film Distributors');
        parseCompanyNames(val).forEach(c => distComps.add(c));
      }
      // Check for other studio / production lines in crew
      else if (lower.startsWith('main titles:') || lower.startsWith('vfx:') || lower.startsWith('animation:')) {
        const val = line.substring(line.indexOf(':') + 1).trim();
        if (/\b(studios?|media|films?|productions?)\b/i.test(val)) {
          parseCompanyNames(val).forEach(c => prodComps.add(c));
        }
      }
    }
  }

  if (!title) return null;

  return {
    title,
    year,
    productionCompanies: Array.from(prodComps),
    distributionCompanies: Array.from(distComps)
  };
}

async function findFilm(url: string, title: string): Promise<any | null> {
  // 1. Search by streaming_links containing AccessKla URL
  const { data: byLink } = await supabase
    .from('films')
    .select('id, title, year')
    .filter('streaming_links', 'cs', JSON.stringify([{ url }]))
    .limit(1);

  if (byLink && byLink.length > 0) return byLink[0];

  // 2. Exact title match with country Uganda
  const cleanTitle = title.replace(/['"“”]/g, '').trim();
  const { data: byTitle } = await supabase
    .from('films')
    .select('id, title, year')
    .ilike('title', cleanTitle)
    .contains('countries', ['Uganda'])
    .limit(1);

  if (byTitle && byTitle.length > 0) return byTitle[0];

  // 3. Fallback fuzzy ilike
  const { data: byFuzzy } = await supabase
    .from('films')
    .select('id, title, year')
    .ilike('title', `%${cleanTitle}%`)
    .limit(1);

  if (byFuzzy && byFuzzy.length > 0) return byFuzzy[0];

  return null;
}

async function syncMovieCompanies(url: string, stats: { totalLinked: number; totalCreated: number }) {
  try {
    const html = await fetchWithHttps(url);
    const parsed = parseCompaniesFromHtml(html);
    if (!parsed) {
      console.log(`⚠️ Could not parse film or title from ${url}`);
      return;
    }

    if (parsed.productionCompanies.length === 0 && parsed.distributionCompanies.length === 0) {
      console.log(`⏭️ [${parsed.title}] No company entries found in crew.`);
      return;
    }

    const film = await findFilm(url, parsed.title);
    if (!film) {
      console.log(`⚠️ Film not found in database: "${parsed.title}"`);
      return;
    }

    console.log(`\n🎬 [${film.title}] (ID: ${film.id})`);

    // Ingest Production Companies
    for (const prodName of parsed.productionCompanies) {
      const companyId = await getOrCreateCompany(prodName, 'production');
      if (companyId) {
        // Link in film_companies
        const { data: existingLink } = await supabase
          .from('film_companies')
          .select('company_id')
          .eq('film_id', film.id)
          .eq('company_id', companyId)
          .eq('role', 'production')
          .maybeSingle();

        if (!existingLink) {
          const { error: linkErr } = await supabase
            .from('film_companies')
            .insert({
              film_id: film.id,
              company_id: companyId,
              role: 'production'
            });

          if (!linkErr) {
            console.log(`   🏢 Linked Production: "${prodName}"`);
            stats.totalLinked++;
          } else {
            console.warn(`   ⚠️ Link error for "${prodName}": ${linkErr.message}`);
          }
        } else {
          console.log(`   ✓ Already linked Production: "${prodName}"`);
        }
      }
    }

    // Ingest Distribution Companies
    for (const distName of parsed.distributionCompanies) {
      const companyId = await getOrCreateCompany(distName, 'distribution');
      if (companyId) {
        const { data: existingLink } = await supabase
          .from('film_companies')
          .select('company_id')
          .eq('film_id', film.id)
          .eq('company_id', companyId)
          .eq('role', 'distribution')
          .maybeSingle();

        if (!existingLink) {
          const { error: linkErr } = await supabase
            .from('film_companies')
            .insert({
              film_id: film.id,
              company_id: companyId,
              role: 'distribution'
            });

          if (!linkErr) {
            console.log(`   🚚 Linked Distribution: "${distName}"`);
            stats.totalLinked++;
          } else {
            console.warn(`   ⚠️ Link error for "${distName}": ${linkErr.message}`);
          }
        } else {
          console.log(`   ✓ Already linked Distribution: "${distName}"`);
        }
      }
    }

  } catch (e: any) {
    console.error(`❌ Error syncing movie companies for ${url}: ${e.message}`);
  }
}

async function run() {
  const args = process.argv.slice(2);
  let limit = 0;
  let offset = 0;
  let delayMs = 1200;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--offset' && args[i + 1]) {
      offset = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      delayMs = parseInt(args[i + 1]);
      i++;
    }
  }

  console.log(`🚀 Starting Ugandan Film Companies Sync...`);
  console.log(`   - Limit: ${limit || 'All'}`);
  console.log(`   - Offset: ${offset}`);
  console.log(`   - Delay: ${delayMs}ms\n`);

  const listUrl = 'https://www.accesskla.com/2024/01/list-of-all-ugandan-movies-z.html?m=1';
  console.log(`📋 Fetching Ugandan Movies list: ${listUrl}`);

  const html = await fetchWithHttps(listUrl);
  const $ = cheerio.load(html);

  const movieUrls: string[] = [];
  $('.post-body a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /\/\d{4}\/\d{2}\//.test(href) && !href.includes('list-of-all-ugandan-movies')) {
      movieUrls.push(href);
    }
  });

  console.log(`🔍 Found ${movieUrls.length} total movie URLs in catalog.`);

  let targetUrls = movieUrls.slice(offset);
  if (limit > 0) {
    targetUrls = targetUrls.slice(0, limit);
  }

  console.log(`🏃 Processing ${targetUrls.length} movies for company links...\n`);

  const stats = { totalLinked: 0, totalCreated: 0 };

  for (let i = 0; i < targetUrls.length; i++) {
    const url = targetUrls[i];
    console.log(`[${i + 1}/${targetUrls.length}] ${url}`);
    await syncMovieCompanies(url, stats);
    await sleep(delayMs);
  }

  console.log(`\n🎉 Ugandan Film Companies Sync complete!`);
  console.log(`   - Total links created in film_companies: ${stats.totalLinked}`);
}

run().catch(e => {
  console.error('💀 Fatal execution error:', e);
  process.exit(1);
});
