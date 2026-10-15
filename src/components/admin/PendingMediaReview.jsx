import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { authHeaders } from '../../lib/apiAuth';
import { savePersonMedia } from '../../lib/personMedia';

export default function PendingMediaReview() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  async function load() {
    try {
      const response = await fetch('/api/person-media?status=pending', { headers: await authHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load submissions');
      setItems(result.data || []); setError('');
    } catch (failure) { setError(failure.message); }
  }
  useEffect(() => { load(); }, []);
  async function review(item, status) {
    setBusy(item.id);
    try {
      await savePersonMedia({ ...item, status }, 'PUT');
      setItems(previous => previous.filter(row => row.id !== item.id));
      toast.success(status === 'approved' ? 'Media approved and published' : 'Media rejected');
    } catch (failure) { toast.error(failure.message || 'Unable to review submission'); }
    finally { setBusy(null); }
  }
  return <details className="rounded-xl border border-border bg-surface p-4" open={items.length > 0}>
    <summary className="cursor-pointer text-sm font-bold text-text-primary">Media awaiting review ({items.length}{items.length === 50 ? '+' : ''})</summary>
    {error && <p className="mt-3 text-xs text-red-400">{error} <button type="button" onClick={load} className="underline">Retry</button></p>}
    {!error && !items.length && <p className="mt-3 text-xs text-text-muted">No pending media submissions.</p>}
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(item => <article key={item.id} className="rounded-lg border border-border p-3">
      <p className="text-xs font-bold text-text-primary">{item.people?.name}: {item.title}</p>
      <p className="mt-1 text-[10px] text-text-muted">{item.media_type} · {item.category?.replaceAll('_', ' ')}</p>
      {item.media_type === 'photo' && <img src={item.url} alt={item.title} loading="lazy" className="mt-2 h-32 w-full rounded object-contain" />}
      <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-brand underline">Open private preview</a>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy === item.id} onClick={() => review(item, 'approved')} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busy === item.id ? 'Saving…' : 'Approve'}</button>
        <button type="button" disabled={busy === item.id} onClick={() => review(item, 'rejected')} className="rounded bg-red-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Reject</button>
      </div>
    </article>)}</div>
  </details>;
}
