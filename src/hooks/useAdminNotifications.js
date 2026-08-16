import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { authHeaders } from '../lib/apiAuth';

export function useAdminNotifications(enabled) {
  const [state, setState] = useState({
    totalCount: 0,
    cinemaCount: 0,
    claimCount: 0,
    notifications: [],
    loading: Boolean(enabled),
  });

  const refresh = useCallback(async () => {
    if (!enabled || !supabase) {
      setState({ totalCount: 0, cinemaCount: 0, claimCount: 0, notifications: [], loading: false });
      return;
    }

    const [cinemaCountResult, cinemaResult, claimCountResult, claimResult] = await Promise.all([
      supabase.from('pending_cinema_films').select('id', { count: 'exact', head: true }).is('admin_decision', null),
      supabase.from('pending_cinema_films').select('id,title,source,last_seen_at,showtime_count').is('admin_decision', null).order('last_seen_at', { ascending: false }).limit(4),
      supabase.from('profile_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profile_claims')
        .select('id,created_at,social_platform,social_handle,verification_status,people!profile_claims_person_id_fkey(name)')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(4),
    ]);

    const error = cinemaCountResult.error || cinemaResult.error || claimCountResult.error || claimResult.error;
    if (error) {
      console.error('Unable to load admin notifications:', error);
      setState((current) => ({ ...current, loading: false }));
      return;
    }

    const cinemaCount = cinemaCountResult.count ?? 0;
    const claimCount = claimCountResult.count ?? 0;
    const notifications = [
      ...(claimResult.data || []).map((item) => ({
        id: `claim-${item.id}`,
        type: 'actor_claim',
        title: item.people?.name || 'Actor profile claim',
        detail: `${item.social_handle} on ${item.social_platform}`,
        time: item.created_at,
        href: '/admin/claims',
      })),
      ...(cinemaResult.data || []).map((item) => ({
        id: `cinema-${item.id}`,
        type: 'cinema',
        title: item.title,
        detail: item.source?.replace(/[_-]+/g, ' ') || 'Cinema scraper',
        badge: item.showtime_count || 0,
        time: item.last_seen_at,
        href: '/admin/cinema-films',
      })),
    ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)).slice(0, 6);

    setState({ totalCount: cinemaCount + claimCount, cinemaCount, claimCount, notifications, loading: false });
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled || !supabase) return undefined;

    const channel = supabase
      .channel('admin-dashboard-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_cinema_films' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_claims' }, refresh)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    void authHeaders()
      .then((headers) => fetch('/api/actor-claims', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'notify-pending-claims' }),
      }))
      .catch((error) => console.warn('Unable to retry pending claim alerts:', error));
  }, [enabled]);

  return { ...state, refresh };
}
