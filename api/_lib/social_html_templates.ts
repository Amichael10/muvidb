import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SocialAssetFormat, RenderedAsset } from './social_render.js';
import type { SocialSourceSnapshot, TheatrePlaySnapshot, UpcomingMovieSnapshot } from './social-studio/content/snapshots.js';
import { buildMovieHook } from './social-studio/content/caption-builder.js';

type HtmlTemplateSpec = {
  file: string;
  formats: SocialAssetFormat[];
  data: (snapshot: SocialSourceSnapshot) => Record<string, unknown>;
  ratio?: (format: SocialAssetFormat) => string;
};

const TEMPLATE_DIR = path.join(getLibDir(), 'social-html-templates');
const DEFAULT_HANDLE = '@muvidb_';

export const HTML_SOCIAL_TEMPLATES: Record<string, HtmlTemplateSpec> = {
  'on-stage-theatre-v1': {
    file: 'on-stage-theatre-v1.html',
    formats: ['square_1_1'],
    data: stageData,
  },
  'critics-say-v1': {
    file: 'critics-say-v1.html',
    formats: ['square_1_1', 'vertical_9_16'],
    data: criticsData,
    ratio: format => (format === 'vertical_9_16' ? '9:16' : '1:1'),
  },
  'watchlist-this-week-v1': {
    file: 'watchlist-this-week-v1.html',
    formats: ['square_1_1'],
    data: watchlistData,
  },
  'nollywood-debate-v1': {
    file: 'nollywood-debate-v1.html',
    formats: ['square_1_1'],
    data: debateData,
  },
  'now-showing-cinemas-v1': {
    file: 'now-showing-cinemas-v1.html',
    formats: ['square_1_1'],
    data: nowShowingData,
  },
};

function getLibDir(): string {
  if (typeof __dirname !== 'undefined') return __dirname;
  return path.join(process.cwd(), 'api', '_lib');
}

export function isHtmlSocialTemplate(slug: string | null | undefined): slug is keyof typeof HTML_SOCIAL_TEMPLATES {
  return Boolean(slug && HTML_SOCIAL_TEMPLATES[slug]);
}

export function htmlTemplateFormats(slug: string): SocialAssetFormat[] | null {
  return HTML_SOCIAL_TEMPLATES[slug]?.formats || null;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined, fallbackYear?: number | null): string {
  const from = formatDate(start);
  const to = formatDate(end);
  if (from && to && from !== to) return `${from} - ${to}`;
  if (from) return from;
  if (to) return to;
  return fallbackYear ? String(fallbackYear) : 'Date TBA';
}

function movie(snapshot: SocialSourceSnapshot): UpcomingMovieSnapshot {
  if (snapshot.kind === 'upcoming_movie') return snapshot;
  throw new Error(`Template requires a film snapshot, received ${snapshot.kind}`);
}

function play(snapshot: SocialSourceSnapshot): TheatrePlaySnapshot {
  if (snapshot.kind === 'whats_on_stage') return snapshot;
  throw new Error(`Template requires a theatre snapshot, received ${snapshot.kind}`);
}

function stageData(snapshot: SocialSourceSnapshot): Record<string, unknown> {
  const s = play(snapshot);
  const location = [s.venue, s.city].filter(Boolean).join(', ') || 'Theatre venue TBA';
  return {
    title: s.title,
    description: s.synopsis || `${s.title} is on stage soon. Save the date and follow MuviDB for the theatre run details.`,
    venue: location,
    date: formatDateRange(s.runStartDate, s.runEndDate, s.year),
    time: s.performanceTime || 'Time TBA',
    poster: s.posterUrl || s.backdropUrl || '',
    posterAlt: s.title,
    handle: DEFAULT_HANDLE,
  };
}

function criticsData(snapshot: SocialSourceSnapshot): Record<string, unknown> {
  const s = movie(snapshot);
  const review = s.tagline || buildMovieHook(s.tagline, s.synopsis, s.title) || `The conversation around ${s.title} is heating up.`;
  return {
    poster: s.posterUrl || s.backdropUrl || '',
    review,
    criticImage: '',
    criticName: 'MuviDB Critics',
    criticRole: 'African cinema review desk',
    rating: s.likedPercent ? Math.max(1, Math.min(5, Math.round(s.likedPercent / 20))) : 4,
    ratingMax: 5,
    handle: DEFAULT_HANDLE,
  };
}

