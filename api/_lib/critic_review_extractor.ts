import * as cheerio from 'cheerio';
import { generateAIContent, parseJSON } from './ai_service.js';

export type ExtractedCriticReview = {
  excerpt: string;
  excerptContext: string | null;
  rating: number | null;
};

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function extractReviewText(html: string): string {
  const $ = cheerio.load(html);
  $('script,style,noscript,svg,nav,footer,header,form,aside,.advertisement,.ads,.share,.social').remove();
  const selectors = ['article [itemprop="articleBody"]', '[itemprop="articleBody"]', 'article', '.entry-content', '.post-content', '.article-content', 'main'];
  for (const selector of selectors) {
    const text = normalize($(selector).first().text());
    if (text.length >= 300) return text;
  }
  return normalize($('body').text());
}

export function extractExplicitRating(text: string): number | null {
  const patterns = [
    /(?:rating|score|verdict)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*\/\s*(5|10|100)\b/i,
    /\b(\d+(?:\.\d+)?)\s*\/\s*(5|10|100)\s*(?:stars?|rating|score)?\b/i,
    /(?:rating|score|verdict)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:out of)\s*(5|10|100)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    const scale = Number(match[2]);
    if (Number.isFinite(value) && value >= 0 && value <= scale) return Math.round((value / scale) * 50) / 10;
  }
  return null;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z“‘"'])/)
    .map(normalize)
    .filter(sentence => {
      const words = sentence.split(/\s+/).length;
      return words >= 10 && words <= 55 && !/cookie|subscribe|newsletter|copyright|privacy/i.test(sentence);
    });
}

export function fallbackDiscussionExcerpt(text: string): string {
  const allSentences = sentences(text);
  if (!allSentences.length) return normalize(text).slice(0, 280);

  // Skip the first 2 sentences if there are enough, to avoid headlines, bylines, or plot opening
  const bodySentences = allSentences.length > 4 ? allSentences.slice(2) : allSentences;

  // Prioritize the sharpest, most controversial or critical assessment
  const controversySignals = /\b(fails?|failure|disaster|unconvincing|terrible|mess|controversial|weak|struggles?|cringe|dull|flawed|superficial|tedious|stumbles?|disappoint\w*|ridiculous|bizarre|cliché|unnecessary|problem|waste)\b/i;
  const controversial = bodySentences.find(s => controversySignals.test(s));
  if (controversial) return controversial;

  const generalSignals = /\b(but|however|although|yet|beautiful|powerful|remarkable|uneven|compelling|ambitious|confusing|best|worst|triumph)\b/i;
  return bodySentences.find(s => generalSignals.test(s)) || bodySentences[0] || allSentences[0];
}

export function extractAuthorAndAvatar(html: string, fallbackLogo: string | null = null): {
  authorName: string | null;
  avatarUrl: string | null;
} {
  const $ = cheerio.load(html);

  // 1. Author Name
  const authorSelectors = [
    '.author-name',
    '.entry-author .author',
    '.post-author-name',
    '[rel="author"]',
    '.author a',
    '.vcard .fn',
    'meta[name="author"]',
    '.byline .author',
  ];
  let authorName: string | null = null;
  for (const sel of authorSelectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = (el.is('meta') ? el.attr('content') : el.text())?.replace(/\s+/g, ' ').trim();
      if (text && text.length > 1 && !/admin|editor|staff/i.test(text)) {
        authorName = text;
        break;
      }
    }
  }

  // 2. Author Avatar
  const avatarSelectors = [
    'img.avatar',
    '.author-avatar img',
    '.post-author img',
    '.author-box img',
    '.bio-avatar img',
    '.author-bio img',
    '.entry-author img',
    '.meta-author img',
    '.post-author-avatar img'
  ];

  let avatarUrl: string | null = null;
  for (const sel of avatarSelectors) {
    const el = $(sel).first();
    if (el.length) {
      const candidate = el.attr('data-src') ||
                        el.attr('data-lazy-src') ||
                        el.attr('data-rocket-src') ||
                        el.attr('data-srcset')?.split(' ')[0] ||
                        el.attr('srcset')?.split(' ')[0] ||
                        el.attr('src');
      if (candidate && !candidate.startsWith('data:image') && !candidate.includes('1x1') && !candidate.includes('gravatar.com/avatar/?d=mm')) {
        avatarUrl = candidate.trim();
        break;
      }
    }
  }

  // 3. Fallback to website logo if no author avatar found
  if (!avatarUrl) {
    const logoSelectors = [
      'link[rel="apple-touch-icon"]',
      'link[rel="icon"][sizes*="180"]',
      'link[rel="icon"][sizes*="192"]',
      '.custom-logo',
      '.site-logo img',
      'header img.logo',
      '.logo img'
    ];
    for (const sel of logoSelectors) {
      const el = $(sel).first();
      if (el.length) {
        const candidate = el.attr('data-src') ||
                          el.attr('data-lazy-src') ||
                          el.attr('data-rocket-src') ||
                          el.attr('href') ||
                          el.attr('src');
        if (candidate && !candidate.startsWith('data:image') && !candidate.includes('1x1')) {
          avatarUrl = candidate.trim();
          break;
        }
      }
    }
  }

  if (!avatarUrl && fallbackLogo) {
    avatarUrl = fallbackLogo;
  }

  return { authorName, avatarUrl };
}

