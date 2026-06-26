import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { CONTRIBUTION_LABELS } from '../../lib/contributions';
import { signedContributionUrl, publishContributionImage, deleteContributionImage } from '../../lib/imageUpload';

// Map a single submitted social URL to the right people.* column.
function socialField(url = '') {
  const s = url.toLowerCase();
  if (/instagram/.test(s)) return 'instagram_url';
  if (/twitter|x\.com/.test(s)) return 'twitter_url';
  if (/facebook|fb\.com/.test(s)) return 'facebook_url';
  return 'instagram_url';
}

const TYPE_STYLE = {
  new_person: { icon: 'solar:user-plus-bold', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  edit_person: { icon: 'solar:pen-2-bold', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  edit_film: { icon: 'solar:pen-2-bold', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  report_link: { icon: 'solar:flag-bold', color: 'text-red-500', bg: 'bg-red-500/10' },
  report_channel: { icon: 'solar:flag-bold', color: 'text-red-500', bg: 'bg-red-500/10' },
};

export default function AdminContributions() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [signedUrls, setSignedUrls] = useState({}); // contribution id -> preview URL
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contributions')
        .select('*, users:submitted_by (name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);

      // Resolve short-lived preview URLs for any quarantined images.
      const withImg = (data || []).filter((d) => d.image_path);
      const entries = await Promise.all(
        withImg.map(async (d) => [d.id, await signedContributionUrl(d.image_path)])
      );
      setSignedUrls(Object.fromEntries(entries.filter(([, url]) => url)));
    } catch (e) {
      console.error('Error fetching contributions:', e);
      toast.error('Failed to load the queue');
    } finally {
      setIsLoading(false);
    }
  };

  const markReviewed = async (item, status) => {
    const { error } = await supabase
      .from('contributions')
      .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), note: status === 'rejected' ? (rejectReason || item.note) : item.note })
      .eq('id', item.id);
    if (error) throw error;
  };

  // Approve. For new_person we actually create the row; everything else is an
  // acknowledgement (the admin applies free-text edits / actions the report
  // manually via the linked record) — we don't auto-apply unstructured text.
  const handleApprove = async (item) => {
    setBusyId(item.id);
    try {
      if (item.type === 'new_person') {
        const p = item.payload || {};
        // Re-encode + publish the quarantined image to the public bucket.
        const photoUrl = item.image_path ? await publishContributionImage(item.image_path) : null;
        const insert = {
          name: p.name,
          gender: p.sex || null,
          date_of_birth: p.date_of_birth || null,
          photo_url: photoUrl,
          bio: [p.bio, p.films ? `Filmography (community-submitted): ${p.films}` : null]
            .filter(Boolean).join('\n\n') || null,
          source: 'community',
          needs_review: true,
        };
        if (p.social_link) insert[socialField(p.social_link)] = p.social_link;

        const { error: insErr } = await supabase.from('people').insert(insert);
        if (insErr) throw insErr;
      }
      await markReviewed(item, 'approved');
      // Remove the quarantined upload now that moderation is complete.
      if (item.image_path) await deleteContributionImage(item.image_path);
      toast.success(item.type === 'new_person' ? 'Person created ✓' : 'Approved');
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      console.error('Approve failed:', e);
      toast.error(e.message || 'Could not approve');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (item) => {
    setBusyId(item.id);
    try {
      await markReviewed(item, 'rejected');
      if (item.image_path) await deleteContributionImage(item.image_path);
      toast.success('Rejected');
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setRejectingId(null);
      setRejectReason('');
    } catch (e) {
      console.error('Reject failed:', e);
      toast.error('Could not reject');
    } finally {
      setBusyId(null);
    }
  };

  const recordLink = (item) => {
    if (item.target_table === 'films') return `/films/${item.target_id}`;
    if (item.target_table === 'people') return `/people/${item.target_id}`;
    if (item.target_table === 'youtube_channels') return `/channels/${item.target_id}`;
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 bg-surface-2 animate-pulse rounded-lg" />
        {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-surface-2 animate-pulse rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Review Queue</p>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Community Contributions</h1>
            <span className="bg-brand/10 text-brand px-3 py-1 rounded-full text-xs font-bold border border-brand/20">
              {items.length} pending
            </span>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="card-cal flex flex-col items-center justify-center py-24 text-center border border-border rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-6">
            <Icon icon="solar:check-circle-bold" width="32" />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">Queue empty</h3>
          <p className="text-text-muted text-sm max-w-xs">No community submissions are waiting for review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const style = TYPE_STYLE[item.type] || TYPE_STYLE.edit_film;
            const link = recordLink(item);
            return (
              <div key={item.id} className="border border-border rounded-2xl p-6 bg-surface space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${style.bg} ${style.color}`}>
                      <Icon icon={style.icon} width="18" />
                    </span>
                    <div>
                      <p className="text-text-primary font-bold text-sm">{CONTRIBUTION_LABELS[item.type] || item.type}</p>
                      <p className="text-text-muted text-[11px]">
                        by {item.users?.name || item.users?.email || 'Unknown'} · {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {link && (
                    <Link to={link} target="_blank" rel="noopener noreferrer" className="text-brand text-xs font-bold hover:underline">
                      View record →
                    </Link>
                  )}
                </div>

                {/* Payload */}
                <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
                  <div className="bg-surface-2 rounded-xl p-4 text-sm space-y-1.5">
                    {Object.entries(item.payload || {}).map(([k, v]) =>
                      v ? (
                        <div key={k} className="flex gap-2">
                          <span className="text-text-muted font-bold capitalize min-w-[90px]">{k.replace(/_/g, ' ')}:</span>
                          <span className="text-text-primary whitespace-pre-wrap">{String(v)}</span>
                        </div>
                      ) : null
                    )}
                    {item.note && (
                      <div className="flex gap-2 pt-1 border-t border-border mt-2">
                        <span className="text-text-muted font-bold min-w-[90px]">Note:</span>
                        <span className="text-text-primary italic">{item.note}</span>
                      </div>
                    )}
                  </div>
                  {signedUrls[item.id] && (
                    <a href={signedUrls[item.id]} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img src={signedUrls[item.id]} alt="" className="w-28 h-28 object-cover rounded-xl border border-border" />
                    </a>
                  )}
                </div>

                {/* Actions */}
                {rejectingId === item.id ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="flex-1 bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm focus:border-red-500 outline-none"
                    />
                    <button onClick={() => handleReject(item)} disabled={busyId === item.id}
                      className="bg-red-500 text-white font-bold px-5 py-2.5 rounded-lg text-xs hover:bg-red-600 disabled:opacity-50">
                      Confirm reject
                    </button>
                    <button onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      className="text-text-muted font-bold px-3 text-xs">Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => handleApprove(item)} disabled={busyId === item.id}
                      className="bg-brand text-white font-bold px-6 py-2.5 rounded-lg text-xs hover:opacity-90 disabled:opacity-50">
                      {item.type === 'new_person' ? 'Approve & create' : 'Approve'}
                    </button>
                    <button onClick={() => setRejectingId(item.id)} disabled={busyId === item.id}
                      className="border border-border bg-surface-2 text-text-muted font-bold px-6 py-2.5 rounded-lg text-xs hover:text-red-500 hover:border-red-500/30 disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
