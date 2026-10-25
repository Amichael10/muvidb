import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SocialAssetFormat, RenderedAsset } from './social_render.js';
import type { SocialSourceSnapshot, TheatrePlaySnapshot, UpcomingMovieSnapshot } from './social-studio/content/snapshots.js';
import { buildMovieHook } from './social-studio/content/caption-builder.js';

type HtmlTemplateSpec = {
  file: string;
  formats: SocialAssetFormat[];
  slides?: number;
  data: (snapshot: SocialSourceSnapshot, slide?: number) => Record<string, unknown>;
  ratio?: (format: SocialAssetFormat) => string;
  dimensions?: Partial<Record<SocialAssetFormat, { width: number; height: number }>>;
};

const TEMPLATE_DIR = path.join(getLibDir(), 'social-html-templates');
const DEFAULT_HANDLE = '@muvidb_';

// @sparticuz/chromium expands its remote pack into /tmp. A single editorial
// asset can render several formats/slides concurrently, so calling
// executablePath() in every render races multiple writers against the same
// archive. Share the extraction promise for the lifetime of the warm function.
let serverlessExecutablePathPromise: Promise<string> | null = null;

async function getServerlessChromium() {
  const { default: serverlessChromium } = await import('@sparticuz/chromium');
  if (!serverlessExecutablePathPromise) {
    // Use the Brotli payload shipped with this exact package version. The
    // former remote tar was created with permissions that Vercel preserved as
    // unreadable (`EACCES` on al2023.tar.br).
    serverlessExecutablePathPromise = serverlessChromium.executablePath().catch(error => {
      serverlessExecutablePathPromise = null;
      throw error;
    });
  }
  return {
    args: serverlessChromium.args,
    executablePath: await serverlessExecutablePathPromise,
  };
}

export const HTML_SOCIAL_TEMPLATES: Record<string, HtmlTemplateSpec> = {
  'behind-camera-simple-v1': simpleSpec('behind_camera'),
  'film-conversation-simple-v1': simpleSpec('film_conversation'),
  'by-the-numbers-simple-v1': simpleSpec('by_the_numbers'),
  'new-upcoming-simple-v1': simpleSpec('new_upcoming'),
  'one-film-two-takes-simple-v1': simpleSpec('one_film_two_takes'),
  'stage-to-screen-simple-v1': simpleSpec('stage_to_screen'),
  'critic-spotlight-simple-v1': simpleSpec('critic_spotlight'),
  'filmography-simple-v1': simpleSpec('filmography'),
  'weekend-watchlist-simple-v1': simpleSpec('weekend_watchlist'),
  'critics-say-simple-v1': simpleSpec('critics_say'),
  'on-stage-simple-v1': simpleSpec('on_stage'),
  'where-to-watch-simple-v1': simpleSpec('where_to_watch'),
  'you-know-the-face-simple-v1': simpleSpec('you_know_the_face'),
  // Its own file rather than a simple-editorial variant: the layout is comment
  // cards scattered over the artwork, which shares nothing with that template.
  'audience-pulse-v1': {
    file: 'audience-verdict-v1.html',
    formats: ['portrait_4_5'],
    data: snapshot => audiencePulseData(snapshot),
  },
};

/**
 * The Audience Pulse card: real mined comments over the film's artwork, with
 * MuviDB's own "% liked". Never an IMDb score — most of the catalogue was never
 * on IMDb, so that badge would be inventing a number.
 */
function audiencePulseData(snapshot: SocialSourceSnapshot): Record<string, unknown> {
  const movie = snapshot.kind === 'upcoming_movie' ? (snapshot as UpcomingMovieSnapshot) : null;
  return {
    lede: 'Like<br>This Film',
    // These are YouTube comments, so say so rather than the broader
    // "across social media" — it is just as persuasive and actually true.
    source: 'Based on real viewer comments on YouTube',
    image: movie ? preferredArtwork(movie) : '',
    likedPercent: movie?.likedPercent ?? null,
    comments: (movie?.audienceComments || []).map(c => ({
      author: c.author,
      body: c.body,
      avatar: c.avatarUrl || '',
      // A real like count. We cannot derive a believable per-comment
      // percentage — sentiment is a whole number out of 10, so it would only
      // ever read 70/80/90/100, and 54% of positive comments score exactly 8.
      likes: c.likes,
    })),
  };
}

