import { supabase } from './supabase';

/**
 * Fetch all verified film critics ordered by name
 */
export async function fetchCritics() {
  const { data: critics, error } = await supabase
    .from('critics')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching critics:', error);
    return [];
  }

  // Also count reviews per critic
  const { data: reviews } = await supabase
    .from('critic_reviews')
    .select('critic_name, critic_id');

  const counts = {};
  (reviews || []).forEach(r => {
    if (r.critic_id) {
      counts[r.critic_id] = (counts[r.critic_id] || 0) + 1;
    }
  });

  return (critics || []).map(c => ({
    ...c,
    review_count: counts[c.id] || 0
  }));
}

/**
 * Fetch a single critic by slug with all their linked reviews & films
 */
export async function fetchCriticBySlug(slug) {
  const { data: critic, error } = await supabase
    .from('critics')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !critic) {
    console.error('Error fetching critic by slug:', error);
    return null;
  }

  // Fetch reviews linked via critic_id or matching critic_name
  const { data: reviews, error: revError } = await supabase
    .from('critic_reviews')
    .select(`
      *,
      film:films (
        id,
        title,
        year,
        poster_url,
        backdrop_url,
        slug
      )
    `)
    .or(`critic_id.eq.${critic.id},critic_name.ilike.%${critic.name}%`)
    .order('created_at', { ascending: false });

  if (revError) {
    console.error('Error fetching critic reviews:', revError);
  }

  return {
    ...critic,
    reviews: reviews || []
  };
}

/**
 * Upsert a critic record (Admin)
 */
export async function upsertCritic(criticData) {
  const payload = {
    ...criticData,
    slug: criticData.slug || criticData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  };

  const { data, error } = await supabase
    .from('critics')
    .upsert(payload, { onConflict: 'slug' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a critic record (Admin)
 */
export async function deleteCritic(criticId) {
  const { error } = await supabase
    .from('critics')
    .delete()
    .eq('id', criticId);

  if (error) throw error;
  return true;
}
