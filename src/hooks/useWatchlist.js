import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/** Persist watched flag on a watchlist row owned by `userId`. */
export async function setWatchlistWatched(userId, filmId, watched) {
  if (!userId || !filmId) return { error: new Error('Missing user or film') }
  return supabase
    .from('watchlist')
    .update({
      watched: !!watched,
      watched_at: watched ? new Date().toISOString() : null,
    })
    .eq('user_id', userId)
    .eq('film_id', filmId)
}

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