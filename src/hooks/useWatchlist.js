import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useWatchlist = (filmId, currentUser) => {
    const [inWatchlist, setInWatchlist] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!filmId || !currentUser?.id) return
        checkWatchlist()
    }, [filmId, currentUser?.id])

    const checkWatchlist = async () => {
        const { data } = await supabase
            .from('watchlist')
            .select('film_id')
            .eq('user_id', currentUser.id)
            .eq('film_id', filmId)
            .single()

        setInWatchlist(!!data)
    }

    const toggleWatchlist = async () => {
        if (!currentUser?.id) return false

        setLoading(true)

        if (inWatchlist) {
            await supabase
                .from('watchlist')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('film_id', filmId)

            setInWatchlist(false)
        } else {
            await supabase
                .from('watchlist')
                .insert({
                    user_id: currentUser.id,
                    film_id: filmId
                })

            setInWatchlist(true)
        }

        setLoading(false)
        return true
    }

    return {
        inWatchlist,
        loading,
        toggleWatchlist
    }
}