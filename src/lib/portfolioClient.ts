import { supabase } from './supabase';

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
  };
  featuredFilms: PortfolioFilm[];
  allFilms: PortfolioFilm[];
  media: Array<{
    id: string;
    media_type: string;
    category: string;
    title: string;
    url: string;
    thumbnail_url: string | null;
  }>;
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

/**
 * Fetch a complete portfolio by vanity handle or person slug.
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

  // 3. Fetch comprehensive person data, credits, and media
  const [personRes, creditsRes, mediaRes] = await Promise.all([
    supabase
      .from('people')
      .select(`
        id, name, slug, photo_url, bio, nationality, is_verified, is_pro,
        popularity_score, booking_email, booking_phone, booking_whatsapp,
        availability_status, availability_note, awards, showreel_urls,
        instagram_url, twitter_url, tiktok_url, facebook_url, youtube_handle
      `)
      .eq('id', personId)
      .single(),
    supabase
      .from('credits')
      .select(`
        id, role, character_name,
        films!inner (
          id, title, slug, year, poster_url, backdrop_url, synopsis,
          release_type, streaming_links, status
        )
      `)
      .eq('person_id', personId),
    supabase
      .from('person_media')
      .select('id, media_type, category, title, url, thumbnail_url, is_primary')
      .eq('person_id', personId)
      .eq('status', 'approved')
      .order('sort_order', { ascending: true })
      .limit(12),
  ]);

  if (personRes.error || !personRes.data) return null;
  const p = personRes.data;

  // Aggregate credits into unique films with aggregated roles
  const filmMap = new Map<string, PortfolioFilm>();
  for (const c of (creditsRes.data || [])) {
    const f: any = c.films;
    if (!f || !f.id) continue;

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
      });
    } else {
      const existing = filmMap.get(f.id)!;
      if (c.role && !existing.roles.includes(c.role)) {
        existing.roles.push(c.role);
      }
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
      featured_film_ids: allFilms.slice(0, 4).map(f => f.id),
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

  // Pick featured films
  const featuredIds = new Set(portfolioRecord.featured_film_ids || []);
  let featuredFilms = allFilms.filter(f => featuredIds.has(f.id));
  if (featuredFilms.length === 0) {
    featuredFilms = allFilms.slice(0, 4);
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
    media: mediaRes.data || [],
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
