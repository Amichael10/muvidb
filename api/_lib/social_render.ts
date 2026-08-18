import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { SocialSourceSnapshot } from '../../src/features/social-studio/content/snapshots.js';
import { SOCIAL_ICONS, type SocialIconName } from './social_icons.js';

export type SocialAssetFormat = 'portrait_4_5' | 'square_1_1' | 'vertical_9_16';

export const ASSET_FORMAT_DIMENSIONS: Record<SocialAssetFormat, { width: number; height: number }> = {
  portrait_4_5: { width: 1080, height: 1350 },
  square_1_1: { width: 1080, height: 1080 },
  vertical_9_16: { width: 1080, height: 1920 },
};

function getLibDir(): string {
  if (typeof __dirname !== 'undefined') return __dirname;
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return path.join(process.cwd(), 'api', '_lib');
}

const FONT_DIR = path.join(getLibDir(), 'fonts');

type SatoriNode = { type: string; props: Record<string, unknown> };

/** Minimal element factory so this stays a .ts file with no JSX build step. */
function h(type: string, style: Record<string, unknown>, children?: unknown): SatoriNode {
  return { type, props: { style, ...(children === undefined ? {} : { children }) } };
}

let fontCache: Awaited<ReturnType<typeof loadFonts>> | null = null;

/**
 * `Headline` is Bebas Neue — the display face used in the authored mockups.
 * It ships only a single weight and is caps-only, so headline text is
 * upper-cased at the call site rather than relying on `textTransform`.
 */
async function loadFonts() {
  const [bebas, syne, outfit, outfitSemi] = await Promise.all([
    readFile(path.join(FONT_DIR, 'bebas-neue-latin-400-normal.woff')),
    readFile(path.join(FONT_DIR, 'syne-latin-800-normal.woff')),
    readFile(path.join(FONT_DIR, 'outfit-latin-400-normal.woff')),
    readFile(path.join(FONT_DIR, 'outfit-latin-600-normal.woff')),
  ]);

  return [
    { name: 'Headline', data: bebas, weight: 400 as const, style: 'normal' as const },
    { name: 'Syne', data: syne, weight: 800 as const, style: 'normal' as const },
    { name: 'Outfit', data: outfit, weight: 400 as const, style: 'normal' as const },
    { name: 'Outfit', data: outfitSemi, weight: 600 as const, style: 'normal' as const },
  ];
}

async function getFonts() {
  if (!fontCache) fontCache = await loadFonts();
  return fontCache;
}

/**
 * YouTube-sourced artwork defaults to `hqdefault.jpg`, a fixed 480x360 canvas
 * with black letterbox bars baked in — upscaling that to 1080x1920 looks awful
 * and the bars end up in the card. `maxresdefault.jpg` is 1280x720 with no
 * bars, so it is tried first and the stored URL kept as the fallback.
 */
function artworkCandidates(url: string): string[] {
  const match = url.match(/^(https?:\/\/i\.ytimg\.com\/vi\/[^/]+\/)[a-z]+default\.jpg(\?.*)?$/i);
  if (!match) return [url];

  const maxres = `${match[1]}maxresdefault.jpg`;
  return maxres === url ? [url] : [maxres, url];
}

async function fetchArtwork(url: string): Promise<Artwork> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;

  const type = res.headers.get('content-type') || 'image/jpeg';
  if (!type.startsWith('image/')) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  const size = imageSize(buffer);
  if (!size || !size.width || !size.height) return null;

  return {
    dataUri: `data:${type};base64,${buffer.toString('base64')}`,
    width: size.width,
    height: size.height,
  };
}

async function loadArtwork(url: string | null): Promise<Artwork> {
  if (!url) return null;

  for (const candidate of artworkCandidates(url)) {
    try {
      const artwork = await fetchArtwork(candidate);
      if (artwork) return artwork;
    } catch {
      // Try the next candidate; a failed fetch degrades to a typographic card.
    }
  }

  return null;
}

