/**
 * Social platform registry for the link-in-bio portfolio.
 *
 * One entry per platform is the whole contract: add a row here and the icon,
 * brand colour and label appear everywhere — the icon row under the bio, the
 * link tiles, and the editor's picker. Nothing else needs to change.
 *
 * `detectPlatform` exists so a creator never has to choose an icon. They paste
 * a URL, we recognise the host, and the right brand mark shows up. Anything we
 * do not recognise still renders, with a neutral link glyph.
 */

export interface SocialPlatform {
  key: string;
  /** Shown on the link tile. */
  label: string;
  /** Iconify id — the app already bundles @iconify/react. */
  icon: string;
  /** Tailwind text colour for the glyph. */
  fg: string;
  /** Tailwind background for the icon panel behind the glyph. */
  tint: string;
  /** Solid brand colour, for the circular icon row. */
  solid: string;
  /** Hosts that identify this platform. */
  hosts: string[];
  /** Turns a bare handle into a full URL. Receives a trimmed, @-less handle. */
  handleToUrl: (handle: string) => string;
}

/**
 * Order matters in two ways: the icon row renders in this order, and
 * `detectPlatform` returns the first host match. Keep the most specific hosts
 * above the generic ones (e.g. music.youtube before youtube).
 */
export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    icon: 'simple-icons:instagram',
    fg: 'text-pink-400',
    tint: 'bg-pink-500/10',
    solid: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400',
    hosts: ['instagram.com', 'instagr.am'],
    handleToUrl: (h) => `https://instagram.com/${h}`,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    icon: 'simple-icons:tiktok',
    fg: 'text-cyan-300',
    tint: 'bg-cyan-500/10',
    solid: 'bg-black',
    hosts: ['tiktok.com'],
    handleToUrl: (h) => `https://tiktok.com/@${h}`,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    icon: 'simple-icons:youtube',
    fg: 'text-red-400',
    tint: 'bg-red-500/10',
    solid: 'bg-red-600',
    hosts: ['youtube.com', 'youtu.be'],
    // Channel handles are @-prefixed; legacy ids are not.
    handleToUrl: (h) => `https://youtube.com/${h.startsWith('@') ? h : `@${h}`}`,
  },
  {
    key: 'x',
    label: 'X',
    icon: 'simple-icons:x',
    fg: 'text-zinc-200',
    tint: 'bg-zinc-500/10',
    solid: 'bg-black',
    hosts: ['x.com', 'twitter.com'],
    handleToUrl: (h) => `https://x.com/${h}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: 'simple-icons:facebook',
    fg: 'text-blue-400',
    tint: 'bg-blue-500/10',
    solid: 'bg-[#1877F2]',
    hosts: ['facebook.com', 'fb.com', 'fb.me'],
    handleToUrl: (h) => `https://facebook.com/${h}`,
  },
  {
    key: 'snapchat',
    label: 'Snapchat',
    icon: 'simple-icons:snapchat',
    fg: 'text-yellow-300',
    tint: 'bg-yellow-400/10',
    solid: 'bg-[#FFFC00]',
    hosts: ['snapchat.com'],
    handleToUrl: (h) => `https://snapchat.com/add/${h}`,
  },
  {
    key: 'threads',
    label: 'Threads',
    icon: 'simple-icons:threads',
    fg: 'text-zinc-200',
    tint: 'bg-zinc-500/10',
    solid: 'bg-black',
    hosts: ['threads.net', 'threads.com'],
    handleToUrl: (h) => `https://threads.net/@${h}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: 'simple-icons:linkedin',
    fg: 'text-sky-400',
    tint: 'bg-sky-500/10',
    solid: 'bg-[#0A66C2]',
    hosts: ['linkedin.com', 'lnkd.in'],
    handleToUrl: (h) => `https://linkedin.com/in/${h}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: 'simple-icons:whatsapp',
    fg: 'text-emerald-400',
    tint: 'bg-emerald-500/10',
    solid: 'bg-[#25D366]',
    hosts: ['whatsapp.com', 'wa.me', 'chat.whatsapp.com'],
    handleToUrl: (h) => `https://wa.me/${h.replace(/[^\d]/g, '')}`,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: 'simple-icons:telegram',
    fg: 'text-sky-300',
    tint: 'bg-sky-400/10',
    solid: 'bg-[#26A5E4]',
    hosts: ['t.me', 'telegram.me', 'telegram.org'],
    handleToUrl: (h) => `https://t.me/${h}`,
  },
  {
    key: 'spotify',
    label: 'Spotify',
    icon: 'simple-icons:spotify',
    fg: 'text-green-400',
    tint: 'bg-green-500/10',
    solid: 'bg-[#1DB954]',
    hosts: ['spotify.com', 'open.spotify.com'],
    handleToUrl: (h) => `https://open.spotify.com/artist/${h}`,
  },
  {
    key: 'applemusic',
    label: 'Apple Music',
    icon: 'simple-icons:applemusic',
    fg: 'text-rose-400',
    tint: 'bg-rose-500/10',
    solid: 'bg-gradient-to-br from-rose-500 to-fuchsia-600',
    hosts: ['music.apple.com'],
    handleToUrl: (h) => `https://music.apple.com/artist/${h}`,
  },
  {
    key: 'soundcloud',
    label: 'SoundCloud',
    icon: 'simple-icons:soundcloud',
    fg: 'text-orange-400',
    tint: 'bg-orange-500/10',
    solid: 'bg-[#FF5500]',
    hosts: ['soundcloud.com'],
    handleToUrl: (h) => `https://soundcloud.com/${h}`,
  },
  {
    key: 'vimeo',
    label: 'Vimeo',
    icon: 'simple-icons:vimeo',
    fg: 'text-sky-300',
    tint: 'bg-sky-500/10',
    solid: 'bg-[#1AB7EA]',
    hosts: ['vimeo.com'],
    handleToUrl: (h) => `https://vimeo.com/${h}`,
  },
  {
    key: 'imdb',
    label: 'IMDb',
    icon: 'simple-icons:imdb',
    fg: 'text-yellow-300',
    tint: 'bg-yellow-500/10',
    solid: 'bg-[#F5C518]',
    hosts: ['imdb.com'],
    handleToUrl: (h) => `https://imdb.com/name/${h}`,
  },
];

