import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { searchPeopleByName } from '../lib/peopleSearch';
import { authHeaders } from '../lib/apiAuth';

const SOCIALS = [
  ['instagram', 'Instagram', 'instagram_url'],
  ['x', 'X / Twitter', 'twitter_url'],
  ['tiktok', 'TikTok', 'tiktok_url'],
  ['facebook', 'Facebook', 'facebook_url'],
  ['youtube', 'YouTube', 'youtube_handle'],
];

function handleFromUrl(value = '') {
  const clean = String(value).replace(/\/$/, '');
  return clean.startsWith('@') ? clean : `@${clean.split('/').filter(Boolean).pop() || ''}`;
}

export default function ClaimProfile() {
  const { user, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchMode, setSearchMode] = useState('name');
  const [filmResults, setFilmResults] = useState([]);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [searching, setSearching] = useState(false);
  const [filmCreditsLoading, setFilmCreditsLoading] = useState(false);
  const [person, setPerson] = useState(null);
  const [platform, setPlatform] = useState('');
  const [socialUrl, setSocialUrl] = useState('');
  const [socialHandle, setSocialHandle] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    document.title = 'Claim actor profile | MuviDB';
    const target = params.get('person');
    if (!target) return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(target);
    const request = supabase.from('people').select('*').eq(isUuid ? 'id' : 'slug', target).limit(1).maybeSingle();
    request.then(({ data }) => data && setPerson(data));
  }, [params]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profile_claims')
      .select('id,status,verification_status,verification_code,people(name,slug)')
      .eq('user_id', user.id).in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => data && setSubmitted(data));
  }, [user?.id]);

  useEffect(() => {
    if (query.trim().length < 2 || person || selectedFilm) {
      setSearching(false);
      if (!selectedFilm) { setResults([]); setFilmResults([]); }
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        if (searchMode === 'name') {
          const rows = await searchPeopleByName(query.trim(), { limit: 8, select: '*' });
          if (!cancelled) {
            setResults(rows || []);
            setFilmResults([]);
          }
        } else {
          const { data, error } = await supabase.from('films').select('id,title,year,poster_url').ilike('title', `%${query.trim()}%`).order('year', { ascending: false }).limit(8);
          if (error) throw error;
          if (!cancelled) {
            setFilmResults(data || []);
            setResults([]);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setResults([]);
          setFilmResults([]);
          toast.error('Search could not be completed. Please try again.');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, person, searchMode, selectedFilm]);

  const chooseFilm = async (film) => {
    setSelectedFilm(film);
    setFilmResults([]);
    setResults([]);
    setFilmCreditsLoading(true);
    try {
      const response = await fetch(`/api/content?resource=film-credits&filmId=${encodeURIComponent(film.id)}`);
      if (!response.ok) throw new Error('Unable to load film credits');
      const body = await response.json();
      const seen = new Set();
      setResults((body.credits || []).map((credit) => credit.people).filter((row) => {
        if (!row?.id || seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      }));
    } catch (error) {
      setResults([]);
      toast.error('The cast and crew could not be loaded. Please try again.');
    } finally {
      setFilmCreditsLoading(false);
    }
  };

  const knownSocials = useMemo(() => {
    if (!person) return [];
    return SOCIALS.map(([value, label, key]) => ({ value, label, url: person[key] }))
      .filter((item) => item.url);
  }, [person]);

  const chooseSocial = (item) => {
    setPlatform(item.value);
    setSocialUrl(item.url.startsWith('@') ? `https://youtube.com/${item.url}` : item.url);
    setSocialHandle(handleFromUrl(item.url));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!user?.id || !person?.id || !platform || !socialHandle.trim() || !socialUrl.trim() || !confirmed) return;
    setSubmitting(true);
    let data = null;
    let error = null;
    try {
      const response = await fetch('/api/actor-claims', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          action: 'submit-claim',
          personId: person.id,
          socialPlatform: platform,
          socialHandle: socialHandle.trim(),
          socialUrl: socialUrl.trim(),
          note: note.trim() || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) error = new Error(body.error || 'Unable to submit profile claim');
      else data = body.claim;
    } catch (requestError) {
      error = requestError;
    }
    setSubmitting(false);
    if (error) return toast.error(error.message.includes('policy') ? 'This profile cannot be claimed with the supplied details.' : error.message);
    setSubmitted(data);
    if (user.role !== 'professional') {
      await updateUserProfile({
        role: 'professional',
        account_intent: 'professional',
        professional_roles: [...new Set([...(user.professional_roles || []), 'actor'])],
        onboarded: true,
      }).catch((profileError) => console.warn('Claim submitted; professional session refresh is pending:', profileError));
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-bg px-4 pt-32 pb-20">
        <section className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-8 text-center md:p-12">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Icon icon="solar:chat-round-check-bold" width="32" />
          </div>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.25em] text-brand">Claim received</p>
          <h1 className="text-3xl font-black tracking-tight text-text-primary">We’ll contact the social account</h1>
          <p className="mt-5 text-sm leading-7 text-text-muted">
            MuviDB will contact the social account in this claim from an official MuviDB account. Reply from that account with the claim reference and verification code.
          </p>
          <div className="mt-7 rounded-xl border border-border bg-surface-2 p-5 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Claim reference</p>
            <p className="mt-1 font-mono text-lg font-black text-text-primary">{String(submitted.id).slice(0, 8).toUpperCase()}</p>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Verification code</p>
            <p className="mt-1 font-mono text-2xl font-black text-brand">{submitted.verification_code}</p>
          </div>
          <p className="mt-6 text-xs leading-6 text-text-muted">We will never ask for your password, login code, payment, or government ID.</p>
          <Link to="/pro-dashboard" className="mt-8 inline-flex rounded-xl bg-brand px-7 py-3 text-xs font-black text-white">Track claim</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg px-4 pt-28 pb-20">
      <section className="mx-auto max-w-3xl">
        <div className="mb-9 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-brand">Actor verification</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-text-primary">Claim your profile</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-text-muted">Choose your actor record and the official social account MuviDB should contact.</p>
        </div>

        {!person ? (
          <div className="rounded-2xl border border-border bg-surface p-7">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1.5">
              <button type="button" onClick={() => { setSearchMode('name'); setSelectedFilm(null); setQuery(''); setResults([]); }} className={`rounded-lg py-3 text-xs font-black ${searchMode === 'name' ? 'bg-brand text-white' : 'text-text-muted'}`}>Search my name</button>
              <button type="button" onClick={() => { setSearchMode('film'); setSelectedFilm(null); setQuery(''); setResults([]); }} className={`rounded-lg py-3 text-xs font-black ${searchMode === 'film' ? 'bg-brand text-white' : 'text-text-muted'}`}>Find me through a film</button>
            </div>
            <label htmlFor="claim-person-search" className="mt-6 block text-xs font-bold text-text-primary">{searchMode === 'name' ? 'Search your professional name' : selectedFilm ? `Choose yourself from ${selectedFilm.title}` : 'Search for a film you worked on'}</label>
            {!selectedFilm && <div className="relative mt-3"><input id="claim-person-search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder={searchMode === 'name' ? 'Start typing your name…' : 'Start typing a film title…'} aria-describedby="claim-search-status" className="w-full rounded-xl border border-border bg-surface-2 px-5 py-4 pr-14 text-sm text-text-primary outline-none focus:border-brand" />{searching && <Icon icon="solar:spinner-linear" width="22" className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-brand" />}</div>}
            <div id="claim-search-status" role="status" aria-live="polite" className="sr-only">{searching ? (searchMode === 'name' ? 'Searching professional profiles' : 'Searching films') : ''}</div>
            {selectedFilm && <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand bg-brand/5 p-4"><img src={selectedFilm.poster_url || '/images/film-placeholder.webp'} alt="" className="h-14 w-10 rounded object-cover" /><div><strong className="text-sm text-text-primary">{selectedFilm.title}</strong><p className="text-xs text-text-muted">{filmCreditsLoading ? 'Loading cast and crew…' : (selectedFilm.year || 'Year unknown')}</p></div><button type="button" disabled={filmCreditsLoading} onClick={() => { setSelectedFilm(null); setResults([]); setQuery(''); }} className="ml-auto text-xs font-bold text-brand disabled:opacity-50">Change film</button></div>}
            {searching && <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-hidden="true">{[0, 1, 2, 3].map((item) => <div key={item} className="flex animate-pulse items-center gap-4 rounded-xl border border-border p-4"><div className="h-14 w-12 rounded-xl bg-surface-2" /><div className="flex-1"><div className="h-3 w-2/3 rounded bg-surface-2" /><div className="mt-2 h-2.5 w-1/3 rounded bg-surface-2" /></div></div>)}</div>}
            {!searching && filmResults.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">{filmResults.map((film) => <button type="button" key={film.id} onClick={() => chooseFilm(film)} className="flex items-center gap-4 rounded-xl border border-border p-4 text-left hover:border-brand"><img src={film.poster_url || '/images/film-placeholder.webp'} alt="" className="h-14 w-10 rounded object-cover" /><span><strong className="block text-sm text-text-primary">{film.title}</strong><small className="text-text-muted">{film.year || 'Year unknown'}</small></span></button>)}</div>}
            {filmCreditsLoading && <div className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-border bg-surface-2 p-8 text-sm font-bold text-text-muted" role="status"><Icon icon="solar:spinner-linear" width="22" className="animate-spin text-brand" />Loading cast and crew…</div>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {!searching && !filmCreditsLoading && results.map((row) => (
                <button key={row.id} onClick={() => setPerson(row)} className="flex items-center gap-4 rounded-xl border border-border p-4 text-left hover:border-brand">
                  <img src={row.photo_url || '/images/person-placeholder.png'} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <span><strong className="block text-sm text-text-primary">{row.name}</strong><small className="text-text-muted">{row.known_for_department || 'Film professional'}</small></span>
                </button>
              ))}
            </div>
            {selectedFilm && !filmCreditsLoading && results.length === 0 && <p className="mt-5 rounded-xl bg-surface-2 p-5 text-sm text-text-muted">No cast or crew records were found for this film. Try searching your name instead.</p>}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6 rounded-2xl border border-border bg-surface p-7 md:p-9">
            <div className="flex items-center gap-4 border-b border-border pb-6">
              <img src={person.photo_url || '/images/person-placeholder.png'} alt="" className="h-20 w-20 rounded-2xl object-cover" />
              <div><p className="text-xs font-bold uppercase tracking-widest text-text-muted">Claiming</p><h2 className="mt-1 text-2xl font-black text-text-primary">{person.name}</h2></div>
              <button type="button" onClick={() => setPerson(null)} className="ml-auto text-xs font-bold text-brand">Change</button>
            </div>

            <div>
              <label className="text-xs font-bold text-text-primary">Where should MuviDB contact you?</label>
              {knownSocials.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2">{knownSocials.map((item) => <button type="button" key={item.value} onClick={() => chooseSocial(item)} className={`rounded-xl border p-4 text-left ${platform === item.value ? 'border-brand bg-brand/5' : 'border-border'}`}><strong className="block text-sm text-text-primary">{item.label}</strong><span className="mt-1 block truncate text-xs text-text-muted">{item.url}</span></button>)}</div>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="claim-social-platform" className="text-xs font-bold text-text-primary">Platform</label><select id="claim-social-platform" value={platform} onChange={(e) => setPlatform(e.target.value)} required className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary"><option value="">Select platform</option>{SOCIALS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div><label htmlFor="claim-social-handle" className="text-xs font-bold text-text-primary">@Handle</label><input id="claim-social-handle" value={socialHandle} onChange={(e) => setSocialHandle(e.target.value)} required placeholder="@yourhandle" className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary" /></div>
            </div>
            <div><label htmlFor="claim-social-url" className="text-xs font-bold text-text-primary">Full social profile URL</label><input id="claim-social-url" type="url" value={socialUrl} onChange={(e) => setSocialUrl(e.target.value)} required placeholder="https://instagram.com/yourhandle" className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary" /></div>
            <div><label htmlFor="claim-context" className="text-xs font-bold text-text-primary">Additional context <span className="font-normal text-text-muted">(optional)</span></label><textarea id="claim-context" value={note} onChange={(e) => setNote(e.target.value)} rows="3" placeholder="Anything that will help the reviewer confirm this account…" className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary" /></div>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4 text-xs leading-6 text-text-muted"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required className="mt-1 accent-brand" /><span>I confirm that I am the person represented by this profile and that I control the social account above.</span></label>
            <button disabled={submitting || !confirmed} className="w-full rounded-xl bg-brand py-4 text-xs font-black text-white disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit profile claim'}</button>
            <button type="button" onClick={() => navigate(-1)} className="w-full text-xs font-bold text-text-muted">Cancel</button>
          </form>
        )}
      </section>
    </main>
  );
}
