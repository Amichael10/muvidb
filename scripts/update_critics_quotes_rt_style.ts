import './dotenv_init.ts';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const WKMUP_POSTS_FILE = path.join(process.cwd(), 'scripts', 'data', 'wkmup_posts.json');
const wkmupPosts: any[] = fs.existsSync(WKMUP_POSTS_FILE)
  ? JSON.parse(fs.readFileSync(WKMUP_POSTS_FILE, 'utf-8'))
  : [];

// Map link and slug to post
const wkmupByLink = new Map<string, any>();
for (const p of wkmupPosts) {
  if (p.link) {
    const cleanLink = p.link.replace(/\/$/, '');
    wkmupByLink.set(cleanLink, p);
  }
  if (p.slug) {
    wkmupByLink.set(p.slug, p);
  }
}

function cleanHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '—')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8230;/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISE_REGEX = /share your thoughts|comments section|join the conversation|twitter|social media|sign up|keep track of upcoming|google calendar|newsletter|patron|subscribe|become a member|distributed by|premiered|screened at|in cinemas|at the cinemas|streaming on|available on|available to stream|is a member of the african|replies to your comments|i do reply to comments|check back under the posts/i;

function formatToRTQuote(text: string): string {
  const cleaned = cleanHtml(text);
  if (cleaned.length <= 260) return cleaned;

  // Split into sentences
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  let acc = '';
  for (const s of sentences) {
    if ((acc + s).length <= 260) {
      acc += (acc ? ' ' : '') + s.trim();
    } else {
      break;
    }
  }

  if (acc.length >= 70) return acc;
  return cleaned.slice(0, 250).replace(/[,; ]+\S*$/, '') + '...';
}

function extractRTQuoteFromWKMUp(post: any): string | null {
  const content = post.content?.rendered || post.content || '';
  const $ = cheerio.load(content);

  const paras: string[] = [];
  $('p').each((_, el) => {
    const t = cleanHtml($(el).html() || '');
    if (t.length >= 45 && !NOISE_REGEX.test(t)) {
      paras.push(t);
    }
  });

  if (paras.length === 0) return null;

  // Prioritize verdict keywords in the last 4 paragraphs
  const tail = paras.slice(-4);
  const verdictKeywords = [
    /in the end/i,
    /however/i,
    /ultimately/i,
    /verdict/i,
    /fails to/i,
    /poorly paced/i,
    /bogged down/i,
    /black hole/i,
    /undone by/i,
    /redeemed by/i,
    /falls flat/i,
    /salvaged by/i,
    /rarely probes/i,
    /stands out/i,
    /brilliant/i,
    /disappointing/i,
    /triumph/i,
    /enjoyable/i,
    /performances of/i,
    /screenplay/i,
    /worth/i
  ];

  for (let i = tail.length - 1; i >= 0; i--) {
    const p = tail[i];
    for (const kw of verdictKeywords) {
      if (kw.test(p)) {
        return formatToRTQuote(p);
      }
    }
  }

  // Fallback: the final meaningful critical paragraph before release notes
  return formatToRTQuote(paras[paras.length - 1]);
}

function cleanAfrocritikQuote(quote: string): string {
  let q = cleanHtml(quote);
  // Strip "XYZ" Review: Title - ...
  const m = q.match(/^[“"'].+?[”"']\s*Review:\s*[^–—\-]+[–—\-]\s*(.+)$/i);
  if (m && m[1]) {
    q = m[1].trim();
  }
  return formatToRTQuote(q);
}

function cleanNMRQuote(quote: string): string | null {
  let q = cleanHtml(quote);
  if (NOISE_REGEX.test(q)) {
    return null;
  }
  return formatToRTQuote(q);
}

function cleanMovieEvolutionQuote(quote: string): string | null {
  let q = cleanHtml(quote);
  if (q.startsWith('THEMES') && q.length < 50) {
    return null;
  }
  q = q.replace(/^\[Review by [^\]]+\]:\s*/i, '');
  return formatToRTQuote(q);
}

export async function updateCriticsQuotesRTStyle() {
  console.log('🍅 Rotten Tomatoes Critics Quote Backlog Refresher');
  console.log('------------------------------------------------------------');

  const { data: reviews, error } = await supabase
    .from('critic_reviews')
    .select('id, critic_name, rating, quote, review_url');

  if (error || !reviews) {
    console.error('❌ Error fetching critic reviews:', error?.message);
    return;
  }

  console.log(`📋 Loaded ${reviews.length} total critic reviews to evaluate.`);

  const updatesToRun: { id: string; quote: string; type: string }[] = [];

  for (const r of reviews) {
    let newQuote: string | null = null;
    let type = 'other';

    if (r.critic_name === 'What Kept Me Up' && r.review_url) {
      const cleanUrl = r.review_url.replace(/\/$/, '');
      const post = wkmupByLink.get(cleanUrl);
      if (post) {
        newQuote = extractRTQuoteFromWKMUp(post);
        type = 'wkmup';
      }
    } else if (
      r.critic_name === 'Joseph Jonathan' ||
      r.critic_name === 'Seyi Lasisi' ||
      r.critic_name === 'Victor Salami' ||
      r.critic_name === 'Dami Dawson'
    ) {
      newQuote = cleanAfrocritikQuote(r.quote);
      type = 'afrocritik';
    } else if (r.critic_name === 'Nigerian Movies Review') {
      newQuote = cleanNMRQuote(r.quote);
      type = 'nmr';
    } else if (r.critic_name === 'Movie Evolution (Film Class Archive)') {
      newQuote = cleanMovieEvolutionQuote(r.quote);
      type = 'archive';
    }

    if (newQuote && newQuote !== r.quote && newQuote.length >= 40 && !NOISE_REGEX.test(newQuote)) {
      updatesToRun.push({ id: r.id, quote: newQuote, type });
    }
  }

  console.log(`🚀 Found ${updatesToRun.length} reviews that will be upgraded to RT verdicts.`);

  // Execute in batches of 15
  let updated = 0;
  for (let i = 0; i < updatesToRun.length; i += 15) {
    const chunk = updatesToRun.slice(i, i + 15);
    await Promise.all(
      chunk.map(async (item) => {
        const { error: uErr } = await supabase
          .from('critic_reviews')
          .update({
            quote: item.quote,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
        if (!uErr) updated++;
      })
    );
    process.stdout.write(`   ✓ Updated ${Math.min(i + 15, updatesToRun.length)} / ${updatesToRun.length}\r`);
  }

  console.log('\n============================================================');
  console.log(`🎉 Successfully upgraded ${updated} critic reviews to Rotten Tomatoes-style verdict quotes!`);
  console.log('============================================================');
}

updateCriticsQuotesRTStyle().catch(console.error);
