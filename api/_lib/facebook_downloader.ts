/**
 * Facebook media extraction engine for Telegram intake and Social Studio.
 * Extracts high-resolution video streams (.mp4), thumbnail images, full captions,
 * and author information from Facebook Reels, Videos, and Posts.
 */

export interface ExtractedFacebookMedia {
  isReel: boolean;
  isVideo: boolean;
  videoUrl: string | null;
  imageUrl: string | null;
  caption: string;
  authorName: string | null;
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

/**
 * Strips verbose Facebook tracking parameters (e.g., ?mibextid=..., ?rdid=..., ?ref=...).
 */
export function cleanFacebookUrl(url: string | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const trackingParams = [
      'mibextid',
      'rdid',
      'ref',
      'refsrc',
      'sfnsn',
      'fbclid',
      '__cft__',
      '__tn__',
      'notif_t',
      'notif_id',
      'paipv',
      'eav',
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString().replace(/&amp;/g, '&');
  } catch {
    return url.replace(/&amp;/g, '&');
  }
}

export function isFacebookUrl(url: string): boolean {
  return /facebook\.com|fb\.watch|fb\.me/i.test(url);
}

export function isFacebookReelUrl(url: string): boolean {
  return /\/(?:reel|reels)\/|\/share\/r\//i.test(url);
}

export function isFacebookVideoUrl(url: string): boolean {
  return isFacebookReelUrl(url) || /\/videos?\/|\/watch\/|\/share\/v\/|fb\.watch/i.test(url);
}

/**
 * Extracts full Facebook post/reel media using multi-tiered extraction.
 */
export async function extractFacebookMedia(url: string): Promise<ExtractedFacebookMedia> {
  const cleanedUrl = cleanFacebookUrl(url);
  const isReel = isFacebookReelUrl(url);
  const isVideo = isFacebookVideoUrl(url);

  let videoUrl: string | null = null;
  let imageUrl: string | null = null;
  let caption = '';
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
            isReel,
            isVideo: Boolean(data.video_url || isVideo),
            videoUrl: data.video_url || null,
            imageUrl: data.image_url ? data.image_url.replace(/&amp;/g, '&') : null,
            caption: cleanCap || titleText,
            authorName: author,
            title: author
              ? `${author} on Facebook (${isReel ? 'Reel' : isVideo ? 'Video' : 'Post'})`
              : titleText || `Facebook ${isReel ? 'Reel' : isVideo ? 'Video' : 'Post'}`,
          };
        }
      }
    } catch (err: any) {
      console.warn('[facebook_downloader] Microservice extractor error:', err.message);
    }
  }

  // ── Strategy 1: Open Graph & Meta HTML Scraper ──
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
      if (ogImg && !ogImg.includes('static.xx.fbcdn.net/rsrc.php')) {
        imageUrl = decodeHtmlEntities(ogImg).replace(/&amp;/g, '&');
      }

      // 3. Extract Title & Author
      const ogTitle =
        html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1] ||
        html.match(/content="([^"]*)"\s+property="og:title"/i)?.[1] ||
        html.match(/<title>([^<]*)<\/title>/i)?.[1];

      if (ogTitle) {
        const decodedTitle = decodeHtmlEntities(ogTitle.trim());
        rawTitle = decodedTitle.replace(/\s*\|\s*Facebook$/i, '').replace(/\s*-\s*Facebook$/i, '').trim();

        // Extract author pattern e.g. "Author Name - Video Title" or "Author Name on Facebook"
        const authorMatch =
          rawTitle.match(/^([^-|]+?)\s*[-|]\s*/i) ||
          rawTitle.match(/^([^:]+?)\s+on\s+Facebook/i);
        if (authorMatch && authorMatch[1] && authorMatch[1].length < 60) {
          authorName = authorMatch[1].trim();
        }
      }

      // 4. Extract Caption / Description
      const ogDesc =
        html.match(/<meta property="og:description" content="([^"]*)"/i)?.[1] ||
        html.match(/content="([^"]*)"\s+property="og:description"/i)?.[1] ||
        html.match(/<meta name="description" content="([^"]*)"/i)?.[1];

      if (ogDesc) {
        const decodedDesc = decodeHtmlEntities(ogDesc.trim());
        if (
          decodedDesc.length > 5 &&
          !decodedDesc.includes('Log into Facebook') &&
          !decodedDesc.includes('Connect with friends')
        ) {
          caption = decodedDesc;
        }
      }

      // 5. Look for direct HD/SD video URLs embedded in page scripts
      if (!videoUrl && isVideo) {
        const hdMatch =
          html.match(/"playable_url_quality_hd":"([^"]+)"/i) ||
          html.match(/playable_url_quality_hd\\":\\"([^"\\]+)\\"/i) ||
          html.match(/"browser_native_hd_url":"([^"]+)"/i);
        const sdMatch =
          html.match(/"playable_url":"([^"]+)"/i) ||
          html.match(/playable_url\\":\\"([^"\\]+)\\"/i) ||
          html.match(/"browser_native_sd_url":"([^"]+)"/i);

        const matchedVid = hdMatch?.[1] || sdMatch?.[1];
        if (matchedVid) {
          videoUrl = matchedVid.replace(/\\u0026/g, '&').replace(/\\/g, '').replace(/&amp;/g, '&');
        }
      }
    }
  } catch (err: any) {
    console.warn('[facebook_downloader] HTML scrape error:', err.message);
  }

  const finalTitle = authorName
    ? `${authorName} on Facebook (${isReel ? 'Reel' : isVideo ? 'Video' : 'Post'})`
    : rawTitle
      ? rawTitle
      : `Facebook ${isReel ? 'Reel' : isVideo ? 'Video' : 'Post'}`;

  return {
    isReel,
    isVideo: Boolean(videoUrl || isVideo),
    videoUrl,
    imageUrl,
    caption: caption || rawTitle,
    authorName,
    title: finalTitle,
  };
}
