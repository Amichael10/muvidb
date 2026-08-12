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

/**
 * Fetch stage plays with optional status filtering
 */
export async function fetchPlays(status = null) {
  let query = supabase
    .from('plays')
    .select('*')
    .order('run_start_date', { ascending: false, nullsFirst: false })
    .order('year', { ascending: false, nullsFirst: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching plays:', error);
    return [];
  }
  return data || [];
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

  return {
    ...play,
    credits: credits || []
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
        status
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
  const runStartDate = playData.run_start_date || null;
  const runEndDate = playData.run_end_date || null;
  const derivedYear = runStartDate ? Number(runStartDate.slice(0, 4)) : null;

  const payload = {
    ...playData,
    run_start_date: runStartDate,
    run_end_date: runEndDate,
    performance_time: playData.performance_time?.trim() || null,
    source_url: playData.source_url?.trim() || null,
    year: derivedYear || (playData.year ? Number(playData.year) : null),
    slug: playData.slug || playData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  };

  const { data, error } = await supabase
    .from('plays')
    .upsert(payload, { onConflict: 'slug' })
    .select()
    .single();

  if (error) throw error;
  return data;
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
