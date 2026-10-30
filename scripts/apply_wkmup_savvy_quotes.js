import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const posts = JSON.parse(fs.readFileSync('scripts/data/wkmup_posts.json', 'utf8'));

function decodeHtml(html) {
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

function cleanSavvyText(text) {
  let res = text.trim();
  res = res.replace(/\s*\((?:Documentary|Short Film|Animation)\)\s*$/i, '');
  // Strip trailing period if single sentence
  res = res.replace(/\.$/, '').trim();
  return res;
}

function extractSavvyQuote(rawTitle, slug) {
  const title = decodeHtml(rawTitle);

  // 1. Check for "Review: [Savvy Quote]"
  // e.g. "‘Alahun: The Weaver’ Review: Dare Olaitan’s Long-Awaited Epic Adventure Return Takes Too Long to Get Going"
  const matchReview = title.match(/(?:Review|Stage Review|Movie Review|Film Review|Series Review)\s*:\s*(.+)$/i);
  if (matchReview && matchReview[1]?.trim()) {
    const candidate = matchReview[1].trim();
    if (!candidate.toLowerCase().endsWith('review')) {
      return cleanSavvyText(candidate);
    }
  }

  // 2. Check for "Review — [Savvy Quote]" or "Review - [Savvy Quote]"
  const matchDash = title.match(/(?:Review|Stage Review|Movie Review|Film Review|Series Review)\s*[-—]\s*(.+)$/i);
  if (matchDash && matchDash[1]?.trim()) {
    const candidate = matchDash[1].trim();
    if (!candidate.toLowerCase().endsWith('review')) {
      return cleanSavvyText(candidate);
    }
  }

  // 3. Check slug for "-review-"
  // e.g. ile-owo-review-wavering-plot-frustrates-bold-horror-outing
  if (slug && slug.includes('-review-')) {
    const parts = slug.split('-review-');
    if (parts[1] && parts[1].length > 8) {
      const words = parts[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return cleanSavvyText(words);
    }
  }

  // 4. Colon separation if there is a colon and second part is not "Review"
  const colonMatch = title.match(/:\s*(.+)$/);
  if (colonMatch && colonMatch[1]?.trim()) {
    const candidate = colonMatch[1].trim();
    if (!candidate.toLowerCase().endsWith('review') && candidate.length > 10) {
      return cleanSavvyText(candidate);
    }
  }

  return null;
}

const postByUrlOrSlug = new Map();
posts.forEach(p => {
  if (p.link) {
    const cleanUrl = p.link.replace(/\/$/, '').toLowerCase();
    postByUrlOrSlug.set(cleanUrl, p);
    const slug = cleanUrl.split('/').filter(Boolean).pop();
    if (slug) postByUrlOrSlug.set(slug, p);
  }
  if (p.slug) {
    postByUrlOrSlug.set(p.slug.toLowerCase(), p);
  }
});

async function runUpdate() {
  const { data, error } = await supabase
    .from('critic_reviews')
    .select('id, film_id, review_url, quote')
    .or('publication.ilike.%What Kept Me Up%,critic_name.ilike.%What Kept Me Up%');

  if (error) {
    console.error('Error fetching reviews:', error);
    return;
  }

  console.log(`Analyzing ${data.length} What Kept Me Up reviews...`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const r of data) {
    if (!r.review_url) {
      skippedCount++;
      continue;
    }

    const cleanUrl = r.review_url.replace(/\/$/, '').toLowerCase();
    const slug = cleanUrl.split('/').filter(Boolean).pop();
    const post = postByUrlOrSlug.get(cleanUrl) || (slug ? postByUrlOrSlug.get(slug) : null);

    const rawTitle = post ? (post.title?.rendered || post.title) : '';
    const savvyQuote = extractSavvyQuote(rawTitle, slug);

    if (savvyQuote && savvyQuote.length >= 8) {
      // Update the quote
      const { error: updateErr } = await supabase
        .from('critic_reviews')
        .update({
          quote: savvyQuote,
          updated_at: new Date().toISOString()
        })
        .eq('id', r.id);

      if (updateErr) {
        console.error(`Failed to update ${r.id}:`, updateErr.message);
      } else {
        updatedCount++;
        if (updatedCount <= 25 || updatedCount % 25 === 0) {
          console.log(`[${updatedCount}] Updated: "${savvyQuote}"`);
        }
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`\n🎉 Completed What Kept Me Up Quote Refresh!`);
  console.log(`Updated with savvy title quotes: ${updatedCount}`);
  console.log(`Retained original (generic festival/short pieces): ${skippedCount}`);
}

runUpdate();