/**
 * Reads intrinsic pixel dimensions straight from the image header.
 *
 * Satori is given an explicit cover box rather than `objectFit: 'cover'`, which
 * needs the source dimensions up front. Parsing the header avoids pulling in an
 * image-decoding dependency just to read two numbers.
 */
export function imageSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;

  // PNG: IHDR is always the first chunk.
  if (buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // GIF: logical screen descriptor, little-endian.
  if (buffer.toString('ascii', 0, 3) === 'GIF') {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: (buffer.readUIntLE(24, 3) & 0xffffff) + 1, height: (buffer.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }

  // JPEG: walk the marker chain to the start-of-frame.
  if (buffer.readUInt16BE(0) === 0xffd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const isFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
        || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);

      if (isFrame) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }

  return null;
}

type Artwork = { dataUri: string; width: number; height: number } | null;

type CardCopy = {
  eyebrow: string;
  headline: string;
  support: string | null;
  imageUrl: string | null;
};

function cardCopy(snapshot: SocialSourceSnapshot): CardCopy {
  if (snapshot.kind === 'actor_spotlight' || snapshot.kind === 'birthday_spotlight') {
    const descriptor = [snapshot.nationality, snapshot.knownForDepartment].filter(Boolean).join(' · ');
    const titles = snapshot.knownFor.map(film => film.title).slice(0, 2).join(' · ');
    return {
      eyebrow: snapshot.kind === 'birthday_spotlight' ? 'Birthday Spotlight' : 'Actor Spotlight',
      headline: snapshot.name,
      support: titles || descriptor || null,
      // Prefer the cut-out; a plain photo still renders, just without the
      // subject sitting over the brand shapes.
      imageUrl: snapshot.photoCutoutUrl || snapshot.photoUrl,
    };
  }

  return {
    eyebrow: snapshot.comingSoon ? 'Coming Soon' : 'Now Showing',
    headline: snapshot.title,
    support: snapshot.year ? String(snapshot.year) : null,
    imageUrl: snapshot.posterUrl,
  };
}

/** Design tokens taken from the authored mockups in docs/social-templates. */
const BRAND = {
  bg: '#F5F3F0',
  ink: '#111111',
  orange: '#FF5A1F',
  muted: 'rgba(17,17,17,0.62)',
  rule: 'rgba(17,17,17,0.12)',
};

const BRAND_DIR = path.join(process.cwd(), 'public', 'images', 'MuviDB Brand');

/**
 * The mockups use a horizontal lockup: hexagon icon then the wordmark.
 * `Logo.png` is the square stacked variant and turns to mush at header size, so
 * the two parts are composed separately.
 */
export type BrandLockup = { icon: Artwork; wordmark: Artwork };

let lockupCache: BrandLockup | undefined;

async function loadBrandImage(file: string): Promise<Artwork> {
  try {
    const buffer = await readFile(path.join(BRAND_DIR, file));
    const size = imageSize(buffer);
    if (!size) return null;
    return { dataUri: `data:image/png;base64,${buffer.toString('base64')}`, width: size.width, height: size.height };
  } catch {
    return null;
  }
}

const DECOR_DIR = path.join(getLibDir(), 'decor');

/**
 * Authored decorative vectors, vendored from docs/social-templates so they ship
 * in the function bundle. Satori renders SVG through `<img>` data URIs, which
 * was verified against these exact files.
 */
const decorCache = new Map<string, string | null>();

async function getDecor(file: string): Promise<string | null> {
  if (decorCache.has(file)) return decorCache.get(file)!;
  try {
    const buffer = await readFile(path.join(DECOR_DIR, file));
    decorCache.set(file, `data:image/svg+xml;base64,${buffer.toString('base64')}`);
  } catch {
    decorCache.set(file, null);
  }
  return decorCache.get(file)!;
}

export type CardDecor = { blob: string | null; reel: string | null };

async function getCardDecor(): Promise<CardDecor> {
  const [blob, reel] = await Promise.all([getDecor('organic_blob.svg'), getDecor('film-reel-disk.svg')]);
  return { blob, reel };
}

