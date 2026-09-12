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

function cleanReviewTitle(rawTitle: string): { title: string; isReview: boolean; targetTitle: string; playOrMovie: 'play' | 'movie' } {
  const decoded = decodeHtml(rawTitle);
  const isReview = /review/i.test(decoded) || /is a \w+ disservice/i.test(decoded);
  
  // Extract movie or play name
  // Common patterns:
  // "Farmer’s Bride Review: A Beautiful Piece Of Nollywood Noir" -> "Farmer's Bride"
  // "Fela & The Kalakuta Queens Review: Weak Writing Masked..." -> "Fela & The Kalakuta Queens"
  // "Far From Home Review: Nollywood Freshers..." -> "Far From Home"
  // "Play Network’s Glamour Girls is a Hollow Disservice..." -> "Glamour Girls"
  // "Lisabi: The Uprising Review: You Have Seen..." -> "Lisabi: The Uprising"
  let target = decoded;
  const reviewMatch = decoded.match(/^(.*?)(?:\s+Review\s*:|\s+Review\s+–|\s+Review\s+-|\s+review\b)/i);
  if (reviewMatch) {
    target = reviewMatch[1].trim();
  } else if (/is a .*disservice/i.test(decoded)) {
    const m = decoded.match(/(?:Play Network[’']s\s+)?(.*?)\s+is a /i);
    if (m) target = m[1].trim();
  }

  // Remove trailing colon or dashes
  target = target.replace(/[:–-]+$/, '').trim();

  // Determine if it's a stage play
  const isPlay = /kalakuta queens|fela|stage play|theatre|theater|musical|broadway|terra kulture|muson/i.test(decoded);

  return {
    title: decoded,
    isReview,
    targetTitle: target,
    playOrMovie: isPlay ? 'play' : 'movie'
  };
}

function extractQuoteAndRating(contentHtml: string, excerptHtml: string): { quote: string; rating: number | null } {
  const $ = cheerio.load(contentHtml);
  const text = $.text().trim();
  
  // Rating extraction patterns
  let rating: number | null = null;
  const ratingMatch1 = text.match(/(?:rating|score|grade)\s*[:–-]\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/i);
  if (ratingMatch1) {
    const val = parseFloat(ratingMatch1[1]);
    const max = parseFloat(ratingMatch1[2]);
    if (max === 5) rating = Math.min(10, Math.round(val * 2 * 10) / 10);
    else if (max === 10) rating = Math.min(10, val);
    else if (max === 100) rating = Math.min(10, Math.round((val / 10) * 10) / 10);
  } else {
    // Star rating e.g. "★★★☆☆" or "3.5/5"
    const starsMatch = text.match(/([★☆]{3,5})/);
    if (starsMatch) {
      const full = (starsMatch[1].match(/★/g) || []).length;
      rating = full * 2;
    }
  }

  // Quote extraction: look for best summary punchline in conclusion or lead paragraph
  const paragraphs = $('p').map((i, el) => $(el).text().trim()).get().filter(p => p.length >= 50 && !/subscribe|newsletter|advertisement|copyright/i.test(p));
  
  let quote = '';
  // Check last paragraph first (conclusions often have the punchiest quote)
  if (paragraphs.length > 0) {
    const lastP = paragraphs[paragraphs.length - 1];
    if (lastP.length <= 350 && lastP.length >= 60) {
      quote = lastP;
    } else {
      quote = paragraphs[0]?.slice(0, 300) || '';
    }
  }
  
  if (!quote && excerptHtml) {
    const $e = cheerio.load(excerptHtml);
    quote = $e.text().trim().slice(0, 300);
  }

  return { quote, rating };
}

async function analyzePosts() {
  const cacheFile = path.join(process.cwd(), 'scripts', 'data', 'filmefiko_posts.json');
  const posts: WpPost[] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));

  console.log(`Analyzing ${posts.length} Film Efiko articles...`);

  const reviewArticles = [];
  const playArticles = [];

  for (const post of posts) {
    const { title, isReview, targetTitle, playOrMovie } = cleanReviewTitle(post.title.rendered);
    const isCategoryReview = post.categories.includes(66);
    
    if (isReview || isCategoryReview) {
      const { quote, rating } = extractQuoteAndRating(post.content.rendered, post.excerpt.rendered);
      reviewArticles.push({
        id: post.id,
        date: post.date,
        link: post.link,
        fullTitle: title,
        targetTitle,
        playOrMovie,
        quote,
        rating
      });
    }

    if (playOrMovie === 'play' || /stage|theatre|theater/i.test(post.title.rendered)) {
      playArticles.push(post);
    }
  }

  console.log(`\nFound ${reviewArticles.length} review articles!`);
  console.log(`Found ${playArticles.length} stage/theatre articles!`);

  console.log("\n--- SAMPLE EXTRACTED REVIEWS ---");
  for (const r of reviewArticles.slice(0, 15)) {
    console.log(`\n🎯 Target: "${r.targetTitle}" [Type: ${r.playOrMovie}]`);
    console.log(`   Rating: ${r.rating || 'N/A'}`);
    console.log(`   Quote: "${r.quote.slice(0, 120)}..."`);
    console.log(`   URL: ${r.link}`);
  }
}

analyzePosts().catch(console.error);
