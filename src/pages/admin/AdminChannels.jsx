import { searchPeopleByName } from '../../lib/peopleSearch';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatViewCount, searchYouTubeChannels } from '../../utils/youtube';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import SyncStatusOverlay from '../../components/admin/SyncStatusOverlay';
import ImageWithFallback from '../../components/ui/ImageWithFallback';
import { toTitleCase, toSentenceCase } from '../../utils/format';
import { deleteChannelWithAssociatedFilms } from '../../utils/channelCascadeDelete';

const CATEGORIES = [
  'Movies', 'Comedy', 'Series', 'Yoruba', 'Faith',
  'Celebrity', 'Network', 'Music', 'Studio', 'skit_maker', 'actor'
];

const EMPTY_FORM = {
  name: '',
  channel_handle: '',
  channel_url: '',
  channel_id: '',
  description: '',
  category: 'Movies',
  country: 'Nigeria',
  subscriber_count: '',
  thumbnail_url: '',
  banner_url: '',
  is_featured: false,
  sync_enabled: true,
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
        const data = await searchPeopleByName(query, { limit: 8, select: 'id, name, photo_url, known_for_department' });
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
        Channel Owner (Star / Actor)
      </label>

      {value ? (
        <div className="flex items-center gap-3 bg-surface-2 border border-brand/30 rounded-xl px-4 py-2.5 shadow-inner">
          {value.photo_url
            ? <img src={value.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
            : <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-brand font-bold text-xs">{value.name?.charAt(0)}</div>
          }
          <div className="flex-1 min-w-0">
            <span className="text-text-primary text-xs font-bold block truncate">{value.name}</span>
            <span className="text-brand text-[10px] font-medium block">Linked Star Profile</span>
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-text-muted hover:text-red-500 p-1" title="Unlink star">
            <Icon icon="solar:close-circle-bold" width="16" />
          </button>
        </div>
      ) : (
        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search star from database..."
            className="w-full h-11 bg-surface-2 border border-border rounded-xl px-4 pl-10 text-text-primary text-xs focus:border-brand focus:outline-none transition-all"
          />
          <Icon icon="solar:user-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm" />
          {loading && <Icon icon="solar:refresh-linear" className="absolute right-3 top-1/2 -translate-y-1/2 text-brand animate-spin text-sm" />}
          {open && results.length > 0 && (
            <div className="absolute z-[120] left-0 right-0 mt-2 bg-surface border border-border rounded-xl overflow-hidden shadow-2xl max-h-56 overflow-y-auto custom-scrollbar">
              {results.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => select(p)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 text-left transition-colors border-b border-border/50 last:border-0"
                >
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className="w-7 h-7 rounded-full object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center text-brand font-bold text-xs shrink-0">
                      {p.name?.charAt(0)}
                    </div>
                  )}
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
        <div className="flex items-center gap-3 bg-surface-2 border border-brand/30 rounded-xl px-4 py-2.5 shadow-inner">
          <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
            <Icon icon="solar:buildings-bold" width="16" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-text-primary text-xs font-bold block truncate">{value.name}</span>
            <span className="text-brand text-[10px] font-medium block">Linked Company</span>
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-text-muted hover:text-red-500 p-1" title="Unlink company">
            <Icon icon="solar:close-circle-bold" width="16" />
          </button>
        </div>
      ) : (
        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search company from database..."
            className="w-full h-11 bg-surface-2 border border-border rounded-xl px-4 pl-10 text-text-primary text-xs focus:border-brand focus:outline-none transition-all"
          />
          <Icon icon="solar:buildings-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm" />
          {loading && <Icon icon="solar:refresh-linear" className="absolute right-3 top-1/2 -translate-y-1/2 text-brand animate-spin text-sm" />}
          {open && results.length > 0 && (
            <div className="absolute z-[120] left-0 right-0 mt-2 bg-surface border border-border rounded-xl overflow-hidden shadow-2xl max-h-56 overflow-y-auto custom-scrollbar">
              {results.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 text-left transition-colors border-b border-border/50 last:border-0"
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

// --- Interactive Channel Modal Component ---
function ChannelModal({ channel, existingChannelIds = [], onSave, onClose }) {
  // Step: 'search' | 'form'
  const isEditing = Boolean(channel?.id);
  const [step, setStep] = useState(isEditing ? 'form' : 'search');

  // Search Step State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Form Step State
  const [form, setForm] = useState(channel ? {
    name: channel.name || '',
    channel_handle: channel.channel_handle || '',
    channel_url: channel.channel_url || '',
    channel_id: channel.channel_id || '',
    description: channel.description || '',
    category: channel.category || 'Movies',
    country: channel.country || 'Nigeria',
    subscriber_count: channel.subscriber_count ?? '',
    thumbnail_url: channel.thumbnail_url || '',
    banner_url: channel.banner_url || '',
    is_featured: channel.is_featured || false,
    sync_enabled: channel.sync_enabled !== false,
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

  // Auto-search suggestions
  const SUGGESTIONS = ['SceneOne TV', 'ApataTV+', 'Yorubahood', 'BAM Real Media', 'Nollywood Picturestv', 'NevadabridgeTV'];

  const executeSearch = async (termToSearch) => {
    const q = (termToSearch !== undefined ? termToSearch : searchQuery).trim();
    if (!q) return;
    setSearching(true);
    setError('');
    setHasSearched(true);
    try {
      const results = await searchYouTubeChannels(q);
      setSearchResults(results || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to search YouTube API');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectYouTubeChannel = (yt) => {
    setForm({
      name: yt.name || '',
      channel_handle: yt.channel_handle || '',
      channel_url: yt.channel_url || `https://www.youtube.com/channel/${yt.channel_id}`,
      channel_id: yt.channel_id || '',
      description: yt.description || '',
      category: form.category || 'Movies',
      country: yt.country || 'Nigeria',
      subscriber_count: yt.subscriber_count ?? '',
      thumbnail_url: yt.thumbnail_url || '',
      banner_url: yt.banner_url || '',
      is_featured: form.is_featured || false,
      sync_enabled: true,
    });
    setStep('form');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Channel Name is required'); return; }
    if (!form.channel_id.trim()) { setError('Channel ID is required'); return; }

    setSaving(true);

    const formattedName = toTitleCase(form.name.trim());
    const cleanHandle = form.channel_handle ? (form.channel_handle.startsWith('@') ? form.channel_handle.trim() : `@${form.channel_handle.trim()}`) : '';
    const generatedSlug = cleanHandle.replace(/^@/, '').toLowerCase() || formattedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const payload = {
      name: formattedName,
      channel_handle: cleanHandle,
      channel_id: form.channel_id.trim(),
      channel_url: form.channel_url?.trim() || `https://www.youtube.com/channel/${form.channel_id.trim()}`,
      description: form.description ? toSentenceCase(form.description.trim()) : '',
      category: form.category || 'Movies',
      country: form.country?.trim() || 'Nigeria',
      subscriber_count: form.subscriber_count === '' ? null : Number(form.subscriber_count),
      thumbnail_url: form.thumbnail_url?.trim() || null,
      banner_url: form.banner_url?.trim() || null,
      is_featured: !!form.is_featured,
      sync_enabled: form.sync_enabled !== false,
      owner_person_id: owner?.id ?? null,
      owner_name: owner?.name ?? null,
      owner_company_id: company?.id ?? null,
      slug: generatedSlug,
    };

    let err;
    if (channel?.id) {
      ({ error: err } = await supabase.from('channels').update(payload).eq('id', channel.id));
    } else {
      ({ error: err } = await supabase.from('channels').insert(payload));
    }

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }

    toast.success(channel?.id ? `Updated ${payload.name}` : `Channel "${payload.name}" registered successfully!`);
    onSave();
  };

  const handleDelete = async () => {
    if (!window.confirm(`⚠️ TEMPORARY CASCADE RULE ACTIVE:\n\nAre you sure you want to delete "${channel.name}"?\nThis will permanently delete this channel AND all its associated movies and credits from the database.`)) return;
    setSaving(true);
    try {
      const res = await deleteChannelWithAssociatedFilms(channel.id);
      toast.success(`Deleted ${channel.name} and ${res.deletedFilms} associated movies (${res.deletedCredits} credits)`);
      onSave();
    } catch (err) {
      setError(err.message || 'Deletion failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300 max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-8 py-5 border-b border-border flex items-center justify-between bg-surface-2/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <Icon icon="solar:videocamera-record-bold" width="22" />
            </div>
            <div>
              <p className="text-brand text-[10px] font-black uppercase tracking-widest">
                {isEditing ? 'Channel Editor' : step === 'search' ? 'YouTube Channel Search' : 'Channel Registration'}
              </p>
              <h2 className="text-lg font-bold text-text-primary tracking-tight">
                {isEditing ? `Edit "${channel.name}"` : step === 'search' ? 'Add Channel via YouTube API' : 'Review & Save Channel'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-border hover:bg-surface-2 text-text-muted hover:text-text-primary transition-all"
          >
            ✕
          </button>
        </div>

        {/* STEP 1: YouTube Channel Search */}
        {step === 'search' ? (
          <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h3 className="text-base font-bold text-text-primary">Search and auto-import any YouTube channel</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Type the channel name, handle (e.g. <span className="text-brand font-mono">@SceneOneTV</span>), or channel link. We'll automatically retrieve the Channel ID, Logo, Backdrop Banner, and Subscriber Stats.
              </p>
            </div>

            {/* Search Input Box */}
            <form
              onSubmit={(e) => { e.preventDefault(); executeSearch(); }}
              className="relative max-w-2xl mx-auto group"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search channel name, @handle, or paste YouTube link..."
                className="w-full h-14 bg-surface-2 border border-border rounded-2xl px-6 pl-13 pr-32 text-text-primary text-sm font-medium focus:border-brand focus:outline-none shadow-xl transition-all"
                autoFocus
              />
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted opacity-60 text-xl pointer-events-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setHasSearched(false); }}
                  className="absolute right-28 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs p-1"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-9 px-5 bg-brand text-white text-xs font-black uppercase tracking-wider rounded-xl hover:opacity-90 transition-all shadow-md shadow-brand/20 disabled:opacity-40 flex items-center gap-2"
              >
                {searching ? (
                  <>
                    <Icon icon="solar:refresh-linear" className="animate-spin text-sm" />
                    <span>Searching</span>
                  </>
                ) : (
                  <>
                    <Icon icon="solar:magnifer-bold" width="14" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </form>

            {/* Suggestions */}
            {!hasSearched && (
              <div className="max-w-2xl mx-auto flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] text-text-muted font-black uppercase tracking-wider mr-1">Popular:</span>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setSearchQuery(s); executeSearch(s); }}
                    className="px-3 py-1 rounded-lg bg-surface-2 border border-border/80 text-[11px] font-bold text-text-muted hover:text-brand hover:border-brand/40 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Results Grid */}
            {searching ? (
              <div className="space-y-3 max-w-2xl mx-auto pt-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-surface-2 rounded-2xl animate-pulse border border-border" />
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-3 max-w-2xl mx-auto pt-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-text-muted">
                  Found {searchResults.length} Channels on YouTube:
                </p>
                {searchResults.map((yt) => {
                  const isExisting = existingChannelIds.includes(yt.channel_id);
                  return (
                    <div
                      key={yt.channel_id}
                      onClick={() => handleSelectYouTubeChannel(yt)}
                      className="bg-surface-2/60 border border-border hover:border-brand/60 rounded-2xl p-4 transition-all group cursor-pointer shadow-md hover:shadow-xl hover:bg-surface-2 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <img
                          src={yt.thumbnail_url}
                          alt=""
                          className="w-14 h-14 rounded-2xl object-cover border border-border shrink-0 shadow-inner group-hover:scale-105 transition-transform"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-text-primary truncate group-hover:text-brand transition-colors">
                              {yt.name}
                            </h4>
                            {isExisting && (
                              <span className="shrink-0 inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                                Already Monitored
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-brand font-semibold">{yt.channel_handle || yt.channel_id}</p>
                          <div className="flex items-center gap-3 text-[10px] text-text-muted font-bold">
                            <span>{formatViewCount(yt.subscriber_count)} Subscribers</span>
                            {yt.video_count > 0 && <span>• {yt.video_count} Videos</span>}
                            <span>• {yt.country}</span>
                          </div>
                          {yt.description && (
                            <p className="text-[11px] text-text-muted/80 line-clamp-1 italic font-normal">
                              "{yt.description}"
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSelectYouTubeChannel(yt); }}
                        className="h-10 px-5 bg-brand text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md shadow-brand/20 shrink-0 flex items-center gap-2 group-hover:scale-105"
                      >
                        <span>Add</span>
                        <Icon icon="solar:arrow-right-linear" width="16" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : hasSearched && !searching && (
              <div className="text-center py-12 bg-surface-2/40 rounded-2xl border border-dashed border-border max-w-2xl mx-auto space-y-2">
                <Icon icon="solar:magnifer-linear" className="text-4xl text-text-muted/40 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-text-primary">No Channels Found</h4>
                <p className="text-xs text-text-muted">
                  Try searching with the exact YouTube @handle or pasting the full YouTube channel link.
                </p>
              </div>
            )}

            {/* Manual Entry Footer Link */}
            <div className="text-center pt-4 border-t border-border/60 max-w-2xl mx-auto">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="text-xs font-bold text-text-muted hover:text-brand transition-colors inline-flex items-center gap-1"
              >
                <span>Or skip YouTube search and enter details manually</span>
                <Icon icon="solar:arrow-right-linear" width="14" />
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: Full Editable Form */
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* Back to search button (if not editing an existing db channel) */}
              {!isEditing && (
                <div className="flex items-center justify-between bg-surface-2/60 border border-brand/20 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:check-circle-bold" className="text-green-500 text-base" />
                    <span className="text-xs font-bold text-text-primary">
                      Imported from YouTube: <span className="text-brand">{form.name}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('search')}
                    className="text-[11px] font-bold text-text-muted hover:text-brand flex items-center gap-1 transition-colors"
                  >
                    <Icon icon="solar:arrow-left-linear" width="14" />
                    <span>Search different channel</span>
                  </button>
                </div>
              )}

              {/* Banner Preview if banner_url exists */}
              {form.banner_url && (
                <div className="relative h-28 rounded-2xl overflow-hidden border border-border shadow-inner group">
                  <img src={form.banner_url} alt="Banner Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4">
                    <div className="flex items-center gap-3">
                      {form.thumbnail_url && (
                        <img src={form.thumbnail_url} alt="" className="w-10 h-10 rounded-xl border-2 border-surface object-cover shadow-lg" />
                      )}
                      <div>
                        <p className="text-white text-xs font-bold leading-tight">{form.name || 'Channel Banner'}</p>
                        <p className="text-brand text-[10px] font-mono">{form.channel_handle || form.channel_id}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold p-4 rounded-xl flex items-center gap-2">
                  <Icon icon="solar:danger-triangle-bold" className="text-base shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Link Relations (Owner & Production Company) */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-text-muted">1. Entity Relations</p>
                <div className="flex flex-col md:flex-row gap-4 bg-surface-2/30 p-4 rounded-2xl border border-border/80">
                  <PeopleSearch value={owner} onChange={setOwner} />
                  <CompanySearch value={company} onChange={setCompany} />
                </div>
              </div>

              {/* Core Information */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-text-muted">2. Channel Information</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
                      Channel Name *
                    </label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. ApataTV+"
                      className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary font-bold focus:border-brand outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
                      Category
                    </label>
                    <select
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary font-bold focus:border-brand outline-none"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
                      Country
                    </label>
                    <input
                      name="country"
                      value={form.country}
                      onChange={handleChange}
                      className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary font-bold focus:border-brand outline-none"
                      placeholder="e.g. Nigeria"
                    />
                  </div>
                </div>
              </div>

              {/* YouTube Identifiers */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-text-muted">3. YouTube Identifiers</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
                      Handle (@...)
                    </label>
                    <input
                      name="channel_handle"
                      value={form.channel_handle}
                      onChange={handleChange}
                      placeholder="@handle"
                      className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary font-mono focus:border-brand outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
                      Channel ID (UC...) *
                    </label>
                    <input
                      name="channel_id"
                      value={form.channel_id}
                      onChange={handleChange}
                      placeholder="UC..."
                      className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary font-mono focus:border-brand outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
                      Subscribers
                    </label>
                    <input
                      type="number"
                      name="subscriber_count"
                      value={form.subscriber_count}
                      onChange={handleChange}
                      placeholder="e.g. 250000"
                      className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary font-bold focus:border-brand outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Media Asset URLs */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-text-muted">4. Visual Assets</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
                      Channel Logo URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        name="thumbnail_url"
                        value={form.thumbnail_url}
                        onChange={handleChange}
                        placeholder="https://..."
                        className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary focus:border-brand outline-none"
                      />
                      {form.thumbnail_url && (
                        <img src={form.thumbnail_url} alt="" className="w-10 h-10 rounded-xl border border-border object-cover shrink-0" />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
                      Backdrop Banner URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        name="banner_url"
                        value={form.banner_url}
                        onChange={handleChange}
                        placeholder="https://..."
                        className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary focus:border-brand outline-none"
                      />
                      {form.banner_url && (
                        <img src={form.banner_url} alt="" className="w-14 h-10 rounded-xl border border-border object-cover shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
                  Channel Description / Bio
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Official Nollywood channel description..."
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary focus:border-brand outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="is_featured"
                    checked={form.is_featured}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-border text-brand focus:ring-brand bg-surface-2"
                  />
                  <span className="text-xs font-bold text-text-primary tracking-wide">★ Feature this channel on Hub</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="sync_enabled"
                    checked={form.sync_enabled}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-border text-brand focus:ring-brand bg-surface-2"
                  />
                  <span className="text-xs font-bold text-text-primary tracking-wide">Enable Daily Video Sync</span>
                </label>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-6 border-t border-border bg-surface-2/50 flex gap-3 shrink-0">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                  title="Cascade delete channel"
                >
                  <Icon icon="solar:trash-bin-trash-bold" width="20" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-surface border border-border rounded-xl text-xs font-bold text-text-muted hover:bg-surface-2 hover:text-text-primary transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-[2] py-3 bg-brand text-white rounded-xl text-xs font-bold hover:opacity-90 shadow-lg shadow-brand/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Icon icon="solar:refresh-linear" className="animate-spin text-sm" />
                    <span>Saving Channel...</span>
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-bold" width="16" />
                    <span>{isEditing ? 'Update Channel' : 'Confirm Registration'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
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
      const data = await searchYouTubeChannels(query.trim());
      setResults(data || []);
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
            <div key={c.id} className="bg-surface border border-border rounded-2xl p-6 hover:border-brand/30 transition-all group shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <img src={c.thumbnail_url} alt="" className="w-16 h-16 rounded-full border-2 border-surface-2 shadow-inner object-cover" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-text-primary truncate">{c.name}</h3>
                    <p className="text-[10px] text-brand font-black uppercase tracking-widest mb-1">{c.channel_handle}</p>
                    <p className="text-[10px] text-text-muted font-bold">{formatViewCount(c.subscriber_count)} Subscribers</p>
                  </div>
                </div>
                <p className="text-xs text-text-muted line-clamp-2 mb-6 h-8 font-medium leading-relaxed">
                  {c.description || 'No description provided.'}
                </p>
              </div>
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
          <Icon icon="solar:magnifer-linear" className="text-4xl mb-4 opacity-20 mx-auto" />
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
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [search]);

  const [filterTab, setFilterTab] = useState('all'); 
  const [editingChannel, setEditingChannel] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncReport, setSyncReport] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkWorking, setBulkWorking] = useState(false);

  useEffect(() => {
    if (activeTab === 'monitored') fetchChannels();
  }, [debouncedSearch, filterTab, activeTab]);

  // Clear selection when the visible set changes (search/filter/tab switch).
  useEffect(() => { setSelectedIds([]); }, [debouncedSearch, filterTab, activeTab]);

  const toggleSelect = (id) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const allVisibleSelected = channels.length > 0 && channels.every((c) => selectedIds.includes(c.id));
  const toggleSelectAll = () =>
    setSelectedIds(allVisibleSelected ? [] : channels.map((c) => c.id));

  // Bulk enable/disable the daily sync for the selected channels.
  const bulkSetSync = async (enabled) => {
    if (!selectedIds.length) return;
    setBulkWorking(true);
    const { error } = await supabase.from('channels').update({ sync_enabled: enabled }).in('id', selectedIds);
    if (error) {
      toast.error('Bulk update failed');
    } else {
      toast.success(`${enabled ? 'Resumed' : 'Paused'} daily sync for ${selectedIds.length} channel${selectedIds.length === 1 ? '' : 's'}`);
      setChannels((prev) => prev.map((c) => selectedIds.includes(c.id) ? { ...c, sync_enabled: enabled } : c));
      setSelectedIds([]);
    }
    setBulkWorking(false);
  };

  // Bulk cascade delete selected channels + their movies and credits
  const bulkDeleteChannels = async () => {
    if (!selectedIds.length) return;
    const confirmMsg = `⚠️ TEMPORARY CASCADE RULE ACTIVE:\n\nAre you sure you want to delete ${selectedIds.length} selected channel(s)?\n\nThis will permanently delete these channels AND all movies and credits associated with them from the database.`;
    if (!window.confirm(confirmMsg)) return;

    setBulkWorking(true);
    const tid = toast.loading(`Deleting ${selectedIds.length} channel(s) and their movies...`);
    try {
      const res = await deleteChannelWithAssociatedFilms(selectedIds);
      toast.success(
        `Deleted ${res.deletedChannels} channel(s), ${res.deletedFilms} movie(s), and ${res.deletedCredits} credit(s)`,
        { id: tid, duration: 6000 }
      );
      setChannels((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      toast.error(`Bulk deletion failed: ${err.message}`, { id: tid });
    } finally {
      setBulkWorking(false);
    }
  };

  // Direct single channel cascade delete from card
  const handleDirectDelete = async (e, ch) => {
    e.stopPropagation();
    const confirmMsg = `⚠️ TEMPORARY CASCADE RULE ACTIVE:\n\nAre you sure you want to delete "${ch.name}"?\n\nThis will permanently delete this channel AND all movies and credits associated with it from the database.`;
    if (!window.confirm(confirmMsg)) return;

    const tid = toast.loading(`Deleting ${ch.name} & associated movies...`);
    try {
      const res = await deleteChannelWithAssociatedFilms(ch.id);
      toast.success(`Deleted ${ch.name} and ${res.deletedFilms} movie(s) (${res.deletedCredits} credits)`, { id: tid, duration: 5000 });
      setChannels((prev) => prev.filter((c) => c.id !== ch.id));
      setSelectedIds((prev) => prev.filter((id) => id !== ch.id));
    } catch (err) {
      console.error(err);
      toast.error(`Deletion failed: ${err.message}`, { id: tid });
    }
  };

  const fetchChannels = async () => {
    setLoading(true);
    let query = supabase
      .from('channels')
      .select('*, people!owner_person_id(name, photo_url), companies!owner_company_id(name)')
      .order('subscriber_count', { ascending: false, nullsFirst: false });

    if (debouncedSearch) query = query.ilike('name', `%${debouncedSearch}%`);
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
      const summary = [
        `${json.videos_upserted || 0} video updates`,
        `${json.films_created || 0} films created`,
        `${json.films_repaired || 0} films cleaned`,
        `${json.credits_added || 0} credits linked`,
      ];
      toast.success(`Sync complete: ${summary.join(' · ')}`, { id: tid });
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
      channel_handle: discoveryResult.channel_handle || discoveryResult.handle,
      channel_url: discoveryResult.channel_url || `https://youtube.com/channel/${discoveryResult.id}`,
      channel_id: discoveryResult.channel_id || discoveryResult.id,
      description: discoveryResult.description,
      subscriber_count: discoveryResult.subscriber_count || discoveryResult.subscriberCount,
      thumbnail_url: discoveryResult.thumbnail_url || discoveryResult.thumbnail,
      banner_url: discoveryResult.banner_url || '',
      country: discoveryResult.country || 'Nigeria',
    });
  };

  const existingChannelIds = useMemo(() => channels.map(c => c.channel_id).filter(Boolean), [channels]);

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
              Discovery Hub
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
              <Icon icon="solar:add-circle-bold" width="18" />
              Add New Channel
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
            <Icon icon="solar:magnifer-linear" className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted opacity-60 text-lg pointer-events-none" />
          </div>
        </div>
      )}

      {activeTab === 'discovery' ? (
        <DiscoveryHub onMonitor={startMonitoring} />
      ) : (
        <div className="space-y-8">
           {/* Selection / bulk action bar */}
           {!loading && channels.length > 0 && (
             <div className="flex flex-wrap items-center gap-3 -mb-2">
               <button
                 onClick={toggleSelectAll}
                 className="flex items-center gap-2 text-xs font-bold text-text-muted hover:text-text-primary transition-colors"
               >
                 <span className={`w-4 h-4 rounded border flex items-center justify-center ${allVisibleSelected ? 'bg-brand border-brand text-white' : 'border-border bg-surface-2'}`}>
                   {allVisibleSelected && <Icon icon="solar:check-read-linear" width="11" />}
                 </span>
                 {allVisibleSelected ? 'Deselect all' : `Select all (${channels.length})`}
               </button>

               {selectedIds.length > 0 && (
                 <>
                   <span className="text-xs font-black text-brand">{selectedIds.length} selected</span>
                   <button
                     onClick={() => bulkSetSync(false)}
                     disabled={bulkWorking}
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                   >
                     <Icon icon="solar:pause-bold" width="14" /> Pause selected
                   </button>
                   <button
                     onClick={() => bulkSetSync(true)}
                     disabled={bulkWorking}
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20 transition-all disabled:opacity-50"
                   >
                     <Icon icon="solar:refresh-circle-bold" width="14" /> Resume selected
                   </button>
                   <button
                     onClick={bulkDeleteChannels}
                     disabled={bulkWorking}
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/15 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                     title="Cascade delete selected channels and their movies/credits"
                   >
                     <Icon icon="solar:trash-bin-trash-bold" width="14" /> Delete selected ({selectedIds.length})
                   </button>
                   <button onClick={() => setSelectedIds([])} className="text-xs font-bold text-text-muted hover:text-text-primary transition-colors">Clear</button>
                 </>
               )}
             </div>
           )}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 bg-surface-2 rounded-2xl animate-pulse" />)
              ) : channels.map(ch => (
                <div key={ch.id} className={`bg-surface border rounded-2xl p-6 group transition-all shadow-xl ${selectedIds.includes(ch.id) ? 'border-brand ring-2 ring-brand/30' : 'border-border hover:border-brand/30'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(ch.id); }}
                        title="Select"
                        className={`absolute -top-2 -left-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shadow ${selectedIds.includes(ch.id) ? 'bg-brand border-brand text-white' : 'bg-surface border-border text-transparent hover:border-brand'}`}
                      >
                        <Icon icon="solar:check-read-linear" width="14" />
                      </button>
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
                           const next = ch.sync_enabled === false; // currently paused -> re-enable
                           const { error } = await supabase.from('channels').update({ sync_enabled: next }).eq('id', ch.id);
                           if (!error) { fetchChannels(); toast.success(next ? 'Daily sync resumed' : 'Daily sync paused for this channel'); }
                           else { toast.error('Failed to update sync setting'); }
                         }}
                         title={ch.sync_enabled === false ? 'Daily sync paused — click to resume' : 'Daily sync active — click to pause'}
                         className={`p-2 border rounded-lg transition-all ${ch.sync_enabled === false ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'bg-green-500/10 border-green-500/30 text-green-500'}`}
                       >
                          <Icon icon={ch.sync_enabled === false ? "solar:pause-bold" : "solar:refresh-circle-bold"} width="16" />
                       </button>
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
                       <button onClick={(e) => { e.stopPropagation(); setEditingChannel(ch); }} className="p-2 bg-surface-2 border border-border rounded-lg text-text-muted hover:text-brand transition-all" title="Edit channel">
                          <Icon icon="solar:pen-linear" width="16" />
                       </button>
                       <button onClick={(e) => handleSync(e, ch)} disabled={syncingId === ch.id} className="p-2 bg-surface-2 border border-border rounded-lg text-text-muted hover:text-green-500 transition-all" title="Sync channel">
                          <Icon icon="solar:refresh-linear" width="16" className={syncingId === ch.id ? 'animate-spin' : ''} />
                       </button>
                       <button onClick={(e) => handleDirectDelete(e, ch)} className="p-2 bg-surface-2 border border-border rounded-lg text-text-muted hover:bg-red-500 hover:text-white transition-all" title="Cascade delete channel & movies">
                          <Icon icon="solar:trash-bin-trash-linear" width="16" />
                       </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-text-primary">{ch.name}</h3>
                    {ch.sync_enabled === false && (
                      <span className="shrink-0 inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                        <Icon icon="solar:pause-bold" width="9" /> Paused
                      </span>
                    )}
                  </div>
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
          existingChannelIds={existingChannelIds}
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
