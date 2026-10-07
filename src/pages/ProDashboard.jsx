import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatRole } from '../lib/creditRoles';
import { authHeaders } from '../lib/apiAuth';
import { professionalRoleLabel } from '../lib/professionalRoles';
import { getProfileProgress } from '../lib/professionalProfile';
import { formatViewCount } from '../utils/youtube';
import { fetchPersonStageCredits } from '../lib/plays';
import CreditRequestModal from '../components/professional/CreditRequestModal';
import ProfileEditorModal from '../components/professional/ProfileEditorModal';
import CareerPassportModal from '../components/professional/CareerPassportModal';
import CareerPassportWelcome from '../components/professional/CareerPassportWelcome';
import PhotoUploadModal from '../components/professional/PhotoUploadModal';
import VideoUploadModal from '../components/professional/VideoUploadModal';
import ProVideoTheaterModal from '../components/professional/ProVideoTheaterModal';
import ProIntelligenceAssistant from '../components/professional/ProIntelligenceAssistant';
import { submitProProfileUpdate, notifyProAdminOnTelegram } from '../lib/proModeration';

const NIGERIAN_GUILDS = [
  { id: 'agn', label: 'Actors Guild of Nigeria (AGN)', badge: 'AGN' },
  { id: 'dgn', label: 'Directors Guild of Nigeria (DGN)', badge: 'DGN' },
  { id: 'tampan', label: 'Theatre Arts & Motion Pictures Practitioners Association (TAMPAN)', badge: 'TAMPAN' },
  { id: 'ancop', label: 'Association of Nollywood Core Producers (ANCOP)', badge: 'ANCOP' },
  { id: 'cdgn', label: 'Creative Designers Guild of Nigeria (CDGN)', badge: 'CDGN' },
  { id: 'sag_aftra', label: 'SAG-AFTRA (International)', badge: 'SAG-AFTRA' },
];

const OPEN_STATUSES = ['submitted', 'pending', 'in_review', 'needs_information'];

