import fs from 'fs';
import { supabase } from '../api/_lib/supabase.js';
import { extractAuthorAndAvatar, extractReviewText, selectCriticExcerpt } from '../api/_lib/critic_review_extractor.js';
import { PUBLICATION_LOGOS } from '../api/_lib/critics_sync.js';

interface MatchedItem {
  raw_title: string;
  film_title: string;
  clean_title: string;
  url: string;
  source: string;
  matched_film_id: string;
  matched_film_title: string;
  matched_year?: number;
}

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? await res.text() : '';
  } catch (err: any) {
    console.warn(`[historical_sync] Error fetching ${url}: ${err.message}`);
    return '';
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('--- Starting Historical Critic Reviews Ingestion ---');
  if (!fs.existsSync('scratch/matched_reviews.json')) {
    console.error('scratch/matched_reviews.json not found! Run match_catalog.mjs first.');
    process.exit(1);
  }

  const items: MatchedItem[] = JSON.parse(fs.readFileSync('scratch/matched_reviews.json', 'utf-8'));
  console.log(`Loaded ${items.length} matched historical reviews to process.`);

  // 1. Fetch registered critics & existing reviews
  const { data: critics } = await supabase.from('critics').select('*');
  const criticMap = new Map<string, any>();
  critics?.forEach(c => {
    criticMap.set(c.name.toLowerCase(), c);
    criticMap.set(c.slug, c);
    if (c.publication) criticMap.set(c.publication.toLowerCase(), c);
  });

  const { data: existingRows } = await supabase.from('critic_reviews').select('id, review_url, extraction_version');
  const existingByUrl = new Map<string, any>((existingRows || []).filter(r => r.review_url).map(r => [r.review_url.split('?')[0], r]));

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const cleanUrl = item.url.split('?')[0];

    const existing = existingByUrl.get(cleanUrl);
    if (existing && Number(existing.extraction_version || 0) >= 1) {
      skipped++;
      continue;
    }

    console.log(`\n[${i + 1}/${items.length}] Processing [${item.source}] "${item.matched_film_title}" (${item.matched_year || 'N/A'})`);
    console.log(`URL: ${cleanUrl}`);

    const html = await fetchPage(cleanUrl);
    if (!html) {
      console.warn(`Failed to fetch page HTML for ${cleanUrl}`);
      failed++;
      continue;
    }

    const defaultLogo = PUBLICATION_LOGOS[item.source] || null;
    const { authorName, avatarUrl } = extractAuthorAndAvatar(html, defaultLogo);

    const criticName = authorName || item.source;
    const matchedCritic = criticMap.get(criticName.toLowerCase()) ||
                          criticMap.get(item.source.toLowerCase()) ||
                          critics?.find(c => c.publication?.toLowerCase().includes(item.source.toLowerCase()));

    const finalAvatar = avatarUrl || matchedCritic?.avatar_url || defaultLogo;

    const articleText = extractReviewText(html);
    const excerptResult = articleText ? await selectCriticExcerpt(articleText) : null;

    const payload: Record<string, any> = {
      film_id: item.matched_film_id,
      play_id: null,
      critic_id: matchedCritic?.id || null,
      critic_name: criticName,
      critic_title: matchedCritic?.title || 'Film Critic',
      avatar_url: finalAvatar,
      quote: excerptResult?.excerpt || `${item.source} review of ${item.matched_film_title}`,
      rating: excerptResult?.rating ?? null, // null if no score in review
      publication: matchedCritic?.publication || item.source,
      social_handle: matchedCritic?.handle || null,
      review_type: 'article',
      excerpt_context: excerptResult?.excerptContext || null,
      extraction_version: 1,
      review_url: cleanUrl,
      is_featured: true,
      is_anonymous: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing) delete payload.created_at;

    const op = existing
      ? supabase.from('critic_reviews').update(payload).eq('id', existing.id)
      : supabase.from('critic_reviews').insert(payload);

    const { error: opErr } = await op;
    if (opErr) {
      console.error(`Failed to save review: ${opErr.message}`);
      failed++;
    } else {
      synced++;
      existingByUrl.set(cleanUrl, { id: existing?.id || '', review_url: cleanUrl, extraction_version: 1 });
      console.log(`✓ Saved! Critic: ${criticName} | Rating: ${payload.rating ?? 'None'} | Avatar: ${finalAvatar ? 'Yes' : 'No'}`);
      console.log(`  Quote: "${payload.quote}"`);
    }

    await sleep(200);
  }

  console.log(`\n=================== COMPLETED ===================`);
  console.log(`Total: ${items.length} | Synced: ${synced} | Skipped: ${skipped} | Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