function watchlistData(snapshot: SocialSourceSnapshot): Record<string, unknown> {
  const s = movie(snapshot);
  return {
    picks: [{
      title: s.title,
      subtitle: s.year ? String(s.year) : '',
      poster: s.posterUrl || s.backdropUrl || '',
      reason: s.watchAvailability || 'MuviDB pick',
      description: buildMovieHook(s.tagline, s.synopsis, s.title) || 'Add this to your weekend watchlist.',
      platform: s.youtubeChannelName ? 'youtube' : '',
      channelName: s.youtubeChannelName || '',
    }],
    backPosters: [s.posterUrl, s.backdropUrl].filter(Boolean),
    handle: DEFAULT_HANDLE,
  };
}

function debateData(snapshot: SocialSourceSnapshot): Record<string, unknown> {
  const s = movie(snapshot);
  return {
    poster: s.posterUrl || s.backdropUrl || '',
    handle: DEFAULT_HANDLE,
  };
}

function nowShowingData(snapshot: SocialSourceSnapshot): Record<string, unknown> {
  const s = movie(snapshot);
  return {
    poster: s.posterUrl || s.backdropUrl || '',
    badge: s.watchAvailability || (s.comingSoon ? 'Coming Soon' : 'Now Showing'),
    description: buildMovieHook(s.tagline, s.synopsis, s.title) || s.title,
    feature1Title: s.title,
    feature1Subtitle: s.year ? String(s.year) : 'MuviDB pick',
    feature2Title: s.releaseDate ? formatDate(s.releaseDate) : 'Release date TBA',
    feature2Subtitle: s.genres.slice(0, 2).join(' / ') || 'African cinema',
    feature3Title: s.topCast[0]?.name || 'On MuviDB',
    feature3Subtitle: s.watchAvailability || 'Track, rate, and save',
    handle: DEFAULT_HANDLE,
  };
}

async function renderHtmlTemplate(input: {
  templateSlug: string;
  snapshot: SocialSourceSnapshot;
  format: SocialAssetFormat;
}): Promise<Buffer> {
  const spec = HTML_SOCIAL_TEMPLATES[input.templateSlug];
  if (!spec) throw new Error(`Unknown HTML template: ${input.templateSlug}`);

  const { chromium } = await import('playwright');
  const templatePath = path.join(TEMPLATE_DIR, spec.file);
  await readFile(templatePath);

  const { width, height } = {
    square_1_1: { width: 1080, height: 1080 },
    portrait_4_5: { width: 1080, height: 1350 },
    vertical_9_16: { width: 1080, height: 1920 },
  }[input.format];
  const ratio = spec.ratio?.(input.format);
  const url = new URL(pathToFileURL(templatePath).toString());
  if (ratio) url.searchParams.set('ratio', ratio);
  url.searchParams.set('render', '1');

  // Vercel functions do not include Playwright's downloaded desktop browser.
  // Use the Lambda-compatible Chromium binary there; retain Playwright's own
  // browser locally so development continues to work on Windows and macOS.
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_EXECUTION_ENV);
  const browser = isServerless
    ? await (async () => {
        const { default: serverlessChromium } = await import('@sparticuz/chromium');
        return chromium.launch({
          args: serverlessChromium.args,
          executablePath: await serverlessChromium.executablePath(),
          headless: true,
        });
      })()
    : await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.addInitScript(data => {
      (window as any).MUVIDB_DATA = data;
    }, spec.data(input.snapshot));
    await page.goto(url.toString(), { waitUntil: 'load', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.evaluate(() => {
      document.documentElement.style.margin = '0';
      document.body.style.margin = '0';
      document.body.style.overflow = 'hidden';
      document.body.classList.add('render-mode');
    });
    await page.evaluate(async () => {
      await (document as any).fonts?.ready;
    }).catch(() => {});
    return Buffer.from(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } }));
  } finally {
    await browser.close();
  }
}

export async function renderHtmlSocialTemplateAsset(input: {
  templateSlug: string;
  snapshot: SocialSourceSnapshot;
  format: SocialAssetFormat;
}): Promise<RenderedAsset> {
  const { width, height } = {
    square_1_1: { width: 1080, height: 1080 },
    portrait_4_5: { width: 1080, height: 1350 },
    vertical_9_16: { width: 1080, height: 1920 },
  }[input.format];

  const png = await renderHtmlTemplate(input);
  return { format: input.format, png, width, height, usedArtwork: true };
}
