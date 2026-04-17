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
    if (!currentUser?.id) return false

    setLoading(true)

    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('person_id', personId)

      setIsFollowing(false)
      setFollowerCount(prev => Math.max(0, prev - 1))
    } else {
      await supabase
        .from('follows')
        .insert({
          user_id: currentUser.id,
          person_id: personId
        })

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