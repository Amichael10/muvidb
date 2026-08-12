import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function cleanTitle(title: string): string {
  return title
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/Nollywood Movie|Latest Yoruba Movie|Yoruba Movie \d+|Full Movie/gi, '')
    .replace(/season\s+\d+|part\s+\d+|ep\s+\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function findOrCreateInkblotCompany(): Promise<string> {
  const companyName = 'Inkblot Productions';
  const bio =
    'Inkblot Productions is a Lagos-based film and TV studio established in 2010, crafting blockbuster Nollywood hits like The Wedding Party series, Knock Knock, The Set Up, Far From Home and more.';

  // Check if company exists
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', '%Inkblot%')
    .limit(1);

  const payload = {
    name: companyName,
    slug: 'inkblot-productions',
    description: bio,
    type: 'production_studio',
    logo_url: 'https://ink-blot.tv/assets/images/inkblot-tv-logo-lightlight.png',
    website_url: 'https://ink-blot.tv',
    facebook_url: 'https://web.facebook.com/InkblotPresents',
    instagram_url: 'https://www.instagram.com/inkblotpresents',
    twitter_url: 'https://twitter.com/InkblotPresents',
    tiktok_url: 'https://www.tiktok.com/@inkblotpresents',
    youtube_channel_id: '@inkblotpresents',
    countries: ['Nigeria'],
    founded_year: 2010,
    updated_at: new Date().toISOString(),
  };

  if (existing && existing.length > 0) {
    const id = existing[0].id;
    console.log(`Found existing Inkblot company record (${id}). Updating info...`);
    await supabase.from('companies').update(payload).eq('id', id);
    return id;
  }

  // Insert new company
  console.log('Creating new Inkblot Productions company record...');
  const { data: newComp, error } = await supabase
    .from('companies')
    .insert(payload)
    .select('id')
    .single();

  if (error || !newComp) {
    throw new Error(`Failed to create company Inkblot: ${error?.message}`);
  }

  return newComp.id;
}

async function linkFilmCompany(filmId: string, companyId: string, role: string = 'production') {
  try {
    await supabase
      .from('film_companies')
      .upsert(
        {
          film_id: filmId,
          company_id: companyId,
          role: role,
        },
        { onConflict: 'film_id,company_id,role' }
      );
  } catch (err: any) {
    console.warn(`Warning linking film to company: ${err.message}`);
  }
}

async function syncInkblotMovies(companyId: string) {
  console.log('\n🎬 Fetching official Inkblot Productions movies from Cockpit CMS...');

  const apiUrl = 'https://dash.ink-blot.tv/api/content/items/Movies?limit=200';
  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch Inkblot CMS API: ${res.status}`);
  }

  const movies: any[] = await res.json();
  console.log(`Loaded ${movies.length} official Inkblot movies from website.\n`);

  // Map streaming platform names from Inkblot to our platform keys
  const platformMap: Record<string, string> = {
    netflix: 'netflix',
    kava: 'kava',
    prime: 'prime_video',
    'amazon prime': 'prime_video',
    'prime video': 'prime_video',
    showmax: 'showmax',
    youtube: 'youtube',
    docuth: 'docuth',
    cinema: 'cinema',
    'now showing': 'cinema',
  };

  let addedCount = 0;
  let updatedCount = 0;

  for (const item of movies) {
    if (!item.Title) continue;

    const title = cleanTitle(item.Title);
    const releaseDate = item['Release Date'] || null;
    const year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;
    const synopsis = item.Synopsis || null;
    const trailerId = item.Trailer || null;
    const genre = item.Genre ? [item.Genre] : ['Drama'];
    const nowShowing: string[] = Array.isArray(item['Now Showing']) ? item['Now Showing'] : [];

    // Resolve streaming platforms
    const streamingPlatforms = nowShowing
      .map((s: string) => platformMap[s.toLowerCase().trim()])
      .filter(Boolean);

    // Image URL & quality from Cockpit (we get real pixel dimensions!)
    let posterUrl: string | null = null;
    let posterWidth = 0;
    const imgObj = item.FeaturedImage || item['Featured Image'];
    if (imgObj && imgObj.path) {
      posterUrl = `https://dash.ink-blot.tv/storage/uploads${imgObj.path}`;
      posterWidth = imgObj.width || 0;
    }

    console.log(`Processing: "${title}" (${year || 'N/A'})...`);

    // Check if film exists in DB
    const { data: existingFilms } = await supabase
      .from('films')
      .select('id, poster_url, synopsis, trailer_youtube_id, watch_platforms')
      .ilike('title', title)
      .limit(1);

    let filmId: string;

    if (existingFilms && existingFilms.length > 0) {
      const f = existingFilms[0];
      filmId = f.id;
      console.log(`  ├─ Existing film found in DB (${filmId})`);

      // Update fields if missing — or if Inkblot poster is higher resolution
      const updates: any = {};
      if (!f.synopsis && synopsis) updates.synopsis = synopsis;
      if (!f.trailer_youtube_id && trailerId) updates.trailer_youtube_id = trailerId;

      // Poster: overwrite if DB poster is low-res thumbnails or Inkblot has real HD art
      const dbPoster = f.poster_url || '';
      const dbIsLowRes =
        dbPoster.includes('hqdefault') ||
        dbPoster.includes('mqdefault') ||
        dbPoster.includes('w185') ||
        dbPoster.includes('w92') ||
        dbPoster === '';
      const inkblotIsHighRes = posterWidth >= 800; // Inkblot art ≥ 800px wide = high quality

      if (posterUrl && (dbIsLowRes || (!f.poster_url && posterUrl) || inkblotIsHighRes && dbIsLowRes)) {
        updates.poster_url = posterUrl;
      }

      // Merge streaming platforms without overwriting
      if (streamingPlatforms.length > 0) {
        const existing = Array.isArray(f.watch_platforms) ? f.watch_platforms : [];
        const merged = Array.from(new Set([...existing, ...streamingPlatforms]));
        if (merged.length !== existing.length) {
          updates.watch_platforms = merged;
        }
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('films').update(updates).eq('id', filmId);
        updatedCount++;
        console.log(`  ├─ Updated fields: [${Object.keys(updates).join(', ')}]`);
      }
    } else {
      // Insert new film
      const slug = slugify(title);
      const { data: newFilm, error } = await supabase
        .from('films')
        .insert({
          title: title,
          slug: slug,
          year: year || 2024,
          release_date: releaseDate,
          synopsis: synopsis,
          poster_url: posterUrl,
          genres: genre,
          trailer_youtube_id: trailerId,
          trailer_source: 'youtube',
          countries: ['Nigeria'],
          language: 'English',
          languages: ['English'],
          is_nollywood: true,
          is_published: true,
          watch_platforms: streamingPlatforms.length > 0 ? streamingPlatforms : undefined,
          source: 'inkblot_official_website',
        })
        .select('id')
        .single();

      if (error || !newFilm) {
        console.error(`  └─ Error creating film "${title}":`, error?.message);
        continue;
      }

      filmId = newFilm.id;
      addedCount++;
      console.log(`  ├─ Created NEW film (${filmId})`);
    }

    // Link Inkblot Productions as production company
    await linkFilmCompany(filmId, companyId, 'production');
    console.log(`  └─ Linked Inkblot Productions as production company`);
  }

  console.log('\n====================================================');
  console.log(`🎉 INKBLOT SYNC COMPLETE!`);
  console.log(`Added New Films: ${addedCount}`);
  console.log(`Updated Existing Films: ${updatedCount}`);
  console.log(`Total Inkblot Films Processed: ${movies.length}`);
  console.log('====================================================');
}

async function main() {
  console.log('====================================================');
  console.log('🚀 INKBLOT PRODUCTIONS SYNC & ENRICHMENT');
  console.log('====================================================\n');

  const companyId = await findOrCreateInkblotCompany();
  await syncInkblotMovies(companyId);
}

main().catch((err) => {
  console.error('Fatal error during Inkblot sync:', err);
  process.exit(1);
});
