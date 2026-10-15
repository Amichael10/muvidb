import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function WhatsAppHealth() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('Sign in to view delivery health.');
      const response = await fetch('/api/whatsapp?action=health', {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load delivery health.');
      if (!signal?.aborted) { setHealth(body); setError(''); }
    } catch (error) {
      if (error.name !== 'AbortError') setError(error.message);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const timer = setInterval(() => load(controller.signal), 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [load]);
  const issues = health ? [...health.failed, ...health.unconfirmed] : [];
  const rows = issues.length ? issues : health?.recent || [];
  const date = value => value ? new Date(value).toLocaleString() : '—';
  return (
    <section className="bg-surface border border-border rounded-2xl p-5 space-y-4" aria-label="WhatsApp delivery health">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">WhatsApp delivery</h2>
          <p className="text-sm text-text-muted">Accepted messages are confirmed only when Meta reports delivery.</p></div>
        <button type="button" onClick={() => load()} disabled={loading} className="text-sm border border-border rounded-lg px-3 py-2 disabled:opacity-50">{loading ? 'Checking…' : 'Refresh'}</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {health && <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[[health.failedCount, 'Failed'], [health.unconfirmedCount, 'Unconfirmed over 30 min'], [health.queueErrorCount, 'Queue errors']].map(([count, label]) => (
            <div key={label} className="rounded-xl border border-border p-3"><p className={`text-2xl font-bold ${count ? 'text-amber-400' : ''}`}>{count}</p><p className="text-xs text-text-muted">{label}</p></div>
          ))}
        </div>
        {!health.notificationsConfigured && <p role="status" className="text-sm text-amber-400">Telegram monitoring is not configured. Failures remain visible here.</p>}
        <p className="text-xs text-text-muted">Temporary Meta failures retry up to 3 total attempts. Unconfirmed messages and recipient, template or account errors need attention.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">{issues.length ? 'Delivery issues' : 'Recent WhatsApp alerts'}</caption>
            <thead><tr className="text-text-muted border-b border-border">{['Film', 'Delivery', 'Attempts', 'Details', 'Last attempt'].map(label => <th scope="col" key={label} className="p-2 font-medium">{label}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.id} className="border-b border-border">
              <td className="p-2">{row.films?.title || 'Unknown film'}</td>
              <td className="p-2 whitespace-nowrap">{row.status === 'sent' ? (issues.some(issue => issue.id === row.id) ? 'Unconfirmed' : 'Accepted') : row.status}</td>
              <td className="p-2">{row.attempts} / 3</td>
              <td className="p-2 min-w-48">{row.error_message || '—'}{row.next_retry_at && <p className="text-xs text-text-muted">Retry: {date(row.next_retry_at)}</p>}</td>
              <td className="p-2 whitespace-nowrap">{date(row.last_attempt_at)}</td>
            </tr>)}</tbody>
          </table>
          {!rows.length && <p className="py-4 text-sm text-text-muted">No WhatsApp alerts yet.</p>}
        </div>
        {health.queueErrors.map(row => <p key={row.film_id} className="text-sm text-amber-400">{row.films?.title || 'Queued film'}: {row.last_error}</p>)}
        <p className="text-xs text-text-muted">Checked {date(health.checkedAt)} · Refreshes every minute · Issues are checked by the five-minute worker.</p>
      </>}
    </section>
  );
}
