import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useReviews = (target, currentUser, optionalPlayId) => {
    let filmId = null
    let playId = null

    if (typeof target === 'object' && target !== null) {
        filmId = target.filmId || null
        playId = target.playId || null
    } else if (optionalPlayId) {
        playId = optionalPlayId
        filmId = target || null
    } else {
        filmId = target || null
    }

    const [reviews, setReviews] = useState([])            // real user reviews
    const [externalReviews, setExternalReviews] = useState([]) // youtube/tmdb, badged
    const [userReview, setUserReview] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!filmId && !playId) return
        fetchReviews()
    }, [filmId, playId])

    // Split a raw row set into real user reviews vs. third-party (badged) ones.
    const applyRows = (rows) => {
        const all = rows || []
        const isExternal = (r) => r.source && r.source !== 'user'
        const users = all.filter((r) => !isExternal(r))
        // External reviews: most-liked first (most helpful), not newest.
        const external = all
            .filter(isExternal)
            .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        setReviews(users)
        setExternalReviews(external)
        if (currentUser?.id) {
            setUserReview(users.find((r) => r.user_id === currentUser.id) || null)
        }
    }

    const fetchReviews = async () => {
        setLoading(true)
        try {
            const fetchDirect = async () => {
                let q = supabase
                    .from('reviews')
                    .select('*, users:user_id (name, avatar_url)')

                if (playId) {
                    q = q.eq('play_id', playId)
                } else if (filmId) {
                    q = q.eq('film_id', filmId)
                } else {
                    return []
                }

                const { data, error } = await q.order('created_at', { ascending: false })
                if (error) throw error
                return data || []
            }

            let rows = []
            if (playId || import.meta.env.DEV) {
                rows = await fetchDirect()
            } else {
                const res = await fetch(`/api/content?resource=film-reviews&filmId=${encodeURIComponent(filmId)}`)
                if (res.ok) {
                    ({ reviews: rows } = await res.json())
                } else {
                    rows = await fetchDirect()
                }
            }
            applyRows(rows)
        } catch (error) {
            console.error('Critical Fetch Fail:', error);
        } finally {
            setLoading(false)
        }
    }

    const submitReview = async (rating, bodyContent) => {
        if (!currentUser?.id) return false

        try {
            // Check if review exists and if it's within the 5-minute window
            if (userReview) {
                const createdTime = new Date(userReview.created_at).getTime();
                const now = Date.now();
                if (now - createdTime > 300000) { // 5 minutes
                    console.error('Edit window expired');
                    return false;
                }
            }

            const payload = {
                user_id: currentUser.id,
                rating,
                body: bodyContent,
                updated_at: new Date().toISOString()
            }

            if (playId) {
                payload.play_id = playId
                payload.film_id = null
            } else if (filmId) {
                payload.film_id = filmId
            }

            let query
            if (userReview?.id) {
                query = supabase.from('reviews').update(payload).eq('id', userReview.id)
            } else {
                query = supabase.from('reviews').insert([payload])
            }

            const { error } = await query
            if (error) throw error
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
        externalReviews,
        userReview,
        loading,
        submitReview,
        deleteReview,
        refetch: fetchReviews
    }
}
