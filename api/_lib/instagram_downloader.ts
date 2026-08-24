/**
 * Instagram media extraction engine for Telegram intake and Social Studio.
 * Extracts high-resolution video streams (.mp4), original aspect ratio images,
 * and full unabridged captions from Instagram Reels and Posts.
 */

export interface ExtractedInstagramMedia {
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

export function cleanInstagramUrl(url: string | null): string | null {
  if (!url) return null;
  let cleaned = url.replace(/&amp;/g, '&');
  // Remove Instagram's dynamic square cropping parameters so flyers and wide images retain original aspect ratio
  cleaned = cleaned.replace(/stp=c\d+\.\d+\.\d+\.\d+a_dst-jpg/g, 'stp=dst-jpg');
  cleaned = cleaned.replace(/_s\d+x\d+_/g, '_');
  return cleaned;
}

export function extractInstagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([^/?#&]+)/i);
  return match ? match[1] : null;
}

/**
 * Extracts full Instagram post/reel media using multi-tiered request simulation.
 */
export async function extractInstagramMedia(url: string): Promise<ExtractedInstagramMedia> {
  const shortcode = extractInstagramShortcode(url) || '';
  const isReel = /\/reels?\/|\/tv\//i.test(url);

  let videoUrl: string | null = null;
  let imageUrl: string | null = null;
  let caption = '';
  let authorUsername: string | null = null;
  let authorName: string | null = null;

  // ── Strategy 0: Dedicated Render Microservice (yt-dlp) ──
  const extractorUrl = (process.env.MEDIA_EXTRACTOR_URL || process.env.RENDER_EXTRACTOR_URL || 'https://muvidb.onrender.com').replace(/\/$/, '');
  const extractorSecret = (process.env.EXTRACTOR_SECRET || '').trim();

  if (extractorUrl) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (extractorSecret) headers['Authorization'] = `Bearer ${extractorSecret}`;

      const res = await fetch(`${extractorUrl}/extract`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && (data.video_url || data.image_url)) {
          return {
            shortcode,
            isReel,
            isVideo: Boolean(data.video_url || isReel),
            videoUrl: data.video_url || null,
            imageUrl: data.image_url ? cleanInstagramUrl(data.image_url) : null,
            caption: data.caption ? decodeHtmlEntities(data.caption) : '',
            authorName: data.author || null,
            authorUsername: data.author || null,
            title: data.title || `${data.author || 'Instagram'} on Instagram`,
          };
        }
      }
    } catch (err: any) {
      console.warn('[instagram_downloader] Microservice extractor error:', err.message);
    }
  }

  // ── Strategy 1: Official Instagram oEmbed API (Fastest for caption + author) ──
  if (shortcode) {
    try {
      const oembedRes = await fetch(
        `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(`https://www.instagram.com/p/${shortcode}/`)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'X-IG-App-ID': '936619743392459',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(4000),
        },
      );

      if (oembedRes.ok) {
        const data = await oembedRes.json();
        if (data.title) caption = decodeHtmlEntities(data.title.trim());
        if (data.author_name) authorName = data.author_name.trim();
        if (data.thumbnail_url) imageUrl = cleanInstagramUrl(data.thumbnail_url);
      }
    } catch {
      /* continue to other strategies */
    }
  }

  // ── Strategy 2: Embed Page Parser (Extracts direct video src and uncropped display images) ──
  if (shortcode && (!videoUrl || !imageUrl)) {
    try {
      const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
      const embedRes = await fetch(embedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (embedRes.ok) {
        const html = await embedRes.text();

        // 1. Check for video tags
        const vidMatch =
          html.match(/<video[^>]+src="([^">]+)"/i) ||
          html.match(/video_url\\":\\"([^"\\]+)\\"/i) ||
          html.match(/"video_url":"([^"]+)"/i);

        if (vidMatch && vidMatch[1]) {
          videoUrl = vidMatch[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
        }

        // 2. Check for display image
        const imgMatch =
          html.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]+src="([^">]+)"/i) ||
          html.match(/display_url\\":\\"([^"\\]+)\\"/i) ||
          html.match(/"display_url":"([^"]+)"/i) ||
          html.match(/<meta property="og:image" content="([^"]*)"/i);

        if (imgMatch && imgMatch[1]) {
          const rawImg = imgMatch[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
          if (!rawImg.startsWith('data:')) {
            imageUrl = cleanInstagramUrl(rawImg);
          }
        }

        // 3. Check for caption
        if (!caption) {
          const captionMatch =
            html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>/i) ||
            html.match(/<div class="CaptionComments"[^>]*>([\s\S]*?)<\/div>/i);
          if (captionMatch && captionMatch[1]) {
            const stripped = captionMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (stripped) caption = decodeHtmlEntities(stripped);
          }
        }

        // 4. Check for username
        const userMatch = html.match(/class="UsernameText"[^>]*>([^<]+)<\/span>/i);
        if (userMatch && userMatch[1]) {
          authorUsername = userMatch[1].trim();
          if (!authorName) authorName = authorUsername;
        }
      }
    } catch {
      /* continue to other strategies */
    }
  }

  // ── Strategy 3: Instagram GraphQL Web Query ──
  if (shortcode && isReel && !videoUrl) {
    try {
      const gqlUrl = `https://www.instagram.com/graphql/query/?doc_id=17867956667140244&variables=${encodeURIComponent(
        JSON.stringify({ shortcode }),
      )}`;

      const gqlRes = await fetch(gqlUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'X-IG-App-ID': '936619743392459',
          'X-ASBD-ID': '129477',
          'Accept': '*/*',
          'Referer': 'https://www.instagram.com/',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (gqlRes.ok) {
        const gqlData = await gqlRes.json();
        const media = gqlData?.data?.xdt_shortcode_media;
        if (media) {
          if (media.video_url) videoUrl = media.video_url;
          if (media.display_url && !imageUrl) imageUrl = cleanInstagramUrl(media.display_url);
          if (media.owner?.username && !authorUsername) {
            authorUsername = media.owner.username;
            authorName = media.owner.full_name || media.owner.username;
          }
          if (!caption && media.edge_media_to_caption?.edges?.[0]?.node?.text) {
            caption = media.edge_media_to_caption.edges[0].node.text;
          }
        }
      }
    } catch {
      /* continue to other strategies */
    }
  }

  // ── Strategy 4: Fallback Direct HTML / Meta Scraper ──
  if (!videoUrl && !imageUrl) {
    try {
      const directRes = await fetch(url, {
        headers: {
          'User-Agent':
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (directRes.ok) {
        const html = await directRes.text();
        const ogVid =
          html.match(/<meta property="og:video(?::secure_url)?" content="([^"]*)"/i)?.[1] ||
          html.match(/content="([^"]*)"\s+property="og:video(?::secure_url)?"/i)?.[1];
        const ogImg =
          html.match(/<meta property="og:image" content="([^"]*)"/i)?.[1] ||
          html.match(/content="([^"]*)"\s+property="og:image"/i)?.[1];
        const ogTitle =
          html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1] ||
          html.match(/content="([^"]*)"\s+property="og:title"/i)?.[1];

        if (ogVid) videoUrl = ogVid.replace(/&amp;/g, '&');
        if (ogImg && !imageUrl) imageUrl = cleanInstagramUrl(ogImg);
        if (ogTitle && !caption) {
          const decoded = decodeHtmlEntities(ogTitle);
          const quoteMatch = decoded.match(/:\s*"([\s\S]*)"/i);
          if (quoteMatch && quoteMatch[1]) caption = quoteMatch[1];
        }
      }
    } catch {
      /* continue */
    }
  }

  // Determine Title & Department
  const title = authorName
    ? `${authorName} on Instagram (${isReel ? 'Reel' : 'Post'})`
    : shortcode
      ? `Instagram ${isReel ? 'Reel' : 'Post'} (${shortcode})`
      : `Instagram ${isReel ? 'Reel' : 'Post'}`;

  return {
    shortcode,
    isReel,
    isVideo: Boolean(videoUrl || isReel),
    videoUrl,
    imageUrl,
    caption,
    authorName: authorName || authorUsername,
    authorUsername,
    title,
  };
}