function exactExcerpt(articleText: string, candidate: unknown): string | null {
  if (typeof candidate !== 'string') return null;
  const wanted = normalize(candidate).replace(/^[“"']|[”"']$/g, '');
  return sentences(articleText).find(sentence => normalize(sentence) === wanted) || null;
}

export async function selectCriticExcerpt(articleText: string): Promise<ExtractedCriticReview> {
  const deterministicRating = extractExplicitRating(articleText);
  const fallback = fallbackDiscussionExcerpt(articleText);
  if (articleText.length < 300) return { excerpt: fallback, excerptContext: null, rating: deterministicRating };

  try {
    const writerPrompt = `You select pull quotes from film criticism. From the SOURCE below, return JSON only with:
{"excerpt":"one exact, contiguous, complete sentence copied verbatim from SOURCE","context":"one short neutral sentence explaining what part of the review it represents"}

CRITICAL RULES:
1. NEVER pick the article headline, subtitle, byline, or introductory plot summary.
2. Focus on the review body and choose the MOST CONTROVERSIAL, sharpest, or debate-provoking critique/sentence that captures the critic's strongest verdict or assessment.
3. Do not rewrite, combine, shorten, or change punctuation. Prefer 12–45 words.
SOURCE:\n${articleText.slice(0, 18000)}`;
    const cohere = await generateAIContent(writerPrompt, { preferredProvider: 'cohere', strictProvider: true });
    const draft = parseJSON(cohere.text) as any;
    const selected = exactExcerpt(articleText, draft?.excerpt);
    if (!selected) return { excerpt: fallback, excerptContext: null, rating: deterministicRating };

    const verifierPrompt = `Verify a proposed pull quote against its review. Return JSON only:
{"valid":true|false,"fair":true|false}
valid means the quote is an exact complete sentence in SOURCE. fair means it is discussion-worthy without reversing or distorting the surrounding argument.
PROPOSED QUOTE: ${JSON.stringify(selected)}
SOURCE:\n${articleText.slice(0, 18000)}`;
    const gemini = await generateAIContent(verifierPrompt, { preferredProvider: 'gemini', strictProvider: true });
    const verdict = parseJSON(gemini.text) as any;
    if (verdict?.valid !== true || verdict?.fair !== true) return { excerpt: fallback, excerptContext: null, rating: deterministicRating };
    return {
      excerpt: selected,
      excerptContext: typeof draft?.context === 'string' ? normalize(draft.context).slice(0, 500) : null,
      rating: deterministicRating,
    };
  } catch (error) {
    console.warn('[critic_review_extractor] AI selection unavailable; using deterministic excerpt:', (error as Error).message);
    return { excerpt: fallback, excerptContext: null, rating: deterministicRating };
  }
}
