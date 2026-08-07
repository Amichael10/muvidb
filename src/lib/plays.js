import { supabase } from './supabase';

/**
 * Fetch stage plays with optional status filtering
 */
export async function fetchPlays(status = null) {
  let query = supabase
    .from('plays')
    .select('*')
    .order('year', { ascending: false });

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
  }));
}

/**
 * Upsert stage play (Admin)
 */
export async function upsertPlay(playData) {
  const payload = {
    ...playData,
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
