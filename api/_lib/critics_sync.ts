import { supabase } from './supabase.js';
import { extractAuthorAndAvatar, extractReviewText, selectCriticExcerpt } from './critic_review_extractor.js';

export const PUBLICATION_LOGOS: Record<string, string> = {
  'Nollywood Life': 'https://nollywoodlife.ng/wp-content/uploads/2024/09/cropped-Nollywood-Life-New-Logo-180x180.png',
  'NollyCritic': 'https://i0.wp.com/nollycritic.com/wp-content/uploads/2025/02/cropped-nc-logo-new-scaled-1.jpg?fit=180%2C180&ssl=1',
  'Afrocritik': 'https://afrocritik.com/wp-content/uploads/2021/04/cropped-Afrocritik-Favicon-1-192x192.png',
  'What Kept Me Up': 'https://whatkeptmeup.com/wp-content/uploads/2020/07/cropped-Favicon-192x192.png',
  'Film Efiko': 'https://filmefiko.com/wp-content/uploads/2021/05/cropped-FE-logo-192x192.png',
  'Nigerian Movies Review': 'https://nigerianmoviesreview.com/wp-content/uploads/2023/08/NMR-WITHOUT-BG-150x150.png',
  "It's A Wrap": 'https://static.wixstatic.com/media/f87a6d_4dd9e45b448549e1a4b6bfb6251af0d4~mv2.png',
  'Movie Evolution': 'https://intro2filmclass.blogspot.com/favicon.ico',
  'VDK Film Club': 'https://yt3.googleusercontent.com/UB8tdamndTKRRQqOkDYOcEIVjMBQIBgfA17r-lEJ6cHkWoXaBTx82vUxFZm3XkfJE0kHg3M_7g=s900-c-k-c0x00ffffff-no-rj',
};

interface DiscoveredReview {
  film_title: string;
  critic_name?: string;
  source_publication: string;
  review_url: string;
  quote?: string;
  rating?: number;
  published_date?: string;
}

async function fetchReviewPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MuviDBCritics/1.0; +https://muvidb.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? await res.text() : '';
  } catch (error) {
    console.warn(`[Critics Sync Page Warn] ${url}: ${(error as Error).message}`);
    return '';
  }
}

function cleanMovieTitle(raw: string): string {
  return raw
    .replace(/^['"“‘]|['"”’]$/g, '')
    .replace(/‘|’/g, "'")
    .replace(/\s*\|\s*.*$/, '')
    .replace(/\s*[-–]\s*Nollywood Movie Review.*/i, '')
    .replace(/\s*[-–]\s*Movie Review.*/i, '')
    .replace(/\s*[-–]\s*Film Review.*/i, '')
    .replace(/\s*–\s*.*Review.*/i, '')
    .replace(/\s*-\s*.*Review.*/i, '')
    .replace(/\s*\(.*?(?:film|movie|review).*?\)$/i, '')
    .replace(/Review\s*:\s*/i, '')
    .replace(/review:?/i, '')
    .replace(/\s*Movie Review$/i, '')
    .replace(/\s*Film Review$/i, '')
    .trim();
}

async function fetchRss(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return '';
    return await res.text();
  } catch (err: any) {
    console.warn(`[Critics Sync RSS Warn] ${url}: ${err.message}`);
    return '';
  }
}

function parseRssItems(xml: string, sourceName: string): DiscoveredReview[] {
  const items: DiscoveredReview[] = [];

  // 1. Support Atom feed entries (e.g. YouTube channels)
  if (xml.includes('<entry')) {
    const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[0];
      const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"/i);
      const authorMatch = entryXml.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/i);
      const pubDateMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/i);
      const descMatch = entryXml.match(/<media:description>([\s\S]*?)<\/media:description>/i);

      if (titleMatch && linkMatch) {
        const rawTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        const link = linkMatch[1].trim();
        const author = authorMatch ? authorMatch[1].trim() : '';
        const rawDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        if (/review/i.test(rawTitle) || /review/i.test(link) || /movie|film|cinema/i.test(entryXml)) {
          const firstDescLine = rawDesc.split('\n').map(l => l.trim()).find(l => l.length > 20 && !l.startsWith('#')) || '';
          items.push({
            film_title: cleanMovieTitle(rawTitle),
            critic_name: author || sourceName,
            source_publication: sourceName,
            review_url: link,
            quote: firstDescLine || rawTitle,
            published_date: pubDateMatch ? pubDateMatch[1] : undefined
          });
        }
      }
    }
  }

  // 2. Standard RSS <item> elements
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[0];
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const creatorMatch = itemXml.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/i) || itemXml.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/i);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || itemXml.match(/<description>([\s\S]*?)<\/description>/i);

    if (titleMatch && linkMatch) {
      const rawTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      const link = linkMatch[1].trim();
      const author = creatorMatch ? creatorMatch[1].trim() : '';
      const rawDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      // Only include if it's a review or Nollywood movie review
      if (/review/i.test(rawTitle) || /review/i.test(link) || /movie|film|cinema/i.test(itemXml)) {
        items.push({
          film_title: cleanMovieTitle(rawTitle),
          critic_name: author || sourceName,
          source_publication: sourceName,
          review_url: link,
          quote: rawDesc ? rawDesc.slice(0, 240) + '...' : rawTitle,
          published_date: pubDateMatch ? pubDateMatch[1] : undefined
        });
      }
    }
  }

  return items;
}

