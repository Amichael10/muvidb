import { supabase } from './supabase.js';

interface DiscoveredReview {
  film_title: string;
  critic_name?: string;
  source_publication: string;
  review_url: string;
  quote?: string;
  rating?: number;
  published_date?: string;
}

function cleanMovieTitle(raw: string): string {
  return raw
    .replace(/^['"“‘]|['"”’]$/g, '')
    .replace(/review:?/i, '')
    .replace(/‘|’/g, "'")
    .replace(/\s*\|\s*.*$/, '')
    .replace(/\s*–\s*.*Review.*/i, '')
    .replace(/\s*-\s*.*Review.*/i, '')
    .replace(/Review\s*:\s*/i, '')
    .replace(/\s*Movie Review$/i, '')
    .replace(/\s*Film Review$/i, '')
    .trim();
}

async function fetchRss(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
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

  const { data: existingRows } = await supabase.from('critic_reviews').select('review_url');
  const existingUrls = new Set((existingRows || []).map(r => r.review_url).filter(Boolean));

  // 2. Fetch feeds from top critic publications
  const feeds = [
    { url: 'https://afrocritik.com/feed/', source: 'Afrocritik' },
    { url: 'https://whatkeptmeup.com/feed/', source: 'What Kept Me Up' },
    { url: 'https://filmefiko.com/feed/', source: 'Film Efiko' },
    { url: 'https://nigerianmoviesreview.com/category/reviews/feed/', source: 'Nigerian Movies Review' },
    { url: 'https://www.itsawrapng.com/blog-feed.xml', source: "It's A Wrap" },
    { url: 'https://intro2filmclass.blogspot.com/feeds/posts/default?alt=rss', source: 'Intro to Film Class' }
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
    if (existingUrls.has(item.review_url)) {
      skipped++;
      continue;
    }

    // Generate candidate titles (full, before colon, before dash, before comma)
    const titleCandidates = [
      item.film_title,
      item.film_title.split(':')[0].trim(),
      item.film_title.split('–')[0].trim(),
      item.film_title.split('-')[0].trim(),
      item.film_title.split(',')[0].trim()
    ].filter(t => t.length >= 2);

    // Also extract 2-to-4 word prefix if title is long sentence-style editorial headline
    const words = item.film_title.split(/\s+/);
    if (words.length > 4) {
      titleCandidates.push(words.slice(0, 3).join(' '));
      titleCandidates.push(words.slice(0, 2).join(' '));
    }

    const uniqueCandidates = [...new Set(titleCandidates)];

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

    const payload = {
      film_id: matchedFilmId,
      play_id: matchedPlayId,
      critic_id: matchedCritic?.id || null,
      critic_name: matchedCritic?.name || item.critic_name || item.source_publication,
      critic_title: matchedCritic?.title || (matchedPlayId ? 'Theatre Critic' : 'Film Critic'),
      avatar_url: matchedCritic?.avatar_url || null,
      quote: item.quote || `${item.source_publication} review of ${targetTitle}`,
      rating: 3.0, // default baseline if not numeric in feed
      review_url: item.review_url,
      is_featured: true,
      is_anonymous: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: insErr } = await supabase.from('critic_reviews').insert(payload);
    if (!insErr) {
      synced++;
      existingUrls.add(item.review_url);
      newReviews.push(`${payload.critic_name} -> "${targetTitle}"`);
    } else {
      console.warn(`[critics_sync] Failed to insert review for ${targetTitle}:`, insErr.message);
    }
  }

  console.log(`[critics_sync] Completed. Processed: ${processed}, Synced: ${synced}, Skipped: ${skipped}`);
  return { processed, synced, skipped, new_reviews: newReviews };
}
