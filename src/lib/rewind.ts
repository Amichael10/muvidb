/**
 * MuviDB Rewind 2026 — shared vocabulary for the video and the share pages.
 *
 * Everything here is pure and DOM-free so it can run in three places: the
 * Remotion compositions in apps/rewind-video, the SSR routes under /rewind,
 * and the render script. Keep it that way — no React, no Remotion imports.
 *
 * Layout and copy are ported from docs/rewind/rewind-sample-template.html,
 * which is the source of truth for the sequence.
 */

/** Palette from the reference template. Deliberately NOT the site tokens: the
 *  video is a standalone artwork and uses #FF5C00, where the site brand is
 *  #FF5A1F (--color-brand). The pages around the video use the site token. */
export const REWIND = {
  orange: '#FF5C00',
  ink: '#120B07',
  card: '#1F120B',
  deepBrown: '#2A0F05',
  cream: '#FFF1E4',
  mutedOnDark: '#D9BFAE',
  mutedOnCream: '#6B5448',
  hairline: '#6B4A38',
} as const;

export const FPS = 30;
/** 14.0s exactly. */
export const TOTAL_FRAMES = 420;
export const WIDTH = 1080;
export const HEIGHT = 1920;
/** The 4:5 feed still. */
export const FEED_HEIGHT = 1350;

/** Scene start times in seconds, from the reference `T`. */
export const SCENE = {
  hook: 0,
  posters: 2.4,
  hero: 5.4,
  type: 8.4,
  card: 11.0,
  end: 14,
} as const;

/** Upward wipe between scenes. */
export const WIPE = 0.4;

export const FOOTER_URL = 'muvidb.com/rewind';
export const BILLING_LINE = 'MuviDB presents  ·  A year in Nollywood  ·  Starring you';
export const CLAIM_LINE = 'Missing a film? Claim your profile and add it.';

/** One row of public.rewind_2026, as the renderer and the pages consume it. */
export interface RewindRow {
  slug: string;
  display_name: string;
  portrait_url: string | null;
  films_count: number;
  plays_count: number;
  lead_count: number;
  support_count: number;
  /** Credits whose billing_order is actually known. Zero means lead/support
   *  are not trustworthy and the pills must be hidden — half of 2026 actor
   *  credits carry the sentinel 99 the admin UI writes for "unknown". */
  lead_known_count: number;
  total_views: number;
  hours_on_screen: number;
  top_film_title: string | null;
  top_film_views: number | null;
  top_play_title: string | null;
  box_office_total: number | string | null;
  box_office_currency: string | null;
  top_costar_name: string | null;
  top_costar_films: number | null;
  top_director_name: string | null;
  top_director_films: number | null;
  followers: number;
  percentile: number | string | null;
  archetype: string;
  archetype_line: string;
  poster_urls: string[];
}

/**
 * 48.2M / 920K / 8,400.
 *
 * Mirrors public.rewind_fmt_views() in SQL, with one deliberate difference:
 * 999,500-999,999 promotes to "1.0M" here rather than rendering "1000K". The
 * SQL copy only feeds stats_hash, where any stable string will do.
 */
export function formatViews(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
  const v = Math.max(0, Math.round(Number(n)));
  if (v >= 999_500) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}K`;
  return v.toLocaleString('en-US');
}

/** Plain grouped integer — follower counts, film counts. */
export function formatCount(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n)).toLocaleString('en-US');
}

/**
 * Box office. Every figure we hold is NGN, and Nigerian box office is quoted
 * in millions, so ₦3,207,600,000 reads as "₦3.21bn".
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string | null | undefined
): string | null {
  if (amount === null || amount === undefined) return null;
  const v = Number(amount);
  if (!Number.isFinite(v) || v <= 0) return null;
  const symbol = currency === 'NGN' ? '₦' : currency ? `${currency} ` : '';
  if (v >= 1_000_000_000) return `${symbol}${(v / 1_000_000_000).toFixed(2)}bn`;
  if (v >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(1)}m`;
  return `${symbol}${Math.round(v).toLocaleString('en-US')}`;
}

/**
 * Break a name across at most two lines, balanced on a word boundary.
 *
 * The hook scene sets the name in 250px Anton across two masked lines. Real
 * names run to 38 characters ("Yusuf Omoshalewa Adeola (Basira Beree)"), so
 * the caller pairs this with a measured font size — see fitDisplaySize.
 */
