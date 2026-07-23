import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import {
  CONTRIBUTION_LABELS,
  PERSON_EDIT_FIELDS,
  FILM_EDIT_FIELDS,
} from '../../lib/contributions';
import { signedContributionUrl, publishContributionImage, deleteContributionImage } from '../../lib/imageUpload';

// Map a single submitted social URL to the right people.* column.
function socialField(url = '') {
  const s = url.toLowerCase();
  if (/instagram/.test(s)) return 'instagram_url';
  if (/twitter|x\.com/.test(s)) return 'twitter_url';
  if (/facebook|fb\.com/.test(s)) return 'facebook_url';
  if (/tiktok/.test(s)) return 'tiktok_url';
  return 'instagram_url';
}

const TYPE_STYLE = {
  new_person: { icon: 'solar:user-plus-bold', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  edit_person: { icon: 'solar:pen-2-bold', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  edit_film: { icon: 'solar:pen-2-bold', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  report_link: { icon: 'solar:flag-bold', color: 'text-red-500', bg: 'bg-red-500/10' },
  report_channel: { icon: 'solar:flag-bold', color: 'text-red-500', bg: 'bg-red-500/10' },
};

const PERSON_LABELS = Object.fromEntries(PERSON_EDIT_FIELDS.map((f) => [f.key, f.label]));
const FILM_LABELS = Object.fromEntries(FILM_EDIT_FIELDS.map((f) => [f.key, f.label]));

function fieldLabel(type, key) {
  if (key === 'photo' || key === 'poster' || key === 'image') {
    return type === 'edit_film' ? 'Poster' : 'Photo';
  }
  if (type === 'edit_film') return FILM_LABELS[key] || key.replace(/_/g, ' ');
  return PERSON_LABELS[key] || key.replace(/_/g, ' ');
}

/** Proposed structured fields + whether an image was attached. */
function proposedParts(item) {
  const p = item.payload || {};
  const fields = { ...(p.fields || {}) };
  // Legacy free-text only
  const legacyNote = p.changes || p.note || item.note || null;
  const hasImage = !!item.image_path;
  return { fields, legacyNote, hasImage, isStructured: Object.keys(fields).length > 0 || hasImage };
}

function defaultSelection(item) {
  const { fields, hasImage } = proposedParts(item);
  const sel = {};
  for (const k of Object.keys(fields)) sel[k] = true;
  if (hasImage) sel.__image = true;
  // new_person: select every payload key + image
  if (item.type === 'new_person') {
    for (const [k, v] of Object.entries(item.payload || {})) {
      if (v != null && String(v).trim() !== '') sel[k] = true;
    }
    if (hasImage) sel.__image = true;
  }
  return sel;
}

function coerceFilmUpdate(fields) {
  const update = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'year' || k === 'runtime_minutes') {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      update[k] = Math.round(n);
    } else if (k === 'countries') {
      update.countries = String(v)
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      update[k] = v;
    }
  }
  return update;
}

export default function AdminContributions() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [signedUrls, setSignedUrls] = useState({}); // contribution id -> preview URL
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selection, setSelection] = useState({}); // id -> { fieldKey: bool }

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

      const sel = {};
      for (const d of data || []) sel[d.id] = defaultSelection(d);
      setSelection(sel);

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

  const markReviewed = async (item, status, extraNote) => {
    const note =
      status === 'rejected'
        ? (rejectReason || item.note)
        : (extraNote || item.note);
    const { error } = await supabase
      .from('contributions')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        note,
      })
      .eq('id', item.id);
    if (error) throw error;
  };

  const toggleField = (itemId, key) => {
    setSelection((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [key]: !prev[itemId]?.[key] },
    }));
  };

  const setAllFields = (itemId, value, keys) => {
    setSelection((prev) => {
      const next = { ...prev[itemId] };
      for (const k of keys) next[k] = value;
      return { ...prev, [itemId]: next };
    });
  };

  const handleApprove = async (item) => {
    setBusyId(item.id);
    try {
      const sel = selection[item.id] || {};
      let appliedSummary = '';

      if (item.type === 'new_person') {
        const p = item.payload || {};
        const photoUrl =
          sel.__image && item.image_path
            ? await publishContributionImage(item.image_path, 'people')
            : null;
        const insert = {
          name: sel.name !== false ? p.name : null,
          source: 'community',
          needs_review: true,
        };
        if (!insert.name) throw new Error('Name must be selected to create a person.');
        if (sel.sex && p.sex) insert.gender = p.sex;
        if (sel.date_of_birth && p.date_of_birth) insert.date_of_birth = p.date_of_birth;
        if (photoUrl) insert.photo_url = photoUrl;
        const bioBits = [];
        if (sel.bio && p.bio) bioBits.push(p.bio);
        if (sel.films && p.films) bioBits.push(`Filmography (community-submitted): ${p.films}`);
        if (bioBits.length) insert.bio = bioBits.join('\n\n');
        if (sel.social_link && p.social_link) insert[socialField(p.social_link)] = p.social_link;

        const { error: insErr } = await supabase.from('people').insert(insert);
        if (insErr) throw insErr;
        appliedSummary = `Created person with: ${Object.keys(insert).join(', ')}`;
      } else if (item.type === 'edit_person' || item.type === 'edit_film') {
        const { fields, hasImage, legacyNote, isStructured } = proposedParts(item);

        if (!isStructured && legacyNote) {
          // Legacy free-text: acknowledge only — nothing safe to auto-apply.
          await markReviewed(item, 'approved', `Legacy free-text (manual apply): ${legacyNote}`);
          if (item.image_path) await deleteContributionImage(item.image_path);
          toast.success('Approved (apply free-text manually via View record)');
          setItems((prev) => prev.filter((x) => x.id !== item.id));
          return;
        }

        if (!item.target_id) throw new Error('Missing target record.');

        const picked = {};
        for (const [k, v] of Object.entries(fields)) {
          if (sel[k]) picked[k] = v;
        }
        const wantImage = !!(sel.__image && hasImage);

        if (!Object.keys(picked).length && !wantImage) {
          toast.error('Select at least one field (or the image) to apply.');
          return;
        }

        const update = item.type === 'edit_film' ? coerceFilmUpdate(picked) : { ...picked };

        if (wantImage) {
          const folder = item.type === 'edit_film' ? 'posters' : 'people';
          const url = await publishContributionImage(item.image_path, folder);
          if (!url) throw new Error('Could not publish the uploaded image.');
          if (item.type === 'edit_film') update.poster_url = url;
          else update.photo_url = url;
        }

        const table = item.type === 'edit_film' ? 'films' : 'people';
        const { error: upErr } = await supabase.from(table).update(update).eq('id', item.target_id);
        if (upErr) throw upErr;

        appliedSummary = `Applied: ${Object.keys(update).join(', ')}`;
      } else {
        // Reports — acknowledgement only
        appliedSummary = 'Report acknowledged';
      }

      await markReviewed(item, 'approved', appliedSummary || item.note);
      // Delete quarantine image only if we published it OR admin didn't keep it
      // (always clean up after review).
      if (item.image_path) await deleteContributionImage(item.image_path);
      toast.success(
        item.type === 'new_person'
          ? 'Person created ✓'
          : item.type === 'edit_person' || item.type === 'edit_film'
            ? 'Selected fields applied ✓'
            : 'Approved'
      );
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
            const { fields, legacyNote, hasImage, isStructured } = proposedParts(item);
            const sel = selection[item.id] || {};
            const isEdit = item.type === 'edit_person' || item.type === 'edit_film';
            const isNew = item.type === 'new_person';
            const selectableKeys = isNew
              ? [
                  ...Object.keys(item.payload || {}).filter(
                    (k) => item.payload[k] != null && String(item.payload[k]).trim() !== ''
                  ),
                  ...(hasImage ? ['__image'] : []),
                ]
              : [...Object.keys(fields), ...(hasImage ? ['__image'] : [])];

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

                {/* Structured field picker (edits + new person) */}
                {(isEdit || isNew) && (isStructured || isNew) ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-text-muted text-[11px] font-bold uppercase tracking-wide">
                        Tick what to apply
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAllFields(item.id, true, selectableKeys)}
                          className="text-[10px] font-bold text-brand hover:underline"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllFields(item.id, false, selectableKeys)}
                          className="text-[10px] font-bold text-text-muted hover:underline"
                        >
                          Select none
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      {hasImage && (
                        <label className="flex items-start gap-3 bg-surface-2 rounded-xl p-3 cursor-pointer border border-transparent hover:border-brand/30 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!sel.__image}
                            onChange={() => toggleField(item.id, '__image')}
                            className="mt-1 accent-[var(--color-brand,#e11d48)]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary text-sm font-bold">
                              {item.type === 'edit_film' ? 'Poster' : 'Photo'}
                            </p>
                            {signedUrls[item.id] && (
                              <a href={signedUrls[item.id]} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
                                <img src={signedUrls[item.id]} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" />
                              </a>
                            )}
                          </div>
                        </label>
                      )}

                      {isNew
                        ? Object.entries(item.payload || {}).map(([k, v]) =>
                            v != null && String(v).trim() !== '' ? (
                              <label
                                key={k}
                                className="flex items-start gap-3 bg-surface-2 rounded-xl p-3 cursor-pointer border border-transparent hover:border-brand/30 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!sel[k]}
                                  onChange={() => toggleField(item.id, k)}
                                  className="mt-1 accent-[var(--color-brand,#e11d48)]"
                                />
                                <div className="min-w-0">
                                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-wide">
                                    {k.replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-text-primary text-sm whitespace-pre-wrap break-words">{String(v)}</p>
                                </div>
                              </label>
                            ) : null
                          )
                        : Object.entries(fields).map(([k, v]) => (
                            <label
                              key={k}
                              className="flex items-start gap-3 bg-surface-2 rounded-xl p-3 cursor-pointer border border-transparent hover:border-brand/30 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={!!sel[k]}
                                onChange={() => toggleField(item.id, k)}
                                className="mt-1 accent-[var(--color-brand,#e11d48)]"
                              />
                              <div className="min-w-0">
                                <p className="text-text-muted text-[10px] font-bold uppercase tracking-wide">
                                  {fieldLabel(item.type, k)}
                                </p>
                                <p className="text-text-primary text-sm whitespace-pre-wrap break-words">{String(v)}</p>
                              </div>
                            </label>
                          ))}
                    </div>

                    {legacyNote && isEdit && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200">
                        <span className="font-bold">Note (not auto-applied): </span>
                        {legacyNote}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Legacy free-text or reports */
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
                      {isEdit && !isStructured && (
                        <p className="text-amber-500 text-[11px] font-bold pt-2">
                          Legacy free-text submission — approve acknowledges only; apply manually via View record.
                        </p>
                      )}
                    </div>
                    {signedUrls[item.id] && (
                      <a href={signedUrls[item.id]} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={signedUrls[item.id]} alt="" className="w-28 h-28 object-cover rounded-xl border border-border" />
                      </a>
                    )}
                  </div>
                )}

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
                      {item.type === 'new_person'
                        ? 'Approve & create'
                        : isEdit && isStructured
                          ? 'Apply selected'
                          : 'Approve'}
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
