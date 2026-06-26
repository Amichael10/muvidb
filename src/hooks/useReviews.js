import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useReviews = (filmId, currentUser) => {
    const [reviews, setReviews] = useState([])
    const [userReview, setUserReview] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!filmId) return
        fetchReviews()
    }, [filmId])

    const fetchReviews = async () => {
        setLoading(true)
        try {
            // Attempt to fetch with users join. 
            // If it fails, fallback to simple select.
            const { data, error } = await supabase
                .from('reviews')
                .select(`
                    *,
                    users:user_id (
                        name,
                        avatar_url
                    )
                `) 
                .eq('film_id', filmId)
                .order('created_at', { ascending: false })

            if (error) {
                console.warn('Profile join failed, falling back to basic review fetch:', error);
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('reviews')
                    .select('*')
                    .eq('film_id', filmId)
                    .order('created_at', { ascending: false });
                
                if (fallbackError) throw fallbackError;
                setReviews(fallbackData || []);
                if (currentUser?.id) {
                    setUserReview(fallbackData?.find(r => r.user_id === currentUser.id) || null);
                }
            } else {
                setReviews(data || [])
                if (currentUser?.id) {
                    setUserReview(data?.find(r => r.user_id === currentUser.id) || null)
                }
            }
        } catch (error) {
            console.error('Critical Fetch Fail:', error);
        } finally {
            setLoading(false)
        }
    }

    const submitReview = async (rating, bodyContent) => {
        if (!currentUser?.id) return false

        try {
            // Check if review exists and if it's within the 2-minute window
            if (userReview) {
                const createdTime = new Date(userReview.created_at).getTime();
                const now = Date.now();
                if (now - createdTime > 300000) { // 5 minutes
                    console.error('Edit window expired');
                    return false;
                }
            }

            const { error } = await supabase
                .from('reviews')
                .upsert({
                    user_id: currentUser.id,
                    film_id: filmId,
                    rating,
                    body: bodyContent,
                    updated_at: new Date().toISOString()
                }, { 
                    onConflict: 'user_id, film_id' 
                });

            if (error) throw error;
            await fetchReviews()
            return true
        } catch (err) {
            console.error('Submit review failure:', err);
            return false
        }
    }

    const deleteReview = async (reviewId) => {
        if (!currentUser?.id) return false;
        
        try {
            // Fetch the review to check its creation time
            const { data: review, error: fetchError } = await supabase
                .from('reviews')
                .select('created_at, user_id')
                .eq('id', reviewId)
                .single();
            
            if (fetchError) throw fetchError;
            if (review.user_id !== currentUser.id) return false;

            const createdTime = new Date(review.created_at).getTime();
            const now = Date.now();
            if (now - createdTime > 300000) { // 5 minutes
                console.error('Delete window expired');
                return false;
            }

            const { error } = await supabase
                .from('reviews')
                .delete()
                .eq('id', reviewId)
                
            if (error) throw error;
            await fetchReviews()
            return true;
        } catch (err) {
            console.error('Delete review failure:', err);
            return false;
        }
    }

    return {
        reviews,
        userReview,
        loading,
        submitReview,
        deleteReview,
        refetch: fetchReviews
    }
}