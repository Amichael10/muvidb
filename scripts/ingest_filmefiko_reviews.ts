import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { supabase } from './lib/db';

interface WpPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories: number[];
  tags: number[];
  author?: number;
  _embedded?: any;
}

function decodeHtml(html: string): string {
  return html
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&hellip;/g, '...')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

const HOLLYWOOD_BLACKLIST = [
  'house of the dragon', 'game of thrones', 'superman', 'batman', 'suicide squad',
  'mortal kombat', 'deadpool', 'inside out', 'bad boys', 'jurassic', 'marvel',
  'avengers', 'spider-man', 'star wars', 'fast & furious', 'hitman', 'the father',
  'run (2020)', 'i am invincible', 'the equalizer', 'baby reindeer', 'shogun',
  'yellowstone', 'the boys'
];

function isHollywoodOrNonAfrican(title: string, content: string = ''): boolean {
  const lower = (title + ' ' + content).toLowerCase();
  return HOLLYWOOD_BLACKLIST.some(kw => lower.includes(kw));
}

function cleanReviewTitle(rawTitle: string): { title: string; isReview: boolean; targetTitle: string; playOrMovie: 'play' | 'movie'; isHollywood: boolean } {
  const decoded = decodeHtml(rawTitle);
  const isReview = /review/i.test(decoded) || /is a \w+ disservice/i.test(decoded);
  
  let target = decoded;
  const reviewMatch = decoded.match(/^(.*?)(?:\s+Review\s*:|\s+Review\s+–|\s+Review\s+-|\s+review\b)/i);
  if (reviewMatch) {
    target = reviewMatch[1].trim();
  } else if (/is a .*disservice/i.test(decoded)) {
    const m = decoded.match(/(?:Play Network[’']s\s+)?(.*?)\s+is a /i);
    if (m) target = m[1].trim();
  }

  // Remove author prefixes like "Biodun Stephen's", "Wingonia Ikpi's", "Africa Magic's"
  target = target
    .replace(/^(?:Biodun Stephen[’']s|Wingonia Ikpi[’']s|Africa Magic[’']s|Play Network[’']s|Clarence Peters[’'])\s+/i, '')
    .replace(/^["“”']|["“”']$/g, '')
    .replace(/[:–-]+$/, '')
    .trim();

  // Determine if it's a stage play
  const isPlay = /kalakuta queens|fela|stage play|theatre|theater|musical|broadway|terra kulture|muson/i.test(decoded);
  const isHollywood = isHollywoodOrNonAfrican(decoded);

  return {
    title: decoded,
    isReview,
    targetTitle: target,
    playOrMovie: isPlay ? 'play' : 'movie',
    isHollywood
  };
}

function extractQuoteAndRating(contentHtml: string, excerptHtml: string): { quote: string; rating: number | null } {
  const $ = cheerio.load(contentHtml);
  const text = $.text().trim();
  
  let rating: number | null = null;
  const ratingMatch = text.match(/(?:rating|score|grade)\s*[:–-]\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/i);
  if (ratingMatch) {
    const val = parseFloat(ratingMatch[1]);
    const max = parseFloat(ratingMatch[2]);
    if (max === 5) rating = Math.min(10, Math.round(val * 2 * 10) / 10);
    else if (max === 10) rating = Math.min(10, val);
    else if (max === 100) rating = Math.min(10, Math.round((val / 10) * 10) / 10);
  } else {
    const starsMatch = text.match(/([★☆]{3,5})/);
    if (starsMatch) {
      const full = (starsMatch[1].match(/★/g) || []).length;
      rating = full * 2;
    }
  }

  const paragraphs = $('p')
    .map((i, el) => $(el).text().trim())
    .get()
    .filter(p => p.length >= 50 && !/subscribe|newsletter|advertisement|copyright|read also/i.test(p));
  
  let quote = '';
  if (paragraphs.length > 0) {
    const lastP = paragraphs[paragraphs.length - 1];
    if (lastP.length <= 350 && lastP.length >= 60) {
      quote = lastP;
    } else {
      quote = paragraphs[0]?.slice(0, 320) || '';
    }
  }
  
  if (!quote && excerptHtml) {
    const $e = cheerio.load(excerptHtml);
    quote = $e.text().trim().slice(0, 320);
  }

  return { quote, rating };
}

async function ingestFilmEfikoReviews() {
  console.log("=== INGESTING FILMEFIKO REVIEWS INTO DATABASE ===");

  // 1. Get or Ensure Oris Aigbokhaevbolo / Film Efiko in critics table
  let criticId = '44490f2b-638f-43f2-b33a-47e5b979fe4f';
  const { data: existingCritic } = await supabase.from('critics').select('*').eq('id', criticId).single();
  if (!existingCritic) {
    const { data: bySlug } = await supabase.from('critics').select('*').eq('slug', 'oris-aigbokhaevbolo').single();
    if (bySlug) criticId = bySlug.id;
  }
  console.log(`Using Critic ID: ${criticId}`);

  // 2. Fetch existing critic reviews to prevent duplicates
  const { data: existingReviews } = await supabase.from('critic_reviews').select('review_url');
  const existingUrls = new Set((existingReviews || []).map(r => r.review_url).filter(Boolean));
  console.log(`Found ${existingUrls.size} existing critic review URLs in DB.`);

  // 3. Load cached posts
  const cacheFile = path.join(process.cwd(), 'scripts', 'data', 'filmefiko_posts.json');
  if (!fs.existsSync(cacheFile)) {
    console.error(`Cache file ${cacheFile} not found!`);
    return;
  }
  const posts: WpPost[] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));

  let moviesIngested = 0;
  let playsIngested = 0;
  let skippedDuplicates = 0;
  let skippedNoMatch = 0;

  for (const post of posts) {
    const { title, isReview, targetTitle, playOrMovie, isHollywood } = cleanReviewTitle(post.title.rendered);
    const isCategoryReview = post.categories?.includes(66);
    if (!isReview && !isCategoryReview) continue;

    if (isHollywood) {
      console.log(`🚫 [HOLLYWOOD SKIPPED] "${title}"`);
      continue;
    }

    if (existingUrls.has(post.link)) {
      skippedDuplicates++;
      continue;
    }

    const { quote, rating } = extractQuoteAndRating(post.content.rendered, post.excerpt.rendered);
    if (!quote) continue;

    const authorName = "Oris Aigbokhaevbolo";
    const postYear = new Date(post.date).getFullYear();

    if (playOrMovie === 'play' || /kalakuta queens/i.test(targetTitle)) {
      // 1. Search in plays table with fuzzy normalization
      let playId: string | null = null;
      const cleanPlaySearch = targetTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      const { data: allPlays } = await supabase.from('plays').select('id, title, slug, year');
      
      const matched = (allPlays || []).find(p => {
        const normTitle = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normSlug = p.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normTitle.includes(cleanPlaySearch) || cleanPlaySearch.includes(normTitle) ||
               normSlug.includes(cleanPlaySearch) || (cleanPlaySearch.includes('kalakuta') && normTitle.includes('kalakuta'));
      });

      if (matched) {
        playId = matched.id;
      } else {
        console.warn(`ℹ️ [STAGE PLAY NOT IN CATALOG] Stage play "${targetTitle}" must exist in plays table before reviews can be attached.`);
      }

      if (playId) {
        const { error: revErr } = await supabase.from('critic_reviews').insert([{
          play_id: playId,
          film_id: null,
          critic_id: criticId,
          critic_name: authorName,
          critic_title: 'Critic · Film Efiko',
          quote: quote.slice(0, 500),
          rating: rating,
          review_url: post.link,
          is_featured: true
        }]);

        if (!revErr) {
          playsIngested++;
          console.log(`✅ [PLAY REVIEW] Ingested: "${targetTitle}" -> Play ID: ${playId} (Rating: ${rating || 'Quote'})`);
        } else {
          console.error(`Error inserting play review for "${targetTitle}":`, revErr.message);
        }
      }
    } else {
      // 2. Search in films table
      let filmId: string | null = null;
      const cleanSearch = targetTitle.replace(/['’]/g, '%').trim();
      
      const { data: matchedFilms } = await supabase
        .from('films')
        .select('id, title, year')
        .ilike('title', cleanSearch)
        .limit(5);

      if (matchedFilms && matchedFilms.length > 0) {
        // Sort by year proximity if multiple
        const sorted = matchedFilms.sort((a, b) => Math.abs((a.year || 2024) - postYear) - Math.abs((b.year || 2024) - postYear));
        filmId = sorted[0].id;
      } else {
        // Try substring search
        const { data: partialMatch } = await supabase
          .from('films')
          .select('id, title, year')
          .ilike('title', `%${cleanSearch}%`)
          .limit(3);

        if (partialMatch && partialMatch.length > 0) {
          filmId = partialMatch[0].id;
        }
      }

      if (filmId) {
        const { error: revErr } = await supabase.from('critic_reviews').insert([{
          film_id: filmId,
          play_id: null,
          critic_id: criticId,
          critic_name: authorName,
          critic_title: 'Critic · Film Efiko',
          quote: quote.slice(0, 500),
          rating: rating,
          review_url: post.link,
          is_featured: true
        }]);

        if (!revErr) {
          moviesIngested++;
          console.log(`✅ [FILM REVIEW] Ingested: "${targetTitle}" -> Film ID: ${filmId} (Rating: ${rating || 'Quote'})`);
        } else {
          console.error(`Error inserting film review for "${targetTitle}":`, revErr.message);
        }
      } else {
        skippedNoMatch++;
        console.log(`ℹ️ No film match found in DB for review: "${targetTitle}" (${post.link})`);
      }
    }
  }

  console.log("\n=== INGESTION SUMMARY ===");
  console.log(`✅ Film Reviews Ingested: ${moviesIngested}`);
  console.log(`🎭 Stage Play Reviews Ingested: ${playsIngested}`);
  console.log(`⏩ Skipped Duplicates: ${skippedDuplicates}`);
  console.log(`⚠️ Unmatched Film Reviews: ${skippedNoMatch}`);
}

ingestFilmEfikoReviews().catch(console.error);