export function splitDisplayName(name: string): string[] {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [''];
  const words = clean.split(' ');
  if (words.length === 1) return [clean];

  let bestAt = 1;
  let bestDelta = Infinity;
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(' ').length;
    const right = words.slice(i).join(' ').length;
    const delta = Math.abs(left - right);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestAt = i;
    }
  }
  return [words.slice(0, bestAt).join(' '), words.slice(bestAt).join(' ')];
}

/**
 * Font size that keeps `lines` inside `maxWidth`, never clipping.
 *
 * `charRatio` is the average glyph advance as a fraction of font size. The
 * compositions override it with a real measurement from @remotion/layout-utils;
 * the default is a conservative value for uppercase Anton so that the pure
 * path (tests, the share pages) still errs on the side of too small.
 */
export function fitDisplaySize(
  lines: string[],
  maxWidth: number,
  maxSize: number,
  charRatio = 0.46
): number {
  const longest = lines.reduce((n, l) => Math.max(n, l.length), 0);
  if (longest === 0) return maxSize;
  return Math.min(maxSize, Math.floor(maxWidth / (longest * charRatio)));
}

/**
 * How long the poster burst should take to deal `count` posters.
 *
 * The reference deals 14 over 2.2s. Dealing 3 over the same 2.2s leaves the
 * counter crawling and the scene reads as stalled, so the ramp shortens with
 * the deck and the final count holds with a pulse instead. Floor of 0.9s keeps
 * even a 3-poster burst from feeling like a cut.
 */
export function posterBurstRamp(count: number): number {
  const n = Math.max(1, Math.floor(count));
  return Math.min(2.2, Math.max(0.9, 0.55 + n * 0.12));
}

export interface StatRow {
  label: string;
  value: string;
}

/**
 * The card's stat rows, in priority order, with every missing value dropped
 * rather than rendered blank.
 *
 * Capped at five because that is what the card's fixed height holds. The
 * follower row is last on purpose: `follows` has eight rows site-wide and no
 * eligible actor has a single follower, so in practice it never appears.
 */
export function buildStatRows(row: RewindRow, limit = 5): StatRow[] {
  const rows: StatRow[] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value) rows.push({ label, value });
  };

  push('Hours on screen', row.hours_on_screen > 0 ? formatCount(row.hours_on_screen) : null);

  if (row.top_film_title) {
    const views = formatViews(row.top_film_views);
    push('Biggest film', views ? `${row.top_film_title} · ${views} views` : row.top_film_title);
  }
  // "Most frequent" needs at least two to mean anything, and a single
  // collaboration rendered as "1 films" twice over. Both now need a repeat.
  if (row.top_costar_name && (row.top_costar_films ?? 0) >= 2) {
    push('Most frequent co-star', `${row.top_costar_name} · ${row.top_costar_films} films`);
  }
  if (row.top_director_name && (row.top_director_films ?? 0) >= 2) {
    push('Most frequent director', `${row.top_director_name} · ${row.top_director_films} films`);
  }
  // Box office outranks stage work for the last slot: only 174 of 782 eligible
  // actors have a figure at all, and a naira number brags harder than a credit.
  push('Box office', formatMoney(row.box_office_total, row.box_office_currency));
  if (row.plays_count > 0) {
    const label = row.plays_count === 1 ? '1 production' : `${row.plays_count} productions`;
    push('On stage', row.top_play_title ? `${row.top_play_title} · ${label}` : label);
  }
  push('Fans following on MuviDB', row.followers > 0 ? formatCount(row.followers) : null);

  return rows.slice(0, limit);
}

/** The lead/supporting pills, or none when billing data is untrustworthy. */
export function buildRolePills(row: RewindRow): string[] {
  if (row.lead_known_count <= 0) return [];
  const pills: string[] = [];
  if (row.lead_count > 0) {
    pills.push(`${row.lead_count} lead ${row.lead_count === 1 ? 'role' : 'roles'}`);
  }
  if (row.support_count > 0) pills.push(`${row.support_count} supporting`);
  return pills;
}

/** "Top 3%" — the badge on the card. Clamped so nobody is told "Top 0%". */
export function topPercentLabel(percentile: number | string | null | undefined): string | null {
  if (percentile === null || percentile === undefined) return null;
  const p = Number(percentile);
  if (!Number.isFinite(p)) return null;
  return `Top ${Math.min(99, Math.max(1, Math.round(100 - p)))}%`;
}
