import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { formatViewCount } from '../../utils/youtube';

const CATEGORIES = [
  'Movies', 'Comedy', 'Series', 'Yoruba', 'Faith',
  'Celebrity', 'Network', 'Music', 'Studio', 'skit_maker',
];

const EMPTY_FORM = {
  name: '',
  channel_handle: '',
  channel_url: '',
  description: '',
  category: '',
  country: 'Nigeria',
  subscriber_count: '',
  thumbnail_url: '',
  banner_url: '',
  is_featured: false,
};

// ── People search widget ──────────────────────────────────────────────────────
function PeopleSearch({ value, onChange }) {
  // value = { id, name, photo_url } | null
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/people?search=${encodeURIComponent(query)}&limit=8`);
      const json = await res.json();
      setResults(json.people || []);
      setLoading(false);
      setOpen(true);
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const select = (person) => {
    onChange(person);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const clear = () => { onChange(null); setQuery(''); };

  return (
    <div ref={ref} className="relative">
      <label className="block text-[#7A8099] text-xs font-medium mb-1">
        Channel Owner
        <span className="ml-1 text-[#7A8099] font-normal">(links to person → auto producer credit on all their 30+ min films)</span>
      </label>

      {value ? (
        // Selected person chip
        <div className="flex items-center gap-3 bg-[#0A0F1E] border border-[#D4A017]/40 rounded-xl px-3 py-2">
          {value.photo_url
            ? <img src={value.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            : <div className="w-8 h-8 rounded-full bg-[#1C2440] flex items-center justify-center text-[#D4A017] font-bold text-sm flex-shrink-0">{value.name?.charAt(0)}</div>
          }
          <span className="text-[#F5F0E8] text-sm font-medium flex-1">{value.name}</span>
          <button type="button" onClick={clear} className="text-[#7A8099] hover:text-red-400 text-lg leading-none transition-colors">✕</button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search people by name…"
            className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none placeholder-[#7A8099]"
          />
          {loading && <p className="text-[#7A8099] text-xs mt-1">Searching…</p>}
          {open && results.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-[#13192B] border border-[#252D45] rounded-xl overflow-hidden shadow-2xl">
              {results.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => select(p)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1C2440] text-left transition-colors"
                >
                  {p.photo_url
                    ? <img src={p.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded-full bg-[#1C2440] flex items-center justify-center text-[#D4A017] font-bold text-sm flex-shrink-0">{p.name?.charAt(0)}</div>
                  }
                  <div className="min-w-0">
                    <p className="text-[#F5F0E8] text-sm font-medium truncate">{p.name}</p>
                    {p.known_for_department && <p className="text-[#7A8099] text-xs">{p.known_for_department}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChannelModal({ channel, onSave, onClose }) {
  const [form, setForm] = useState(channel ? {
    name: channel.name || '',
    channel_handle: channel.channel_handle || '',
    channel_url: channel.channel_url || '',
    description: channel.description || '',
    category: channel.category || '',
    country: channel.country || 'Nigeria',
    subscriber_count: channel.subscriber_count ?? '',
    thumbnail_url: channel.thumbnail_url || '',
    banner_url: channel.banner_url || '',
    is_featured: channel.is_featured || false,
  } : { ...EMPTY_FORM });

  // Owner is managed separately as a person object (not just a name string)
  const [owner, setOwner] = useState(
    channel?.owner_person_id
      ? { id: channel.owner_person_id, name: channel.owner_name || '', photo_url: null }
      : null,
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);

    const payload = {
      ...form,
      subscriber_count: form.subscriber_count === '' ? null : Number(form.subscriber_count),
      owner_person_id: owner?.id ?? null,
      owner_name:      owner?.name ?? null,
    };

    let err;
    if (channel) {
      ({ error: err } = await supabase.from('channels').update(payload).eq('id', channel.id));
    } else {
      ({ error: err } = await supabase.from('channels').insert(payload));
    }

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#13192B] border border-[#252D45] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#13192B] border-b border-[#252D45] px-6 py-4 flex items-center justify-between">
          <h2 className="text-[#F5F0E8] font-bold text-lg">
            {channel ? 'Edit Channel' : 'Add Channel'}
          </h2>
          <button onClick={onClose} className="text-[#7A8099] hover:text-[#F5F0E8] text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Owner search — full width, on top */}
          <PeopleSearch value={owner} onChange={setOwner} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Channel Name *',   name: 'name',             placeholder: 'e.g. Nollywood Inc.' },
              { label: 'Handle',           name: 'channel_handle',   placeholder: '@channelhandle' },
              { label: 'Channel URL',      name: 'channel_url',      placeholder: 'https://youtube.com/@...' },
              { label: 'Thumbnail URL',    name: 'thumbnail_url',    placeholder: 'https://...' },
              { label: 'Banner URL',       name: 'banner_url',       placeholder: 'https://...' },
              { label: 'Country',          name: 'country',          placeholder: 'Nigeria' },
              { label: 'Subscriber Count', name: 'subscriber_count', placeholder: '0', type: 'number' },
            ].map(f => (
              <div key={f.name}>
                <label className="block text-[#7A8099] text-xs font-medium mb-1">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  name={f.name}
                  value={form[f.name]}
                  onChange={handleChange}
                  placeholder={f.placeholder}
                  className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none placeholder-[#7A8099]"
                />
              </div>
            ))}
          </div>

          {/* Category */}
          <div>
            <label className="block text-[#7A8099] text-xs font-medium mb-1">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none"
            >
              <option value="">— None —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[#7A8099] text-xs font-medium mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none resize-none"
            />
          </div>

          {/* Featured */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_featured"
              checked={form.is_featured}
              onChange={handleChange}
              className="w-4 h-4 accent-[#D4A017]"
            />
            <span className="text-[#F5F0E8] text-sm">Featured channel (shown in top section)</span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#252D45] text-[#7A8099] hover:text-[#F5F0E8] text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#D4A017] text-black font-bold text-sm hover:bg-[#D4A017]/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : channel ? 'Save Changes' : 'Add Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FlagsModal({ channel, onClose }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('channel_flags')
      .select('id, reason, details, status, created_at')
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setFlags(data || []); setLoading(false); });
  }, [channel.id]);

  const resolveFlag = async (flagId) => {
    await supabase.from('channel_flags').update({ status: 'resolved' }).eq('id', flagId);
    setFlags(f => f.map(x => x.id === flagId ? { ...x, status: 'resolved' } : x));
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#13192B] border border-[#252D45] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="border-b border-[#252D45] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-[#F5F0E8] font-bold">Flags — {channel.name}</h2>
          <button onClick={onClose} className="text-[#7A8099] hover:text-[#F5F0E8] text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {loading ? (
            <p className="text-[#7A8099] text-sm text-center py-8">Loading…</p>
          ) : flags.length === 0 ? (
            <p className="text-[#7A8099] text-sm text-center py-8">No flags found.</p>
          ) : flags.map(flag => (
            <div key={flag.id} className="bg-[#0A0F1E] border border-[#252D45] rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[#F5F0E8] text-sm font-medium capitalize">{flag.reason?.replace(/_/g, ' ')}</p>
                  {flag.details && <p className="text-[#7A8099] text-xs mt-1">{flag.details}</p>}
                  <p className="text-[#7A8099] text-xs mt-1">{new Date(flag.created_at).toLocaleDateString()}</p>
                </div>
                {flag.status === 'pending' ? (
                  <button
                    onClick={() => resolveFlag(flag.id)}
                    className="text-xs bg-green-900/40 text-green-400 px-3 py-1 rounded-full hover:bg-green-900/60 transition-colors"
                  >
                    Resolve
                  </button>
                ) : (
                  <span className="text-xs text-[#7A8099] bg-[#1C2440] px-3 py-1 rounded-full">Resolved</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminChannels() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingChannel, setEditingChannel] = useState(null);  // null=closed, false=new, obj=edit
  const [flagChannel, setFlagChannel] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [syncResult, setSyncResult] = useState('');

  useEffect(() => {
    fetchChannels();
  }, [search]);

  const fetchChannels = async () => {
    setLoading(true);
    let query = supabase
      .from('channels')
      .select('id, name, channel_handle, channel_url, category, subscriber_count, thumbnail_url, is_featured, owner_name, videos_last_fetched_at')
      .order('subscriber_count', { ascending: false, nullsFirst: false });

    if (search) query = query.ilike('name', `%${search}%`);

    const { data } = await query;
    setChannels(data || []);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this channel? This cannot be undone.')) return;
    setDeleting(id);
    await supabase.from('channels').delete().eq('id', id);
    setChannels(c => c.filter(x => x.id !== id));
    setDeleting(null);
  };

  const handleSync = async (channel) => {
    setSyncingId(channel.id);
    setSyncResult('');
    try {
      const handle = channel.channel_handle?.replace(/^@/, '') || '';
      if (!handle) { setSyncResult('No channel handle set.'); setSyncingId(null); return; }

      // Fetch recent videos via YouTube API proxy
      const res = await fetch(
        `/api/youtube?part=snippet,contentDetails&channelId=${encodeURIComponent(channel.channel_url || '')}&type=video&order=date&maxResults=20`,
      );
      if (!res.ok) throw new Error(`YouTube API error ${res.status}`);
      const json = await res.json();
      const items = json.items || [];

      // Upsert into channel_videos
      if (items.length > 0) {
        const rows = items.map((item) => ({
          channel_id: channel.id,
          video_id: item.id?.videoId || item.snippet?.resourceId?.videoId,
          title: item.snippet?.title,
          thumbnail_url: item.snippet?.thumbnails?.medium?.url,
          published_at: item.snippet?.publishedAt,
        })).filter(r => r.video_id);

        await supabase.from('channel_videos').upsert(rows, { onConflict: 'channel_id,video_id' });
        await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', channel.id);
        setSyncResult(`Synced ${rows.length} video(s).`);
        fetchChannels();
      } else {
        setSyncResult('No videos returned from YouTube.');
      }
    } catch (err) {
      setSyncResult(`Sync failed: ${err.message}`);
    }
    setSyncingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">YouTube Channels</h1>
          <p className="text-[#7A8099] text-sm mt-1">{channels.length} channel{channels.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setEditingChannel(false)}
          className="bg-[#D4A017] text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-[#D4A017]/90 transition-colors"
        >
          + Add Channel
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search channels…"
          className="w-full max-w-sm bg-[#13192B] border border-[#252D45] rounded-xl px-4 py-2.5 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none placeholder-[#7A8099]"
        />
      </div>

      {syncResult && (
        <div className="mb-4 bg-[#13192B] border border-[#252D45] text-[#F5F0E8] text-sm px-4 py-3 rounded-xl">
          {syncResult}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#13192B] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">📺</p>
          <p className="text-[#F5F0E8] font-bold text-lg">No channels found</p>
          <p className="text-[#7A8099] text-sm mt-1">Add your first channel above</p>
        </div>
      ) : (
        <div className="bg-[#13192B] border border-[#252D45] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#252D45] text-[#7A8099] text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Channel</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Subscribers</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Last Synced</th>
                <th className="text-right px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch, i) => (
                <tr
                  key={ch.id}
                  className={`border-b border-[#252D45] last:border-0 hover:bg-[#1C2440]/40 transition-colors ${
                    i % 2 === 0 ? '' : 'bg-[#0A0F1E]/30'
                  }`}
                >
                  {/* Channel */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {ch.thumbnail_url ? (
                        <img src={ch.thumbnail_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#1C2440] flex items-center justify-center flex-shrink-0 text-[#D4A017] font-bold">
                          {ch.name?.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[#F5F0E8] font-medium truncate max-w-[180px]">{ch.name}</p>
                        {ch.channel_handle && (
                          <p className="text-[#7A8099] text-xs">@{ch.channel_handle.replace(/^@/, '')}</p>
                        )}
                        {ch.is_featured && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#D4A017]">★ Featured</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    {ch.category ? (
                      <span className="text-xs text-[#7A8099] bg-[#1C2440] px-2 py-0.5 rounded-full">
                        {ch.category}
                      </span>
                    ) : (
                      <span className="text-[#7A8099]">—</span>
                    )}
                  </td>

                  {/* Subscribers */}
                  <td className="px-4 py-3 hidden lg:table-cell text-[#7A8099]">
                    {ch.subscriber_count ? formatViewCount(ch.subscriber_count) : '—'}
                  </td>

                  {/* Last synced */}
                  <td className="px-4 py-3 hidden xl:table-cell text-[#7A8099] text-xs">
                    {ch.videos_last_fetched_at
                      ? new Date(ch.videos_last_fetched_at).toLocaleDateString()
                      : 'Never'}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSync(ch)}
                        disabled={syncingId === ch.id}
                        title="Sync videos from YouTube"
                        className="text-xs bg-blue-900/30 text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-900/50 disabled:opacity-50 transition-colors"
                      >
                        {syncingId === ch.id ? '⟳' : '↻ Sync'}
                      </button>
                      <button
                        onClick={() => setFlagChannel(ch)}
                        title="View flags"
                        className="text-xs bg-yellow-900/30 text-yellow-400 px-3 py-1.5 rounded-lg hover:bg-yellow-900/50 transition-colors"
                      >
                        🚩 Flags
                      </button>
                      <button
                        onClick={() => setEditingChannel(ch)}
                        className="text-xs bg-[#D4A017]/10 text-[#D4A017] px-3 py-1.5 rounded-lg hover:bg-[#D4A017]/20 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(ch.id)}
                        disabled={deleting === ch.id}
                        className="text-xs bg-red-900/30 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                      >
                        {deleting === ch.id ? '…' : 'Del'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Add modal */}
      {editingChannel !== null && (
        <ChannelModal
          channel={editingChannel || null}
          onSave={() => { setEditingChannel(null); fetchChannels(); }}
          onClose={() => setEditingChannel(null)}
        />
      )}

      {/* Flags modal */}
      {flagChannel && (
        <FlagsModal channel={flagChannel} onClose={() => setFlagChannel(null)} />
      )}
    </div>
  );
}
