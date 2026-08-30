/**
 * Threads media extraction engine for Telegram intake and Social Studio.
 * Extracts high-resolution video streams (.mp4), high-res display images, full post text,
 * and author profiles from Meta Threads posts and videos.
 */

export interface ExtractedThreadsMedia {
  shortcode: string;
  isReel: boolean;
  isVideo: boolean;
  videoUrl: string | null;
  imageUrl: string | null;
  caption: string;
  authorName: string | null;
  authorUsername: string | null;
  title: string;
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#064;/g, '@')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return '';
      }
    });
}

export function cleanThreadsUrl(url: string | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const trackingParams = ['xmt', 'sjid', 'igshid', 'utm_source', 'utm_medium', 'utm_campaign'];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString().replace(/&amp;/g, '&');
  } catch {
    return url.replace(/&amp;/g, '&');
  }
}

export function isThreadsUrl(url: string): boolean {
  return /threads\.(?:net|com)/i.test(url);
}

export function extractThreadsShortcode(url: string): string | null {
  const match = url.match(/threads\.(?:net|com)\/(?:@[^/?#]+\/post\/|t\/|post\/)([^/?#&]+)/i);
  return match ? match[1] : null;
}

/**
 * Extracts full Threads post/reel media using multi-tiered request simulation.
 */
export async function extractThreadsMedia(url: string): Promise<ExtractedThreadsMedia> {
  const cleanedUrl = cleanThreadsUrl(url);
  const shortcode = extractThreadsShortcode(url) || '';
  const isReel = /\/(?:reel|reels)\//i.test(url);

  let videoUrl: string | null = null;
  let imageUrl: string | null = null;
  let caption = '';
  let authorUsername: string | null = null;
  let authorName: string | null = null;
  let rawTitle = '';

  // ── Strategy 0: Dedicated Render Microservice (yt-dlp) ──
  const extractorUrl = (
    process.env.MEDIA_EXTRACTOR_URL ||
    process.env.RENDER_EXTRACTOR_URL ||
    'https://muvidb.onrender.com'
  ).replace(/\/$/, '');
  const extractorSecret = (process.env.EXTRACTOR_SECRET || '').trim();

  if (extractorUrl) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (extractorSecret) headers['Authorization'] = `Bearer ${extractorSecret}`;

      const res = await fetch(`${extractorUrl}/extract`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: cleanedUrl || url }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && (data.video_url || data.image_url || data.caption)) {
          const author = data.author || null;
          const cleanCap = data.caption ? decodeHtmlEntities(data.caption) : '';
          const titleText = data.title ? decodeHtmlEntities(data.title) : '';

          return {
            shortcode,
            isReel,
            isVideo: Boolean(data.video_url || isReel),
            videoUrl: data.video_url || null,
            imageUrl: data.image_url ? data.image_url.replace(/&amp;/g, '&') : null,
            caption: cleanCap || titleText,
            authorName: author,
            authorUsername: author,
            title: author ? `${author} on Threads` : titleText || 'Threads Post',
          };
        }
      }
    } catch (err: any) {
      console.warn('[threads_downloader] Microservice extractor error:', err.message);
    }
  }

  // ── Strategy 1: Official Threads oEmbed API ──
  if (shortcode) {
    try {
      const oembedUrl = `https://www.threads.net/api/v1/oembed/?url=${encodeURIComponent(
        cleanedUrl || url,
      )}`;
      const oembedRes = await fetch(oembedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      });

      if (oembedRes.ok) {
        const data = await oembedRes.json();
        if (data.title) caption = decodeHtmlEntities(data.title.trim());
        if (data.author_name) authorName = data.author_name.trim();
        if (data.author_url) {
          const match = data.author_url.match(/threads\.(?:net|com)\/@([^/?#]+)/i);
          if (match) authorUsername = match[1];
        }
        if (data.thumbnail_url) imageUrl = data.thumbnail_url.replace(/&amp;/g, '&');
      }
    } catch {
      /* continue to Strategy 2 */
    }
  }

  // ── Strategy 2: Open Graph & Meta Tag Scraper ──
  try {
    const res = await fetch(cleanedUrl || url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const html = await res.text();

      // 1. Extract Video URLs
      const ogVid =
        html.match(/<meta property="og:video(?::secure_url)?" content="([^"]*)"/i)?.[1] ||
        html.match(/content="([^"]*)"\s+property="og:video(?::secure_url)?"/i)?.[1];
      if (ogVid) {
        videoUrl = decodeHtmlEntities(ogVid).replace(/&amp;/g, '&');
      }

      // 2. Extract Display Image / Poster
      const ogImg =
        html.match(/<meta property="og:image" content="([^"]*)"/i)?.[1] ||
        html.match(/content="([^"]*)"\s+property="og:image"/i)?.[1];
      if (
        ogImg &&
        !ogImg.includes('static.cdninstagram.com') &&
        !ogImg.includes('static.xx.fbcdn.net')
      ) {
        imageUrl = decodeHtmlEntities(ogImg).replace(/&amp;/g, '&');
      }

      // 3. Extract Title & Author
      const ogTitle =
        html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1] ||
        html.match(/content="([^"]*)"\s+property="og:title"/i)?.[1] ||
        html.match(/<title>([^<]*)<\/title>/i)?.[1];

      if (ogTitle) {
        const decodedTitle = decodeHtmlEntities(ogTitle.trim());
        rawTitle = decodedTitle.replace(/\s*\|\s*Threads$/i, '').replace(/\s*-\s*Threads$/i, '').trim();

        // Threads author format: "Author Name (@username) on Threads" or "Author Name on Threads"
        const authorMatch =
          rawTitle.match(/^([^(]+?)\s*\(@([^)]+)\)\s+on\s+Threads/i) ||
          rawTitle.match(/^([^:]+?)\s+on\s+Threads/i) ||
          rawTitle.match(/^([^(]+)\s*\(@([^)]+)\)/i);

        if (authorMatch) {
          if (!authorName && authorMatch[1]) authorName = authorMatch[1].trim();
          if (!authorUsername && authorMatch[2]) authorUsername = authorMatch[2].trim();
        }
      }

      // 4. Extract Caption / Description
      const ogDesc =
        html.match(/<meta property="og:description" content="([^"]*)"/i)?.[1] ||
        html.match(/content="([^"]*)"\s+property="og:description"/i)?.[1] ||
        html.match(/<meta name="description" content="([^"]*)"/i)?.[1];

      if (ogDesc && !caption) {
        const decodedDesc = decodeHtmlEntities(ogDesc.trim());
        if (
          decodedDesc.length > 5 &&
          !decodedDesc.includes('Join Threads to share') &&
          !decodedDesc.includes('Log in to see photos')
        ) {
          caption = decodedDesc;
        }
      }
    }
  } catch (err: any) {
    console.warn('[threads_downloader] HTML scrape error:', err.message);
  }

  const finalAuthor = authorName || authorUsername;
  const finalTitle = finalAuthor
    ? `${finalAuthor} on Threads`
    : rawTitle
      ? rawTitle
      : 'Threads Post';

  return {
    shortcode,
    isReel,
    isVideo: Boolean(videoUrl || isReel),
    videoUrl,
    imageUrl,
    caption: caption || rawTitle,
    authorName: finalAuthor,
    authorUsername,
    title: finalTitle,
  };
}
