import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatViewCount } from '../../utils/youtube';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import SyncStatusOverlay from '../../components/admin/SyncStatusOverlay';
import ImageWithFallback from '../../components/ui/ImageWithFallback';

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

  return (
    <div ref={ref} className="relative flex-1">
      <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
        Channel Owner (Star)
      </label>

      {value ? (
        <div className="flex items-center gap-3 bg-surface-2 border border-brand/20 rounded-lg px-4 py-3 shadow-inner">
          {value.photo_url
            ? <img src={value.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
            : <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-brand font-bold text-xs">{value.name?.charAt(0)}</div>
          }
          <div className="flex-1 min-w-0">
            <span className="text-text-primary text-xs font-bold block truncate">{value.name}</span>
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-text-muted hover:text-red-500">✕</button>
        </div>
      ) : (
        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search Star..."
            className="w-full h-10 bg-surface-2 border border-border rounded-lg px-4 text-text-primary text-xs focus:border-brand focus:outline-none transition-all"
          />
          {open && results.length > 0 && (
            <div className="absolute z-[110] left-0 right-0 mt-2 bg-surface border border-border rounded-lg overflow-hidden shadow-2xl">
              {results.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => select(p)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-2 text-left transition-colors"
                >
                  <p className="text-text-primary text-xs font-bold truncate">{p.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Company Search Component ---
function CompanySearch({ value, onChange }) {
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
          .from('companies')
          .select('id, name, logo_url')
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

  const select = (company) => {
    onChange(company);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex-1">
      <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
        Production Company
      </label>

      {value ? (
        <div className="flex items-center gap-3 bg-surface-2 border border-brand/20 rounded-lg px-4 py-3 shadow-inner">
          <div className="flex-1 min-w-0">
            <span className="text-text-primary text-xs font-bold block truncate">{value.name}</span>
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-text-muted hover:text-red-500">✕</button>
        </div>
      ) : (
        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search Company..."
            className="w-full h-10 bg-surface-2 border border-border rounded-lg px-4 text-text-primary text-xs focus:border-brand focus:outline-none transition-all"
          />
          {open && results.length > 0 && (
            <div className="absolute z-[110] left-0 right-0 mt-2 bg-surface border border-border rounded-lg overflow-hidden shadow-2xl">
              {results.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-2 text-left transition-colors"
                >
                  <p className="text-text-primary text-xs font-bold truncate">{c.name}</p>
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
    channel_id: channel.channel_id || '',
  } : { ...EMPTY_FORM });

  const [owner, setOwner] = useState(
    channel?.owner_person_id
      ? { id: channel.owner_person_id, name: channel.owner_name || '', photo_url: null }
      : null,
  );

  const [company, setCompany] = useState(
    channel?.owner_company_id
      ? { id: channel.owner_company_id, name: channel.company_name || '', logo_url: null }
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
      owner_company_id: company?.id ?? null,
      banner_url: form.banner_url || null,
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

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${channel.name}? This cannot be undone.`)) return;
    setSaving(true);
    const { error } = await supabase.from('channels').delete().eq('id', channel.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300">
        <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-surface-2/50">
          <div>
            <p className="text-brand text-[10px] font-black uppercase tracking-widest mb-1">Source Config</p>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              {channel ? 'Modify Channel' : 'Initialize New Source'}
            </h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface border border-border hover:bg-surface-2 transition-all">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold p-4 rounded-lg">{error}</div>}

          <div className="flex flex-col md:flex-row gap-6">
            <PeopleSearch value={owner} onChange={setOwner} />
            <CompanySearch value={company} onChange={setCompany} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">Channel Name</label>
              <input name="name" value={form.name} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm focus:border-brand outline-none" />
            </div>
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">Category</label>
              <select name="category" value={form.category} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm focus:border-brand outline-none">
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">Country</label>
              <input name="country" value={form.country} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm focus:border-brand outline-none" placeholder="e.g. Nigeria" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">Handle (@...)</label>
              <input name="channel_handle" value={form.channel_handle} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm focus:border-brand outline-none" />
            </div>
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">Channel ID</label>
              <input name="channel_id" value={form.channel_id} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm focus:border-brand outline-none" placeholder="UC..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">Channel Logo URL</label>
              <div className="flex gap-2">
                <input name="thumbnail_url" value={form.thumbnail_url} onChange={handleChange} className="flex-1 bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm focus:border-brand outline-none" placeholder="https://..." />
                {form.thumbnail_url && <img src={form.thumbnail_url} alt="" className="w-10 h-10 rounded border border-border" />}
              </div>
            </div>
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">Backdrop Asset URL</label>
              <div className="flex gap-2">
                <input name="banner_url" value={form.banner_url} onChange={handleChange} className="flex-1 bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm focus:border-brand outline-none" placeholder="https://..." />
                {form.banner_url && <img src={form.banner_url} alt="" className="w-10 h-10 rounded border border-border object-cover" />}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm focus:border-brand outline-none resize-none" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" name="is_featured" checked={form.is_featured} onChange={handleChange} className="w-4 h-4 rounded border-border text-brand focus:ring-brand bg-surface-2" />
            <span className="text-xs font-bold text-text-primary uppercase tracking-widest">Feature this channel</span>
          </label>
        </form>

        <div className="p-8 border-t border-border bg-surface-2/50 flex gap-3">
          {channel && (
            <button type="button" onClick={handleDelete} disabled={saving} className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
               <Icon icon="solar:trash-bin-trash-bold" width="20" />
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-surface border border-border rounded-lg text-xs font-bold text-text-muted hover:bg-surface-2 transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-[2] py-3 bg-brand text-white rounded-lg text-xs font-bold hover:opacity-90 shadow-lg shadow-brand/20 transition-all disabled:opacity-50">
            {saving ? 'Processing...' : channel ? 'Update Source' : 'Confirm Registration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Discovery Hub Component ---
function DiscoveryHub({ onMonitor }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const search = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/search-channels?query=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      const data = await res.json();
      setResults(data.items || []);
    } catch (err) {
      toast.error('Discovery search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-2xl mx-auto">
        <form onSubmit={search} className="relative group">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Find production channels, actors, or skit makers..."
            className="w-full h-16 bg-surface border border-border rounded-2xl px-8 pl-14 text-text-primary text-sm focus:border-brand focus:outline-none shadow-2xl transition-all group-hover:border-border-hover"
          />
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted opacity-50 text-2xl">📡</span>
          <button 
            type="submit"
            disabled={loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 px-6 bg-brand text-white text-xs font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Scan'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-surface-2 rounded-2xl animate-pulse border border-border" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((c) => (
            <div key={c.id} className="bg-surface border border-border rounded-2xl p-6 hover:border-brand/30 transition-all group shadow-xl">
              <div className="flex items-center gap-4 mb-6">
                <img src={c.thumbnail} alt="" className="w-16 h-16 rounded-full border-2 border-surface-2 shadow-inner" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-text-primary truncate">{c.name}</h3>
                  <p className="text-[10px] text-brand font-black uppercase tracking-widest mb-1">{c.handle}</p>
                  <p className="text-[10px] text-text-muted font-bold">{formatViewCount(c.subscriberCount)} Subscribers</p>
                </div>
              </div>
              <p className="text-xs text-text-muted line-clamp-2 mb-6 h-8 font-medium leading-relaxed">
                {c.description || 'No description provided.'}
              </p>
              <button
                onClick={() => onMonitor(c)}
                className="w-full py-3 bg-surface-2 border border-border rounded-xl text-xs font-bold text-text-primary hover:bg-brand hover:text-white hover:border-brand transition-all flex items-center justify-center gap-2"
              >
                <Icon icon="solar:videocamera-record-linear" width="16" />
                Monitor Channel
              </button>
            </div>
          ))}
        </div>
      ) : query && !loading && (
        <div className="text-center py-20 bg-surface-2/50 rounded-2xl border border-dashed border-border">
          <p className="text-4xl mb-4 opacity-20">🔍</p>
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">No Sources Found</h3>
          <p className="text-xs text-text-muted mt-2">Try searching for generic keywords like "Nollywood" or "Nigerian Movies"</p>
        </div>
      )}
    </div>
  );
}

// --- Main AdminChannels Page ---
export default function AdminChannels() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('monitored'); // monitored | discovery
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all'); 
  const [editingChannel, setEditingChannel] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncReport, setSyncReport] = useState(null);

  useEffect(() => {
    if (activeTab === 'monitored') fetchChannels();
  }, [search, filterTab, activeTab]);

  const fetchChannels = async () => {
    setLoading(true);
    let query = supabase
      .from('channels')
      .select('*, people!owner_person_id(name, photo_url), companies!owner_company_id(name)')
      .order('subscriber_count', { ascending: false, nullsFirst: false });

    if (search) query = query.ilike('name', `%${search}%`);
    if (filterTab === 'featured') {
      query = query.eq('is_featured', true);
    } else if (filterTab !== 'all') {
      query = query.eq('category', filterTab);
    }

    const { data, error } = await query;
    if (!error) {
      setChannels(data.map(ch => ({
        ...ch,
        owner_name: ch.people?.name,
        company_name: ch.companies?.name
      })) || []);
    }
    setLoading(false);
  };

  const handleSync = async (e, channel) => {
    if (e) e.stopPropagation();
    setSyncingId(channel.id);
    const tid = toast.loading(`Syncing ${channel.name}...`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/cron/refresh-videos?channelId=${channel.id}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sync Error');
      toast.success(`Success: Ingested ${json.videos_upserted || 0} movies.`, { id: tid });
      fetchChannels();
    } catch (err) {
      toast.error(`Failed: ${err.message}`, { id: tid });
    }
    setSyncingId(null);
  };

  const handleSyncAll = async () => {
    setSyncReport(null);
    setSyncProgress({ current: 0, total: channels.length, status: 'Initializing Global Sync...' });
    
    const results = [];
    const { data: { session } } = await supabase.auth.getSession();

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      setSyncProgress(prev => ({ ...prev, current: i + 1, status: `Syncing ${ch.name}...` }));
      
      try {
        const res = await fetch(`/api/cron/refresh-videos?channelId=${ch.id}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
        });
        const json = await res.json();
        results.push({
          name: ch.name,
          success: res.ok,
          count: json.videos_upserted || 0,
          error: res.ok ? null : (json.error || 'Unknown Error')
        });
      } catch (err) {
        results.push({ name: ch.name, success: false, count: 0, error: err.message });
      }
    }

    setSyncProgress(null);
    setSyncReport(results);
    fetchChannels();
  };

  const startMonitoring = (discoveryResult) => {
    setEditingChannel({
      name: discoveryResult.name,
      channel_handle: discoveryResult.handle,
      channel_url: `https://youtube.com/channel/${discoveryResult.id}`,
      channel_id: discoveryResult.id,
      description: discoveryResult.description,
      subscriber_count: discoveryResult.subscriberCount,
      thumbnail_url: discoveryResult.thumbnail,
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto pb-32">
      <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-12 border-b border-border pb-10">
        <div>
          <p className="text-brand text-[10px] font-black uppercase tracking-widest mb-2">Content Ingestion</p>
          <h1 className="text-4xl font-bold text-text-primary tracking-tighter mb-2">Source Hub</h1>
          <div className="flex items-center gap-6 mt-6">
            <button
              onClick={() => setActiveTab('monitored')}
              className={`text-xs font-black uppercase tracking-widest pb-4 border-b-2 transition-all ${activeTab === 'monitored' ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'}`}
            >
              Monitored ({channels.length})
            </button>
            <button
              onClick={() => setActiveTab('discovery')}
              className={`text-xs font-black uppercase tracking-widest pb-4 border-b-2 transition-all ${activeTab === 'discovery' ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'}`}
            >
              Discovery
            </button>
          </div>
        </div>

        {activeTab === 'monitored' && (
          <div className="flex gap-4">
             <button
              onClick={handleSyncAll}
              disabled={syncingId || syncProgress}
              className="h-12 px-6 bg-surface-2 border border-border text-text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-brand/40 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              <Icon icon="solar:refresh-linear" width="16" className={syncProgress ? 'animate-spin' : ''} />
              Total Sync
            </button>
            <button
              onClick={() => setEditingChannel(true)}
              className="h-12 px-8 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-brand/20 flex items-center gap-2"
            >
              <Icon icon="solar:add-circle-linear" width="18" />
              Direct Entry
            </button>
          </div>
        )}
      </div>

      {activeTab === 'monitored' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 items-end animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="lg:col-span-8 flex gap-4">
            <div className="relative group w-full md:w-64">
              <select
                value={filterTab}
                onChange={(e) => setFilterTab(e.target.value)}
                className="w-full h-14 bg-surface border border-border rounded-xl px-5 text-text-primary text-xs font-bold focus:border-brand focus:outline-none appearance-none cursor-pointer shadow-xl transition-all"
              >
                <option value="all">All Categories</option>
                <option value="featured">★ Featured Only</option>
                {CATEGORIES.map(tab => (
                  <option key={tab} value={tab}>{tab}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-text-muted">▼</div>
            </div>
          </div>
          <div className="lg:col-span-4 relative group">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search monitored sources..."
              className="w-full h-14 bg-surface border border-border rounded-xl px-6 pl-12 text-text-primary text-sm focus:border-brand focus:outline-none transition-all shadow-xl"
            />
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted opacity-50">🔍</span>
          </div>
        </div>
      )}

      {activeTab === 'discovery' ? (
        <DiscoveryHub onMonitor={startMonitoring} />
      ) : (
        <div className="space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 bg-surface-2 rounded-2xl animate-pulse" />)
              ) : channels.map(ch => (
                <div key={ch.id} className="bg-surface border border-border rounded-2xl p-6 group hover:border-brand/30 transition-all shadow-xl">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <ImageWithFallback
                        src={ch.thumbnail_url}
                        alt=""
                        fallbackType="avatar"
                        name={ch.name}
                        className="w-16 h-16 rounded-xl border border-border object-cover"
                      />
                      {ch.is_featured && (
                        <div className="absolute -top-2 -right-2 bg-brand text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-lg border-2 border-surface">★</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={async (e) => {
                           e.stopPropagation();
                           const { error } = await supabase.from('channels').update({ is_featured: !ch.is_featured }).eq('id', ch.id);
                           if (!error) { fetchChannels(); toast.success(ch.is_featured ? 'Removed from featured' : 'Marked as featured'); }
                         }}
                         className={`p-2 border rounded-lg transition-all ${ch.is_featured ? 'bg-brand/10 border-brand text-brand' : 'bg-surface-2 border-border text-text-muted hover:text-brand'}`}
                       >
                          <Icon icon={ch.is_featured ? "solar:star-bold" : "solar:star-linear"} width="16" />
                       </button>
                       <button onClick={(e) => { e.stopPropagation(); setEditingChannel(ch); }} className="p-2 bg-surface-2 border border-border rounded-lg text-text-muted hover:text-brand transition-all">
                          <Icon icon="solar:pen-linear" width="16" />
                       </button>
                       <button onClick={(e) => handleSync(e, ch)} disabled={syncingId === ch.id} className="p-2 bg-surface-2 border border-border rounded-lg text-text-muted hover:text-green-500 transition-all">
                          <Icon icon="solar:refresh-linear" width="16" className={syncingId === ch.id ? 'animate-spin' : ''} />
                       </button>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-text-primary mb-1">{ch.name}</h3>
                  <p className="text-[10px] text-brand font-black uppercase tracking-widest mb-4">{ch.category || 'Uncategorized'} • {ch.country || 'Nigeria'}</p>
                  
                  <div className="space-y-3 bg-surface-2/50 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-text-muted uppercase tracking-wider">Subscribers</span>
                      <span className="text-text-primary">{formatViewCount(ch.subscriber_count)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-text-muted uppercase tracking-wider">Owner</span>
                      <span className="text-brand">{ch.owner_name || 'Generic'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/admin/channels/${ch.id}`)}
                    className="w-full py-3 bg-surface border border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
                  >
                    Manage Repository
                  </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {editingChannel !== null && (
        <ChannelModal
          channel={typeof editingChannel === 'object' ? editingChannel : null}
          onSave={() => { setEditingChannel(null); fetchChannels(); }}
          onClose={() => setEditingChannel(null)}
        />
      )}

      <SyncStatusOverlay 
        progress={syncProgress} 
        report={syncReport} 
        onClose={() => setSyncReport(null)} 
      />
    </div>
  );
}
