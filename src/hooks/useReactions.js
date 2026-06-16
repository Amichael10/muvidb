import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useReactions = (filmId, currentUser, enabled = true) => {
    const [userReaction, setUserReaction] = useState(null); // 'like', 'dislike', or null
    const [likesCount, setLikesCount] = useState(0);
    const [dislikesCount, setDislikesCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);

    useEffect(() => {
        if (!filmId || !enabled || fetched) return;
        fetchReactions();
    }, [filmId, currentUser?.id, enabled, fetched]);

    const fetchReactions = async () => {
        try {
            // Fetch total counts using a single query and parsing results, or two count queries.
            // Using two count queries for simplicity, though a group by could be better.
            const { count: likes, error: errLikes } = await supabase
                .from('film_reactions')
                .select('*', { count: 'exact', head: true })
                .eq('film_id', filmId)
                .eq('reaction_type', 'like');

            const { count: dislikes, error: errDislikes } = await supabase
                .from('film_reactions')
                .select('*', { count: 'exact', head: true })
                .eq('film_id', filmId)
                .eq('reaction_type', 'dislike');

            if (!errLikes) setLikesCount(likes || 0);
            if (!errDislikes) setDislikesCount(dislikes || 0);

            // Fetch current user reaction
            if (currentUser?.id) {
                const { data, error } = await supabase
                    .from('film_reactions')
                    .select('reaction_type')
                    .eq('user_id', currentUser.id)
                    .eq('film_id', filmId)
                    .maybeSingle();
                
                if (!error && data) {
                    setUserReaction(data.reaction_type);
                } else {
                    setUserReaction(null);
                }
            } else {
                setUserReaction(null);
            }
            setFetched(true);
        } catch (err) {
            console.error('Error fetching reactions:', err);
        }
    };

    const toggleReaction = async (type) => {
        if (!currentUser?.id) return false;
        
        setLoading(true);
        const previousReaction = userReaction;
        
        try {
            if (previousReaction === type) {
                // If same type clicked, remove it (unlike/undislike)
                await supabase
                    .from('film_reactions')
                    .delete()
                    .eq('user_id', currentUser.id)
                    .eq('film_id', filmId);
                
                setUserReaction(null);
                if (type === 'like') setLikesCount(prev => Math.max(0, prev - 1));
                if (type === 'dislike') setDislikesCount(prev => Math.max(0, prev - 1));
            } else {
                // Changing to a different type (or from null)
                await supabase
                    .from('film_reactions')
                    .upsert({
                        user_id: currentUser.id,
                        film_id: filmId,
                        reaction_type: type
                    }, { onConflict: 'user_id, film_id' });
                
                setUserReaction(type);
                
                // Update local counts optimistically
                if (type === 'like') {
                    setLikesCount(prev => prev + 1);
                    if (previousReaction === 'dislike') setDislikesCount(prev => Math.max(0, prev - 1));
                } else if (type === 'dislike') {
                    setDislikesCount(prev => prev + 1);
                    if (previousReaction === 'like') setLikesCount(prev => Math.max(0, prev - 1));
                }
            }
        } catch (err) {
            console.error('Error toggling reaction:', err);
            // Revert on error
            setUserReaction(previousReaction);
        } finally {
            setLoading(false);
        }
        
        return true;
    };

    return {
        userReaction,
        likesCount,
        dislikesCount,
        loading,
        toggleReaction
    };
};
