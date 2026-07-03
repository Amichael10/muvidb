import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load stealth plugin
const stealthPlugin = stealth();
chromium.use(stealthPlugin);

dotenv.config({ path: './.env.local' });
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const TMDB_KEY = process.env.TMDB_API_KEY;

const isDryRun = process.argv.includes('--dry-run');

/** Decodes high-resolution image URL from Next.js _next/image wrappers */
function decodeNextImageUrl(src: string): string {
  if (!src) return '';
  try {
    const urlObj = new URL(src, 'https://filmflux.app');
    const originalUrl = urlObj.searchParams.get('url');
    return originalUrl ? decodeURIComponent(originalUrl) : src;
  } catch {
    return src;
  }
}

/** Parses date of birth string (e.g. "12 March 1990") to YYYY-MM-DD in local time */
function parseDateOfBirth(dobText: string): string | null {
  if (!dobText) return null;
  try {
    const date = new Date(dobText);
    if (isNaN(date.getTime())) return null;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return null;
  }
}

/** Look up person on TMDB for additional details like gender/place of birth */
async function lookupPersonOnTMDB(name: string): Promise<{
  photo_url?: string;
  biography?: string;
  tmdb_id?: number;
  gender?: string;
  place_of_birth?: string;
  birthday?: string;
} | null> {
  if (!TMDB_KEY) return null;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;

    // Fetch full details
    const detRes = await fetch(`https://api.themoviedb.org/3/person/${result.id}?api_key=${TMDB_KEY}`);
    if (!detRes.ok) return null;
    const detData = await detRes.json();

    let genderStr = 'Prefer not to say';
    if (detData.gender === 1) genderStr = 'Female';
    else if (detData.gender === 2) genderStr = 'Male';

    return {
      tmdb_id: result.id,
      photo_url: result.profile_path ? `https://image.tmdb.org/t/p/w500${result.profile_path}` : undefined,
      biography: detData.biography?.trim() || undefined,
      gender: genderStr,
      place_of_birth: detData.place_of_birth || undefined,
      birthday: detData.birthday || undefined
    };
  } catch {
    return null;
  }
}

