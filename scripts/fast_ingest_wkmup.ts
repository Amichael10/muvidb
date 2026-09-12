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

function normalize(t: string): string {
  if (!t) return '';
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function extractTargetTitleCandidates(rawTitle: string): string[] {
  const decoded = decodeEntities(rawTitle).trim();
  const candidates: string[] = [];

  // 1. Quoted title: ‘Title’ or "Title" or 'Title'
  const quoteMatch = decoded.match(/[‘'“"]([^‘'“”""]+)[’'“”"]/);
  if (quoteMatch && quoteMatch[1]) {
    const q = quoteMatch[1].trim();
    if (q.length >= 2 && !q.toLowerCase().includes('review')) {
      candidates.push(q);
    }
  }

  // 2. Before Review
  const beforeReview = decoded.match(/^(.+?)\s*(?:Movie|Film|Stage Play|Play|Theatre|Series|Docuseries|Nollywood)?\s*Review\s*[:\-–—]/i);
  if (beforeReview && beforeReview[1]) {
    candidates.push(beforeReview[1].replace(/[‘'“"”’]/g, '').trim());
  }

  // 3. After Movie Review: / Series Review: / Review:
  const afterReview = decoded.match(/(?:Movie|Film|Stage Play|Play|Theatre|Series|Docuseries|Nollywood)?\s*Review\s*[:\-–—\|]\s*[‘'“"]?([^‘'“”"–—:\(\]]+)/i);
  if (afterReview && afterReview[1]) {
    candidates.push(afterReview[1].trim());
  }

  // 4. Cleaned baseline
  let base = decoded
    .replace(/\s*[\(\[]?(?:Movie|Film|Stage Play|Play|Theatre|Series|Nollywood)?\s*Review[\)\]]?/gi, '')
    .replace(/\s*[:\-–—\|]\s*.*$/g, '')
    .replace(/[‘'“"”’]/g, '')
    .trim();
  if (base) candidates.push(base);

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

  if (cleanExcerpt.length >= 60 && cleanExcerpt.length <= 350) {
    return cleanExcerpt;
  }

  const paras = content.split(/<\/p>/i)
    .map(p => stripHtml(p))
    .filter(p => p.length > 50 && !p.startsWith('Track Upcoming') && !p.startsWith('Become a patron') && !p.startsWith('Subscribe') && !p.includes('Premiered on'));

  if (paras.length > 0) {
    const quote = paras[0].slice(0, 320);
    return quote.endsWith('.') ? quote : quote + '...';
  }

  return cleanExcerpt.slice(0, 320) || 'In-depth film analysis from What Kept Me Up.';
}

async function fetchAllFilms() {
  const pageSize = 1000;
  const batches = [];
  for (let i = 0; i < 25; i++) {
    batches.push(supabase.from('films').select('id, title, year').range(i * pageSize, (i + 1) * pageSize - 1));
  }
  const results = await Promise.all(batches);
  const all: any[] = [];
  for (const r of results) {
    if (r.data) all.push(...r.data);
  }
  return all;
}

async function main() {
  console.log('🚀 High-Precision What Kept Me Up Ingestion Pipeline...');

  if (!fs.existsSync(POSTS_FILE)) {
    console.error(`Posts file not found: ${POSTS_FILE}`);
    return;
  }

  const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
  console.log(`Loaded ${posts.length} review posts.`);

  const [allFilms, playsRes, existingRevRes] = await Promise.all([
    fetchAllFilms(),
    supabase.from('plays').select('id, title, year'),
    supabase.from('critic_reviews').select('review_url').eq('critic_id', WKMUP_CRITIC_ID)
  ]);

  const allPlays = playsRes.data || [];
  const existingUrls = new Set((existingRevRes.data || []).map(r => r.review_url));
  console.log(`Loaded ${allFilms.length} films, ${allPlays.length} stage plays, ${existingUrls.size} existing reviews.`);

  // Build normalized lookup maps
  const normPlayMap = new Map<string, any>();
  for (const p of allPlays) {
    normPlayMap.set(normalize(p.title), p);
  }

  const normFilmMap = new Map<string, any>();
  for (const f of allFilms) {
    const n = normalize(f.title);
    if (!normFilmMap.has(n)) normFilmMap.set(n, f);
  }

  const toInsert: any[] = [];
  let filmMatches = 0;
  let playMatches = 0;
  let skippedExisting = 0;
  let unmatched = 0;

  for (const post of posts) {
    const rawTitle = post.title || '';
    const link = post.link;

    if (existingUrls.has(link)) {
      skippedExisting++;
      continue;
    }

    const isStageCategory = (post.categories || []).includes(3137) || /stage play|theatre/i.test(rawTitle);
    const candidates = extractTargetTitleCandidates(rawTitle);

    const rating = extractRating(post.content || '', post.excerpt || '');
    const quote = extractQuote(post.excerpt || '', post.content || '');
    const publishedAt = post.date ? new Date(post.date).toISOString() : new Date().toISOString();

    let matchedPlay: any = null;
    let matchedFilm: any = null;

    if (isStageCategory) {
      for (const cand of candidates) {
        const norm = normalize(cand);
        if (normPlayMap.has(norm)) {
          matchedPlay = normPlayMap.get(norm);
          break;
        }
      }
    }

    if (!matchedPlay) {
      for (const cand of candidates) {
        const norm = normalize(cand);
        if (norm.length < 2) continue;

        // Skip dangerous short stopwords
        if (['what', 'the', 'love', 'a', 'in', 'of', 'and', 'my', 'her', 'his', 'he', 'she', 'it'].includes(norm)) {
          continue;
        }

        if (normFilmMap.has(norm)) {
          matchedFilm = normFilmMap.get(norm);
          break;
        }
      }
    }

    if (matchedPlay) {
      toInsert.push({
        critic_id: WKMUP_CRITIC_ID,
        critic_name: 'What Kept Me Up',
        critic_title: 'Film & Culture Editorial',
        avatar_url: 'https://whatkeptmeup.com/wp-content/uploads/2020/07/cropped-Favicon-192x192.png',
        play_id: matchedPlay.id,
        film_id: null,
        rating,
        quote,
        review_url: link,
        created_at: publishedAt,
        updated_at: publishedAt
      });
      existingUrls.add(link);
      playMatches++;
      console.log(`🎭 Ingesting PLAY: "${matchedPlay.title}" (Rating: ${rating}/10)`);
      continue;
    }

    if (matchedFilm) {
      toInsert.push({
        critic_id: WKMUP_CRITIC_ID,
        critic_name: 'What Kept Me Up',
        critic_title: 'Film & Culture Editorial',
        avatar_url: 'https://whatkeptmeup.com/wp-content/uploads/2020/07/cropped-Favicon-192x192.png',
        film_id: matchedFilm.id,
        play_id: null,
        rating,
        quote,
        review_url: link,
        created_at: publishedAt,
        updated_at: publishedAt
      });
      existingUrls.add(link);
      filmMatches++;
      console.log(`🎬 Ingesting FILM: "${matchedFilm.title}" (Rating: ${rating}/10)`);
    } else {
      unmatched++;
    }
  }

  console.log(`\n==============================================`);
  console.log(`📊 Ingestion Summary:`);
  console.log(`- Matched Films: ${filmMatches}`);
  console.log(`- Matched Plays: ${playMatches}`);
  console.log(`- Skipped Existing: ${skippedExisting}`);
  console.log(`- Unmatched Posts: ${unmatched}`);
  console.log(`- Total To Insert: ${toInsert.length}`);
  console.log(`==============================================\n`);

  if (toInsert.length > 0) {
    console.log(`Inserting ${toInsert.length} reviews into Supabase in batches of 50...`);
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error } = await supabase.from('critic_reviews').insert(batch);
      if (error) {
        console.error(`Batch insert error at ${i}:`, error.message);
      } else {
        console.log(`  ✅ Inserted batch ${Math.floor(i / 50) + 1}/${Math.ceil(toInsert.length / 50)} (${batch.length} reviews)`);
      }
    }
  }

  console.log('🎉 What Kept Me Up ingestion complete!');
}

main().catch(console.error);
