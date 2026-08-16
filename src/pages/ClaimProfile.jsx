import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { searchPeopleByName } from '../lib/peopleSearch';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
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
    if (query.trim().length < 3 || person) return setResults([]);
    const timer = setTimeout(async () => {
      const rows = await searchPeopleByName(query.trim(), { limit: 8, select: '*' });
      setResults(rows || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, person]);

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
    const { data, error } = await supabase.from('profile_claims').insert({
      user_id: user.id,
      person_id: person.id,
      status: 'pending',
      verification_status: 'awaiting_contact',
      social_platform: platform,
      social_handle: socialHandle.trim(),
      social_url: socialUrl.trim(),
      note: note.trim() || null,
    }).select('id,status,verification_status,verification_code,people(name,slug)').single();
    setSubmitting(false);
    if (error) return toast.error(error.message.includes('policy') ? 'This profile cannot be claimed with the supplied details.' : error.message);
    setSubmitted(data);
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
            <label htmlFor="claim-person-search" className="text-xs font-bold text-text-primary">Search your professional name</label>
            <input id="claim-person-search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="Start typing your name…" className="mt-3 w-full rounded-xl border border-border bg-surface-2 px-5 py-4 text-sm text-text-primary outline-none focus:border-brand" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {results.map((row) => (
                <button key={row.id} onClick={() => setPerson(row)} className="flex items-center gap-4 rounded-xl border border-border p-4 text-left hover:border-brand">
                  <img src={row.photo_url || '/images/person-placeholder.png'} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <span><strong className="block text-sm text-text-primary">{row.name}</strong><small className="text-text-muted">{row.known_for_department || 'Film professional'}</small></span>
                </button>
              ))}
            </div>
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