async function harvestActors() {
  console.log('Fetching existing people from database to optimize crawls (paginated)...');
  const allPeople: any[] = [];
  let dbPage = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data: dbPeople, error: dbError } = await supabase
      .from('people')
      .select('id, name, slug, bio, photo_url, date_of_birth, instagram_url, twitter_url, facebook_url')
      .range(dbPage * pageSize, (dbPage + 1) * pageSize - 1);
    
    if (dbError) {
      console.error('❌ Error fetching existing people:', dbError.message);
      process.exit(1);
    }
    
    if (!dbPeople || dbPeople.length === 0) break;
    allPeople.push(...dbPeople);
    if (dbPeople.length < pageSize) break;
    dbPage++;
  }

  const existingMap = new Map<string, any>();
  const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  for (const person of allPeople) {
    const slug = person.slug || slugify(person.name);
    existingMap.set(slug, person);
  }
  console.log(`✅ Loaded ${existingMap.size} existing people into memory.`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  let page = await context.newPage();

  try {
    console.log(`\n🚀 Starting Filmflux Alphabetical Actors Scraper${isDryRun ? ' (DRY RUN)' : ''}...`);

    // 1. Discovery Phase
    console.log('Navigating to Filmflux Actors list...');
    await page.goto('https://filmflux.app/actors', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const uniqueLinks: string[] = [];

    for (const letter of letters) {
      console.log(`\nFiltering by letter: "${letter}"`);
      try {
        await page.waitForSelector(`button:has-text("${letter}")`, { timeout: 15000 });
      } catch {
        console.log(`⚠️ Button for letter "${letter}" not found. Skipping.`);
        continue;
      }

      const letterBtn = await page.evaluateHandle((l) => {
        return Array.from(document.querySelectorAll('button')).find(el => el.textContent?.trim() === l);
      }, letter);

      if (letterBtn) {
        // @ts-ignore
        await letterBtn.click();
        await page.waitForTimeout(3000); // Wait for filtered list to load
      } else {
        console.log(`⚠️ Failed to find button for "${letter}".`);
        continue;
      }

      console.log(`Paginating / Scrolling to load all actors starting with "${letter}"...`);
      let previousHeight = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 40; // Max scrolls to load all actors under this letter

      while (scrollAttempts < maxScrollAttempts) {
        try {
          const currentHeight = await page.evaluate(() => document.body.scrollHeight);
          
          // Scroll to the bottom of the page
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(2500); // Wait for items to fetch and render

          const newHeight = await page.evaluate(() => document.body.scrollHeight);
          
          if (newHeight === previousHeight) {
            // Re-check after brief delay
            await page.waitForTimeout(2000);
            const secondAttemptHeight = await page.evaluate(() => document.body.scrollHeight);
            if (secondAttemptHeight === previousHeight) {
              console.log(`  [${letter}] Reached bottom of page after ${scrollAttempts} scrolls.`);
              break;
            }
          }
          
          previousHeight = newHeight;
          scrollAttempts++;
          if (scrollAttempts % 5 === 0) {
            console.log(`  [${letter}] Scrolled ${scrollAttempts} times (height: ${newHeight})...`);
          }
        } catch (scrollError) {
          break;
        }
      }

      const linksForLetter = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => a.href)
          .filter(href => href.includes('/actor/'));
      });

      const newLinksCountBefore = uniqueLinks.length;
      for (const link of linksForLetter) {
        if (!uniqueLinks.includes(link)) {
          uniqueLinks.push(link);
        }
      }
      console.log(`✅ Discovered ${uniqueLinks.length - newLinksCountBefore} new links for letter "${letter}". Total so far: ${uniqueLinks.length}`);
    }

    console.log(`\n✅ Discovery Complete! Total unique links found: ${uniqueLinks.length}`);

    // 2. Pre-Filtering Phase
    const targetsToCrawl: string[] = [];
    const skippedAlreadyComplete: string[] = [];

    for (const link of uniqueLinks) {
      const slug = link.split('/').pop() || '';
      const existing = existingMap.get(slug);

      if (existing) {
        // Actor exists in DB. Check if they have a complete profile or need enrichment.
        const needsEnrichment = !existing.bio || 
                                !existing.photo_url || 
                                !existing.date_of_birth || 
                                (!existing.instagram_url && !existing.twitter_url && !existing.facebook_url);
        
        if (needsEnrichment) {
          targetsToCrawl.push(link);
        } else {
          skippedAlreadyComplete.push(link);
        }
      } else {
        // Actor is new to our DB
        targetsToCrawl.push(link);
      }
    }

    console.log(`\n📊 Scrape Optimization Summary:`);
    console.log(`- Total discovered links: ${uniqueLinks.length}`);
    console.log(`- Skipped (Complete in DB): ${skippedAlreadyComplete.length}`);
    console.log(`- Crawling required (New / Needs Enrichment): ${targetsToCrawl.length}`);

    const limitArgIndex = process.argv.indexOf('--limit');
    let crawlLimit = 350;
    if (limitArgIndex !== -1 && process.argv[limitArgIndex + 1]) {
      crawlLimit = parseInt(process.argv[limitArgIndex + 1], 10);
    }

    const targets = isDryRun ? targetsToCrawl.slice(0, 3) : targetsToCrawl.slice(0, crawlLimit);
    console.log(`\nProcessing ${targets.length} actors (limit: ${crawlLimit})...`);

    let inserted = 0;
    let enriched = 0;
    let skipped = 0;
    let errors = 0;

    // 3. Scraping Phase
    for (const link of targets) {
      try {
        console.log(`\nCrawling: ${link}`);
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(1500); // Wait for Next.js hydration

        const data = await page.evaluate(() => {
          // Extract Name - target main h1 or specific classes to avoid the header logo
          const name = document.querySelector('main h1, h1.text-3xl, h1.text-4xl, [class*="actor-name"]')?.textContent?.trim() || '';

          // Extract Image
          const imgEl = document.querySelector('img.object-cover, img[class*="profile"], img[class*="actor"]') as HTMLImageElement;
          const rawPhotoUrl = imgEl?.src || '';

          // Extract Bio
          const bioEl = document.querySelector('p.text-gray-400.text-sm.leading-relaxed, .scene45-hero-bio p, [class*="bio"] p');
          const bio = bioEl?.textContent?.trim() || '';

          // Extract Birthday
          const allElements = Array.from(document.querySelectorAll('p, span, div'));
          const bornHeader = allElements.find(el => el.textContent?.trim() === 'Born');
          const birthdayRaw = bornHeader?.nextElementSibling?.textContent?.trim() || '';

          // Extract Social Links
          const socialLinks = Array.from(document.querySelectorAll('a')).map(a => a.href);
          
          // Inline brand filters to avoid ESBuild name helpers and ReferenceError: __name is not defined
          const instagram = socialLinks.find(h => h.includes('instagram.com/') && !h.toLowerCase().includes('filmflux') && !h.toLowerCase().includes('61583527341257')) || null;
          const twitter = socialLinks.find(h => (h.includes('twitter.com/') || h.includes('x.com/')) && !h.toLowerCase().includes('filmflux') && !h.toLowerCase().includes('61583527341257')) || null;
          const facebook = socialLinks.find(h => h.includes('facebook.com/') && !h.toLowerCase().includes('filmflux') && !h.toLowerCase().includes('61583527341257')) || null;

          return { name, rawPhotoUrl, bio, birthdayRaw, instagram, twitter, facebook };
        });

        if (!data.name || data.name.toLowerCase() === 'filmflux') {
          console.log(`  ⚠️ Skipping invalid actor name: ${data.name}`);
          skipped++;
          continue;
        }

        const name = data.name.trim();
        const photo_url = decodeNextImageUrl(data.rawPhotoUrl);
        const dobStr = parseDateOfBirth(data.birthdayRaw);
        
        const filterBrand = (url: string | null) => {
          if (!url) return null;
          const u = url.toLowerCase();
          if (u.includes('filmflux')) return null;
          return url;
        };

        const instagram_url = filterBrand(data.instagram);
        const twitter_url = filterBrand(data.twitter);
        const facebook_url = filterBrand(data.facebook);

        console.log(`  Name: ${name}`);
        console.log(`  DOB parsed: ${dobStr || 'N/A'} (${data.birthdayRaw || 'N/A'})`);
        console.log(`  Photo URL: ${photo_url || 'N/A'}`);
        console.log(`  Bio excerpt: ${data.bio ? data.bio.slice(0, 80) + '...' : 'N/A'}`);
        console.log(`  Instagram: ${instagram_url || 'N/A'}`);
        console.log(`  Twitter: ${twitter_url || 'N/A'}`);
        console.log(`  Facebook: ${facebook_url || 'N/A'}`);

        // TMDB Enrichment
        let tmdbData = await lookupPersonOnTMDB(name);
        await new Promise(r => setTimeout(r, 150)); // Rate limit buffer

        const finalDOB = dobStr || (tmdbData?.birthday ? tmdbData.birthday : null);
        const finalBio = data.bio || tmdbData?.biography || null;
        const finalPhoto = photo_url || tmdbData?.photo_url || null;
        const gender = tmdbData?.gender || 'Prefer not to say';
        
        let nationality = null;
        let birthplace = tmdbData?.place_of_birth || null;
        if (birthplace && birthplace.toLowerCase().includes('nigeria')) {
          nationality = 'Nigerian';
        }

        if (isDryRun) {
          console.log('  [Dry Run] Data values that would be updated/inserted:');
          console.log({
            name,
            bio: finalBio ? finalBio.slice(0, 100) + '...' : null,
            photo_url: finalPhoto,
            date_of_birth: finalDOB,
            gender,
            nationality,
            birthplace,
            instagram_url,
            twitter_url,
            facebook_url,
            tmdb_id: tmdbData?.tmdb_id || null,
            source: 'filmflux'
          });
          continue;
        }

        // Database logic
        const { data: existing } = await supabase.from('people')
          .select('*')
          .ilike('name', name);

        if (existing && existing.length > 0) {
          const person = existing[0];
          const updates: any = {};
          
          if (!person.bio && finalBio) updates.bio = finalBio;
          if (!person.photo_url && finalPhoto) updates.photo_url = finalPhoto;
          if (!person.date_of_birth && finalDOB) updates.date_of_birth = finalDOB;
          if ((!person.gender || person.gender === 'Prefer not to say') && gender !== 'Prefer not to say') updates.gender = gender;
          if (!person.nationality && nationality) updates.nationality = nationality;
          if (!person.birthplace && birthplace) updates.birthplace = birthplace;
          if (!person.instagram_url && instagram_url) updates.instagram_url = instagram_url;
          if (!person.twitter_url && twitter_url) updates.twitter_url = twitter_url;
          if (!person.facebook_url && facebook_url) updates.facebook_url = facebook_url;
          if (!person.tmdb_id && tmdbData?.tmdb_id) updates.tmdb_id = tmdbData.tmdb_id;

          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase.from('people').update(updates).eq('id', person.id);
            if (updateError) {
              console.error(`  ❌ Error updating ${name}:`, updateError.message);
              errors++;
            } else {
              console.log(`  ✨ Enriched existing actor profile.`);
              enriched++;
            }
          } else {
            console.log(`  ✔️ No new details to enrich.`);
            skipped++;
          }
        } else {
          // New actor insert
          const { error: insertError } = await supabase.from('people').insert({
            name,
            bio: finalBio,
            photo_url: finalPhoto,
            date_of_birth: finalDOB,
            gender,
            nationality: nationality || 'Nigerian',
            birthplace,
            instagram_url,
            twitter_url,
            facebook_url,
            tmdb_id: tmdbData?.tmdb_id || null,
            source: 'filmflux'
          });

          if (insertError) {
            console.error(`  ❌ Error inserting ${name}:`, insertError.message);
            errors++;
          } else {
            console.log(`  ✨ Inserted new actor into database.`);
            inserted++;
          }
        }
      } catch (e: any) {
        console.error(`  ❌ Error processing actor detail:`, e.message);
        errors++;
        // Re-create page to clear stuck/interrupted navigation state
        try {
          await page.close();
        } catch {}
        page = await context.newPage();
        // Cooling down after error
        await new Promise(r => setTimeout(r, 3000));
      }
      
      // Cooldown after successfully processing an actor to prevent rate limits
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log(`\n✅ Harvester Run Complete!`);
    console.log(`Inserted: ${inserted}, Enriched: ${enriched}, Skipped: ${skipped}, Errors: ${errors}`);

  } catch (error) {
    console.error('💀 Fatal error:', error);
  } finally {
    await browser.close();
  }
}

harvestActors();
