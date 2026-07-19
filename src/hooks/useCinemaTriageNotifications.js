import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useCinemaTriageNotifications(enabled) {
  const [pendingCount, setPendingCount] = useState(0);
  const [latestPending, setLatestPending] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));

  const refresh = useCallback(async () => {
    if (!enabled || !supabase) {
      setPendingCount(0);
      setLatestPending([]);
      setLoading(false);
      return;
    }

    const [countResult, latestResult] = await Promise.all([
      supabase
        .from('pending_cinema_films')
        .select('id', { count: 'exact', head: true })
        .is('admin_decision', null),
      supabase
        .from('pending_cinema_films')
        .select('id,title,source,last_seen_at,showtime_count')
        .is('admin_decision', null)
        .order('last_seen_at', { ascending: false })
        .limit(4),
    ]);

    if (countResult.error || latestResult.error) {
      console.error('Unable to load cinema triage notifications:', countResult.error || latestResult.error);
    } else {
      setPendingCount(countResult.count ?? 0);
      setLatestPending(latestResult.data ?? []);
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled || !supabase) return undefined;

    const channel = supabase
      .channel('admin-cinema-triage-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_cinema_films' }, refresh)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [enabled, refresh]);

  return { pendingCount, latestPending, loading, refresh };
}