function StatusPill({ status }) {
  const normalized = String(status || 'pending');
  const tone = normalized === 'approved'
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
    : normalized === 'rejected'
      ? 'border-red-500/20 bg-red-500/10 text-red-400'
      : 'border-amber-500/20 bg-amber-500/10 text-amber-400';
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${tone}`}>
      {normalized.replaceAll('_', ' ')}
    </span>
  );
}

function MetricCard({ icon, label, value, detail, highlight }) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-[#161616] p-4 transition hover:-translate-y-0.5 hover:border-brand/40">
      <div className="flex items-start justify-between">
        <p className="text-[9px] font-black uppercase tracking-[.2em] text-text-muted">{label}</p>
        <span className={`rounded-lg p-2 ${highlight ? 'bg-red-500/10 text-red-400' : 'bg-brand/10 text-brand'}`}>
          <Icon icon={icon} width="16" />
        </span>
      </div>
      <p className="mt-2.5 text-2xl font-black tracking-tight text-text-primary">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-text-muted">{detail}</p>
    </article>
  );
}

function EmptyState({ icon, title, body, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[.015] px-6 py-10 text-center">
      <Icon icon={icon} width="32" className="mx-auto text-brand" />
      <h3 className="mt-3 text-sm font-black text-text-primary">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function formatMoney(value, currency = 'NGN') {
  const amount = Number(value) || 0;
  const prefix = currency === 'NGN' ? '₦' : `${currency} `;
  if (amount >= 1_000_000_000) return `${prefix}${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${prefix}${(amount / 1_000_000).toFixed(1)}M`;
  return `${prefix}${amount.toLocaleString()}`;
}

export default function ProDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [access, setAccess] = useState(null);
  const [claim, setClaim] = useState(null);
  const [credits, setCredits] = useState([]);
  const [stageCredits, setStageCredits] = useState([]);
  const [creditRequests, setCreditRequests] = useState([]);
  const [profileRequests, setProfileRequests] = useState([]);

  // Active Top Navigation Tab: 'filmography' | 'photos' | 'videos' | 'awards' | 'representation' | 'requests'
  const [activeTab, setActiveTab] = useState('filmography');

  // Filmography Toolbar State
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [releaseFilter, setReleaseFilter] = useState('all');
  const [sortKey, setSortKey] = useState('year_desc');

  // Photos & Media State
  const [photoCategoryFilter, setPhotoCategoryFilter] = useState('all');
  const [videoCategoryFilter, setVideoCategoryFilter] = useState('all');

  // Modals & Action States
  const [addingCredit, setAddingCredit] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Inline Form States (Less Pop-ups)
  const [inlineRepOpen, setInlineRepOpen] = useState(false);
  const [repForm, setRepForm] = useState({
    agency: '',
    agent_name: '',
    agent_email: '',
    agent_phone: '',
    manager_name: '',
    manager_email: '',
    publicist: '',
    guilds: ['agn'],
    territory: 'Pan-African & International',
  });
  const [savingRep, setSavingRep] = useState(false);

  const [inlineAwardOpen, setInlineAwardOpen] = useState(false);
  const [awardForm, setAwardForm] = useState({
    name: '',
    category: '',
    year: new Date().getFullYear(),
    status: 'Winner',
    organization: '',
  });
  const [savingAward, setSavingAward] = useState(false);

  const [theaterVideo, setTheaterVideo] = useState(null);
  const [passportOpen, setPassportOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [exporting, setExporting] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { data: accessRow, error: accessError } = await supabase
        .from('actor_profile_access')
        .select('*,people(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (accessError) throw accessError;
      setAccess(accessRow || null);

      if (!accessRow) {
        const { data: claimRow, error: claimError } = await supabase
          .from('profile_claims')
          .select('*,people(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (claimError) throw claimError;
        setClaim(claimRow || null);
        setCredits([]);
        setStageCredits([]);
        setCreditRequests([]);
        setProfileRequests([]);
        return;
      }

      const [creditResponse, stageCreditResponse, requestResponse, profileResponse] = await Promise.all([
        fetch(`/api/content?resource=person-credits&personId=${encodeURIComponent(accessRow.person_id)}`).then((res) =>
          res.ok ? res.json() : Promise.reject(new Error('credits unavailable'))
        ),
        fetchPersonStageCredits(accessRow.person_id),
        supabase
          .from('actor_credit_requests')
          .select('*')
          .eq('submitted_by', user.id)
          .eq('person_id', accessRow.person_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contributions')
          .select('id,status,payload,note,created_at,reviewed_at')
          .eq('submitted_by', user.id)
          .eq('type', 'edit_person')
          .eq('target_id', accessRow.person_id)
          .order('created_at', { ascending: false }),
      ]);

      if (requestResponse.error) throw requestResponse.error;
      if (profileResponse.error) throw profileResponse.error;

      setCredits(creditResponse.credits || []);
      setStageCredits(stageCreditResponse || []);
      setCreditRequests(requestResponse.data || []);
      setProfileRequests(profileResponse.data || []);
    } catch (error) {
      console.error('Professional dashboard failed to load', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    document.title = 'IMDbPro Creator Dashboard | MuviDB';
    if (user?.role === 'admin' || user?.role === 'admin_limited') navigate('/admin');
    else load();
  }, [load, navigate, user?.role]);

  const person = access?.people || {};
  const progress = useMemo(() => getProfileProgress(person, credits), [person, credits]);
  const pendingRemoval = useMemo(
    () => new Set(creditRequests.filter((r) => r.request_type === 'remove' && OPEN_STATUSES.includes(r.status)).map((r) => r.credit_id)),
    [creditRequests]
  );
  const openRequests = [...creditRequests, ...profileRequests].filter((r) => OPEN_STATUSES.includes(r.status));
  const hasPendingProfileUpdate = profileRequests.some((r) => OPEN_STATUSES.includes(r.status));

  // Extract Highlights / Photos / Videos from person record
  const youtubeStats = person.youtube_stats || {};
  const highlights = Array.isArray(youtubeStats.instagram_highlights) ? youtubeStats.instagram_highlights : [];
  const photosList = useMemo(() => highlights.filter((h) => h.type === 'photo'), [highlights]);
  const videosList = useMemo(() => highlights.filter((h) => h.type === 'video'), [highlights]);
  const awardsList = Array.isArray(person.awards) ? person.awards : [];
  const repData = youtubeStats.representation || {};

  const pendingRepRequest = profileRequests.find(
    (r) => OPEN_STATUSES.includes(r.status) && r.payload?.fields?.representation
  );
  const pendingAwardsRequest = profileRequests.find(
    (r) => OPEN_STATUSES.includes(r.status) && r.payload?.fields?.awards
  );

  useEffect(() => {
    if (repData && Object.keys(repData).length) {
      setRepForm({
        agency: repData.agency || '',
        agent_name: repData.agent_name || '',
        agent_email: repData.agent_email || '',
        agent_phone: repData.agent_phone || '',
        manager_name: repData.manager_name || '',
        manager_email: repData.manager_email || '',
        publicist: repData.publicist || '',
        guilds: Array.isArray(repData.guilds) && repData.guilds.length ? repData.guilds : ['agn'],
        territory: repData.territory || 'Pan-African & International',
      });
    }
  }, [person.id, repData.agency, repData.agent_name, repData.manager_name]);

  const handleSaveRepresentation = async (e) => {
    e.preventDefault();
    setSavingRep(true);
    try {
      const updatedRep = {
        agency: repForm.agency.trim() || null,
        agent_name: repForm.agent_name.trim() || null,
        agent_email: repForm.agent_email.trim() || null,
        agent_phone: repForm.agent_phone.trim() || null,
        manager_name: repForm.manager_name.trim() || null,
        manager_email: repForm.manager_email.trim() || null,
        publicist: repForm.publicist.trim() || null,
        guilds: repForm.guilds,
        territory: repForm.territory || 'Pan-African & International',
        updated_at: new Date().toISOString(),
      };

      const res = await submitProProfileUpdate({
        person,
        updateType: 'representation',
        proposedFields: { representation: updatedRep },
        summary: `Representation & Guild update: ${updatedRep.agency || 'Direct'} (${updatedRep.guilds?.join(', ').toUpperCase()})`,
        details: [
          updatedRep.agency ? `Agency: ${updatedRep.agency}` : null,
          updatedRep.agent_name ? `Agent: ${updatedRep.agent_name} (${updatedRep.agent_email || 'No email'})` : null,
          updatedRep.manager_name ? `Manager: ${updatedRep.manager_name}` : null,
          `Guilds: ${updatedRep.guilds?.join(', ').toUpperCase()}`,
        ].filter(Boolean).join('\n'),
      });

      if (!res.ok) throw res.error;

      toast.success('Representation & guild changes submitted for admin approval! Admin notified on Telegram.');
      setInlineRepOpen(false);
      load();
    } catch (err) {
      console.error('Representation submit error:', err);
      toast.error('Failed to submit representation updates.');
    } finally {
      setSavingRep(false);
    }
  };

  const handleSaveAward = async (e) => {
    e.preventDefault();
    if (!awardForm.name.trim()) {
      return toast.error('Please enter the award or organization name.');
    }
    setSavingAward(true);
    try {
      const newAwardItem = {
        name: awardForm.name.trim(),
        category: awardForm.category.trim() || 'General Recognition',
        year: Number(awardForm.year) || new Date().getFullYear(),
        status: awardForm.status || 'Winner',
        organization: awardForm.organization.trim() || null,
        created_at: new Date().toISOString(),
      };

      const existingAwards = Array.isArray(person.awards) ? [...person.awards] : [];
      const updatedAwards = [newAwardItem, ...existingAwards];

      const res = await submitProProfileUpdate({
        person,
        updateType: 'awards',
        proposedFields: { awards: updatedAwards },
        summary: `Added ${newAwardItem.status}: "${newAwardItem.name}" (${newAwardItem.year}) - ${newAwardItem.category}`,
        details: `Award: ${newAwardItem.name}\nCategory: ${newAwardItem.category}\nYear: ${newAwardItem.year}\nStatus: ${newAwardItem.status}`,
      });

      if (!res.ok) throw res.error;

      toast.success('Award submitted for review! Admin notified on Telegram.');
      setAwardForm({
        name: '',
        category: '',
        year: new Date().getFullYear(),
        status: 'Winner',
        organization: '',
      });
      setInlineAwardOpen(false);
      load();
    } catch (err) {
      console.error('Award submit error:', err);
      toast.error('Failed to submit award.');
    } finally {
      setSavingAward(false);
    }
  };

  const roles = (user?.professional_roles?.length ? user.professional_roles : [person?.known_for_department || 'actor']).map(
    professionalRoleLabel
  );

  const youtubeViews = Number(youtubeStats.views) || 0;
  const youtubeSubscribers = Number(youtubeStats.subscribers) || 0;
  const uniqueCreditsForBo = useMemo(() => {
    const seen = new Set();
    return credits.filter((c) => {
      const fid = c.films?.id || c.film_id;
      if (!fid || seen.has(fid)) return false;
      seen.add(fid);
      return true;
    });
  }, [credits]);

  const reportedBoxOffice = uniqueCreditsForBo.reduce((sum, credit) => {
    const film = credit.films || {};
    const bo = Number(film.streaming_links?.box_office?.domestic || film.box_office_domestic || film.box_office_worldwide) || 0;
    return sum + bo;
  }, 0);

  // Filtered & Sorted Credits
  const filteredCredits = useMemo(() => {
    return credits.filter((c) => {
      const film = c.films || {};
      const titleMatch = !searchQuery || (film.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (c.character_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!titleMatch) return false;

      // Role filter
      if (roleFilter === 'acting' && c.role !== 'actor') return false;
      if (roleFilter === 'directing' && c.role !== 'director') return false;
      if (roleFilter === 'producing' && !['producer', 'executive_producer'].includes(c.role)) return false;

      // Release filter
      if (releaseFilter === 'cinema' && film.release_type !== 'cinema' && !film.box_office_source) return false;
      if (releaseFilter === 'youtube' && !film.youtube_watch_url && film.release_type !== 'youtube') return false;
      if (releaseFilter === 'streaming' && !['netflix', 'prime', 'amazon', 'showmax'].includes(film.release_type)) return false;

      return true;
    }).sort((a, b) => {
      if (sortKey === 'year_desc') return (b.films?.year || 0) - (a.films?.year || 0);
      if (sortKey === 'year_asc') return (a.films?.year || 0) - (b.films?.year || 0);
      if (sortKey === 'title_asc') return (a.films?.title || '').localeCompare(b.films?.title || '');
      if (sortKey === 'box_office') {
        const aBox = Number(a.films?.box_office_domestic || a.films?.box_office_worldwide) || Number(a.films?.view_count) || 0;
        const bBox = Number(b.films?.box_office_domestic || b.films?.box_office_worldwide) || Number(b.films?.view_count) || 0;
        return bBox - aBox;
      }
      return 0;
    });
  }, [credits, searchQuery, roleFilter, releaseFilter, sortKey]);

  // Request Removal Action
  const requestRemoval = async (credit) => {
    const reason = window.prompt(`Why should “${credit.films?.title || 'this credit'}” be removed from your filmography?`);
    if (!reason?.trim()) return;
    try {
      const { error } = await supabase.from('actor_credit_requests').insert({
        submitted_by: user.id,
        person_id: access.person_id,
        request_type: 'remove',
        credit_id: credit.id,
        note: reason.trim(),
        status: 'submitted',
      });
      if (error) throw error;

      notifyProAdminOnTelegram({
        personId: access.person_id,
        personName: person.name,
        personSlug: person.slug,
        updateType: 'credits',
        summary: `Credit removal request for "${credit.films?.title || 'Film'}"`,
        details: `Reason: ${reason.trim()}`,
        link: '/admin/actor-claims',
      }).catch((err) => console.warn('Credit removal telegram alert error:', err));

      toast.success('Removal request sent to editorial review.');
      load();
    } catch (error) {
      console.error('Credit removal request failed', error);
      toast.error('We couldn’t send this request. Please try again.');
    }
  };

  // Set Primary Headshot
  const handleSetPrimaryPhoto = async (photoUrl) => {
    try {
      const updatedHighlights = highlights.map((h) => ({
        ...h,
        is_primary: h.url === photoUrl,
      }));

      const { error } = await supabase
        .from('people')
        .update({
          photo_url: photoUrl,
          youtube_stats: {
            ...youtubeStats,
            instagram_highlights: updatedHighlights,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', person.id);

      if (error) throw error;
      toast.success('Primary headshot updated successfully!');
      load();
    } catch (err) {
      toast.error('Failed to set primary photo.');
    }
  };

  // Delete Media Item
  const handleDeleteMedia = async (mediaId) => {
    if (!window.confirm('Are you sure you want to remove this item from your portfolio?')) return;
    try {
      const updatedHighlights = highlights.filter((h) => h.id !== mediaId);
      const { error } = await supabase
        .from('people')
        .update({
          youtube_stats: {
            ...youtubeStats,
            instagram_highlights: updatedHighlights,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', person.id);

      if (error) throw error;
      toast.success('Media removed from your portfolio.');
      load();
    } catch (err) {
      toast.error('Failed to remove media.');
    }
  };

  const exportCv = async (format) => {
    setExporting(format);
    try {
      const response = await fetch('/api/actor-claims', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'export-professional-cv', format }),
      });
      if (!response.ok) throw new Error('export failed');
      const blob = await response.blob();
      const filename = `${person.name}-${format}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`${format === 'resume' ? 'Resume' : 'Detailed CV'} downloaded.`);
    } catch (error) {
      console.error('Professional PDF export failed', error);
      toast.error('We couldn’t prepare your PDF right now. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] px-4 pb-20 pt-28">
        <div className="mx-auto max-w-7xl animate-pulse space-y-6">
          <div className="h-64 rounded-3xl bg-white/[.04]" />
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="h-24 rounded-2xl bg-white/[.04]" />
            <div className="h-24 rounded-2xl bg-white/[.04]" />
            <div className="h-24 rounded-2xl bg-white/[.04]" />
            <div className="h-24 rounded-2xl bg-white/[.04]" />
          </div>
          <div className="h-96 rounded-3xl bg-white/[.04]" />
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] px-4 pb-20 pt-32">
        <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#171717] p-9 text-center">
          <Icon icon="solar:cloud-cross-linear" width="40" className="mx-auto text-brand" />
          <h1 className="mt-4 text-2xl font-black text-text-primary">Dashboard Connection Issue</h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">Your data is safe. Please check your network and refresh.</p>
          <button onClick={load} className="mt-6 rounded-xl bg-brand px-6 py-3 text-xs font-black text-white">
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (!access) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] px-4 pb-20 pt-32">
        <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#171717] p-8 text-center md:p-12">
          {claim?.status === 'pending' ? (
            <>
              <Icon icon="solar:hourglass-line-bold" width="42" className="mx-auto text-brand" />
              <p className="mt-5 text-[10px] font-black uppercase tracking-[.24em] text-brand">Profile claim</p>
              <h1 className="mt-2 text-3xl font-black text-text-primary">Your claim is under review</h1>
              <p className="mt-4 text-sm leading-7 text-text-muted">
                MuviDB will contact <strong className="text-text-primary">{claim.social_handle}</strong> on {claim.social_platform}.
              </p>
            </>
          ) : (
            <>
              <Icon icon="solar:user-check-linear" width="42" className="mx-auto text-brand" />
              <h1 className="mt-5 text-3xl font-black text-text-primary">Connect your professional profile</h1>
              <p className="mt-4 text-sm leading-7 text-text-muted">
                Find your existing MuviDB page, claim it and bring your credits into your IMDbPro workspace.
              </p>
              <Link to="/claim" className="mt-7 inline-flex rounded-xl bg-brand px-7 py-3 text-xs font-black text-white">
                Find my profile
              </Link>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#0d0d0d] px-4 pb-24 pt-20 text-text-primary">
      {/* Cinematic Ambient Glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(circle_at_80%_0%,rgba(255,83,31,.14),transparent_45%),radial-gradient(circle_at_20%_20%,rgba(255,255,255,.03),transparent_35%)]" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 rounded-lg bg-brand/15 px-2.5 py-1 text-[10px] font-black tracking-widest text-brand uppercase">
              <Icon icon="solar:shield-check-bold" width="14" /> MuviDB Pro
            </span>
            <span className="text-xs font-bold text-text-muted truncate">Creator Studio & Industry Passport</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setUploadingPhoto(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] px-3 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-black text-text-primary transition hover:border-brand/40 hover:text-brand"
            >
              <Icon icon="solar:camera-add-bold" width="15" /> Add Photo
            </button>
            <button
              onClick={() => setUploadingVideo(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] px-3 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-black text-text-primary transition hover:border-brand/40 hover:text-brand"
            >
              <Icon icon="solar:videocamera-record-bold" width="15" /> Add Reel
            </button>
            <button
              onClick={() => setAddingCredit(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90"
            >
              <Icon icon="solar:add-circle-bold" width="15" /> Add Credit
            </button>
            <Link
              to="/advanced-search"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] px-3 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-black text-text-primary transition hover:border-brand/40 hover:text-brand"
              title="Search shared filmographies, comparisons & granular talent data"
            >
              <Icon icon="solar:tuning-square-2-bold" width="15" className="text-brand" /> Advanced Search
            </Link>
            <Link
              to={`/people/${person.slug || person.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.03] px-3 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-black text-text-muted transition hover:border-white/25 hover:text-white"
            >
              <Icon icon="solar:eye-linear" width="15" /> Public View
            </Link>
          </div>
        </div>

        {/* Cinematic Studio Hero Banner */}
        <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1a1a1a] via-[#141414] to-[#0d0d0d] p-5 shadow-2xl md:p-8">
          <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-brand/10 blur-[110px] pointer-events-none" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
            {/* Avatar & Hover Quick Upload */}
            <div className="group relative shrink-0 mx-auto sm:mx-0">
              <img
                src={person.photo_url || '/images/person-placeholder.png'}
                alt={person.name}
                className="h-40 w-32 rounded-2xl border-2 border-white/15 object-cover shadow-2xl md:h-48 md:w-38"
              />
              <span className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full border-2 border-[#141414] bg-brand text-white shadow-lg">
                <Icon icon="solar:verified-check-bold" width="16" />
              </span>
              <button
                onClick={() => setUploadingPhoto(true)}
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/70 p-2 text-center opacity-0 backdrop-blur-sm transition duration-200 group-hover:opacity-100"
              >
                <Icon icon="solar:camera-bold" width="24" className="text-brand" />
                <span className="mt-1 text-[10px] font-black text-white">Change Headshot</span>
              </button>
            </div>

            {/* Profile Identity Details */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-brand/25 bg-brand/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand">
                  <Icon icon="solar:star-circle-bold" width="12" /> Verified Talent
                </span>
                {repData.guilds?.map((g) => (
                  <span key={g} className="rounded-full border border-white/10 bg-white/[.04] px-2.5 py-0.5 text-[9px] font-black uppercase text-text-muted">
                    {g.toUpperCase()}
                  </span>
                ))}
                {hasPendingProfileUpdate && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase text-amber-400">
                    <Icon icon="solar:hourglass-line-bold" width="11" /> In Review
                  </span>
                )}
              </div>

              <h1 className="mt-2.5 truncate text-2xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">{person.name}</h1>
              <p className="mt-1 text-xs sm:text-sm font-black text-brand tracking-wide">{roles.join(' · ')}</p>
              
              <p className="mt-2.5 max-w-2xl text-xs leading-relaxed text-text-muted line-clamp-2">
                {person.bio || 'Add a professional biography and career milestones so producers, casting directors, and international festival juries can discover your profile.'}
              </p>

              {/* Badges & Location */}
              <div className="mt-3.5 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-xs text-text-muted">
                {person.nationality && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:global-linear" className="text-brand" width="14" />
                    {person.nationality}
                  </span>
                )}
                {person.birthplace && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:map-point-linear" className="text-brand" width="14" />
                    {person.birthplace}
                  </span>
                )}
                {repData.agency && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:buildings-2-bold" className="text-emerald-400" width="14" />
                    Rep: <strong className="text-white">{repData.agency}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Profile Strength & Passport Card */}
            <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5 lg:w-72 shadow-inner">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Profile Completeness</p>
                  <p className="mt-0.5 text-2xl font-black text-white">{progress.percent}%</p>
                </div>
                <div
                  className="relative grid h-12 w-12 place-items-center rounded-full"
                  style={{ background: `conic-gradient(#ff531f ${progress.percent * 3.6}deg, rgba(255,255,255,.08) 0)` }}
                >
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-[#161616] text-[10px] font-black text-text-primary">
                    {progress.completed}/{progress.total}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${progress.percent}%` }} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEditingProfile(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] py-2 text-xs font-black text-text-primary transition hover:border-brand/40 hover:text-brand"
                >
                  <Icon icon="solar:pen-2-bold" width="14" /> Edit Bio
                </button>
                <button
                  onClick={() => setPassportOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-xs font-black text-white shadow-lg shadow-brand/15 transition hover:bg-brand/90"
                >
                  <Icon icon="solar:share-bold" width="14" /> Passport
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* High-Level Stat Cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon="solar:clapperboard-play-bold" label="Total Filmography" value={credits.length} detail="Verified Nollywood & African credits" />
          <MetricCard icon="solar:gallery-wide-bold" label="Portfolio Media" value={highlights.length} detail={`${photosList.length} photos · ${videosList.length} video reels`} />
          <MetricCard icon="solar:cup-star-bold" label="Industry Awards" value={awardsList.length} detail={`${awardsList.filter((a) => a.status === 'Winner').length} wins · ${awardsList.filter((a) => a.status !== 'Winner').length} nominations`} />
          <MetricCard
            icon="logos:youtube-icon"
            label="YouTube Channel Views"
            value={youtubeViews ? formatViewCount(youtubeViews) : '—'}
            detail={youtubeViews ? 'Synced from linked channel' : 'Connect in representation'}
            highlight={Boolean(youtubeViews)}
          />
        </div>

        {/* Redesigned Floating Segmented Capsule Navigation (Zero scrollbars, zero clipping) */}
        <div className="sticky top-20 z-30">
          <nav
            className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#141414]/95 p-1.5 shadow-2xl backdrop-blur-xl no-scrollbar scrollbar-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {[
              { id: 'filmography', label: 'Filmography', icon: 'solar:clapperboard-bold', count: credits.length },
              { id: 'photos', label: 'Photos', icon: 'solar:camera-bold', count: photosList.length },
              { id: 'videos', label: 'Showreels', icon: 'solar:videocamera-record-bold', count: videosList.length },
              { id: 'awards', label: 'Awards', icon: 'solar:cup-star-bold', count: awardsList.length },
              { id: 'representation', label: 'Representation', icon: 'solar:users-group-two-rounded-bold' },
              { id: 'intelligence', label: 'AI Studio', icon: 'solar:magic-stick-3-bold', badge: 'Pro' },
              { id: 'requests', label: 'Requests', icon: 'solar:inbox-bold', count: openRequests.length },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-black transition-all ${
                    isActive
                      ? 'bg-brand text-white shadow-lg shadow-brand/25'
                      : 'text-text-muted hover:bg-white/[.05] hover:text-white'
                  }`}
                >
                  <Icon icon={tab.icon} width="16" className={isActive ? 'text-white' : 'text-text-muted group-hover:text-white'} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`grid min-w-[18px] place-items-center rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-white/[.07] text-text-muted group-hover:bg-white/15 group-hover:text-white'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {tab.badge && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                        isActive
                          ? 'bg-black/30 text-amber-200'
                          : 'bg-brand/15 text-brand group-hover:bg-brand/25'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab 1: Filmography & Credits */}
        {activeTab === 'filmography' && (
          <div className="space-y-4">
            {/* Toolbar: Search, Role Filter, Release Filter, View Toggle, Sort */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#161616] p-3.5">
              {/* Search Bar */}
              <div className="relative min-w-[220px] flex-1">
                <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-3 text-text-muted" width="16" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search titles, characters..."
                  className="w-full rounded-xl border border-white/10 bg-white/[.03] py-2 pl-10 pr-4 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>

              {/* Role Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Roles' },
                  { id: 'acting', label: 'Acting' },
                  { id: 'directing', label: 'Directing' },
                  { id: 'producing', label: 'Producing' },
                ].map((rf) => (
                  <button
                    key={rf.id}
                    onClick={() => setRoleFilter(rf.id)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition ${
                      roleFilter === rf.id ? 'bg-brand text-white' : 'bg-white/[.04] text-text-muted hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>

              {/* Sort & View Mode */}
              <div className="flex items-center gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#202020] px-3 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                >
                  <option value="year_desc">Year (Newest)</option>
                  <option value="year_asc">Year (Oldest)</option>
                  <option value="title_asc">Title (A–Z)</option>
                  <option value="box_office">Box Office / Views</option>
                </select>

                <div className="hidden sm:flex rounded-xl border border-white/10 bg-white/[.03] p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`rounded-lg p-1.5 transition ${viewMode === 'table' ? 'bg-brand text-white' : 'text-text-muted hover:text-white'}`}
                    title="Table View"
                  >
                    <Icon icon="solar:list-bold" width="16" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`rounded-lg p-1.5 transition ${viewMode === 'grid' ? 'bg-brand text-white' : 'text-text-muted hover:text-white'}`}
                    title="Poster Grid View"
                  >
                    <Icon icon="solar:widget-4-bold" width="16" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results Count & Add Credit CTA */}
            <div className="flex items-center justify-between px-1 text-xs text-text-muted">
              <span>Showing {filteredCredits.length} of {credits.length} verified productions</span>
              <button onClick={() => setAddingCredit(true)} className="inline-flex items-center gap-1.5 text-xs font-black text-brand hover:underline">
                <Icon icon="solar:add-circle-bold" width="16" /> Add missing credit
              </button>
            </div>

            {/* Mobile Card Stack View (Eliminates mobile horizontal table scroll) */}
            <div className="block sm:hidden space-y-3">
              {filteredCredits.length === 0 ? (
                <EmptyState
                  icon="solar:clapperboard-text-linear"
                  title="No credits found"
                  body="Try adjusting your search or add a missing title to your filmography."
                  action={<button onClick={() => setAddingCredit(true)} className="text-xs font-black text-brand">Add credit →</button>}
                />
              ) : (
                filteredCredits.map((credit) => {
                  const film = credit.films || {};
                  const boxOffice = Number(film.streaming_links?.box_office?.domestic || film.box_office_domestic || film.box_office_worldwide) || 0;
                  return (
                    <article key={credit.id} className="rounded-2xl border border-white/10 bg-[#161616] p-3.5 flex gap-3.5 items-start">
                      <img
                        src={film.poster_url || '/images/film-placeholder.webp'}
                        alt=""
                        className="h-20 w-14 shrink-0 rounded-xl border border-white/10 object-cover shadow"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <Link
                            to={`/films/${film.slug || credit.film_id}`}
                            className="font-black text-sm text-text-primary hover:text-brand line-clamp-1"
                          >
                            {film.title || 'Untitled Film'}
                          </Link>
                          <span className="shrink-0 rounded bg-white/[.06] px-1.5 py-0.5 text-[10px] font-black text-text-primary">
                            {film.year || 'N/A'}
                          </span>
                        </div>

                        <p className="mt-0.5 text-xs font-bold text-brand">{formatRole(credit.role)}</p>
                        {credit.character_name && (
                          <p className="text-[11px] text-text-muted truncate">as {credit.character_name}</p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2">
                          <div>
                            {boxOffice > 0 ? (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-300">
                                {formatMoney(boxOffice, film.box_office_currency || 'NGN')}
                              </span>
                            ) : Number(film.view_count) > 0 ? (
                              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-black text-red-300">
                                {formatViewCount(film.view_count)} views
                              </span>
                            ) : null}
                          </div>

                          <button
                            disabled={pendingRemoval.has(credit.id)}
                            onClick={() => requestRemoval(credit)}
                            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-text-muted transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                          >
                            {pendingRemoval.has(credit.id) ? 'Pending' : 'Request Removal'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            {viewMode === 'table' && (
              <div className="hidden sm:block overflow-hidden rounded-2xl border border-white/10 bg-[#161616]">
                <div className="overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 bg-white/[.02] text-[10px] font-black uppercase tracking-wider text-text-muted">
                      <tr>
                        <th className="py-3.5 pl-4 pr-2">Poster</th>
                        <th className="px-4 py-3.5">Production Title</th>
                        <th className="px-4 py-3.5">Role / Character</th>
                        <th className="px-4 py-3.5">Year</th>
                        <th className="px-4 py-3.5">Metrics / Box Office</th>
                        <th className="py-3.5 pl-4 pr-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium text-text-muted">
                      {filteredCredits.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center">
                            <EmptyState
                              icon="solar:clapperboard-text-linear"
                              title="No credits matched your filter"
                              body="Try searching a different title or add a missing production to your filmography."
                              action={<button onClick={() => setAddingCredit(true)} className="text-xs font-black text-brand">Add credit →</button>}
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredCredits.map((credit) => {
                          const film = credit.films || {};
                          const boxOffice = Number(film.streaming_links?.box_office?.domestic || film.box_office_domestic || film.box_office_worldwide) || 0;
                          return (
                            <tr key={credit.id} className="transition hover:bg-white/[.02]">
                              <td className="py-3 pl-4 pr-2">
                                <img
                                  src={film.poster_url || '/images/film-placeholder.webp'}
                                  alt=""
                                  className="h-12 w-9 rounded-lg border border-white/10 object-cover shadow"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Link
                                  to={`/films/${film.slug || credit.film_id}`}
                                  className="font-black text-text-primary hover:text-brand"
                                >
                                  {film.title || 'Untitled Film'}
                                </Link>
                                <div className="mt-0.5 flex flex-wrap gap-1.5">
                                  {film.release_type && (
                                    <span className="rounded bg-white/[.04] px-1.5 py-0.5 text-[9px] font-bold uppercase text-text-muted">
                                      {film.release_type}
                                    </span>
                                  )}
                                  {film.average_rating > 0 && (
                                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
                                      ⭐ {Number(film.average_rating).toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-bold text-text-primary">{formatRole(credit.role)}</p>
                                {credit.character_name && (
                                  <p className="text-[11px] text-text-muted">as <span className="text-brand">{credit.character_name}</span></p>
                                )}
                              </td>
                              <td className="px-4 py-3 font-bold text-text-primary">
                                {film.year || 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                {boxOffice > 0 ? (
                                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                                    {formatMoney(boxOffice, film.box_office_currency || 'NGN')}
                                  </span>
                                ) : Number(film.view_count) > 0 ? (
                                  <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-black text-red-300">
                                    {formatViewCount(film.view_count)} views
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-text-muted">—</span>
                                )}
                              </td>
                              <td className="py-3 pl-4 pr-4 text-right">
                                <button
                                  disabled={pendingRemoval.has(credit.id)}
                                  onClick={() => requestRemoval(credit)}
                                  className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold text-text-muted transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                                >
                                  {pendingRemoval.has(credit.id) ? 'Pending' : 'Request Removal'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Poster Grid View */}
            {viewMode === 'grid' && (
              <div className="hidden sm:grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredCredits.map((credit) => {
                  const film = credit.films || {};
                  return (
                    <article key={credit.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#161616] transition hover:-translate-y-1 hover:border-brand/40">
                      <div className="relative aspect-[2/3] w-full overflow-hidden bg-black">
                        <img
                          src={film.poster_url || '/images/film-placeholder.webp'}
                          alt={film.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur-md">
                          {film.year || 'N/A'}
                        </div>
                      </div>
                      <div className="p-3.5">
                        <Link to={`/films/${film.slug || credit.film_id}`} className="block truncate text-sm font-black text-text-primary group-hover:text-brand">
                          {film.title || 'Untitled'}
                        </Link>
                        <p className="mt-1 text-xs text-brand">{formatRole(credit.role)}</p>
                        {credit.character_name && (
                          <p className="truncate text-[11px] text-text-muted">as {credit.character_name}</p>
                        )}
                        <div className="mt-3 border-t border-white/5 pt-2 text-right">
                          <button
                            disabled={pendingRemoval.has(credit.id)}
                            onClick={() => requestRemoval(credit)}
                            className="text-[10px] font-bold text-text-muted hover:text-red-400"
                          >
                            {pendingRemoval.has(credit.id) ? 'Removal Pending' : 'Request Removal'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Photos & Headshots */}
        {activeTab === 'photos' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#161616] p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand">Portfolio Gallery</p>
                <h3 className="text-base font-black text-text-primary">Professional Headshots & Production Stills</h3>
              </div>
              <button
                onClick={() => setUploadingPhoto(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-brand/20 hover:bg-brand/90"
              >
                <Icon icon="solar:camera-add-bold" width="18" /> Upload High-Res Photo
              </button>
            </div>

            {photosList.length === 0 ? (
              <EmptyState
                icon="solar:camera-bold"
                title="No portfolio photos yet"
                body="Upload professional headshots, production stills, behind-the-scenes moments, and red carpet captures."
                action={
                  <button onClick={() => setUploadingPhoto(true)} className="rounded-xl bg-brand px-5 py-2.5 text-xs font-black text-white">
                    Upload Your First Photo
                  </button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {photosList.map((photo) => (
                  <article key={photo.id || photo.url} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#161616]">
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-black">
                      <img src={photo.url} alt={photo.title || 'Portfolio photo'} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      {photo.is_primary && (
                        <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[9px] font-black text-white shadow-lg">
                          <Icon icon="solar:star-bold" width="12" /> Primary Avatar
                        </span>
                      )}
                      <span className="absolute right-2.5 top-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[9px] font-black uppercase text-white backdrop-blur-md">
                        {photo.category?.replaceAll('_', ' ') || 'Photo'}
                      </span>
                    </div>
                    <div className="p-3.5">
                      <p className="truncate text-xs font-black text-text-primary">{photo.title || 'Official Photo'}</p>
                      {photo.photographer && <p className="text-[10px] text-text-muted">Photo by: {photo.photographer}</p>}

                      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5 text-[11px]">
                        {!photo.is_primary && (
                          <button
                            onClick={() => handleSetPrimaryPhoto(photo.url)}
                            className="font-bold text-brand hover:underline"
                          >
                            Set as Primary
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMedia(photo.id)}
                          className="font-bold text-text-muted hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Videos & Showreels */}
        {activeTab === 'videos' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#161616] p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand">Performance Reels</p>
                <h3 className="text-base font-black text-text-primary">Showreels, Monologues & Film Scene Clips</h3>
              </div>
              <button
                onClick={() => setUploadingVideo(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-brand/20 hover:bg-brand/90"
              >
                <Icon icon="solar:videocamera-record-bold" width="18" /> Add Video / Reel
              </button>
            </div>

            {videosList.length === 0 ? (
              <EmptyState
                icon="solar:videocamera-record-bold"
                title="No video reels added yet"
                body="Add acting showreels, dramatic monologues, audition tapes, or link scene clips directly from your films."
                action={
                  <button onClick={() => setUploadingVideo(true)} className="rounded-xl bg-brand px-5 py-2.5 text-xs font-black text-white">
                    Add Your First Reel
                  </button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {videosList.map((video) => (
                  <article key={video.id || video.url} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#161616] transition hover:border-brand/40">
                    <div
                      onClick={() => setTheaterVideo(video)}
                      className="relative aspect-video w-full cursor-pointer overflow-hidden bg-black"
                    >
                      <img src={video.thumbnail || '/images/film-placeholder.webp'} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 grid place-items-center bg-black/30 transition group-hover:bg-black/50">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/90 text-white shadow-xl transition group-hover:scale-110">
                          <Icon icon="solar:play-bold" width="22" />
                        </span>
                      </div>
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-black/70 px-2.5 py-0.5 text-[9px] font-black uppercase text-brand backdrop-blur-md">
                        {video.category?.replaceAll('_', ' ') || 'Reel'}
                      </span>
                    </div>

                    <div className="p-4">
                      <h4 className="truncate text-xs font-black text-text-primary">{video.title}</h4>
                      {video.film_title && (
                        <p className="mt-1 truncate text-[11px] text-text-muted">
                          Tagged: <strong className="text-text-primary">{video.film_title}</strong>
                        </p>
                      )}
                      {video.character_name && (
                        <p className="text-[10px] text-brand">as {video.character_name}</p>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5 text-[11px]">
                        <button
                          onClick={() => setTheaterVideo(video)}
                          className="font-black text-brand hover:underline"
                        >
                          Play Reel →
                        </button>
                        <button
                          onClick={() => handleDeleteMedia(video.id)}
                          className="font-bold text-text-muted hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Awards & Honors */}
        {activeTab === 'awards' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#161616] p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand">Recognition</p>
                <h3 className="text-base font-black text-text-primary">Industry Awards & Nominations</h3>
              </div>
              <button
                onClick={() => setInlineAwardOpen(!inlineAwardOpen)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90"
              >
                <Icon icon={inlineAwardOpen ? 'solar:close-circle-bold' : 'solar:add-circle-bold'} width="16" />
                {inlineAwardOpen ? 'Cancel' : 'Add Award / Nomination'}
              </button>
            </div>

            {/* Inline Award Submission Form (No Pop-ups!) */}
            {inlineAwardOpen && (
              <form onSubmit={handleSaveAward} className="space-y-4 rounded-2xl border border-brand/30 bg-[#191615] p-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/15 text-amber-400">
                      <Icon icon="solar:cup-star-bold" width="18" />
                    </span>
                    <div>
                      <h4 className="text-sm font-black text-white">Add Award or Industry Nomination</h4>
                      <p className="text-[11px] text-text-muted">Changes go to admin review and notify on Telegram before publishing.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setInlineAwardOpen(false)} className="text-text-muted hover:text-white">
                    <Icon icon="solar:close-circle-linear" width="20" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold uppercase text-text-muted">Award Name / Honor *</label>
                    <input
                      type="text"
                      required
                      value={awardForm.name}
                      onChange={(e) => setAwardForm({ ...awardForm, name: e.target.value })}
                      placeholder="e.g. Africa Magic Viewers' Choice Awards (AMVCA)"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-text-muted">Category</label>
                    <input
                      type="text"
                      value={awardForm.category}
                      onChange={(e) => setAwardForm({ ...awardForm, category: e.target.value })}
                      placeholder="e.g. Best Actor in a Leading Role (Drama)"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-text-muted">Year</label>
                    <input
                      type="number"
                      value={awardForm.year}
                      onChange={(e) => setAwardForm({ ...awardForm, year: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-text-muted">Result</label>
                    <select
                      value={awardForm.status}
                      onChange={(e) => setAwardForm({ ...awardForm, status: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-[#222] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                    >
                      <option value="Winner">Winner / Won</option>
                      <option value="Nominee">Nominee / Nominated</option>
                      <option value="Honoree">Special Honoree / Recognition</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold uppercase text-text-muted">Organization / Production Association</label>
                    <input
                      type="text"
                      value={awardForm.organization}
                      onChange={(e) => setAwardForm({ ...awardForm, organization: e.target.value })}
                      placeholder="e.g. Multichoice / AMVCA Board of Jurors"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setInlineAwardOpen(false)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-text-muted hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAward}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-xs font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50"
                  >
                    {savingAward ? (
                      <>
                        <Icon icon="solar:restart-circle-bold" className="animate-spin" width="16" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:check-circle-bold" width="16" /> Submit for Approval
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {pendingAwardsRequest && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300">
                <Icon icon="solar:hourglass-line-bold" width="20" className="shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-black">Award Update Pending Editorial Review</p>
                  <p className="text-[11px] text-amber-300/80">Your recent award submission is queued for admin approval. Admin was notified on Telegram.</p>
                </div>
              </div>
            )}

            {awardsList.length === 0 ? (
              <EmptyState
                icon="solar:cup-star-bold"
                title="No awards listed yet"
                body="Add your verified awards, festival selections, and nominations to showcase on your public IMDbPro profile."
                action={
                  <button
                    onClick={() => setInlineAwardOpen(true)}
                    className="rounded-xl bg-brand px-4 py-2 text-xs font-black text-white"
                  >
                    Add Your First Award
                  </button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {awardsList.map((award, i) => (
                  <article key={i} className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-[#161616] p-4">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${award.status === 'Winner' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[.04] text-text-muted'}`}>
                      <Icon icon="solar:cup-star-bold" width="22" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${award.status === 'Winner' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[.05] text-text-muted'}`}>
                          {award.status || 'Nominee'}
                        </span>
                        <span className="text-[10px] font-bold text-text-muted">{award.year}</span>
                      </div>
                      <h4 className="mt-1 text-xs font-black text-text-primary">{award.name}</h4>
                      <p className="mt-0.5 text-[11px] text-text-muted">{award.category}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Representation & Guilds */}
        {activeTab === 'representation' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#161616] p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand">Talent Representation & Guilds</p>
                <h3 className="text-base font-black text-text-primary">Agent, Manager & Professional Guild Credentials</h3>
              </div>
              <button
                onClick={() => setInlineRepOpen(!inlineRepOpen)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90"
              >
                <Icon icon={inlineRepOpen ? 'solar:close-circle-bold' : 'solar:pen-2-bold'} width="16" />
                {inlineRepOpen ? 'Cancel' : 'Edit Contacts & Guilds'}
              </button>
            </div>

            {pendingRepRequest && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300">
                <Icon icon="solar:hourglass-line-bold" width="20" className="shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-black">Representation Updates In Review</p>
                  <p className="text-[11px] text-amber-300/80">Your proposed contact & guild changes are in the moderation queue awaiting approval. Admin was notified on Telegram.</p>
                </div>
              </div>
            )}

            {/* Inline Representation Editor (No Pop-ups!) */}
            {inlineRepOpen && (
              <form onSubmit={handleSaveRepresentation} className="space-y-6 rounded-2xl border border-brand/30 bg-[#191615] p-5 md:p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-white">Edit Representation, Contacts & Guild Memberships</h4>
                    <p className="text-[11px] text-text-muted">Update your agent, manager, and affiliations. All changes go to admin for approval with immediate Telegram alert.</p>
                  </div>
                  <button type="button" onClick={() => setInlineRepOpen(false)} className="text-text-muted hover:text-white">
                    <Icon icon="solar:close-circle-linear" width="20" />
                  </button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Agency & Agent */}
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <p className="text-[10px] font-black uppercase text-brand">Talent Agency & Agent</p>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted">Agency Name</label>
                      <input
                        type="text"
                        value={repForm.agency}
                        onChange={(e) => setRepForm({ ...repForm, agency: e.target.value })}
                        placeholder="e.g. The Temple Management Company"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted">Agent Name</label>
                      <input
                        type="text"
                        value={repForm.agent_name}
                        onChange={(e) => setRepForm({ ...repForm, agent_name: e.target.value })}
                        placeholder="e.g. Femi Adeyemi"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted">Agent Email</label>
                        <input
                          type="email"
                          value={repForm.agent_email}
                          onChange={(e) => setRepForm({ ...repForm, agent_email: e.target.value })}
                          placeholder="agent@agency.com"
                          className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted">WhatsApp / Phone</label>
                        <input
                          type="text"
                          value={repForm.agent_phone}
                          onChange={(e) => setRepForm({ ...repForm, agent_phone: e.target.value })}
                          placeholder="+234 800 000 0000"
                          className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Manager & Publicist */}
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <p className="text-[10px] font-black uppercase text-brand">Management & Public Relations</p>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted">Manager / Management Company</label>
                      <input
                        type="text"
                        value={repForm.manager_name}
                        onChange={(e) => setRepForm({ ...repForm, manager_name: e.target.value })}
                        placeholder="e.g. Raw Artistry Management (London / Lagos)"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted">Manager Email</label>
                      <input
                        type="email"
                        value={repForm.manager_email}
                        onChange={(e) => setRepForm({ ...repForm, manager_email: e.target.value })}
                        placeholder="management@rawartistry.com"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted">Publicist / PR Agency</label>
                      <input
                        type="text"
                        value={repForm.publicist}
                        onChange={(e) => setRepForm({ ...repForm, publicist: e.target.value })}
                        placeholder="e.g. MediaRoom Hub PR & Communications"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                </div>

                {/* Guild Memberships Selection */}
                <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                  <p className="text-[10px] font-black uppercase text-brand">Guild & Union Affiliations</p>
                  <p className="mt-1 text-xs text-text-muted">Select all industry guilds and unions you currently hold membership in:</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {NIGERIAN_GUILDS.map((g) => {
                      const isSelected = repForm.guilds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setRepForm({
                              ...repForm,
                              guilds: isSelected
                                ? repForm.guilds.filter((id) => id !== g.id)
                                : [...repForm.guilds, g.id],
                            });
                          }}
                          className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                            isSelected
                              ? 'border-brand bg-brand/10 text-white'
                              : 'border-white/10 bg-white/[.02] text-text-muted hover:border-white/20'
                          }`}
                        >
                          <span className={`grid h-6 w-6 place-items-center rounded-md text-xs ${isSelected ? 'bg-brand text-white' : 'bg-white/10 text-text-muted'}`}>
                            <Icon icon={isSelected ? 'solar:check-square-bold' : 'solar:square-linear'} width="16" />
                          </span>
                          <span className="text-xs font-bold leading-tight">{g.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setInlineRepOpen(false)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-text-muted hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingRep}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50"
                  >
                    {savingRep ? (
                      <>
                        <Icon icon="solar:restart-circle-bold" className="animate-spin" width="16" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:check-circle-bold" width="16" /> Submit for Admin Approval
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Read-only Display Cards */}
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-3xl border border-white/10 bg-[#161616] p-6 md:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-brand">Talent Representation</p>
                    <h3 className="text-lg font-black text-text-primary">Agent & Manager Contacts</h3>
                  </div>
                  <button
                    onClick={() => setInlineRepOpen(true)}
                    className="rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-black text-brand hover:border-brand/40"
                  >
                    Edit Contacts
                  </button>
                </div>

                <div className="mt-5 space-y-4 text-xs">
                  <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <p className="text-[10px] font-black uppercase text-brand">Talent Agency</p>
                    <p className="mt-1 text-sm font-black text-text-primary">{repData.agency || 'Not specified'}</p>
                    {repData.agent_name && <p className="mt-1 text-text-muted">Agent: {repData.agent_name}</p>}
                    {repData.agent_email && <p className="text-text-muted">Email: {repData.agent_email}</p>}
                    {repData.agent_phone && <p className="text-text-muted">WhatsApp/Phone: {repData.agent_phone}</p>}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <p className="text-[10px] font-black uppercase text-brand">Personal Management & Publicist</p>
                    <p className="mt-1 text-sm font-black text-text-primary">{repData.manager_name || 'Direct Management'}</p>
                    {repData.manager_email && <p className="mt-1 text-text-muted">Email: {repData.manager_email}</p>}
                    {repData.publicist && <p className="text-text-muted">PR: {repData.publicist}</p>}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-[#161616] p-6 md:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-brand">Affiliations</p>
                    <h3 className="text-lg font-black text-text-primary">Guild & Union Memberships</h3>
                  </div>
                  <button
                    onClick={() => setInlineRepOpen(true)}
                    className="rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-black text-brand hover:border-brand/40"
                  >
                    Manage Guilds
                  </button>
                </div>

                <div className="mt-5 space-y-2.5">
                  {(repData.guilds || ['agn']).map((g) => (
                    <div key={g} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.02] p-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
                          <Icon icon="solar:shield-check-bold" width="18" />
                        </span>
                        <span className="text-xs font-black uppercase tracking-wide text-text-primary">
                          {NIGERIAN_GUILDS.find((item) => item.id === g)?.label || `${g.toUpperCase()} Member`}
                        </span>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-black text-emerald-400">Verified</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Tab 6: Requests & History */}
        {activeTab === 'requests' && (
          <section className="rounded-3xl border border-white/10 bg-[#161616] p-6 md:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand">Editorial Queue</p>
                <h3 className="text-lg font-black text-text-primary">Submitted Requests & Status</h3>
              </div>
              <span className="text-xs font-bold text-text-muted">{creditRequests.length + profileRequests.length} Total</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {creditRequests.length === 0 && profileRequests.length === 0 && (
                <div className="md:col-span-2">
                  <EmptyState icon="solar:inbox-linear" title="No requests in review" body="Profile updates and credit submissions will appear here with editorial feedback." />
                </div>
              )}
              {profileRequests.map((req) => (
                <article key={req.id} className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase text-brand">Profile Update</p>
                      <h4 className="mt-1 text-xs font-black text-text-primary">Profile details change</h4>
                    </div>
                    <StatusPill status={req.status} />
                  </div>
                  <p className="mt-3 text-[10px] text-text-muted">Submitted {new Date(req.created_at).toLocaleDateString()}</p>
                </article>
              ))}
              {creditRequests.map((req) => (
                <article key={req.id} className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase text-brand">{req.request_type.replaceAll('_', ' ')}</p>
                      <h4 className="mt-1 text-xs font-black text-text-primary">
                        {req.proposed_film?.title || credits.find((c) => c.film_id === req.film_id || c.id === req.credit_id)?.films?.title || 'Credit Submission'}
                      </h4>
                    </div>
                    <StatusPill status={req.status} />
                  </div>
                  <p className="mt-3 text-[10px] text-text-muted">Submitted {new Date(req.created_at).toLocaleDateString()}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Tab: Pro AI Industry Intelligence */}
        {activeTab === 'intelligence' && (
          <ProIntelligenceAssistant person={person} credits={credits} />
        )}
      </div>

      {/* Modals */}
      {addingCredit && <CreditRequestModal person={person} onClose={() => setAddingCredit(false)} onSaved={load} />}
      {editingProfile && <ProfileEditorModal person={person} onClose={() => setEditingProfile(false)} onSaved={load} />}
      {uploadingPhoto && <PhotoUploadModal person={person} onClose={() => setUploadingPhoto(false)} onSaved={load} />}
      {uploadingVideo && <VideoUploadModal person={person} credits={credits} onClose={() => setUploadingVideo(false)} onSaved={load} />}
      {theaterVideo && <ProVideoTheaterModal video={theaterVideo} onClose={() => setTheaterVideo(null)} />}
      {welcomeOpen && <CareerPassportWelcome firstName={person.name?.split(' ')[0]} onDismiss={() => setWelcomeOpen(false)} onCreate={() => { setWelcomeOpen(false); setPassportOpen(true); }} />}
      {passportOpen && <CareerPassportModal person={{ ...person, claimed: true }} credits={credits} stageCredits={stageCredits} personalized onClose={() => setPassportOpen(false)} />}
    </main>
  );
}
