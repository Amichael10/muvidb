import fs from 'fs';
import path from 'path';

/**
 * Instagram media extraction engine for Telegram intake and Social Studio.
 * Extracts high-resolution video streams (.mp4), original aspect ratio images,
 * and full unabridged captions from Instagram Reels and Posts.
 */

export interface ExtractedInstagramSlide {
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string | null;
}

export interface ExtractedInstagramMedia {
  shortcode: string;
  isReel: boolean;
  isVideo: boolean;
  videoUrl: string | null;
  imageUrl: string | null;
  images?: string[];
  slides?: ExtractedInstagramSlide[];
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
  let cleaned = url
    .replace(/\\u0026/gi, '&')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .trim();
  // Never tamper with query parameters on signed Instagram CDN URLs (oh=...),
  // otherwise Meta's CDN rejects the request with 403 URL signature mismatch.
  if (!/[?&]oh=/i.test(cleaned)) {
    cleaned = cleaned.replace(/stp=c\d+\.\d+\.\d+\.\d+a_dst-jpg/g, 'stp=dst-jpg');
    cleaned = cleaned.replace(/_s\d+x\d+_/g, '_');
  }
  return cleaned;
}

/**
 * Stable media deduplication key that strips CDN edge host & query params
 * so the same slide at 640px and 1080px isn't added twice.
 */
function instagramMediaKey(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const filename = parsed.pathname.split('/').pop() || parsed.pathname;
    return filename.toLowerCase();
  } catch {
    return rawUrl.split('?')[0].toLowerCase();
  }
}

function pickBestResourceUrl(node: any): string | null {
  if (!node) return null;
  if (Array.isArray(node.display_resources) && node.display_resources.length > 0) {
    const sorted = [...node.display_resources].sort(
      (a, b) => Number(b?.config_width || 0) - Number(a?.config_width || 0),
    );
    if (sorted[0]?.src) return sorted[0].src;
  }
  if (Array.isArray(node.image_versions2?.candidates) && node.image_versions2.candidates.length > 0) {
    const sorted = [...node.image_versions2.candidates].sort(
      (a, b) => Number(b?.width || 0) - Number(a?.width || 0),
    );
    if (sorted[0]?.url) return sorted[0].url;
  }
  if (typeof node.display_url === 'string' && node.display_url.startsWith('http')) {
    return node.display_url;
  }
  return null;
}

/**
 * Parses Instagram's embedded `contextJSON` payload from `/p/{shortcode}/embed/captioned/`
 * to recover all carousel (`GraphSidecar`) slides, video streams, full caption, and author.
 */
