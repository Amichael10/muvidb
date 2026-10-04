import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useFollow = (personId, currentUser) => {
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!personId) return
    fetchFollowData()
  }, [personId, currentUser?.id])

  const fetchFollowData = async () => {
    // Get follower count
    const { count } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', personId)

    setFollowerCount(count || 0)

    // Check if current user follows
    if (!currentUser?.id) return

    const { data } = await supabase
      .from('follows')
      .select('user_id')
      .eq('user_id', currentUser.id)
      .eq('person_id', personId)
      .single()

    setIsFollowing(!!data)
  }

  const toggleFollow = async () => {
    if (!currentUser?.id || !personId) return false

    setLoading(true)

    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('person_id', personId)

      if (error) {
        console.error('Failed to unfollow:', error)
        setLoading(false)
        return false
      }

      setIsFollowing(false)
      setFollowerCount(prev => Math.max(0, prev - 1))
    } else {
      let insertRes = await supabase
        .from('follows')
        .insert({
          user_id: currentUser.id,
          person_id: personId
        })

      // If failed due to missing user in public.users (foreign key 23503), sync user and retry
      if (insertRes.error && insertRes.error.code === '23503') {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (token) {
          await fetch('/api/whatsapp?action=sync-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }).catch(() => {})

          insertRes = await supabase
            .from('follows')
            .insert({
              user_id: currentUser.id,
              person_id: personId
            })
        }
      }

      if (insertRes.error) {
        console.error('Follow failed:', insertRes.error)
        setLoading(false)
        return false
      }

      setIsFollowing(true)
      setFollowerCount(prev => prev + 1)
    }

    setLoading(false)
    return true
  }

  return {
    isFollowing,
    followerCount,
    loading,
    toggleFollow
  }
}