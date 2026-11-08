import { supabase } from './supabase';

function parseDateOnly(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPlayDate(value) {
  const date = parseDateOnly(value);
  if (!date) return null;

  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getPlayDateLabel(play, fallback = 'Date TBA') {
  const start = formatPlayDate(play?.run_start_date);
  const end = formatPlayDate(play?.run_end_date);
  const time = String(play?.performance_time || '').trim();
  let label = start || end || (play?.year ? String(play.year) : fallback);

  if (start && end && play.run_start_date !== play.run_end_date) {
    label = `${start} - ${end}`;
  }

  return time && label !== fallback ? `${label}, ${time}` : label;
}

export const NGN_PER_GBP = 2000;
export const NGN_PER_USD = 1550;

/**
 * Format stage play box office with multi-currency support and estimation awareness.
 * Example outputs:
 * - For GBP £54,000 (Estimate):
 *   {
 *     primaryFormatted: '£54,000',
 *     convertedFormatted: '~₦108M est.',
 *     fullBadge: '£54,000 (~₦108M est.) Box Office',
 *     shortBadge: '£54,000 (~₦108M est.)',
 *     currencySymbol: '£',
 *     isEstimate: true,
 *     exchangeRateNote: '£1 ≈ ₦2,000 NGN est.'
 *   }
 */
export function formatPlayBoxOffice(play) {
  if (!play || !play.box_office_domestic || Number(play.box_office_domestic) <= 0) {
    return null;
  }

  const rawAmount = Number(play.box_office_domestic);
  const currency = (play.box_office_currency || 'NGN').toUpperCase();
  const source = String(play.box_office_source || '').toLowerCase();
  const isEstimate =
    source.includes('est') ||
    source.includes('project') ||
    play.box_office_metrics?.is_estimate === true ||
    play.box_office_metrics?.reporting_type === 'industry_projection';

  if (currency === 'GBP') {
    const primaryFormatted = `£${rawAmount.toLocaleString('en-GB')}`;
    const estNgn = rawAmount * NGN_PER_GBP;
    const estNgnMillion = (estNgn / 1_000_000).toFixed(estNgn >= 100_000_000 ? 0 : 1);
    const convertedFormatted = `~₦${estNgnMillion}M est.`;
    return {
      amount: rawAmount,
      currency: 'GBP',
      currencySymbol: '£',
      isEstimate,
      primaryFormatted,
      convertedFormatted,
      fullBadge: `${primaryFormatted} (${convertedFormatted}) Box Office`,
      shortBadge: `${primaryFormatted} (${convertedFormatted})`,
      sourceLabel: play.box_office_source || 'Industry Estimation',
    };
  }

  if (currency === 'USD') {
    const primaryFormatted = `$${rawAmount.toLocaleString('en-US')}`;
    const estNgn = rawAmount * NGN_PER_USD;
    const estNgnMillion = (estNgn / 1_000_000).toFixed(estNgn >= 100_000_000 ? 0 : 1);
    const convertedFormatted = `~₦${estNgnMillion}M est.`;
    return {
      amount: rawAmount,
      currency: 'USD',
      currencySymbol: '$',
      isEstimate,
      primaryFormatted,
      convertedFormatted,
      fullBadge: `${primaryFormatted} (${convertedFormatted}) Box Office`,
      shortBadge: `${primaryFormatted} (${convertedFormatted})`,
      sourceLabel: play.box_office_source || 'Industry Estimation',
    };
  }

  // Default NGN
  const primaryFormatted = `₦${rawAmount.toLocaleString('en-NG')}`;
  return {
    amount: rawAmount,
    currency: 'NGN',
    currencySymbol: '₦',
    isEstimate,
    primaryFormatted,
    convertedFormatted: null,
    fullBadge: isEstimate ? `${primaryFormatted} (Est.) Box Office` : `${primaryFormatted} Box Office`,
    shortBadge: isEstimate ? `${primaryFormatted} (Est.)` : primaryFormatted,
    sourceLabel: play.box_office_source || (isEstimate ? 'Industry Estimation' : 'Audited Theatre Gross'),
  };
}

/**
 * Derive the accurate live status ('upcoming' | 'currently_running' | 'archived')
 * based on the run dates relative to the current reference date.
 */
export function derivePlayStatus(play, refDate = new Date()) {
  const todayStr = (refDate instanceof Date ? refDate : new Date(refDate)).toISOString().slice(0, 10);
  const currentYear = (refDate instanceof Date ? refDate : new Date(refDate)).getFullYear();

  const start = play?.run_start_date ? String(play.run_start_date).slice(0, 10) : null;
  const end = play?.run_end_date ? String(play.run_end_date).slice(0, 10) : null;

  // Case 1: Both start and end dates exist
  if (start && end) {
    if (end < todayStr) return 'archived';
    if (start <= todayStr && end >= todayStr) return 'currently_running';
    return 'upcoming';
  }

  // Case 2: Only start date exists
  if (start && !end) {
    if (start < todayStr) return 'archived';
    if (start === todayStr) return 'currently_running';
    return 'upcoming';
  }

  // Case 3: Only end date exists
  if (!start && end) {
    if (end < todayStr) return 'archived';
    return 'currently_running';
  }

  // Case 4: No exact run dates — check year
  if (play?.year && Number(play.year) < currentYear) {
    return 'archived';
  }

  return play?.status || 'archived';
}

/**
 * Fetch stage plays with date-aware status derivation
 */
export async function fetchPlays(status = null) {
  const query = supabase
    .from('plays')
    .select('*')
    .order('run_start_date', { ascending: false, nullsFirst: false })
    .order('year', { ascending: false, nullsFirst: false });

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching plays:', error);
    return [];
  }

  // Derive live status on all plays
  const normalized = (data || []).map((play) => ({
    ...play,
    status: derivePlayStatus(play),
  }));

  if (status && status !== 'all') {
    return normalized.filter((play) => play.status === status);
  }

  return normalized;
}

/**
 * Fetch play details by slug with ensemble cast
 */
export async function fetchPlayBySlug(slug) {
  const { data: play, error } = await supabase
    .from('plays')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !play) {
    console.error('Error fetching play by slug:', error);
    return null;
  }

  // Fetch stage credits for this play
  const { data: credits, error: credError } = await supabase
    .from('stage_credits')
    .select(`
      *,
      person:people (
        id,
        name,
        slug,
        photo_url,
        known_for_department
      )
    `)
    .eq('play_id', play.id)
    .order('billing_order', { ascending: true });

  if (credError) {
    console.error('Error fetching stage credits:', credError);
  }

  // Fetch gallery photos and production stills for this play
  const { data: images, error: imgError } = await supabase
    .from('play_images')
    .select('*')
    .eq('play_id', play.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (imgError) {
    console.error('Error fetching play images:', imgError);
  }

  return {
    ...play,
    status: derivePlayStatus(play),
    credits: credits || [],
    images: images || []
  };
}

/**
 * Fetch stage plays for a specific actor / person
 */
export async function fetchPersonStageCredits(personId) {
  if (!personId) return [];

  const { data, error } = await supabase
    .from('stage_credits')
    .select(`
      *,
      play:plays (
        id,
        title,
        slug,
        playwright,
        director,
        venue,
        city,
        run_start_date,
        run_end_date,
        performance_time,
        year,
        poster_url,
        status,
        box_office_domestic,
        box_office_tickets_sold,
        box_office_currency,
        box_office_source,
        genre
      )
    `)
    .eq('person_id', personId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching person stage credits:', error);
    return [];
  }

  return (data || []).map(item => ({
    ...item.play,
    status: derivePlayStatus(item.play),
    role: item.role,
    character_name: item.character_name
  })).sort((a, b) => {
    const dateA = a.run_start_date || (a.year ? `${a.year}-01-01` : '');
    const dateB = b.run_start_date || (b.year ? `${b.year}-01-01` : '');
    return dateB.localeCompare(dateA);
  });
}

/**
 * Upsert stage play (Admin)
 */
export async function upsertPlay(playData) {
  const runStartDate = playData.run_start_date?.trim?.() || playData.run_start_date || null;
  const runEndDate = playData.run_end_date?.trim?.() || playData.run_end_date || null;
  const derivedYear = runStartDate ? Number(runStartDate.slice(0, 4)) : null;

  const derivedStatus = derivePlayStatus({
    ...playData,
    run_start_date: runStartDate,
    run_end_date: runEndDate,
  });

  const parseNumOrNull = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  };

  const parseTextOrNull = (val) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed === '' ? null : trimmed;
    }
    return val || null;
  };

  const payload = {
    title: playData.title?.trim() || '',
    slug: parseTextOrNull(playData.slug) || (playData.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    playwright: parseTextOrNull(playData.playwright),
    director: parseTextOrNull(playData.director),
    producer: parseTextOrNull(playData.producer),
    venue: parseTextOrNull(playData.venue),
    city: parseTextOrNull(playData.city) || 'Lagos',
    country: parseTextOrNull(playData.country) || 'Nigeria',
    poster_url: parseTextOrNull(playData.poster_url),
    banner_url: parseTextOrNull(playData.banner_url),
    synopsis: parseTextOrNull(playData.synopsis),
    genre: parseTextOrNull(playData.genre),
    year: derivedYear || parseNumOrNull(playData.year) || new Date().getFullYear(),
    run_start_date: runStartDate,
    run_end_date: runEndDate,
    performance_time: parseTextOrNull(playData.performance_time),
    source_url: parseTextOrNull(playData.source_url),
    status: playData.status || derivedStatus,
    box_office_domestic: parseNumOrNull(playData.box_office_domestic),
    box_office_tickets_sold: parseNumOrNull(playData.box_office_tickets_sold),
    box_office_currency: parseTextOrNull(playData.box_office_currency) || 'NGN',
    box_office_source: parseTextOrNull(playData.box_office_source),
    box_office_metrics: playData.box_office_metrics || null,
  };

  let result;
  if (playData.id) {
    const { data, error } = await supabase
      .from('plays')
      .update(payload)
      .eq('id', playData.id)
      .select()
      .single();

    if (error) throw error;
    result = data;
  } else {
    const { data, error } = await supabase
      .from('plays')
      .upsert(payload, { onConflict: 'slug' })
      .select()
      .single();

    if (error) throw error;
    result = data;
  }

  return {
    ...result,
    status: derivePlayStatus(result),
  };
}

