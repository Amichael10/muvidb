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

  // Also fetch review metadata (counts, average rating, latest review)
  const { data: reviews } = await supabase
    .from('critic_reviews')
    .select(`
      id,
      critic_id,
      rating,
      quote,
      created_at,
      film:films (
        id,
        title,
        year,
        poster_url,
        slug,
        genres
      )
    `)
    .order('created_at', { ascending: false });

  const stats = {};
  (reviews || []).forEach(r => {
    if (!r.critic_id) return;
    if (!stats[r.critic_id]) {
      stats[r.critic_id] = {
        count: 0,
        ratings: [],
        latestReview: r
      };
    }
    stats[r.critic_id].count += 1;
    if (r.rating !== null && r.rating !== undefined) {
      stats[r.critic_id].ratings.push(Number(r.rating));
    }
  });

  return (critics || []).map(c => {
    const criticStat = stats[c.id];
    const reviewCount = criticStat ? criticStat.count : 0;
    const ratings = criticStat ? criticStat.ratings : [];
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;

    return {
      ...c,
      review_count: reviewCount,
      avg_rating: avgRating,
      latest_review: criticStat?.latestReview || null
    };
  });
}

/**
 * Fetch a single critic by slug with all their linked reviews, films & plays
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
        slug,
        genres,
        runtime_minutes,
        content_type
      ),
      play:plays (
        id,
        title,
        year,
        poster_url,
        banner_url,
        slug,
        venue
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
  const { review_count, created_at, updated_at, ...validData } = criticData;
  const payload = {
    ...validData,
    slug: validData.slug || (validData.name ? validData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'critic'),
    updated_at: new Date().toISOString()
  };

  const onConflict = validData.id ? 'id' : 'slug';

  const { data, error } = await supabase
    .from('critics')
    .upsert(payload, { onConflict })
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

/**
 * Upsert a critic review (Admin)
 * Links a critic to a film with a quote, star rating, and optional source URL.
 */
export async function upsertCriticReview(reviewData) {
  const { data, error } = await supabase
    .from('critic_reviews')
    .upsert(reviewData, { onConflict: 'critic_id,film_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a single critic review by id (Admin)
 */
export async function deleteCriticReview(reviewId) {
  const { error } = await supabase
    .from('critic_reviews')
    .delete()
    .eq('id', reviewId);

  if (error) throw error;
  return true;
}