/** Neutral fallback so an unrecognised link still looks deliberate. */
export const GENERIC_LINK: Pick<SocialPlatform, 'key' | 'label' | 'icon' | 'fg' | 'tint' | 'solid'> = {
  key: 'link',
  label: 'Link',
  icon: 'solar:link-circle-bold',
  fg: 'text-amber-400',
  tint: 'bg-amber-500/10',
  solid: 'bg-amber-500',
};

const BY_KEY = new Map(SOCIAL_PLATFORMS.map((p) => [p.key, p]));
// Accept the names the people table already uses so stored values keep working.
const KEY_ALIASES: Record<string, string> = {
  twitter: 'x',
  twitter_url: 'x',
  instagram_url: 'instagram',
  facebook_url: 'facebook',
  tiktok_url: 'tiktok',
  youtube_handle: 'youtube',
  ig: 'instagram',
  yt: 'youtube',
  fb: 'facebook',
};

export function platformFor(key?: string | null): SocialPlatform | null {
  if (!key) return null;
  const k = String(key).trim().toLowerCase();
  return BY_KEY.get(k) || BY_KEY.get(KEY_ALIASES[k]) || null;
}

function hostOf(value: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withScheme).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Identify a platform from a pasted URL. This is what spares the creator from
 * picking an icon: paste `instagram.com/rinaboyxx` and the Instagram mark
 * appears on its own.
 */
export function detectPlatform(url?: string | null): SocialPlatform | null {
  if (!url) return null;
  const host = hostOf(String(url).trim());
  if (!host) return null;
  return (
    SOCIAL_PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`))) || null
  );
}

/**
 * Normalise whatever is stored for a platform into an openable URL. The people
 * table mixes full URLs (instagram_url) with bare handles (youtube_handle), so
 * both have to work.
 */
export function resolveSocialUrl(key: string, value?: string | null): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const platform = platformFor(key);
  // A bare host with a path but no scheme is still a URL, not a handle.
  if (/^[\w.-]+\.[a-z]{2,}\//i.test(raw)) return `https://${raw}`;
  if (!platform) return `https://${raw}`;
  return platform.handleToUrl(raw.replace(/^@/, ''));
}

/** Display form for a link subtitle: host + path, no scheme or trailing slash. */
export function prettyUrl(url?: string | null): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}

/**
 * The handle a creator would recognise, pulled from the URL. Used as the tile
 * label so a row reads "rinaboyxx" rather than the full link.
 */
export function handleFromUrl(url?: string | null): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const { pathname } = new URL(withScheme);
    const segment = pathname.split('/').filter(Boolean).pop();
    if (!segment) return null;
    const cleaned = decodeURIComponent(segment).replace(/^@/, '');
    return cleaned.length > 40 ? null : cleaned;
  } catch {
    return null;
  }
}
