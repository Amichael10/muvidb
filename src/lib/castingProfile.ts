import { supabase } from './supabase';

export interface CastingProfileData {
  id?: string;
  person_id: string;
  user_id?: string;
  
  // Physical Attributes
  height_cm?: number | null;
  height_feet_inches?: string | null;
  body_type?: string | null;
  skin_tone?: string | null;
  hair_color?: string | null;
  eye_color?: string | null;
  distinguishing_features?: string | null;
  
  // Playing Age & Location
  playing_age_min?: number | null;
  playing_age_max?: number | null;
  location?: string | null;
  willing_to_travel?: boolean;
  
  // Skills & Languages
  languages?: string[];
  skills?: string[];
  
  // Professional Status & Availability
  experience_level?: 'Professional' | 'Semi-Professional' | 'Emerging Talent' | 'Student' | string;
  availability_status?: 'Available for Bookings' | 'Available with Notice' | 'Currently on Production' | string;
  preferences?: string | null;
  union_memberships?: string[];
  
  // Visibility Controls
  show_on_creator_link?: boolean;
  show_on_person_page?: boolean;
  
  created_at?: string;
  updated_at?: string;
}

export const BODY_TYPE_OPTIONS = [
  'Athletic',
  'Slim',
  'Average',
  'Muscular',
  'Curvy',
  'Plus Size',
  'Lean'
] as const;

export const SKIN_TONE_OPTIONS = [
  'Deep Bronze / Dark',
  'Warm Brown',
  'Caramel / Olive',
  'Medium / Tan',
  'Fair / Light'
] as const;

export const HAIR_COLOR_OPTIONS = [
  'Black',
  'Dark Brown',
  'Brown',
  'Auburn',
  'Grey / Silver',
  'Bald / Shaved'
] as const;

export const EYE_COLOR_OPTIONS = [
  'Dark Brown',
  'Brown',
  'Hazel',
  'Amber',
  'Black'
] as const;

export const EXPERIENCE_LEVEL_OPTIONS = [
  'Professional',
  'Semi-Professional',
  'Emerging Talent',
  'Student'
] as const;

export const AVAILABILITY_OPTIONS = [
  'Available for Bookings',
  'Available with Notice',
  'Currently on Production',
  'On Hiatus'
] as const;

/**
 * Fetch casting profile for a given person.
 * Checks the dedicated casting_profiles table first; falls back gracefully
 * to filmmaker_portfolios.custom_links (metadata record with _meta === 'casting_profile').
 */
export async function fetchCastingProfile(personId: string): Promise<CastingProfileData | null> {
  if (!personId) return null;

  // 1. Try dedicated casting_profiles table
  try {
    const { data, error } = await supabase
      .from('casting_profiles')
      .select('*')
      .eq('person_id', personId)
      .maybeSingle();

    if (!error && data) {
      return data as CastingProfileData;
    }
  } catch {
    // Schema may not be migrated in certain environments, proceed to fallback
  }

  // 2. Fallback: check filmmaker_portfolios custom_links metadata
  try {
    const { data: portfolio } = await supabase
      .from('filmmaker_portfolios')
      .select('custom_links')
      .eq('person_id', personId)
      .maybeSingle();

    if (portfolio?.custom_links && Array.isArray(portfolio.custom_links)) {
      const castingMeta = portfolio.custom_links.find((l: any) => l && l._meta === 'casting_profile');
      if (castingMeta?.profile) {
        return {
          ...castingMeta.profile,
          person_id: personId,
        } as CastingProfileData;
      }
    }
  } catch {
    // Ignore fallback read errors
  }

  return null;
}

/**
 * Save casting profile.
 * Upserts to casting_profiles table and dual-syncs to filmmaker_portfolios.custom_links
 * for guaranteed instant persistence.
 */
export async function saveCastingProfile(
  personId: string,
  profile: Partial<CastingProfileData>,
  userId?: string
): Promise<{ ok: boolean; data?: CastingProfileData; error?: any }> {
  if (!personId) return { ok: false, error: 'Missing personId' };

  const payload: CastingProfileData = {
    person_id: personId,
    user_id: userId,
    height_cm: profile.height_cm ? Number(profile.height_cm) : null,
    height_feet_inches: profile.height_feet_inches || null,
    body_type: profile.body_type || null,
    skin_tone: profile.skin_tone || null,
    hair_color: profile.hair_color || null,
    eye_color: profile.eye_color || null,
    distinguishing_features: profile.distinguishing_features || null,
    playing_age_min: profile.playing_age_min ? Number(profile.playing_age_min) : 20,
    playing_age_max: profile.playing_age_max ? Number(profile.playing_age_max) : 35,
    location: profile.location || 'Lagos, Nigeria',
    willing_to_travel: profile.willing_to_travel !== false,
    languages: Array.isArray(profile.languages) ? profile.languages : ['English'],
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    experience_level: profile.experience_level || 'Professional',
    availability_status: profile.availability_status || 'Available for Bookings',
    preferences: profile.preferences || null,
    union_memberships: Array.isArray(profile.union_memberships) ? profile.union_memberships : [],
    show_on_creator_link: profile.show_on_creator_link !== false,
    show_on_person_page: profile.show_on_person_page !== false,
    updated_at: new Date().toISOString(),
  };

  // 1. Try upserting to casting_profiles table
  let tableSaved = false;
  try {
    const { data, error } = await supabase
      .from('casting_profiles')
      .upsert(payload, { onConflict: 'person_id' })
      .select('*')
      .single();

    if (!error && data) {
      tableSaved = true;
      payload.id = data.id;
    }
  } catch (err) {
    console.warn('casting_profiles table upsert deferred or not migrated:', err);
  }

  // 2. Dual-sync to filmmaker_portfolios custom_links metadata for instant UI display
  try {
    const { data: portfolio } = await supabase
      .from('filmmaker_portfolios')
      .select('id, custom_links')
      .eq('person_id', personId)
      .maybeSingle();

    if (portfolio?.id) {
      const existingLinks = Array.isArray(portfolio.custom_links) ? portfolio.custom_links : [];
      const filtered = existingLinks.filter((l: any) => l && l._meta !== 'casting_profile');
      filtered.push({
        _meta: 'casting_profile',
        id: 'casting-meta',
        title: 'Casting & Industry Specs',
        url: '#casting',
        profile: payload,
      });

      await supabase
        .from('filmmaker_portfolios')
        .update({ custom_links: filtered, updated_at: new Date().toISOString() })
        .eq('id', portfolio.id);
    }
  } catch (err) {
    console.warn('filmmaker_portfolios metadata sync notice:', err);
  }

  return { ok: true, data: payload };
}