function parseEmbedContextJson(html: string): {
  slides: ExtractedInstagramSlide[];
  caption: string;
  authorUsername: string | null;
  authorName: string | null;
  videoUrl: string | null;
} | null {
  const ctxMatch =
    html.match(/"contextJSON":"((?:[^"\\]|\\.)*)"/) ||
    html.match(/contextJSON\\":\\"((?:[^"\\]|\\.)*)\\"/);
  if (!ctxMatch?.[1]) return null;

  let ctx: any = null;
  try {
    const unescaped = JSON.parse(`"${ctxMatch[1]}"`);
    ctx = typeof unescaped === 'string' ? JSON.parse(unescaped) : unescaped;
  } catch {
    return null;
  }

  const sm = ctx?.gql_data?.shortcode_media;
  const fallbackCtx = ctx?.context;
  if (!sm && !fallbackCtx) return null;

  const slides: ExtractedInstagramSlide[] = [];
  const seenKeys = new Set<string>();
  let videoUrl: string | null = null;

  const pushSlide = (url: string | null | undefined, type: 'image' | 'video', thumb?: string | null) => {
    const clean = cleanInstagramUrl(url || null);
    if (!clean || clean.startsWith('data:')) return;
    const key = `${type}:${instagramMediaKey(clean)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    slides.push({
      url: clean,
      type,
      thumbnailUrl: thumb ? cleanInstagramUrl(thumb) : null,
    });
    if (type === 'video' && !videoUrl) videoUrl = clean;
  };

  // 1. Multi-slide Carousel (GraphSidecar)
  const sidecarEdges = sm?.edge_sidecar_to_children?.edges;
  if (Array.isArray(sidecarEdges) && sidecarEdges.length > 0) {
    for (const edge of sidecarEdges) {
      const node = edge?.node;
      if (!node) continue;
      const img = pickBestResourceUrl(node);
      if (node.is_video && node.video_url) {
        pushSlide(node.video_url, 'video', img);
      }
      if (img) {
        pushSlide(img, 'image');
      }
    }
  } else if (sm) {
    // 2. Single Image or Video / Reel
    const img = pickBestResourceUrl(sm);
    if (sm.video_url) pushSlide(sm.video_url, 'video', img);
    if (img) pushSlide(img, 'image');
  } else if (fallbackCtx?.media) {
    const img = pickBestResourceUrl(fallbackCtx.media);
    if (fallbackCtx.media.video_url) pushSlide(fallbackCtx.media.video_url, 'video', img);
    if (img) pushSlide(img, 'image');
  }

  const captionRaw =
    sm?.edge_media_to_caption?.edges?.[0]?.node?.text ||
    fallbackCtx?.caption ||
    '';
  const caption = captionRaw ? decodeHtmlEntities(String(captionRaw).trim()) : '';

  const authorUsername = sm?.owner?.username || fallbackCtx?.username || null;
  const authorName = sm?.owner?.full_name || authorUsername || null;

  return { slides, caption, authorUsername, authorName, videoUrl };
}

export function extractInstagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([^/?#&]+)/i);
  return match ? match[1] : null;
}

/**
 * Returns active Instagram session cookies to completely bypass Instagram login gates.
 * Checks environment variables (IG_COOKIE, INSTAGRAM_SESSION_COOKIE) or local storage
 * saved by the scout account manager (`npm run ig:login` in scratch/ig_session.json).
 */
export function getInstagramSessionCookies(): string | null {
  const envCookie = (process.env.INSTAGRAM_SESSION_COOKIE || process.env.IG_COOKIE || '').trim();
  if (envCookie && envCookie.includes('sessionid')) return envCookie;

  const sessionId = (process.env.INSTAGRAM_SESSION_ID || process.env.IG_SESSION_ID || '').trim();
  if (sessionId) return `sessionid=${sessionId}`;

  try {
    const sessionFile = path.resolve(process.cwd(), 'scratch/ig_session.json');
    if (fs.existsSync(sessionFile)) {
      const parsed = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      const cookies = parsed.cookies || [];
      const hasSessionId = cookies.some((c: any) => c.name === 'sessionid' && c.value);
      if (!hasSessionId) return null;
      const valid = cookies.filter((c: any) => c.name && c.value && (!c.expires || c.expires * 1000 > Date.now()));
      if (valid.length > 0) {
        return valid.map((c: any) => `${c.name}=${c.value}`).join('; ');
      }
    }
  } catch {
    // fallback
  }

  return null;
}

/**
 * Extracts full Instagram post/reel media using multi-tiered request simulation.
 */
export async function extractInstagramMedia(url: string): Promise<ExtractedInstagramMedia> {
  const shortcode = extractInstagramShortcode(url) || '';
  const isReel = /\/reels?\/|\/tv\//i.test(url);

  let videoUrl: string | null = null;
  let imageUrl: string | null = null;
  const images: string[] = [];
  const slides: ExtractedInstagramSlide[] = [];
  const seenImageKeys = new Set<string>();
  const seenSlideKeys = new Set<string>();
  let caption = '';
  let authorUsername: string | null = null;
  let authorName: string | null = null;

  const recordImage = (rawUrl: string | null | undefined) => {
    if (!rawUrl) return;
    const clean = cleanInstagramUrl(rawUrl);
    if (!clean || clean.startsWith('data:')) return;
    const key = instagramMediaKey(clean);
    if (!seenImageKeys.has(key)) {
      seenImageKeys.add(key);
      images.push(clean);
      if (!imageUrl) imageUrl = clean;
    }
    const slideKey = `image:${key}`;
    if (!seenSlideKeys.has(slideKey)) {
      seenSlideKeys.add(slideKey);
      slides.push({ url: clean, type: 'image' });
    }
  };

  const recordVideo = (rawUrl: string | null | undefined, thumb?: string | null) => {
    if (!rawUrl) return;
    const clean = cleanInstagramUrl(rawUrl);
    if (!clean || clean.startsWith('data:')) return;
    if (!videoUrl) videoUrl = clean;
    const slideKey = `video:${instagramMediaKey(clean)}`;
    if (!seenSlideKeys.has(slideKey)) {
      seenSlideKeys.add(slideKey);
      slides.push({ url: clean, type: 'video', thumbnailUrl: thumb ? cleanInstagramUrl(thumb) : null });
    }
  };

  const sessionCookie = getInstagramSessionCookies();

  // ── Strategy -1: Authenticated Instagram Post Info API (Bypasses Login Wall) ──
  if (shortcode && sessionCookie) {
    try {
      const authApiUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
      const authRes = await fetch(authApiUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'X-IG-App-ID': '936619743392459',
          'Accept': 'application/json, text/plain, */*',
          'Cookie': sessionCookie,
          'Referer': `https://www.instagram.com/p/${shortcode}/`,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (authRes.ok) {
        const json = await authRes.json();
        const item = json?.items?.[0] || json?.graphql?.shortcode_media;
        if (item) {
          if (!caption && item.caption?.text) {
            caption = decodeHtmlEntities(item.caption.text);
          } else if (!caption && item.edge_media_to_caption?.edges?.[0]?.node?.text) {
            caption = decodeHtmlEntities(item.edge_media_to_caption.edges[0].node.text);
          }

          if (item.user) {
            authorUsername = item.user.username || null;
            authorName = item.user.full_name || authorUsername;
          } else if (item.owner) {
            authorUsername = item.owner.username || null;
            authorName = item.owner.full_name || authorUsername;
          }

          if (Array.isArray(item.carousel_media) && item.carousel_media.length) {
            for (const slide of item.carousel_media) {
              const bestImg = pickBestResourceUrl(slide);
              if (bestImg) recordImage(bestImg);
              if (slide.video_versions?.[0]?.url) {
                recordVideo(slide.video_versions[0].url, bestImg);
              }
            }
          } else if (Array.isArray(item.edge_sidecar_to_children?.edges) && item.edge_sidecar_to_children.edges.length) {
            for (const edge of item.edge_sidecar_to_children.edges) {
              const node = edge?.node;
              const bestImg = pickBestResourceUrl(node);
              if (bestImg) recordImage(bestImg);
              if (node?.video_url) recordVideo(node.video_url, bestImg);
            }
          } else {
            const singleImg = pickBestResourceUrl(item);
            if (singleImg) recordImage(singleImg);
            if (item.video_versions?.[0]?.url) recordVideo(item.video_versions[0].url, singleImg);
            else if (item.video_url) recordVideo(item.video_url, singleImg);
          }

          if (images.length > 0 || videoUrl || caption) {
            return {
              shortcode,
              isReel,
              isVideo: Boolean(videoUrl || isReel),
              videoUrl,
              imageUrl: imageUrl || images[0] || null,
              images: images.length ? images : (imageUrl ? [imageUrl] : []),
              slides,
              caption,
              authorName: authorName || authorUsername,
              authorUsername,
              title: authorName
                ? `${authorName} on Instagram (${isReel ? 'Reel' : 'Post'})`
                : `Instagram ${isReel ? 'Reel' : 'Post'} (${shortcode})`,
            };
          }
        }
      }
    } catch (err: any) {
      console.warn('[instagram_downloader] Authenticated API error:', err.message);
    }
  }

  // ── Strategy 1: Embed Page Parser (Fastest & most reliable full-carousel extractor, works anonymously!) ──
  if (shortcode) {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    // Bot / Crawler user agents are critical: Meta serves the complete SSR `contextJSON` payload
    // containing all carousel slides and full captions to bots/curl, whereas standard browser UAs
    // receive an interactive JS login shell.
    const userAgents = [
      'curl/8.4.0',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Twitterbot/1.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ];

    let lastHtml: string | null = null;

    for (const ua of userAgents) {
      try {
        const embedRes = await fetch(embedUrl, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            ...(sessionCookie ? { Cookie: sessionCookie } : {}),
          },
          signal: AbortSignal.timeout(7000),
        });

        if (!embedRes.ok) continue;
        const html = await embedRes.text();
        lastHtml = html;

        // Primary: structured contextJSON -> gql_data.shortcode_media (full carousel + unabridged caption)
        const parsedCtx = parseEmbedContextJson(html);
        if (parsedCtx && (parsedCtx.slides.length > 0 || parsedCtx.caption)) {
          for (const slide of parsedCtx.slides) {
            if (slide.type === 'video') recordVideo(slide.url, slide.thumbnailUrl);
            else recordImage(slide.url);
          }
          if (parsedCtx.caption && (!caption || parsedCtx.caption.length > caption.length)) {
            caption = parsedCtx.caption;
          }
          if (parsedCtx.authorUsername && !authorUsername) authorUsername = parsedCtx.authorUsername;
          if (parsedCtx.authorName && !authorName) authorName = parsedCtx.authorName;

          // If we got full carousel slides (more than 1) or a verified single post with caption, we are done
          if (slides.length > 1 || (slides.length === 1 && caption)) {
            break;
          }
        }
      } catch {
        /* try next user-agent */
      }
    }

    // Secondary fallback: if contextJSON was never parsed across any user agent, parse HTML tags from the last response
    if (slides.length === 0 && lastHtml) {
      if (!videoUrl) {
        const vidMatch =
          lastHtml.match(/<video[^>]+src="([^">]+)"/i) ||
          lastHtml.match(/video_url\\":\\"([^"\\]+)\\"/i) ||
          lastHtml.match(/"video_url":"([^"]+)"/i);
        if (vidMatch?.[1]) recordVideo(vidMatch[1]);
      }

      const imgMatch =
        lastHtml.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]+src="([^">]+)"/i) ||
        lastHtml.match(/<meta property="og:image" content="([^"]*)"/i);
      if (imgMatch?.[1]) recordImage(imgMatch[1]);

      if (!caption) {
        const captionMatch =
          lastHtml.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>/i) ||
          lastHtml.match(/<div class="CaptionComments"[^>]*>([\s\S]*?)<\/div>/i);
        if (captionMatch?.[1]) {
          const stripped = captionMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (stripped) caption = decodeHtmlEntities(stripped);
        }
      }

      const userMatch = lastHtml.match(/class="UsernameText"[^>]*>([^<]+)<\/span>/i);
      if (userMatch?.[1]) {
        authorUsername = userMatch[1].trim();
        if (!authorName) authorName = authorUsername;
      }
    }
  }

  // ── Strategy 2: Dedicated Render Microservice (yt-dlp — for Reels or when carousel not expanded) ──
  const needsMicroservice = (isReel && !videoUrl) || slides.length <= 1;
  const extractorUrl = (process.env.MEDIA_EXTRACTOR_URL || process.env.RENDER_EXTRACTOR_URL || 'https://muvidb.onrender.com').replace(/\/$/, '');
  const extractorSecret = (process.env.EXTRACTOR_SECRET || '').trim();

  if (extractorUrl && needsMicroservice) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (extractorSecret) headers['Authorization'] = `Bearer ${extractorSecret}`;

      const res = await fetch(`${extractorUrl}/extract`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, cookie: sessionCookie || undefined }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.video_url) recordVideo(data.video_url, data.image_url);
          if (Array.isArray(data.images)) {
            data.images.forEach((u: string) => recordImage(u));
          }
          if (Array.isArray(data.entries)) {
            data.entries.forEach((e: any) => {
              if (e?.url && !e.url.includes('.mp4')) recordImage(e.url);
              else if (e?.thumbnail) recordImage(e.thumbnail);
            });
          }
          if (data.image_url) recordImage(data.image_url);
          if (data.caption && !caption) caption = decodeHtmlEntities(data.caption);
          if (data.author && !authorName) {
            authorName = data.author;
            authorUsername = authorUsername || data.author;
          }
        }
      }
    } catch (err: any) {
      console.warn('[instagram_downloader] Microservice extractor error:', err.message);
    }
  }

  // ── Strategy 3: Official Instagram oEmbed API (Fallback for caption + author) ──
  if (shortcode && (images.length === 0 || !caption)) {
    try {
      const oembedRes = await fetch(
        `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(`https://www.instagram.com/p/${shortcode}/`)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'X-IG-App-ID': '936619743392459',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(4000),
        },
      );

      if (oembedRes.ok) {
        const data = await oembedRes.json();
        if (data.title && !caption) caption = decodeHtmlEntities(data.title.trim());
        if (data.author_name && !authorName) authorName = data.author_name.trim();
        if (data.thumbnail_url && images.length === 0) {
          recordImage(data.thumbnail_url);
        }
      }
    } catch {
      /* continue to other strategies */
    }
  }

  // ── Strategy 4: Instagram GraphQL Web Query (Fallback when carousel still not expanded) ──
  if (shortcode && images.length <= 1) {
    try {
      const gqlUrl = `https://www.instagram.com/graphql/query/?doc_id=8845758582119845&variables=${encodeURIComponent(
        JSON.stringify({ shortcode }),
      )}`;

      const gqlRes = await fetch(gqlUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'X-IG-App-ID': '936619743392459',
          'X-ASBD-ID': '129477',
          'Accept': '*/*',
          'Referer': 'https://www.instagram.com/',
          ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        },
        signal: AbortSignal.timeout(5000),
      });

      if (gqlRes.ok) {
        const gqlData = await gqlRes.json();
        const media = gqlData?.data?.xdt_shortcode_media || gqlData?.data?.shortcode_media;
        if (media) {
          const sidecarEdges = media.edge_sidecar_to_children?.edges;
          if (Array.isArray(sidecarEdges) && sidecarEdges.length > 0) {
            for (const edge of sidecarEdges) {
              const node = edge?.node;
              const bestImg = pickBestResourceUrl(node);
              if (bestImg) recordImage(bestImg);
              if (node?.video_url) recordVideo(node.video_url, bestImg);
            }
          } else {
            const bestImg = pickBestResourceUrl(media);
            if (bestImg) recordImage(bestImg);
            if (media.video_url) recordVideo(media.video_url, bestImg);
          }

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
  if (!videoUrl && images.length === 0) {
    try {
      const directRes = await fetch(url, {
        headers: {
          'User-Agent':
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          ...(sessionCookie ? { Cookie: sessionCookie } : {}),
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
        if (ogImg) recordImage(ogImg);
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
    imageUrl: imageUrl || images[0] || null,
    images: images.length ? images : (imageUrl ? [imageUrl] : []),
    slides,
    caption,
    authorName: authorName || authorUsername,
    authorUsername,
    title,
  };
}