/**
 * Add or update a stage credit (Admin)
 */
export async function upsertStageCredit(creditData) {
  const { data, error } = await supabase
    .from('stage_credits')
    .upsert(creditData, { onConflict: 'play_id,person_id,role' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a stage credit by id (Admin)
 */
export async function deleteStageCredit(creditId) {
  const { error } = await supabase
    .from('stage_credits')
    .delete()
    .eq('id', creditId);

  if (error) throw error;
  return true;
}

/**
 * Fetch stage gallery images / production stills for a play
 */
export async function fetchPlayImages(playId) {
  if (!playId) return [];
  const { data, error } = await supabase
    .from('play_images')
    .select('*')
    .eq('play_id', playId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching play images:', error);
    return [];
  }
  return data || [];
}

/**
 * Add a new image to a play's gallery (Admin)
 */
export async function addPlayImage(imageData) {
  const { data, error } = await supabase
    .from('play_images')
    .insert(imageData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a play image (Admin)
 */
export async function deletePlayImage(imageId) {
  const { error } = await supabase
    .from('play_images')
    .delete()
    .eq('id', imageId);

  if (error) throw error;
  return true;
}

/**
 * Update a play image (Admin)
 */
export async function updatePlayImage(imageId, updates) {
  const { data, error } = await supabase
    .from('play_images')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', imageId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

