import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatViewCount } from '../../utils/youtube';
import { toast } from 'react-hot-toast';

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

// --- People Search Component ---
function PeopleSearch({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
      try {
        const { data } = await supabase
          .from('people')
          .select('id, name, photo_url, known_for_department')
          .ilike('name', `%${query}%`)
          .limit(8);
        setResults(data || []);
        setOpen(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
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
      <label className="block text-text-muted text-xs font-bold mb-2 px-1">
        Channel Owner
      </label>

      {value ? (
        <div className="flex items-center gap-3 bg-surface-2 border border-brand/20 rounded-lg px-4 py-3 shadow-inner">
          {value.photo_url
            ? <img src={value.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
            : <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-brand font-bold">{value.name?.charAt(0)}</div>
          }
          <div className="flex-1 min-w-0">
            <span className="text-text-primary text-sm font-bold block truncate">{value.name}</span>
            <span className="text-text-muted text-xs font-medium">Linked Person</span>
          </div>
          <button type="button" onClick={clear} className="w-8 h-8 flex items-center justify-center rounded-md bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">✕</button>
        </div>
      ) : (
        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search for an owner..."
            className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none placeholder:text-text-muted/50 transition-all group-hover:border-border-hover"
          />
          {loading && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />}
          {open && results.length > 0 && (
            <div className="absolute z-[110] left-0 right-0 mt-2 bg-surface border border-border rounded-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
              {results.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => select(p)}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-surface-2 text-left transition-colors border-b border-border last:border-0"
                >
                  {p.photo_url
                    ? <img src={p.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
                    : <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-brand font-bold">{p.name?.charAt(0)}</div>
                  }
                  <div className="min-w-0">
                    <p className="text-text-primary text-sm font-bold truncate">{p.name}</p>
                    <p className="text-text-muted text-xs font-medium">{p.known_for_department || 'Person'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Channel Modal Component ---
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
    <div className="fixed inset-0 bg-overlay backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface border border-border rounded-md w-full max-w-2xl my-auto overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300">
        <div className="px-10 py-8 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-brand text-xs font-bold mb-1">Source Configuration</p>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">
              {channel ? 'Edit Channel' : 'Add Channel'}
            </h2>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-lg bg-surface-2 text-text-muted hover:text-text-primary transition-all border border-border hover:border-border-hover">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-10 py-8 space-y-8 custom-scrollbar max-h-[60vh]">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold px-6 py-4 rounded-lg flex items-center gap-3">
              <span className="text-lg">⚠️</span> {error}
            </div>
          )}

          <PeopleSearch value={owner} onChange={setOwner} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: 'Channel Name *',   name: 'name',             placeholder: 'e.g. Nollywood Inc.' },
              { label: 'Handle',           name: 'channel_handle',   placeholder: '@channelhandle' },
              { label: 'Channel URL',      name: 'channel_url',      placeholder: 'https://youtube.com/@...' },
              { label: 'Subscriber Count', name: 'subscriber_count', placeholder: '0', type: 'number' },
              { label: 'Thumbnail URL',    name: 'thumbnail_url',    placeholder: 'https://...' },
              { label: 'Banner URL',       name: 'banner_url',       placeholder: 'https://...' },
              { label: 'Country',          name: 'country',          placeholder: 'Nigeria' },
            ].map(f => (
              <div key={f.name}>
                <label className="block text-text-muted text-xs font-bold mb-2 px-1">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  name={f.name}
                  value={form[f.name]}
                  onChange={handleChange}
                  placeholder={f.placeholder}
                  className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none placeholder:text-text-muted/50 transition-all"
                />
              </div>
            ))}
            
            <div>
              <label className="block text-text-muted text-xs font-bold mb-2 px-1">Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none appearance-none"
              >
                <option value="">— Uncategorized —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-text-muted text-xs font-bold mb-2 px-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Primary channel scope and thematic overview..."
              className="w-full bg-surface-2 border border-border rounded-lg px-5 py-4 text-text-primary text-sm focus:border-brand focus:outline-none resize-none transition-all placeholder:text-text-muted/30"
            />
          </div>

          <label className="flex items-center gap-4 cursor-pointer group w-fit">
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${form.is_featured ? 'bg-brand border-brand' : 'border-border group-hover:border-brand/50'}`}>
              <input
                type="checkbox"
                name="is_featured"
                checked={form.is_featured}
                onChange={handleChange}
                className="hidden"
              />
              {form.is_featured && <span className="text-white font-black text-sm">✓</span>}
            </div>
            <span className="text-text-primary text-xs font-bold">Featured Source</span>
          </label>
        </form>

        <div className="px-10 py-8 border-t border-border bg-surface-2/30 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 rounded-lg border border-border text-text-muted font-bold text-xs hover:bg-surface-3 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-[2] py-4 rounded-lg bg-brand text-white font-bold text-xs hover:bg-brand-hover active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-brand/20"
          >
            {saving ? 'Saving...' : channel ? 'Save Changes' : 'Add Channel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Flags Modal Component ---
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
    const { error } = await supabase.from('channel_flags').update({ status: 'resolved' }).eq('id', flagId);
    if (!error) {
      setFlags(f => f.map(x => x.id === flagId ? { ...x, status: 'resolved' } : x));
      toast.success('Issue resolved');
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-md w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="px-8 py-6 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-brand text-xs font-bold mb-1">Issue History</p>
            <h2 className="text-xl font-bold text-text-primary">{channel.name}</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>
          ) : flags.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-4 opacity-30 text-text-muted">🛡️</p>
              <p className="text-text-primary font-bold text-xs">No Active Issues</p>
              <p className="text-text-muted text-xs mt-1">This channel is in compliance.</p>
            </div>
          ) : flags.map(flag => (
            <div key={flag.id} className="bg-surface-2 border border-border/10 rounded-lg p-5 group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${flag.status === 'pending' ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                    <p className="text-text-primary text-xs font-bold">{flag.reason?.replace(/_/g, ' ')}</p>
                  </div>
                  {flag.details && <p className="text-text-muted text-xs leading-relaxed mb-3">{flag.details}</p>}
                  <p className="text-text-muted/60 text-xs font-bold">{new Date(flag.created_at).toLocaleDateString()}</p>
                </div>
                {flag.status === 'pending' ? (
                  <button
                    onClick={() => resolveFlag(flag.id)}
                    className="px-4 py-2 bg-green-500/10 text-green-500 text-xs font-bold rounded-md hover:bg-green-500 hover:text-white transition-all border border-green-500/20"
                  >
                    Resolve
                  </button>
                ) : (
                  <span className="px-4 py-2 bg-surface-3 text-text-muted text-xs font-bold rounded-md">Resolved</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main AdminChannels Page ---
export default function AdminChannels() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all'); 
  const [editingChannel, setEditingChannel] = useState(null);
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
      .select('*')
      .order('subscriber_count', { ascending: false, nullsFirst: false });

    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (!error) setChannels(data || []);
    setLoading(false);
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (!window.confirm(`Terminate connection with ${name}? This action is irreversible.`)) return;
    setDeleting(id);
    const { error } = await supabase.from('channels').delete().eq('id', id);
    if (!error) {
      setChannels(c => c.filter(x => x.id !== id));
      toast.success('Channel node terminated');
    } else {
      toast.error('Failed to delete');
    }
    setDeleting(null);
  };

  const handleSync = async (e, channel) => {
    e.stopPropagation();
    setSyncingId(channel.id);
    setSyncResult('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/cron/refresh-videos?channelId=${channel.id}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      
      const text = await res.text();
      if (text.includes('import ') || text.includes('export ')) {
        throw new Error('Local dev detected: Vite cannot execute .ts scripts. Use vercel dev.');
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid server response');
      }

      if (!res.ok) throw new Error(json.error || `Status ${res.status}`);

      const processedCount = json.videos_upserted || 0;
      const filmsCreated = json.films_created || 0;
      
      setSyncResult(`Sync complete: ${processedCount} assets ingested. ${filmsCreated} films created.`);
      toast.success(`Ingested ${processedCount} videos`);
      fetchChannels();
    } catch (e) {
      setSyncResult(`Protocol Error: ${e.message}`);
      toast.error('Sync failed');
    }
    setSyncingId(null);
  };

  const filteredChannels = useMemo(() => {
    return channels.filter(ch => {
      if (filterTab === 'all') return true;
      if (filterTab === 'featured') return ch.is_featured;
      return ch.category === filterTab;
    });
  }, [channels, filterTab]);

  const stats = useMemo(() => ({
    total: channels.length,
    featured: channels.filter(c => c.is_featured).length,
    active: channels.filter(c => c.videos_last_fetched_at && (new Date() - new Date(c.videos_last_fetched_at)) < 86400000 * 7).length,
    subscribers: channels.reduce((acc, current) => acc + (current.subscriber_count || 0), 0)
  }), [channels]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto pb-24">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-12">
        <div>
          <p className="text-brand text-xs font-bold mb-2">Channel Database</p>
          <h1 className="text-4xl font-bold text-text-primary tracking-tight mb-2">Content Sources</h1>
          <p className="text-text-muted text-sm max-w-xl font-medium leading-relaxed">
            Manage incoming content from <span className="text-brand font-bold">{stats.total} verified channels</span>. Monitor activity and sync movie records.
          </p>
        </div>
        <button
          onClick={() => setEditingChannel(false)}
          className="group relative px-10 py-5 bg-brand text-white rounded-md text-xs font-bold shadow-2xl shadow-brand/20 hover:scale-105 active:scale-95 transition-all duration-300"
        >
          <span className="relative z-10 flex items-center gap-3 font-bold">
             <span className="text-lg">⊕</span> Add New Source
          </span>
          <div className="absolute inset-0 bg-white/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Total Channels', val: stats.total,       icon: '📡', color: 'text-brand',      bg: 'bg-brand/10' },
          { label: 'Featured',      val: stats.featured,    icon: '💎', color: 'text-blue-400',  bg: 'bg-blue-400/10' },
          { label: 'Synced Hubs',   val: stats.active,      icon: '🔄', color: 'text-green-400', bg: 'bg-green-400/10' },
          { label: 'Total Reach',   val: formatViewCount(stats.subscribers), icon: '👥', color: 'text-purple-400', bg: 'bg-purple-400/10' },
        ].map(s => (
          <div key={s.label} className="card-cal p-6 relative overflow-hidden group hover:border-brand/30 transition-all duration-500">
            <div className={`absolute top-0 right-0 w-24 h-24 ${s.bg} rounded-bl-[4rem] -mr-8 -mt-8 opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`} />
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <span className="text-xl bg-surface-3 w-12 h-12 flex items-center justify-center rounded-lg border border-border group-hover:scale-110 transition-transform">{s.icon}</span>
              <p className="text-xs font-bold text-text-muted">{s.label}</p>
            </div>
            <p className={`text-4xl font-bold tracking-tighter ${s.color} relative z-10 group-hover:tracking-normal transition-all`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Control Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 items-end">
        <div className="lg:col-span-8">
           <div className="relative group w-full md:w-64 mb-4">
              <select
                value={filterTab}
                onChange={(e) => setFilterTab(e.target.value)}
                className="w-full h-14 bg-surface border border-border rounded-md px-5 text-text-primary text-xs font-bold focus:border-brand focus:outline-none appearance-none cursor-pointer shadow-2xl group-hover:border-border-hover transition-all"
              >
                {['all', 'featured', ...CATEGORIES].map(tab => (
                  <option key={tab} value={tab} className="uppercase bg-surface text-text-primary">
                    {tab}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-text-muted">
                ▼
              </div>
           </div>
        </div>
        <div className="lg:col-span-4 relative group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search channel frequency..."
            className="w-full h-14 bg-surface border border-border rounded-md px-6 pl-14 text-text-primary text-sm focus:border-brand focus:outline-none transition-all placeholder:text-text-muted/30 shadow-2xl group-hover:border-border-hover"
          />
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted opacity-50 text-xl">🔍</span>
          {syncResult && (
            <div className="absolute right-0 top-full mt-4 bg-surface-2 border border-brand/20 text-brand text-xs font-bold px-4 py-2 rounded-md shadow-2xl animate-in fade-in slide-in-from-top-2 z-20 flex items-center gap-3">
               <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
               {syncResult}
               <button onClick={() => setSyncResult('')} className="ml-2 hover:text-text-primary transition-colors">✕</button>
            </div>
          )}
        </div>
      </div>

      {/* Assets Grid Interface */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-80 bg-surface-2 rounded-md animate-pulse border border-border" />
          ))}
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="card-cal p-32 text-center border-dashed border-border-hover">
           <div className="w-24 h-24 bg-surface-3 border border-border rounded-md flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner text-brand/20 animate-bounce-slow">📺</div>
           <h2 className="text-text-primary text-2xl font-bold tracking-tight mb-3">No Sources Found</h2>
           <p className="text-text-muted max-w-md mx-auto text-sm leading-relaxed mb-10">Adjust your search or add a new channel to begin syncing content.</p>
           <button onClick={() => { setSearch(''); setFilterTab('all'); }} className="px-8 py-4 bg-brand/10 border border-brand/20 text-brand text-xs font-bold rounded-lg hover:bg-brand hover:text-white transition-all">Clear Filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredChannels.map((ch) => (
            <div
              key={ch.id}
              onClick={() => navigate(`/admin/channels/${ch.id}`)}
              className="group bg-surface border border-border rounded-md overflow-hidden shadow-2xl hover:border-brand/30 transition-all duration-500 cursor-pointer relative"
            >
              {/* Banner Area */}
              <div className="h-32 bg-surface-3 relative overflow-hidden">
                {ch.banner_url ? (
                  <img src={ch.banner_url} alt="" className="w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-surface-3 to-surface opacity-50" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
                
                {/* Status Overlays */}
                <div className="absolute top-4 right-6 flex gap-3">
                   {ch.is_featured && <span className="w-8 h-8 rounded-md bg-brand/20 backdrop-blur-md border border-brand/20 flex items-center justify-center text-brand text-lg shadow-lg" title="Featured">💎</span>}
                   {ch.videos_last_fetched_at && (new Date() - new Date(ch.videos_last_fetched_at)) < 86400000 && <span className="w-8 h-8 rounded-md bg-green-500/20 backdrop-blur-md border border-green-500/20 flex items-center justify-center text-green-400 text-xs shadow-lg animate-pulse" title="Active Hub">⚡</span>}
                </div>
              </div>

              {/* Profile Identity */}
              <div className="px-8 pb-10 relative mt-[-3rem]">
                <div className="relative mb-4 group/avatar inline-block">
                  {ch.thumbnail_url ? (
                    <img src={ch.thumbnail_url} alt="" className="w-24 h-24 rounded-md object-cover border-[6px] border-surface group-hover:scale-105 transition-all shadow-2xl" />
                  ) : (
                    <div className="w-24 h-24 rounded-md bg-surface-2 border-[6px] border-surface flex items-center justify-center text-3xl font-bold text-brand shadow-2xl group-hover:scale-105 transition-all">
                      {ch.name?.charAt(0)}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 bg-surface border border-border text-text-primary text-xs font-bold px-3 py-1.5 rounded-md shadow-2xl">
                    {formatViewCount(ch.subscriber_count || 0)} 
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-text-primary text-xl font-bold tracking-tight truncate group-hover:text-brand transition-colors">{ch.name}</h3>
                      <p className="text-text-muted text-xs font-medium mt-1">@{ch.channel_handle?.replace(/^@/, '') || 'channel'}</p>
                    </div>
                    {ch.category && (
                      <span className="flex-shrink-0 px-3 py-1 bg-surface-2 border border-border text-brand text-[10px] font-bold rounded-lg h-fit mt-1">
                        {ch.category}
                      </span>
                    )}
                  </div>
                </div>

                {ch.description && (
                  <p className="text-text-muted text-xs leading-relaxed line-clamp-2 mb-8 italic min-h-[2.5rem]">
                    {ch.description}
                  </p>
                )}

                <div className="h-px bg-border w-full mb-8" />

                {/* Grid Footer Controls */}
                <div className="flex items-center justify-between gap-4">
                   <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                         <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Protocol Owner</span>
                         <span className="text-text-primary text-xs font-bold truncate max-w-[100px]">{ch.owner_name || 'System Auto'}</span>
                      </div>
                   </div>

                   <div className="flex items-center gap-2">
                     <button
                       onClick={(e) => handleSync(e, ch)}
                       disabled={syncingId === ch.id}
                       className="w-10 h-10 rounded-md bg-brand/10 text-brand border border-brand/10 flex items-center justify-center hover:bg-brand hover:text-white transition-all shadow-lg"
                       title="Recalibrate Feed"
                     >
                        <span className={syncingId === ch.id ? 'animate-spin' : ''}>↻</span>
                     </button>
                     <button
                       onClick={(e) => { e.stopPropagation(); setFlagChannel(ch); }}
                       className="w-10 h-10 rounded-md bg-orange-500/10 text-orange-500 border border-orange-500/10 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all shadow-lg"
                       title="Violation Logs"
                     >
                       🛡️
                     </button>
                     <button
                       onClick={(e) => { e.stopPropagation(); setEditingChannel(ch); }}
                       className="w-10 h-10 rounded-md bg-surface-2 text-text-muted border border-border flex items-center justify-center hover:text-brand hover:border-brand/30 transition-all shadow-lg"
                       title="Edit Config"
                     >
                       ✏️
                     </button>
                     <button
                       onClick={(e) => handleDelete(e, ch.id, ch.name)}
                       disabled={deleting === ch.id}
                       className="w-10 h-10 rounded-md bg-red-500/10 text-red-500 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-lg"
                       title="Terminate Node"
                     >
                       🗑️
                     </button>
                   </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 h-1 w-0 bg-brand transition-all duration-700 group-hover:w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Active Overlays */}
      {editingChannel !== null && (
        <ChannelModal
          channel={editingChannel || null}
          onSave={() => { setEditingChannel(null); fetchChannels(); toast.success('Frequency recalibrated.'); }}
          onClose={() => setEditingChannel(null)}
        />
      )}

      {flagChannel && (
        <FlagsModal channel={flagChannel} onClose={() => setFlagChannel(null)} />
      )}
    </div>
  );
}