async function getBrandLockup(): Promise<BrandLockup> {
  if (lockupCache !== undefined) return lockupCache;
  const [icon, wordmark] = await Promise.all([
    loadBrandImage('MuviDB Icon.png'),
    loadBrandImage('Wordmark.png'),
  ]);
  lockupCache = { icon, wordmark };
  return lockupCache;
}

/**
 * The mockups set the name across three lines: first word in ink, second in
 * orange, and any remainder smaller and letterspaced. Shorter names simply use
 * fewer lines rather than padding to three.
 */
export function splitHeadlineName(name: string): { top: string; accent: string; tail: string } {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { top: words[0] || '', accent: '', tail: '' };
  if (words.length === 2) return { top: words[0], accent: words[1], tail: '' };
  return { top: words[0], accent: words[1], tail: words.slice(2).join(' ') };
}

function rule(width: string, s: number, color = BRAND.rule): SatoriNode {
  return h('div', { width, height: `${Math.max(1, Math.round(s))}px`, backgroundColor: color, display: 'flex' });
}

/**
 * Renders a Solar icon — the same set the app uses — as an inline SVG data URI.
 * Satori will not resolve an icon font or a remote sprite, and Solar bodies are
 * stroke-based with `currentColor`, so the colour is substituted here.
 */
export function iconDataUri(name: SocialIconName, color: string): string {
  const icon = SOCIAL_ICONS[name];
  const body = icon.body.replace(/currentColor/g, color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width} ${icon.height}">${body}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function icon(name: SocialIconName, size: number, s: number, color = BRAND.orange): SatoriNode {
  const px = Math.round(size * s);
  return {
    type: 'img',
    props: {
      src: iconDataUri(name, color),
      width: px,
      height: px,
      style: { width: `${px}px`, height: `${px}px`, flexShrink: 0 },
    },
  } as SatoriNode;
}

/** Circled icon used by the footer call to action. */
function circledIcon(name: SocialIconName, size: number, s: number): SatoriNode {
  return h(
    'div',
    {
      width: `${size * s}px`,
      height: `${size * s}px`,
      borderRadius: `${size * s}px`,
      border: `${Math.max(2, 2.5 * s)}px solid ${BRAND.orange}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    icon(name, size * 0.52, s),
  );
}

/** Fading dot matrix in the top-right corner of every mockup. */
function dotGrid(x: number, y: number, s: number): SatoriNode {
  const cols = 8;
  const rows = 11;
  const gap = 11 * s;
  const dots: unknown[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        h('div', {
          position: 'absolute',
          left: `${c * gap}px`,
          top: `${r * gap}px`,
          width: `${3.5 * s}px`,
          height: `${3.5 * s}px`,
          borderRadius: `${4 * s}px`,
          backgroundColor: BRAND.orange,
          opacity: Math.max(0.12, 0.85 - r * 0.07),
          display: 'flex',
        }),
      );
    }
  }

  return h(
    'div',
    { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${cols * gap}px`, height: `${rows * gap}px`, display: 'flex' },
    dots,
  );
}

/**
 * Copy that varies between the person-spotlight cards. The layout, density
 * tuning and decor are identical across them, so only these three strings and
 * the eyebrow change — see docs/social-templates.
 */
type PersonCardSpec = { eyebrow: string; kicker: string; roleLine: string; support: string | null };

/**
 * Copy for each person card.
 *
 * The birthday card deliberately carries a fixed celebratory line rather than
 * the person's bio: the mockup's supporting text is addressed to the subject
 * ("the impact you bring"), and a scraped bio reads wrong in that slot.
 *
 * The age is only mentioned when it was derived from a real year — no age is
 * better than a wrong one on a post about a living person.
 */