/**
 * Prefer the uploaded portrait. Only fall back to YouTube, and then to its
 * highest-resolution thumbnail — films store the 480x360 `hqdefault`, while
 * `maxresdefault` is 1280x720 and looks far sharper behind the cards.
 */
function preferredArtwork(movie: UpcomingMovieSnapshot): string {
  // Some stored URLs carry stray whitespace, which breaks the <img> outright.
  const clean = (url: string | null) => (url || '').replace(/\s+/g, '').trim();
  const poster = clean(movie.posterUrl);
  if (poster && !poster.includes('ytimg.com')) return poster;
  const candidate = poster || clean(movie.backdropUrl);
  if (!candidate.includes('ytimg.com')) return candidate;
  return candidate.replace(/\/(hq|sd|mq|maxres)default\.jpg/, '/maxresdefault.jpg');
}

type SimpleEditorialVariant =
  | 'behind_camera'
  | 'film_conversation'
  | 'by_the_numbers'
  | 'new_upcoming'
  | 'one_film_two_takes'
  | 'stage_to_screen'
  | 'critic_spotlight'
  | 'filmography'
  | 'weekend_watchlist'
  | 'critics_say'
  | 'on_stage'
  | 'where_to_watch'
  | 'you_know_the_face';

function simpleSpec(variant: SimpleEditorialVariant): HtmlTemplateSpec {
  return {
    file: 'simple-editorial-v1.html',
    formats: ['portrait_4_5'],
    slides: variant === 'weekend_watchlist' ? 5 : undefined,
    data: (snapshot, slide) => simpleEditorialData(snapshot, variant, slide),
  };
}

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
  const selectedReview = s.criticReview;
  const review = selectedReview?.quote || s.tagline || buildMovieHook(s.tagline, s.synopsis, s.title) || `The conversation around ${s.title} is heating up.`;
  return {
    poster: s.posterUrl || s.backdropUrl || '',
    review,
    criticImage: selectedReview?.avatarUrl || '',
    criticName: selectedReview?.criticName || 'MuviDB Critics',
    criticRole: selectedReview?.criticTitle || 'African cinema review desk',
    rating: selectedReview?.rating ?? (s.likedPercent ? Math.max(1, Math.min(5, Math.round(s.likedPercent / 20))) : 4),
    ratingMax: 5,
    handle: DEFAULT_HANDLE,
  };
}

