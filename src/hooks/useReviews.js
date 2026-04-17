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

        const { data } = await supabase
            .from('reviews')
            .select(`*, users(name, avatar_url)`)
            .eq('film_id', filmId)
            .order('created_at', { ascending: false })

        setReviews(data || [])

        if (currentUser?.id) {
            const existing = data?.find(r => r.user_id === currentUser.id)
            setUserReview(existing || null)
        }

        setLoading(false)
    }

    const submitReview = async (rating, body) => {
        if (!currentUser?.id) return false

        if (userReview) {
            await supabase
                .from('reviews')
                .update({ rating, body })
                .eq('id', userReview.id)
        } else {
            await supabase
                .from('reviews')
                .insert({
                    user_id: currentUser.id,
                    film_id: filmId,
                    rating,
                    body
                })
        }

        await fetchReviews()
        return true
    }

    const deleteReview = async (reviewId) => {
        await supabase
            .from('reviews')
            .delete()
            .eq('id', reviewId)

        await fetchReviews()
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