function personCardSpec(
  snapshot: Extract<SocialSourceSnapshot, { kind: 'actor_spotlight' | 'birthday_spotlight' }>,
): PersonCardSpec {
  if (snapshot.kind === 'birthday_spotlight') {
    return {
      eyebrow: 'BIRTHDAY SPOTLIGHT',
      kicker: 'BIRTHDAY',
      roleLine: (snapshot.roles.length ? snapshot.roles : ['Actor'])
        .map(role => role.toUpperCase())
        .join('  •  '),
      support: 'Celebrating the talent, versatility and impact you bring to African cinema.',
    };
  }

  return {
    eyebrow: 'ACTOR SPOTLIGHT',
    kicker: 'THIS WEEK',
    roleLine: (snapshot.knownForDepartment || 'Actor').toUpperCase(),
    support: snapshot.bio,
  };
}

function buildPersonSpotlightCard(
  snapshot: Extract<SocialSourceSnapshot, { kind: 'actor_spotlight' | 'birthday_spotlight' }>,
  spec: PersonCardSpec,
  format: SocialAssetFormat,
  portrait: Artwork,
  logo: BrandLockup,
  decor: CardDecor,
): SatoriNode {
  const { width, height } = ASSET_FORMAT_DIMENSIONS[format];
  const s = width / 1080;
  const pad = 52 * s;
  const splitX = width * (format === 'square_1_1' ? 0.5 : 0.468);
  const gridY = height * (format === 'vertical_9_16' ? 0.105 : 0.145);

  // The square format has ~270px less height than 4:5 for the same stack, so it
  // carries less copy. Without this the KNOWN FOR list runs into the footer CTA.
  const density = {
    portrait_4_5: { titles: 3, bio: 132, headline: 1, gap: 1 },
    square_1_1: { titles: 2, bio: 68, headline: 0.76, gap: 0.62 },
    vertical_9_16: { titles: 3, bio: 160, headline: 1, gap: 1.15 },
  }[format];

  // Vertical rhythm multiplier for the left column. The stack is authored for
  // 4:5; at 1:1 it is ~1090px tall in a 1080px canvas and collides with the
  // footer CTA, so headline size and gaps shrink together.
  const g = s * density.gap;

  const name = splitHeadlineName(snapshot.name);
  const titles = snapshot.knownFor.map(f => f.title).slice(0, density.titles);
  const bio =
    spec.support && spec.support.length > density.bio
      ? `${spec.support.slice(0, density.bio - 3).trimEnd()}…`
      : spec.support;

  const children: unknown[] = [];

  // — decorative layer ————————————————————————————————
  children.push(
    h('div', {
      position: 'absolute',
      left: `${splitX}px`,
      top: 0,
      width: `${Math.max(1, s)}px`,
      height: `${height}px`,
      backgroundColor: BRAND.rule,
      display: 'flex',
    }),
    h('div', {
      position: 'absolute',
      left: 0,
      top: `${gridY}px`,
      width: `${width}px`,
      height: `${Math.max(1, s)}px`,
      backgroundColor: BRAND.rule,
      display: 'flex',
    }),
    h('div', {
      position: 'absolute',
      left: `${splitX - 4.5 * s}px`,
      top: `${gridY + 10 * s}px`,
      width: `${9 * s}px`,
      height: `${9 * s}px`,
      borderRadius: `${9 * s}px`,
      backgroundColor: BRAND.orange,
      display: 'flex',
    }),
  );

  children.push(dotGrid(width - pad - 78 * s, gridY + 34 * s, s));

  // Authored organic accent, sitting behind the subject's shoulder.
  if (decor.blob) {
    // Sized to read as a deliberate shape around the subject's shoulder rather
    // than a sliver at the canvas edge — the subject silhouette hides most of it.
    const blobSize = Math.round(440 * s);
    children.push(
      h(
        'div',
        { position: 'absolute', right: `${-60 * s}px`, top: `${height * 0.19}px`, display: 'flex' },
        {
          type: 'img',
          props: {
            src: decor.blob,
            width: blobSize,
            height: blobSize,
            style: { width: `${blobSize}px`, height: `${blobSize}px` },
          },
        },
      ),
    );
  }

  // Film-reel line art. The authored file is solid; the pale look in the
  // mockups comes from opacity rather than a separate light-weight export.
  if (decor.reel) {
    const reelSize = Math.round(330 * s);
    children.push(
      h(
        'div',
        {
          position: 'absolute',
          left: `${splitX - 150 * s}px`,
          bottom: `${-70 * s}px`,
          display: 'flex',
          opacity: 0.13,
        },
        {
          type: 'img',
          props: {
            src: decor.reel,
            width: reelSize,
            height: reelSize,
            style: { width: `${reelSize}px`, height: `${reelSize}px` },
          },
        },
      ),
    );
  }

  // — portrait ————————————————————————————————————————
  if (portrait) {
    // Width is the binding constraint: the subject must stay clear of the text
    // column, which ends around `splitX`. How TALL the subject can therefore be
    // is decided entirely by the source aspect ratio — a square head-and-
    // shoulders crop can only ever reach ~47% of card height, while the 1:2
    // portrait crop the cutout pipeline produces reaches ~95%, matching the
    // authored mockups. Feed this a tall crop, not a square one.
    const maxWidth = width - splitX + 80 * s;
    // Stop the head short of the header row, otherwise a tall crop rides up over
    // "ACTOR SPOTLIGHT 01". The mockups clear it by a similar margin.
    const maxHeight = height - (gridY - 40 * s);
    const fit = Math.min(maxWidth / portrait.width, maxHeight / portrait.height);
    const drawWidth = Math.round(portrait.width * fit);
    const drawHeight = Math.round(portrait.height * fit);

    children.push(
      h(
        'div',
        {
          position: 'absolute',
          right: `${-20 * s}px`,
          bottom: 0,
          width: `${drawWidth}px`,
          height: `${drawHeight}px`,
          display: 'flex',
        },
        {
          type: 'img',
          props: {
            src: portrait.dataUri,
            width: drawWidth,
            height: Math.round(drawHeight),
            style: { width: `${drawWidth}px`, height: `${Math.round(drawHeight)}px` },
          },
        },
      ),
    );
  }

  // — header ——————————————————————————————————————————
  // `Wordmark.png` bakes in the "EVERY FILM. EVERY CREDIT" tagline, which at
  // header size degrades into an unreadable smear — and the mockups show no
  // tagline up here. So the hexagon is placed as an image and "MuviDB" is set
  // in type beside it, which stays crisp at any format.
  const lockupParts: unknown[] = [];
  if (logo.icon) {
    const iconH = Math.round(48 * s);
    const iconW = Math.round((logo.icon.width / logo.icon.height) * iconH);
    lockupParts.push({
      type: 'img',
      props: { src: logo.icon.dataUri, width: iconW, height: iconH, style: { width: `${iconW}px`, height: `${iconH}px` } },
    });
  }
  lockupParts.push(
    h(
      'div',
      {
        display: 'flex',
        marginLeft: `${14 * s}px`,
        fontFamily: 'Outfit',
        fontWeight: 600,
        fontSize: `${44 * s}px`,
        letterSpacing: `${-1 * s}px`,
        color: BRAND.ink,
      },
      'MuviDB',
    ),
  );
  if (lockupParts.length) {
    children.push(
      h(
        'div',
        { position: 'absolute', left: `${pad}px`, top: `${gridY - 82 * s}px`, display: 'flex', alignItems: 'center' },
        lockupParts,
      ),
    );
  }

  children.push(
    h(
      'div',
      {
        position: 'absolute',
        right: `${pad}px`,
        top: `${gridY - 68 * s}px`,
        display: 'flex',
        alignItems: 'center',
      },
      [
        h(
          'div',
          {
            display: 'flex',
            fontFamily: 'Outfit',
            fontWeight: 600,
            fontSize: `${21 * s}px`,
            letterSpacing: `${2.6 * s}px`,
            color: BRAND.ink,
          },
          spec.eyebrow,
        ),
        h(
          'div',
          {
            display: 'flex',
            marginLeft: `${14 * s}px`,
            fontFamily: 'Outfit',
            fontWeight: 600,
            fontSize: `${21 * s}px`,
            color: BRAND.orange,
          },
          '01',
        ),
      ],
    ),
  );

  // — left column ——————————————————————————————————————
  const column: unknown[] = [];

  column.push(
    h(
      'div',
      {
        display: 'flex',
        fontFamily: 'Outfit',
        fontWeight: 600,
        fontSize: `${23 * s}px`,
        letterSpacing: `${5 * s}px`,
        color: BRAND.ink,
      },
      spec.kicker,
    ),
    h('div', { display: 'flex', marginTop: `${14 * g}px`, marginBottom: `${26 * g}px` }, rule(`${splitX - pad - 40 * s}px`, s)),
  );

  // Bebas Neue is narrow, so it needs a larger size than a wider grotesque to
  // fill the text column the way the mockups do. Longest visible word drives
  // the step-down so a long name still fits inside the column.
  const longestWord = Math.max(name.top.length, name.accent.length);
  const headlineSize = (longestWord > 12 ? 100 : longestWord > 9 ? 118 : 132) * s * density.headline;
  column.push(
    h('div', { display: 'flex', fontFamily: 'Headline', fontSize: `${headlineSize}px`, lineHeight: 1.02, color: BRAND.ink }, name.top.toUpperCase()),
  );
  if (name.accent) {
    column.push(
      h('div', { display: 'flex', fontFamily: 'Headline', fontSize: `${headlineSize}px`, lineHeight: 1.02, color: BRAND.orange }, name.accent.toUpperCase()),
    );
  }
  if (name.tail) {
    column.push(
      h(
        'div',
        {
          display: 'flex',
          marginTop: `${6 * g}px`,
          fontFamily: 'Headline',
          fontSize: `${headlineSize * 0.62}px`,
          letterSpacing: `${11 * s}px`,
          color: BRAND.ink,
        },
        name.tail.toUpperCase(),
      ),
    );
  }

  column.push(
    h(
      'div',
      {
        display: 'flex',
        marginTop: `${24 * g}px`,
        fontFamily: 'Outfit',
        fontWeight: 600,
        fontSize: `${23 * s}px`,
        letterSpacing: `${4.5 * s}px`,
        color: BRAND.ink,
      },
      spec.roleLine,
    ),
    h('div', { display: 'flex', marginTop: `${22 * g}px`, marginBottom: `${26 * g}px` }, rule(`${230 * s}px`, s, 'rgba(255,90,31,0.35)')),
  );

  if (snapshot.nationality) {
    column.push(
      h(
        'div',
        { display: 'flex', alignItems: 'center', marginBottom: `${20 * g}px` },
        [
          icon('globe', 30, s),
          h(
            'div',
            {
              display: 'flex',
              marginLeft: `${14 * s}px`,
              fontFamily: 'Outfit',
              fontWeight: 600,
              fontSize: `${21 * s}px`,
              letterSpacing: `${3 * s}px`,
              color: BRAND.ink,
            },
            snapshot.nationality.toUpperCase(),
          ),
        ],
      ),
    );
  }

  if (bio) {
    column.push(
      h(
        'div',
        {
          display: 'flex',
          width: `${splitX - pad - 60 * s}px`,
          marginBottom: `${30 * g}px`,
          fontFamily: 'Outfit',
          fontWeight: 400,
          fontSize: `${24 * s}px`,
          lineHeight: 1.45,
          color: BRAND.muted,
        },
        bio,
      ),
    );
  }

  if (titles.length) {
    column.push(
      h(
        'div',
        { display: 'flex', alignItems: 'center', marginBottom: `${16 * g}px` },
        [
          h(
            'div',
            {
              display: 'flex',
              fontFamily: 'Outfit',
              fontWeight: 600,
              fontSize: `${21 * s}px`,
              letterSpacing: `${3.4 * s}px`,
              color: BRAND.orange,
            },
            'KNOWN FOR',
          ),
          h('div', { display: 'flex', marginLeft: `${16 * s}px` }, rule(`${150 * s}px`, s)),
        ],
      ),
    );

    for (const title of titles) {
      column.push(
        h(
          'div',
          { display: 'flex', alignItems: 'center', marginBottom: `${12 * g}px` },
          [
            h('div', {
              width: `${9 * s}px`,
              height: `${9 * s}px`,
              borderRadius: `${9 * s}px`,
              backgroundColor: BRAND.orange,
              display: 'flex',
              flexShrink: 0,
            }),
            h(
              'div',
              {
                display: 'flex',
                marginLeft: `${16 * s}px`,
                fontFamily: 'Outfit',
                fontWeight: 400,
                fontSize: `${25 * s}px`,
                color: BRAND.ink,
              },
              title,
            ),
          ],
        ),
      );
    }
  }

  children.push(
    h(
      'div',
      {
        position: 'absolute',
        left: `${pad}px`,
        top: `${gridY + 62 * s}px`,
        width: `${splitX - pad}px`,
        display: 'flex',
        flexDirection: 'column',
      },
      column,
    ),
  );

  // — footer CTA ————————————————————————————————————————
  children.push(
    h(
      'div',
      { position: 'absolute', left: `${pad}px`, bottom: `${64 * s}px`, display: 'flex', alignItems: 'center' },
      [
        circledIcon('arrowRight', 52, s),
        h(
          'div',
          { display: 'flex', flexDirection: 'column', marginLeft: `${18 * s}px` },
          [
            h(
              'div',
              {
                display: 'flex',
                fontFamily: 'Outfit',
                fontWeight: 600,
                fontSize: `${19 * s}px`,
                letterSpacing: `${3 * s}px`,
                color: BRAND.muted,
              },
              'VIEW FULL PROFILE',
            ),
            h(
              'div',
              { display: 'flex', fontFamily: 'Outfit', fontWeight: 600, fontSize: `${27 * s}px`, color: BRAND.ink },
              'MuviDB.com',
            ),
          ],
        ),
      ],
    ),
  );

  return h(
    'div',
    { width: `${width}px`, height: `${height}px`, display: 'flex', position: 'relative', backgroundColor: BRAND.bg },
    children,
  );
}