export async function runCriticsSync(): Promise<{
  processed: number;
  synced: number;
  skipped: number;
  new_reviews: string[];
}> {
  console.log('[critics_sync] Starting weekly Sunday critics review sync...');
  const newReviews: string[] = [];
  let processed = 0;
  let synced = 0;
  let skipped = 0;

  // 1. Fetch registered critics & existing reviews
  const { data: critics } = await supabase.from('critics').select('*');
  const criticMap = new Map();
  critics?.forEach(c => {
    criticMap.set(c.name.toLowerCase(), c);
    criticMap.set(c.slug, c);
    if (c.publication) criticMap.set(c.publication.toLowerCase(), c);
  });

  const { data: existingRows } = await supabase.from('critic_reviews').select('id, review_url, extraction_version');
  const existingByUrl = new Map((existingRows || []).filter(r => r.review_url).map(r => [r.review_url, r]));

  // 2. Fetch feeds from top critic publications
  const feeds = [
    { url: 'https://afrocritik.com/feed/', source: 'Afrocritik' },
    { url: 'https://whatkeptmeup.com/feed/', source: 'What Kept Me Up' },
    { url: 'https://filmefiko.com/feed/', source: 'Film Efiko' },
    { url: 'https://nigerianmoviesreview.com/category/reviews/feed/', source: 'Nigerian Movies Review' },
    { url: 'https://www.itsawrapng.com/blog-feed.xml', source: "It's A Wrap" },
    { url: 'https://intro2filmclass.blogspot.com/feeds/posts/default?alt=rss', source: 'Intro to Film Class' },
    { url: 'https://nollywoodlife.ng/topics/movie-reviews/feed/', source: 'Nollywood Life' },
    { url: 'https://nollycritic.com/category/reviews/feed/', source: 'NollyCritic' },
    { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCgNhtj5ldkwI2-P9jFExexg', source: 'VDK Film Club' }
  ];

  const candidateReviews: DiscoveredReview[] = [];
  for (const feed of feeds) {
    const xml = await fetchRss(feed.url);
    if (xml) {
      const items = parseRssItems(xml, feed.source);
      candidateReviews.push(...items);
    }
  }

  processed = candidateReviews.length;

  for (const item of candidateReviews) {
    let cleanUrl = item.review_url;
    try {
      const parsedUrl = new URL(item.review_url);
      if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
        const v = parsedUrl.searchParams.get('v');
        cleanUrl = v ? `https://www.youtube.com/watch?v=${v}` : item.review_url;
      } else {
        cleanUrl = item.review_url.split('?')[0];
      }
    } catch {
      cleanUrl = item.review_url.split('?')[0];
    }
    const existingReview = existingByUrl.get(cleanUrl) || existingByUrl.get(item.review_url);
    if (existingReview && Number(existingReview.extraction_version || 0) >= 1) {
      skipped++;
      continue;
    }

    // Generate candidate titles (quotes, before "Review", prefixes, punctuation splits)
    const titleCandidates = [
      item.film_title,
      item.film_title.split(':')[0].trim(),
      item.film_title.split('–')[0].trim(),
      item.film_title.split('-')[0].trim(),
      item.film_title.split(',')[0].trim()
    ];

    const quoteMatches = item.film_title.matchAll(/['"“‘]([^'"”’]{2,60})['"”’]/g);
    for (const m of quoteMatches) {
      titleCandidates.push(m[1].replace(/,$/, '').trim());
    }

    const beforeReview = item.film_title.match(/^(.+?)(?:,\s*Review|\s+Review\s*:|\s+Movie Review|\s+Film Review)/i);
    if (beforeReview) {
      titleCandidates.push(beforeReview[1].trim());
    }

    const words = item.film_title.split(/\s+/);
    if (words.length > 4) {
      titleCandidates.push(words.slice(0, 3).join(' '));
      titleCandidates.push(words.slice(0, 2).join(' '));
    }

    const uniqueCandidates = [...new Set(
      titleCandidates.map(t => t.replace(/^['"“‘]|['"”’,]$/g, '').trim()).filter(t => t.length >= 2)
    )];

    let film: any = null;
    for (const cand of uniqueCandidates) {
      const { data: matchedFilms } = await supabase
        .from('films')
        .select('id, title, year')
        .ilike('title', cand)
        .order('year', { ascending: false, nullsFirst: false })
        .limit(1);

      if (matchedFilms && matchedFilms[0]) {
        film = matchedFilms[0];
        break;
      }
    }

    let matchedFilmId: string | null = film?.id || null;
    let matchedPlayId: string | null = null;
    let targetTitle: string = film?.title || item.film_title;

    if (!matchedFilmId) {
      // Check if this is a stage play / theatre review
      for (const cand of uniqueCandidates) {
        const { data: matchedPlays } = await supabase
          .from('plays')
          .select('id, title, year')
          .ilike('title', cand)
          .limit(1);

        if (matchedPlays?.[0]) {
          matchedPlayId = matchedPlays[0].id;
          targetTitle = matchedPlays[0].title;
          break;
        }
      }
    }

    if (!matchedFilmId && !matchedPlayId) {
      skipped++;
      continue;
    }

    // Match critic
    const matchedCritic = (item.critic_name && criticMap.get(item.critic_name.toLowerCase())) ||
                          criticMap.get(item.source_publication.toLowerCase()) ||
                          critics?.find(c => c.publication?.includes(item.source_publication));

    const defaultLogo = PUBLICATION_LOGOS[item.source_publication] || null;
    let criticAvatar = matchedCritic?.avatar_url || null;
    let criticName = matchedCritic?.name || item.critic_name || item.source_publication;

    const isYouTubeUrl = /youtube\.com|youtu\.be/i.test(cleanUrl);
    const pageHtml = isYouTubeUrl ? '' : await fetchReviewPage(cleanUrl);
    if (pageHtml) {
      const { authorName, avatarUrl } = extractAuthorAndAvatar(pageHtml, defaultLogo);
      if (authorName && (!matchedCritic || criticName === item.source_publication)) {
        criticName = authorName;
      }
      if (avatarUrl && !criticAvatar) {
        criticAvatar = avatarUrl;
      }
    }
    if (!criticAvatar) {
      criticAvatar = defaultLogo;
    }

    const payload: Record<string, any> = {
      film_id: matchedFilmId,
      play_id: matchedPlayId,
      critic_id: matchedCritic?.id || null,
      critic_name: criticName,
      critic_title: matchedCritic?.title || (matchedPlayId ? 'Theatre Critic' : 'Film Critic'),
      avatar_url: criticAvatar,
      quote: item.quote || `${item.source_publication} review of ${targetTitle}`,
      rating: null,
      publication: matchedCritic?.publication || item.source_publication,
      social_handle: matchedCritic?.handle || null,
      review_type: 'article',
      excerpt_context: null,
      extraction_version: 1,
      review_url: cleanUrl,
      is_featured: true,
      is_anonymous: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const articleText = pageHtml ? extractReviewText(pageHtml) : '';
    if (articleText) {
      const extracted = await selectCriticExcerpt(articleText);
      payload.quote = extracted.excerpt;
      payload.rating = extracted.rating;
      payload.excerpt_context = extracted.excerptContext;
    }

    if (existingReview) delete payload.created_at;
    const write = existingReview
      ? supabase.from('critic_reviews').update(payload).eq('id', existingReview.id)
      : supabase.from('critic_reviews').insert(payload);
    const { error: insErr } = await write;
    if (!insErr) {
      synced++;
      existingByUrl.set(cleanUrl, { id: existingReview?.id || '', review_url: cleanUrl, extraction_version: 1 });
      newReviews.push(`${payload.critic_name} -> "${targetTitle}"`);
    } else {
      console.warn(`[critics_sync] Failed to insert review for ${targetTitle}:`, insErr.message);
    }
  }

  console.log(`[critics_sync] Completed. Processed: ${processed}, Synced: ${synced}, Skipped: ${skipped}`);
  return { processed, synced, skipped, new_reviews: newReviews };
}
