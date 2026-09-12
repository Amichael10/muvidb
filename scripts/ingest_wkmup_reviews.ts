import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from './lib/db';

const WKMUP_CRITIC_ID = '2867dc88-3a63-4821-84fc-262159505dd9';
const POSTS_FILE = path.join(process.cwd(), 'scripts', 'data', 'wkmup_posts.json');

function decodeEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '—')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&hellip;/g, '...')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8230;/g, '...')
    .replace(/&#8242;/g, "'")
    .replace(/&#8243;/g, '"');
}

function stripHtml(html: string): string {
  if (!html) return '';
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function cleanTitleForSearch(t: string): string {
  return t
    .replace(/[‘'“"”’]/g, '')
    .replace(/[\:\-\–—].*$/g, '')
    .trim();
}

function extractTargetTitleCandidates(rawTitle: string): string[] {
  const decoded = decodeEntities(rawTitle).trim();
  const candidates: string[] = [];

  // Pattern 1: 'Title' Review or "Title" Review
  const quoteMatch = decoded.match(/[‘'“"]([^‘'“”""]+)[’'“”"]\s*(?:Movie|Film|Stage Play|Play|Theatre|Series|Docuseries|Nollywood)?\s*Review/i);
  if (quoteMatch && quoteMatch[1]) {
    candidates.push(quoteMatch[1].trim());
  }

  // Pattern 2: Title Review: Subtitle
  const reviewColonMatch = decoded.match(/^(.+?)\s*(?:Movie|Film|Stage Play|Play|Theatre|Series|Nollywood)?\s*Review\s*[:\-–—]/i);
  if (reviewColonMatch && reviewColonMatch[1]) {
    candidates.push(reviewColonMatch[1].replace(/[‘'“"]/g, '').trim());
  }

  // Pattern 3: Review: 'Title'
  const prefixReviewMatch = decoded.match(/Review\s*[:\-–—]\s*[‘'“"]?([^‘'“”"–—:\(\]]+)/i);
  if (prefixReviewMatch && prefixReviewMatch[1]) {
    candidates.push(prefixReviewMatch[1].trim());
  }

  // Pattern 4: Fallback
  let cleaned = decoded
    .replace(/\s*[\(\[]?(?:Movie|Film|Stage Play|Play|Theatre|Series|Nollywood)?\s*Review[\)\]]?/gi, '')
    .replace(/\s*[:\-–—]\s*.*$/g, '')
    .replace(/[‘'“"”’]/g, '')
    .trim();

  if (cleaned) {
    candidates.push(cleaned);
  }

  return Array.from(new Set(candidates)).filter(c => c.length >= 2);
}

function extractRating(content: string, excerpt: string): number {
  const text = stripHtml(content + ' ' + excerpt);

  const fiveMatch = text.match(/(?:rating|score|verdict)?\s*[:\-\–—]?\s*([0-5](?:\.[0-9])?)\s*\/\s*5/i);
  if (fiveMatch) {
    const val = parseFloat(fiveMatch[1]);
    if (!isNaN(val) && val > 0 && val <= 5) {
      return Math.round(val * 2 * 10) / 10;
    }
  }

  const tenMatch = text.match(/(?:rating|score|verdict)?\s*[:\-\–—]?\s*([0-9](?:\.[0-9])?|10)\s*\/\s*10/i);
  if (tenMatch) {
    const val = parseFloat(tenMatch[1]);
    if (!isNaN(val) && val > 0 && val <= 10) {
      return Math.round(val * 10) / 10;
    }
  }

  return 7.0;
}

function extractQuote(excerpt: string, content: string): string {
  let cleanExcerpt = stripHtml(excerpt);
  cleanExcerpt = cleanExcerpt.replace(/\[\s*&hellip;\s*\]/g, '...').replace(/\[\s*\.\.\.\s*\]/g, '...');

  if (cleanExcerpt.length >= 60 && cleanExcerpt.length <= 400) {
    return cleanExcerpt;
  }

  const paras = content.split(/<\/p>/i)
    .map(p => stripHtml(p))
    .filter(p => p.length > 50 && !p.startsWith('Track Upcoming') && !p.startsWith('Become a patron') && !p.startsWith('Subscribe') && !p.includes('Premiered on'));

  if (paras.length > 0) {
    const quote = paras[0].slice(0, 320);
    return quote.endsWith('.') ? quote : quote + '...';
  }

  return cleanExcerpt.slice(0, 320) || 'Detailed review on What Kept Me Up.';
}

async function main() {
  console.log('🚀 Starting Targeted What Kept Me Up Review Ingestion Pipeline...');

  if (!fs.existsSync(POSTS_FILE)) {
    console.error(`Posts file not found at ${POSTS_FILE}`);
    return;
  }

  const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
  console.log(`Loaded ${posts.length} review posts from cache.`);

  // 1. Fetch all plays (table is small)
  const { data: plays } = await supabase.from('plays').select('id, title, year');
  const allPlays = plays || [];
  console.log(`Loaded ${allPlays.length} stage plays.`);

  // 2. Fetch existing critic reviews
  const { data: existingReviews } = await supabase
    .from('critic_reviews')
    .select('review_url')
    .eq('critic_id', WKMUP_CRITIC_ID);
  
  const existingUrls = new Set((existingReviews || []).map(r => r.review_url));
  console.log(`Found ${existingUrls.size} existing reviews for What Kept Me Up.`);

  let filmMatches = 0;
  let playMatches = 0;
  let skippedDuplicates = 0;
  let unmatched = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const rawTitle = post.title || '';
    const link = post.link;

    if (existingUrls.has(link)) {
      skippedDuplicates++;
      continue;
    }

    const titleCandidates = extractTargetTitleCandidates(rawTitle);
    if (titleCandidates.length === 0) {
      unmatched++;
      continue;
    }

    const rating = extractRating(post.content || '', post.excerpt || '');
    const quote = extractQuote(post.excerpt || '', post.content || '');
    const publishedAt = post.date ? new Date(post.date).toISOString() : new Date().toISOString();

    // Check Play first
    let matchedPlay: any = null;
    for (const cand of titleCandidates) {
      const cleanCand = cleanTitleForSearch(cand);
      matchedPlay = allPlays.find(p => 
        p.title.toLowerCase() === cand.toLowerCase() ||
        p.title.toLowerCase().includes(cleanCand.toLowerCase()) ||
        cleanCand.toLowerCase().includes(p.title.toLowerCase())
      );
      if (matchedPlay) break;
    }

    if (matchedPlay) {
      const { error } = await supabase.from('critic_reviews').insert({
        critic_id: WKMUP_CRITIC_ID,
        play_id: matchedPlay.id,
        film_id: null,
        rating,
        quote,
        review_url: link,
        published_at: publishedAt,
        publication: 'What Kept Me Up'
      });

      if (!error) {
        existingUrls.add(link);
        playMatches++;
        console.log(`[${i + 1}/${posts.length}] 🎭 Ingested PLAY Review: "${matchedPlay.title}" (Rating: ${rating}/10)`);
      }
      continue;
    }

    // Check Film via targeted Supabase queries
    let matchedFilm: any = null;
    for (const cand of titleCandidates) {
      const cleanCand = cleanTitleForSearch(cand);
      if (cleanCand.length < 2) continue;

      // 1. Exact match
      const { data: exact } = await supabase
        .from('films')
        .select('id, title, year')
        .ilike('title', cleanCand)
        .limit(1);

      if (exact && exact.length > 0) {
        matchedFilm = exact[0];
        break;
      }

      // 2. Fuzzy match
      const { data: fuzzy } = await supabase
        .from('films')
        .select('id, title, year')
        .ilike('title', `%${cleanCand}%`)
        .limit(3);

      if (fuzzy && fuzzy.length > 0) {
        // Find best match
        matchedFilm = fuzzy.find(f => f.title.toLowerCase() === cleanCand.toLowerCase()) || fuzzy[0];
        break;
      }
    }

    if (matchedFilm) {
      const { error } = await supabase.from('critic_reviews').insert({
        critic_id: WKMUP_CRITIC_ID,
        film_id: matchedFilm.id,
        play_id: null,
        rating,
        quote,
        review_url: link,
        published_at: publishedAt,
        publication: 'What Kept Me Up'
      });

      if (!error) {
        existingUrls.add(link);
        filmMatches++;
        console.log(`[${i + 1}/${posts.length}] 🎬 Ingested FILM Review: "${matchedFilm.title}" (Rating: ${rating}/10)`);
      }
    } else {
      unmatched++;
    }
  }

  console.log(`\n==============================================`);
  console.log(`📊 Ingestion Summary:`);
  console.log(`- Matched Films: ${filmMatches}`);
  console.log(`- Matched Plays: ${playMatches}`);
  console.log(`- Skipped Existing: ${skippedDuplicates}`);
  console.log(`- Unmatched Posts: ${unmatched}`);
  console.log(`- Total Added: ${filmMatches + playMatches}`);
  console.log(`==============================================\n`);
  console.log('🎉 What Kept Me Up review ingestion completed successfully!');
}

main().catch(console.error);