function buildCard(copy: CardCopy, format: SocialAssetFormat, artwork: Artwork): SatoriNode {
  const { width, height } = ASSET_FORMAT_DIMENSIONS[format];
  const scale = width / 1080;

  const children: unknown[] = [];

  if (artwork) {
    // Sized to an explicit cover box so the crop is deterministic across
    // formats. Anchored above centre so faces survive the vertical crop.
    const cover = Math.max(width / artwork.width, height / artwork.height);
    const drawWidth = Math.ceil(artwork.width * cover);
    const drawHeight = Math.ceil(artwork.height * cover);

    children.push(
      h(
        'div',
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${width}px`,
          height: `${height}px`,
          display: 'flex',
          overflow: 'hidden',
        },
        {
          type: 'img',
          props: {
            src: artwork.dataUri,
            width: drawWidth,
            height: drawHeight,
            // Sized to the cover box, so the image's own aspect ratio already
            // matches and satori's preserveAspectRatio has nothing to letterbox.
            style: {
              width: `${drawWidth}px`,
              height: `${drawHeight}px`,
              marginLeft: `${Math.round((width - drawWidth) / 2)}px`,
              marginTop: `${Math.round((height - drawHeight) * 0.35)}px`,
            },
          },
        },
      ),
    );
  }

  // Scrim keeps the headline legible over any artwork.
  children.push(
    h('div', {
      position: 'absolute',
      top: 0,
      left: 0,
      width: `${width}px`,
      height: `${height}px`,
      backgroundImage: artwork
        ? 'linear-gradient(180deg, rgba(11,11,15,0.35) 0%, rgba(11,11,15,0.15) 40%, rgba(11,11,15,0.92) 82%, rgba(11,11,15,0.99) 100%)'
        : 'linear-gradient(160deg, #1A1526 0%, #0B0B0F 70%)',
    }),
  );

  children.push(
    h(
      'div',
      {
        position: 'absolute',
        top: `${64 * scale}px`,
        left: `${64 * scale}px`,
        display: 'flex',
        alignItems: 'center',
        paddingTop: `${12 * scale}px`,
        paddingBottom: `${12 * scale}px`,
        paddingLeft: `${26 * scale}px`,
        paddingRight: `${26 * scale}px`,
        borderRadius: `${999}px`,
        backgroundColor: '#E23E2D',
        fontFamily: 'Outfit',
        fontWeight: 600,
        fontSize: `${26 * scale}px`,
        letterSpacing: `${2 * scale}px`,
        textTransform: 'uppercase',
        color: '#FFFFFF',
      },
      copy.eyebrow,
    ),
  );

  const block: unknown[] = [
    h(
      'div',
      {
        display: 'flex',
        fontFamily: 'Syne',
        fontWeight: 800,
        fontSize: `${(copy.headline.length > 22 ? 76 : 96) * scale}px`,
        lineHeight: 1.05,
        color: '#FFFFFF',
      },
      copy.headline,
    ),
  ];

  if (copy.support) {
    block.push(
      h(
        'div',
        {
          display: 'flex',
          marginTop: `${20 * scale}px`,
          fontFamily: 'Outfit',
          fontWeight: 400,
          fontSize: `${36 * scale}px`,
          color: 'rgba(255,255,255,0.78)',
        },
        copy.support,
      ),
    );
  }

  block.push(
    h(
      'div',
      {
        display: 'flex',
        marginTop: `${36 * scale}px`,
        fontFamily: 'Outfit',
        fontWeight: 600,
        fontSize: `${28 * scale}px`,
        letterSpacing: `${4 * scale}px`,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
      },
      'MuviDB',
    ),
  );

  children.push(
    h(
      'div',
      {
        position: 'absolute',
        left: `${64 * scale}px`,
        right: `${64 * scale}px`,
        bottom: `${72 * scale}px`,
        display: 'flex',
        flexDirection: 'column',
      },
      block,
    ),
  );

  return h(
    'div',
    {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
      position: 'relative',
      backgroundColor: '#0B0B0F',
    },
    children,
  );
}

export type RenderedAsset = {
  format: SocialAssetFormat;
  png: Buffer;
  width: number;
  height: number;
  usedArtwork: boolean;
};

export async function renderSnapshotAsset(input: {
  snapshot: SocialSourceSnapshot;
  format: SocialAssetFormat;
  artwork?: Artwork;
}): Promise<RenderedAsset> {
  const { width, height } = ASSET_FORMAT_DIMENSIONS[input.format];
  const copy = cardCopy(input.snapshot);

  const artwork = input.artwork !== undefined ? input.artwork : await loadArtwork(copy.imageUrl);

  const element =
    input.snapshot.kind === 'actor_spotlight' || input.snapshot.kind === 'birthday_spotlight'
      ? buildPersonSpotlightCard(
          input.snapshot,
          personCardSpec(input.snapshot),
          input.format,
          artwork,
          await getBrandLockup(),
          await getCardDecor(),
        )
      : buildCard(copy, input.format, artwork);

  const svg = await satori(element as never, {
    width,
    height,
    fonts: await getFonts(),
  });

  if (process.env.SOCIAL_RENDER_DEBUG_SVG) {
    for (const match of svg.matchAll(/<image[^>]*>/g)) {
      console.log(`[render:${input.format}]`, match[0].replace(/(xlink:)?href="[^"]*"/, 'href="..."'));
    }
  }

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();

  return { format: input.format, png, width, height, usedArtwork: Boolean(artwork) };
}

/** Renders every format from one artwork fetch instead of re-downloading per size. */
export async function renderSnapshotAssets(input: {
  snapshot: SocialSourceSnapshot;
  formats: SocialAssetFormat[];
}): Promise<RenderedAsset[]> {
  const artwork = await loadArtwork(cardCopy(input.snapshot).imageUrl);

  const rendered: RenderedAsset[] = [];
  for (const format of input.formats) {
    rendered.push(await renderSnapshotAsset({ snapshot: input.snapshot, format, artwork }));
  }
  return rendered;
}