function watchlistData(snapshot: SocialSourceSnapshot): Record<string, unknown> {
  const s = movie(snapshot);
  const films = s.watchlistPicks?.length ? s.watchlistPicks : [s];
  // The supplied thread artwork has three numbered film pages. Preserve legacy
  // one-film drafts by repeating their film rather than sending undefined pages.
  const picksSource = [...films];
  while (picksSource.length < 3) picksSource.push(picksSource[0]);
  const picks = picksSource.slice(0, 3).map(film => ({
    title: film.title,
    subtitle: film.year ? String(film.year) : '',
    poster: film.posterUrl || film.backdropUrl || '',
    reason: film.watchAvailability || 'MuviDB pick',
    description: buildMovieHook(film.tagline, film.synopsis, film.title) || 'Add this to your weekend watchlist.',
    platform: film.youtubeChannelName ? 'youtube' : (film.watchAvailability || ''),
    channelName: film.youtubeChannelName || '',
  }));
  return {
    picks,
    backPosters: picks.map(pick => pick.poster).filter(Boolean),
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
  const rawAvailability = `${s.watchAvailability || ''} ${(s as any).platform || ''}`.toLowerCase();
  let platform = 'docuth';
  if (s.youtubeChannelName || rawAvailability.includes('youtube')) {
    platform = 'youtube';
  } else if (rawAvailability.includes('docuth')) {
    platform = 'docuth';
  } else if (rawAvailability.includes('kav') || rawAvailability.includes('kàv')) {
    platform = 'kava';
  } else if (rawAvailability.includes('ebony')) {
    platform = 'ebonyonplus';
  } else if (rawAvailability.includes('circuit')) {
    platform = 'circuits';
  } else if (rawAvailability.includes('nollie')) {
    platform = 'nolliestream';
  } else if (rawAvailability.includes('netflix')) {
    platform = 'netflix';
  } else if (rawAvailability.includes('prime') || rawAvailability.includes('amazon')) {
    platform = 'primevideo';
  } else if (s.watchAvailability) {
    platform = s.watchAvailability;
  }

  return {
    title: s.title,
    poster: s.posterUrl || s.backdropUrl || '',
    badge: s.watchAvailability || (s.comingSoon ? 'Coming Soon' : 'Now Streaming'),
    platform,
    year: s.year ? String(s.year) : '',
    genres: s.genres || [],
    synopsis: s.synopsis || s.tagline || buildMovieHook(s.tagline, s.synopsis, s.title) || s.title,
    description: buildMovieHook(s.tagline, s.synopsis, s.title) || s.title,
    handle: DEFAULT_HANDLE,
  };
}

function actorData(snapshot: SocialSourceSnapshot): Record<string, unknown> {
  const s = snapshot.kind === 'actor_spotlight' || snapshot.kind === 'birthday_spotlight' ? (snapshot as any) : {};
  const name = String(s.name || '').trim();
  const parts = name ? name.split(/\s+/) : ['Featured', 'Talent'];
  const firstName = s.firstName || parts[0] || '';
  const lastName = s.lastName || parts.slice(1).join(' ') || '';
  const department = s.knownForDepartment || (s.roles && s.roles.length ? (Array.isArray(s.roles) ? s.roles.join(' . ') : s.roles) : 'ACTOR');
  const country = (s.nationality || s.country || 'NIGERIAN').toUpperCase();
  const creditsCount = s.film_count || s.creditCount || s.creditsCount || (s.knownFor && s.knownFor.length ? s.knownFor.length : 12);
  const photo = s.photoUrl || s.photoCutoutUrl || s.backdropUrl || s.posterUrl || s.photo || '';

  return {
    name,
    firstName,
    lastName,
    nameLine1: firstName,
    nameLine2: lastName,
    roles: String(department).toUpperCase(),
    department: String(department).toUpperCase(),
    occupations: String(department).toUpperCase(),
    country,
    nationality: country,
    creditsCount: String(creditsCount),
    creditsLabel: 'Verified Credits',
    photo,
    portrait: photo,
    handle: DEFAULT_HANDLE,
  };
}

function summarizePersonBio(bio: string | null | undefined, maxChars = 210): string {
  if (!bio) return 'Discover the people and stories shaping African screen culture.';
  const clean = bio.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  const lastDot = slice.lastIndexOf('.');
  if (lastDot > 90) {
    return clean.slice(0, lastDot + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? clean.slice(0, lastSpace) : slice).trim() + '...';
}

function simpleEditorialData(snapshot: SocialSourceSnapshot, variant: SimpleEditorialVariant, slide = 1): Record<string, unknown> {
  const isPerson = snapshot.kind === 'actor_spotlight' || snapshot.kind === 'birthday_spotlight';
  const isFilm = snapshot.kind === 'upcoming_movie';
  const isPlay = snapshot.kind === 'whats_on_stage';

  const person = isPerson ? snapshot : null;
  const film = isFilm ? snapshot : null;
  const stage = isPlay ? snapshot : null;
  const image = person
    ? (person.photoCutoutUrl || person.photoUrl || person.knownFor[0]?.posterUrl || '')
    : film
      ? (film.posterUrl || film.backdropUrl || '')
      : stage
        ? (stage.posterUrl || stage.backdropUrl || '')
        : '';
  const title = person?.name || film?.title || stage?.title || 'MuviDB';
  const filmStatus = film?.watchAvailability || (film?.comingSoon ? 'Coming soon' : 'Discover');
  const filmDetail = film?.genres?.slice(0, 2).join(' · ') || (film?.year ? String(film.year) : 'African cinema');
  const suppliedRoles = 'roles' in (person || {}) && Array.isArray((person as any).roles)
    ? (person as any).roles.filter(Boolean).join(' · ')
    : '';
  const personRole = suppliedRoles || person?.knownForDepartment || 'Screen professional';
  const personSummary = (person as any)?.summary || (person as any)?.shortBio || summarizePersonBio(person?.bio, 210);

  const base = {
    title,
    image,
    series: 'MuviDB Editorial',
    badge: 'DISCOVER',
    status: isFilm ? filmStatus : isPlay ? 'Live on stage' : 'Profile',
    detail: isFilm ? filmDetail : isPlay ? ([stage?.venue, stage?.city].filter(Boolean).join(' · ') || 'Theatre') : personRole,
    support: film?.synopsis || stage?.synopsis || personSummary || 'Discover the people and stories shaping African screen culture.',
    variant: 'default',
    metric: '',
    metricLabel: '',
    quote: '',
  };

  switch (variant) {
    case 'behind_camera':
      return { ...base, series: 'Behind The Camera', badge: 'THE MAKERS', status: `${person?.creditCount || 0} credits`, detail: personRole, support: personSummary };
    case 'film_conversation':
      return { ...base, image: film?.posterUrl || image, imagePosition: 'center top', series: 'Film Conversation', badge: 'JOIN IN', title: `What did you think of ${title}?`, status: 'Tell us', detail: 'In the comments' };
    case 'by_the_numbers':
      return { ...base, series: 'MuviDB By The Numbers', badge: 'DATABASE', variant: 'data', metric: film?.year || person?.creditCount || '', metricLabel: film ? 'YEAR' : 'CREDITS', title: film ? `${film.title}, indexed.` : `${title}, by the numbers.`, status: 'Verified data', detail: 'MuviDB' };
    case 'new_upcoming':
      return { ...base, series: 'New & Upcoming', badge: 'RELEASE RADAR', status: film?.comingSoon ? 'Coming soon' : filmStatus, detail: film?.releaseDate ? formatDate(film.releaseDate) : filmDetail };
    case 'one_film_two_takes':
      return { ...base, series: 'One Film, Two Takes', badge: 'CRITICS', quote: film?.criticReview?.quote || film?.tagline || '', status: film?.criticReview?.rating ? `${film.criticReview.rating}/5` : 'Two perspectives', detail: film?.criticReview?.criticName || 'Read the reviews' };
    case 'stage_to_screen':
      return { ...base, series: 'Stage To Screen', badge: 'CROSSOVER', status: 'Stage & film', detail: stage?.year ? String(stage.year) : 'African stories' };
    case 'critic_spotlight':
      return { ...base, image: film?.posterUrl || image, imagePosition: 'center top', criticAvatar: film?.criticReview?.avatarUrl || '', variant: 'critic_spotlight', series: 'The Critic', badge: 'CRITIC SPOTLIGHT', quote: film?.criticReview?.quote || film?.tagline || '', title: film?.criticReview?.criticName || title, status: film?.criticReview?.criticName || 'Film critic', detail: film?.criticReview?.publication || film?.criticReview?.criticTitle || 'African cinema' };
    case 'filmography':
      return {
        ...base,
        series: 'The Filmography',
        badge: 'CAREER PROFILE',
        variant: 'filmography',
        title,
        support: 'A career across generations of African cinema.',
        status: personRole,
        detail: '',
        metric: person?.creditCount || '',
        metricLabel: 'DOCUMENTED CREDITS',
      };
    case 'weekend_watchlist':
      {
        const pickIndex = Math.max(0, (slide || 2) - 2);
        const pick = film?.watchlistPicks?.[pickIndex] || film;
        const totalPicks = film?.watchlistPicks?.length || 3;
        return {
          ...base,
          series: 'Weekend Watchlist',
          badge: `${pickIndex + 1}/${totalPicks} · FRI — SUN`,
          title: pick?.title || title,
          image: pick?.posterUrl || pick?.backdropUrl || image,
          imagePosition: 'center top',
          status: pick?.watchAvailability || filmStatus,
          detail: pick?.year ? String(pick.year) : filmDetail,
          support: pick?.synopsis || base.support,
        };
      }
    case 'critics_say':
      {
        const review = film?.criticReview;
        const destination = review?.socialHandle || review?.publication || review?.criticName || 'ORIGINAL REVIEW';
        const fullReview = String(destination).startsWith('@') ? destination : String(destination).toUpperCase();
        return {
          ...base,
          series: 'The Critic’s Take',
          badge: 'CRITICISM',
          variant: 'critic-quote',
          image: film?.posterUrl || image,
          imagePosition: 'center top',
          criticAvatar: review?.avatarUrl || '',
          title,
          quote: review?.quote || '',
          status: review?.criticName || 'Film critic',
          detail: review?.publication || review?.criticTitle || '',
          support: `FULL REVIEW → ${fullReview}`,
        };
      }
    case 'on_stage':
      return { ...base, series: "What’s On Stage", badge: formatDateRange(stage?.runStartDate, stage?.runEndDate, stage?.year), status: stage?.status || 'Live on stage', detail: [stage?.venue, stage?.city].filter(Boolean).join(' · ') || 'Theatre' };
    case 'where_to_watch':
      return { ...base, series: 'Now Streaming', badge: 'NEW TO STREAMING', variant: 'now-streaming', status: film?.youtubeChannelName || filmStatus, detail: film?.youtubeChannelName ? 'YouTube' : filmDetail };
    case 'you_know_the_face':
      return { ...base, series: 'You Know The Face', badge: 'PEOPLE', status: `${person?.creditCount || 0} credits`, detail: personRole, support: personSummary };
    default:
      return base;
  }
}

async function renderHtmlTemplate(input: {
  templateSlug: string;
  snapshot: SocialSourceSnapshot;
  format: SocialAssetFormat;
  slide?: number;
  dataOverride?: Record<string, unknown>;
}): Promise<Buffer> {
  const spec = HTML_SOCIAL_TEMPLATES[input.templateSlug];
  if (!spec) throw new Error(`Unknown HTML template: ${input.templateSlug}`);

  const { chromium } = await import('playwright');
  const templatePath = path.join(TEMPLATE_DIR, spec.file);
  await readFile(templatePath);

  const defaultDimensions = {
    square_1_1: { width: 1254, height: 1254 },
    portrait_4_5: { width: 1080, height: 1350 },
    vertical_9_16: { width: 1080, height: 1920 },
  }[input.format];
  const { width, height } = spec.dimensions?.[input.format] || defaultDimensions;
  const ratio = spec.ratio?.(input.format);
  const url = new URL(pathToFileURL(templatePath).toString());
  if (ratio) url.searchParams.set('ratio', ratio);
  url.searchParams.set('render', '1');
  if (input.slide) url.searchParams.set('slide', String(input.slide));

  // Vercel functions do not include Playwright's downloaded desktop browser.
  // Use the Lambda-compatible Chromium binary there; retain Playwright's own
  // browser locally so development continues to work on Windows and macOS.
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_EXECUTION_ENV);
  const browser = isServerless
    ? await (async () => {
        const serverlessChromium = await getServerlessChromium();
        return chromium.launch({
          args: serverlessChromium.args,
          executablePath: serverlessChromium.executablePath,
          headless: true,
        });
      })()
    : await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.addInitScript(data => {
      (window as any).MUVIDB_DATA = data;
    }, { ...spec.data(input.snapshot, input.slide), ...(input.dataOverride || {}) });
    await page.goto(url.toString(), { waitUntil: 'commit', timeout: 15_000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      await Promise.all(
        images.map((img: HTMLImageElement) => {
          if (!img.src || img.complete) return;
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 5000);
          });
        })
      );
    }).catch(() => {});
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
  slide?: number;
  dataOverride?: Record<string, unknown>;
}): Promise<RenderedAsset> {
  const spec = HTML_SOCIAL_TEMPLATES[input.templateSlug];
  const defaultDimensions = {
    square_1_1: { width: 1254, height: 1254 },
    portrait_4_5: { width: 1080, height: 1350 },
    vertical_9_16: { width: 1080, height: 1920 },
  }[input.format];
  const { width, height } = spec?.dimensions?.[input.format] || defaultDimensions;

  // Slide 1 of weekend_watchlist is always the official default cover poster
  if (input.templateSlug === 'weekend-watchlist-simple-v1' && (!input.slide || input.slide === 1)) {
    const coverPath = path.join(process.cwd(), 'public', 'images', 'social', 'weekend-watchlist-cover-v1.png');
    if (existsSync(coverPath)) {
      const sharp = (await import('sharp')).default;
      const png = await sharp(coverPath).resize(width, height, { fit: 'cover' }).png().toBuffer();
      return { format: input.format, png, width, height, usedArtwork: true, slide: input.slide || 1 };
    }
  }

  // Final slide of ANY carousel is the official default back cover poster unless custom override requested
  const totalSlides = spec?.slides || 1;
  const wantsCustomBackCover = Boolean(input.dataOverride && (input.dataOverride.variant || input.dataOverride.title || input.dataOverride.skipDefaultBackCover));
  if (totalSlides > 1 && input.slide === totalSlides && !wantsCustomBackCover) {
    const backCoverPath = path.join(process.cwd(), 'public', 'images', 'social', 'carousel-back-cover-v1.png');
    if (existsSync(backCoverPath)) {
      const sharp = (await import('sharp')).default;
      const png = await sharp(backCoverPath).resize(width, height, { fit: 'cover' }).png().toBuffer();
      return { format: input.format, png, width, height, usedArtwork: true, slide: input.slide };
    }
  }

  const png = await renderHtmlTemplate(input);
  return { format: input.format, png, width, height, usedArtwork: true, slide: input.slide };
}

export function htmlTemplateSlides(slug: string): number {
  return HTML_SOCIAL_TEMPLATES[slug]?.slides || 1;
}
