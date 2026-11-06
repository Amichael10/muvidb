import { supabase } from './supabase';
import { fetchPersonStageCredits } from './plays';

export interface CustomLink {
  id: string;
  title: string;
  url: string;
  category?: 'press' | 'festival' | 'tickets' | 'social' | 'other';
  icon?: string;
}

export interface PortfolioFilm {
  id: string;
  title: string;
  slug: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  synopsis: string | null;
  roles: string[];
  release_type?: string;
  streaming_links?: Record<string, string>;
  is_featured?: boolean;
  box_office_domestic?: number | null;
  box_office_worldwide?: number | null;
  box_office_currency?: string | null;
  view_count?: number | null;
  youtube_watch_url?: string | null;
}

export interface PortfolioSettings {
  show_metrics: boolean;
  show_box_office: boolean;
  show_youtube_views: boolean;
  filmography_order: string[];
}

export interface PortfolioMetrics {
  cinemaCount: number;
  youtubeCount: number;
  stageCount: number;
  acrossScreensText: string;
  totalBoxOffice: number;
  formattedBoxOffice: string;
  totalStageBoxOffice: number;
  formattedStageBoxOffice: string;
  totalViews: number;
  formattedViews: string;
  hasCommercialFootprint: boolean;
}

export interface FilmmakerPortfolio {
  id?: string;
  person_id: string;
  user_id?: string;
  handle: string;
  tagline: string | null;
  bio_statement: string | null;
  featured_reel_url: string | null;
  featured_film_ids: string[];
  custom_links: CustomLink[];
  inquiry_email: string | null;
  inquiry_phone: string | null;
  epk_pdf_url: string | null;
  theme_preset: 'midnight' | 'gold' | 'neon' | 'minimal';
  accent_color: string;
  is_published: boolean;
  view_count: number;
}

export interface PortfolioData {
  portfolio: FilmmakerPortfolio;
  person: {
    id: string;
    name: string;
    slug: string;
    photo_url: string | null;
    bio: string | null;
    nationality: string | null;
    is_verified: boolean;
    is_pro: boolean;
    popularity_score: number | null;
    booking_email: string | null;
    availability_status: string | null;
    awards: any[];
    socials: {
      instagram?: string | null;
      twitter?: string | null;
      tiktok?: string | null;
      facebook?: string | null;
      youtube?: string | null;
    };
    youtube_stats?: any;
  };
  featuredFilms: PortfolioFilm[];
  allFilms: PortfolioFilm[];
  stageCredits?: any[];
  media: Array<{
    id: string;
    media_type: string;
    category: string;
    title: string;
    url: string;
    thumbnail_url: string | null;
  }>;
  metrics: PortfolioMetrics;
  settings: PortfolioSettings;
}

/**
 * Format any YouTube / Vimeo video URL into a clean embeddable player iframe URL.
 */
export function formatVideoEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  const clean = url.trim();

  // YouTube
  const ytMatch = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|(?:embed|v|shorts)\/))([\w-]{11})/i);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0&modestbranding=1`;
  }

  // Vimeo
  const vimeoMatch = clean.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=0&title=0&byline=0&portrait=0`;
  }

  return clean;
}

/**
 * Clean vanity handle from '@username' or full URL to 'username'.
 */
export function sanitizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
}


export function formatCurrencyShort(amount: number, currency = 'NGN'): string {
  if (!amount || amount <= 0) return '';
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '₦';
  if (amount >= 1_000_000_000) {
    const val = (amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
    return `${symbol}${val}B`;
  }
  if (amount >= 1_000_000) {
    const val = (amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1).replace(/\.0$/, '');
    return `${symbol}${val}M`;
  }
  if (amount >= 1_000) {
    return `${symbol}${Math.round(amount / 1_000)}K`;
  }
  return `${symbol}${amount.toLocaleString()}`;
}

/**
 * Fetch a filmmaker's public portfolio by their custom vanity handle or person slug.
 * Gracefully falls back to creating a dynamic portfolio view from the people table
 * if no custom portfolio configuration has been saved yet.
 */
export async function fetchPortfolioByHandle(rawHandle: string): Promise<PortfolioData | null> {
  const handle = sanitizeHandle(rawHandle);
  if (!handle) return null;

  let portfolioRecord: FilmmakerPortfolio | null = null;
  let personId: string | null = null;

  // 1. Try querying filmmaker_portfolios table
  try {
    const { data, error } = await supabase
      .from('filmmaker_portfolios')
      .select('*')
      .ilike('handle', handle)
      .maybeSingle();

    if (!error && data) {
      portfolioRecord = data as FilmmakerPortfolio;
      personId = data.person_id;
    }
  } catch {
    // Table might not exist yet before migration
  }

  // 2. If not found by custom handle, try finding person by slug or handle
  if (!personId) {
    const { data: personData } = await supabase
      .from('people')
      .select('id')
      .or(`slug.eq.${handle},slug.ilike.${handle}`)
      .limit(1)
      .maybeSingle();

    if (personData?.id) {
      personId = personData.id;
    }
  }

  if (!personId) return null;

  // 3. Fetch comprehensive person data, credits, media, and stage plays
  const [personRes, creditsRes, mediaRes, stageRes] = await Promise.all([
    supabase
      .from('people')
      .select(`
        id, name, slug, photo_url, bio, nationality, is_verified, is_pro,
        popularity_score, booking_email, booking_phone, booking_whatsapp,
        availability_status, availability_note, awards, showreel_urls,
        instagram_url, twitter_url, tiktok_url, facebook_url, youtube_handle, youtube_stats
      `)
      .eq('id', personId)
      .single(),
    // Via /api/content: portfolio/:handle is a PUBLIC route, so the browser
    // must not read the credits table directly. person-credits returns a
    // superset of the fields aggregated below, and is_published matches what
    // anon could already see (RLS hides unpublished films).
    (async (): Promise<{ data: any[] }> => {
      try {
        const res = await fetch(
          `/api/content?resource=person-credits&personId=${encodeURIComponent(personId)}`
        );
        return { data: res.ok ? ((await res.json()).credits || []) : [] };
      } catch {
        return { data: [] };
      }
    })(),
    supabase
      .from('person_media')
      .select('id, media_type, category, title, url, thumbnail_url, is_primary')
      .eq('person_id', personId)
      .eq('status', 'approved')
      .order('sort_order', { ascending: true })
      .limit(12),
    fetchPersonStageCredits(personId).catch(() => []),
  ]);

  if (personRes.error || !personRes.data) return null;
  const p = personRes.data;

  // Aggregate credits into unique films with aggregated roles
  const filmMap = new Map<string, PortfolioFilm>();
  for (const c of (creditsRes.data || [])) {
    const f: any = c.films;
    if (!f || !f.id) continue;

    const boDomestic = f.box_office_domestic != null ? Number(f.box_office_domestic) : (Number(f.streaming_links?.box_office?.domestic) || null);
    const boWorldwide = f.box_office_worldwide != null ? Number(f.box_office_worldwide) : null;
    const views = f.view_count != null ? Number(f.view_count) : (Number(f.streaming_links?.youtube_views) || null);

    if (!filmMap.has(f.id)) {
      filmMap.set(f.id, {
        id: f.id,
        title: f.title,
        slug: f.slug || f.id,
        year: f.year,
        poster_url: f.poster_url,
        backdrop_url: f.backdrop_url,
        synopsis: f.synopsis,
        roles: [c.role || 'Contributor'],
        release_type: f.release_type,
        streaming_links: f.streaming_links || {},
        box_office_domestic: boDomestic,
        box_office_worldwide: boWorldwide,
        box_office_currency: f.box_office_currency || 'NGN',
        view_count: views,
        youtube_watch_url: f.youtube_watch_url || null,
      });
    } else {
      const existing = filmMap.get(f.id)!;
      if (c.role && !existing.roles.includes(c.role)) {
        existing.roles.push(c.role);
      }
      if (existing.box_office_domestic == null && boDomestic != null) existing.box_office_domestic = boDomestic;
      if (existing.box_office_worldwide == null && boWorldwide != null) existing.box_office_worldwide = boWorldwide;
      if (existing.view_count == null && views != null) existing.view_count = views;
      if (!existing.youtube_watch_url && f.youtube_watch_url) existing.youtube_watch_url = f.youtube_watch_url;
    }
  }

  const allFilms = Array.from(filmMap.values()).sort((a, b) => (b.year || 0) - (a.year || 0));

  // Determine fallback showreel from person_media or people.showreel_urls
  const primaryShowreelMedia = (mediaRes.data || []).find(
    m => m.category === 'showreel' || (m.media_type === 'video' && m.is_primary)
  );
  const fallbackReel = primaryShowreelMedia?.url || (Array.isArray(p.showreel_urls) ? p.showreel_urls[0] : null);

  // If no portfolio record in DB, create synthetic default
  if (!portfolioRecord) {
    portfolioRecord = {
      person_id: p.id,
      handle: p.slug || handle,
      tagline: p.bio ? p.bio.split('.')[0] : 'Filmmaker & Visual Artist',
      bio_statement: p.bio || null,
      featured_reel_url: fallbackReel || null,
      featured_film_ids: allFilms.slice(0, 3).map(f => f.id),
      custom_links: [],
      inquiry_email: p.booking_email || null,
      inquiry_phone: p.booking_phone || null,
      epk_pdf_url: null,
      theme_preset: 'midnight',
      accent_color: '#f59e0b',
      is_published: true,
      view_count: 0,
    };
  }

  // Extract layout and customization settings from metadata link
  const metaLink = (portfolioRecord.custom_links || []).find((l: any) => l && l._meta === 'layout');
  const settings: PortfolioSettings = {
    show_metrics: metaLink?.show_metrics !== false,
    show_box_office: metaLink?.show_box_office !== false,
    show_youtube_views: metaLink?.show_youtube_views !== false,
    filmography_order: Array.isArray(metaLink?.filmography_order) ? metaLink.filmography_order : [],
  };

  // Reorder allFilms if custom filmography arrangement exists
  if (settings.filmography_order.length > 0) {
    const orderMap = new Map<string, number>();
    settings.filmography_order.forEach((id, idx) => orderMap.set(id, idx));
    allFilms.sort((a, b) => {
      const aOrder = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const bOrder = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (b.year || 0) - (a.year || 0);
    });
  }

  // Pick top 3 featured showcase films, preserving creator's selection order
  const featuredIds = portfolioRecord.featured_film_ids || [];
  let featuredFilms: PortfolioFilm[] = [];
  if (featuredIds.length > 0) {
    featuredFilms = featuredIds
      .map(id => filmMap.get(id))
      .filter(Boolean) as PortfolioFilm[];
  }
  if (featuredFilms.length === 0) {
    featuredFilms = allFilms.slice(0, 3);
  } else {
    featuredFilms = featuredFilms.slice(0, 3);
  }
  featuredFilms.forEach(f => (f.is_featured = true));

  return {
    portfolio: portfolioRecord,
    person: {
      id: p.id,
      name: p.name,
      slug: p.slug,
      photo_url: p.photo_url,
      bio: p.bio,
      nationality: p.nationality,
      is_verified: Boolean(p.is_verified),
      is_pro: Boolean(p.is_pro),
      popularity_score: p.popularity_score,
      booking_email: p.booking_email,
      availability_status: p.availability_status,
      awards: Array.isArray(p.awards) ? p.awards : [],
      socials: {
        instagram: p.instagram_url,
        twitter: p.twitter_url,
        tiktok: p.tiktok_url,
        facebook: p.facebook_url,
        youtube: p.youtube_handle,
      },
    },
    featuredFilms,
    allFilms,
    stageCredits: stageRes || [],
    media: mediaRes.data || [],
    metrics: computePortfolioMetrics(allFilms, stageRes || [], p.youtube_stats),
    settings,
  };
}

/**
 * Fetch or initialize current logged-in user's portfolio.
 */
export async function getMyPortfolio(userId: string): Promise<PortfolioData | null> {
  if (!userId) return null;

  // 1. Find the claimed person ID via actor_profile_access or claimed_by
  const { data: access } = await supabase
    .from('actor_profile_access')
    .select('person_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  let personId = access?.person_id;

  if (!personId) {
    const { data: person } = await supabase
      .from('people')
      .select('id, slug')
      .eq('claimed_by', userId)
      .limit(1)
      .maybeSingle();
    personId = person?.id;
  }

  if (!personId) return null;

  const { data: person } = await supabase
    .from('people')
    .select('slug')
    .eq('id', personId)
    .single();

  if (!person?.slug) return null;
  return fetchPortfolioByHandle(person.slug);
}

/**
 * Save / Update portfolio configuration.
 */
export async function savePortfolio(
  payload: Partial<FilmmakerPortfolio> & { person_id: string }
): Promise<{ success: boolean; data?: FilmmakerPortfolio; error?: string }> {
  try {
    const cleanHandle = sanitizeHandle(payload.handle || '');
    if (!cleanHandle) {
      return { success: false, error: 'A valid portfolio handle is required (e.g. kunleafolayan).' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'You must be logged in to save portfolio settings.' };
    }

    const record = {
      person_id: payload.person_id,
      user_id: user.id,
      handle: cleanHandle,
      tagline: payload.tagline || null,
      bio_statement: payload.bio_statement || null,
      featured_reel_url: payload.featured_reel_url || null,
      featured_film_ids: payload.featured_film_ids || [],
      custom_links: payload.custom_links || [],
      inquiry_email: payload.inquiry_email || null,
      inquiry_phone: payload.inquiry_phone || null,
      epk_pdf_url: payload.epk_pdf_url || null,
      theme_preset: payload.theme_preset || 'midnight',
      accent_color: payload.accent_color || '#f59e0b',
      is_published: payload.is_published ?? true,
      updated_at: new Date().toISOString(),
    };

    // Upsert into filmmaker_portfolios
    const { data, error } = await supabase
      .from('filmmaker_portfolios')
      .upsert(record, { onConflict: 'person_id' })
      .select()
      .single();

    if (error) {
      console.warn('Upsert filmmaker_portfolios error:', error.message);
      return { success: false, error: error.message };
    }

    // Also update common fields on the person profile if user has ownership
    if (payload.inquiry_email || payload.featured_reel_url) {
      const updates: any = {};
      if (payload.inquiry_email) updates.booking_email = payload.inquiry_email;
      if (payload.featured_reel_url) {
        updates.showreel_urls = [payload.featured_reel_url];
      }
      await supabase.from('people').update(updates).eq('id', payload.person_id);
    }

    return { success: true, data: data as FilmmakerPortfolio };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save portfolio.' };
  }
}

export function formatViewsShort(views: number): string {
  if (!views || views <= 0) return '';
  if (views >= 1_000_000_000) {
    const val = (views / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
    return `${val}B`;
  }
  if (views >= 1_000_000) {
    const val = (views / 1_000_000).toFixed(views % 1_000_000 === 0 ? 0 : 1).replace(/\.0$/, '');
    return `${val}M`;
  }
  if (views >= 1_000) {
    return `${Math.round(views / 1_000)}K`;
  }
  return views.toLocaleString();
}

export function computePortfolioMetrics(
  allFilms: PortfolioFilm[] = [],
  stageCredits: any[] = [],
  personYoutubeStats?: any
): PortfolioMetrics {
  let cinemaCount = 0;
  let youtubeCount = 0;
  let totalBoxOffice = 0;
  let totalViews = 0;
  let totalStageBoxOffice = 0;

  for (const f of allFilms) {
    const bo = Number(f.box_office_domestic || f.box_office_worldwide || f.streaming_links?.box_office?.domestic) || 0;
    const views = Number(f.view_count || f.streaming_links?.youtube_views) || 0;

    const isCinema =
      f.release_type === 'cinema' ||
      f.release_type === 'theatrical' ||
      bo > 0 ||
      Boolean(f.streaming_links && 'cinema' in f.streaming_links);
    if (isCinema) cinemaCount++;

    const isYoutube =
      f.release_type === 'youtube' ||
      f.release_type === 'youtube_premium' ||
      Boolean(f.youtube_watch_url) ||
      views > 0;
    if (isYoutube) youtubeCount++;

    if (bo > 0) totalBoxOffice += bo;
    if (views > 0) totalViews += views;
  }

  for (const s of (stageCredits || [])) {
    const sBo = Number(s.box_office_domestic || s.play?.box_office_domestic) || 0;
    if (sBo > 0) totalStageBoxOffice += sBo;
  }

  if (personYoutubeStats?.views && typeof personYoutubeStats.views === 'number' && personYoutubeStats.views > totalViews) {
    totalViews = personYoutubeStats.views;
  }

  const stageCount = stageCredits?.length || 0;

  const screenBits: string[] = [];
  if (cinemaCount > 0) {
    screenBits.push(`${cinemaCount} cinema release${cinemaCount > 1 ? 's' : ''}`);
  }
  if (youtubeCount > 0) {
    screenBits.push(`${youtubeCount} YouTube film${youtubeCount > 1 ? 's' : ''}`);
  }
  if (stageCount > 0) {
    screenBits.push(`${stageCount} stage production${stageCount > 1 ? 's' : ''}`);
  }
  if (screenBits.length === 0 && allFilms.length > 0) {
    screenBits.push(`${allFilms.length} credited production${allFilms.length > 1 ? 's' : ''}`);
  }

  const acrossScreensText = screenBits.join(' · ') || 'Active Across Screens & Stage';
  const formattedBoxOffice = formatCurrencyShort(totalBoxOffice);
  const formattedStageBoxOffice = formatCurrencyShort(totalStageBoxOffice);
  const formattedViews = formatViewsShort(totalViews);
  const hasCommercialFootprint = totalBoxOffice > 0 || totalViews > 0 || totalStageBoxOffice > 0;

  return {
    cinemaCount,
    youtubeCount,
    stageCount,
    acrossScreensText,
    totalBoxOffice,
    formattedBoxOffice,
    totalStageBoxOffice,
    formattedStageBoxOffice,
    totalViews,
    formattedViews,
    hasCommercialFootprint,
  };
}
