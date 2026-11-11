import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { fetchPlayBySlug, getPlayDateLabel, formatPlayBoxOffice } from '../lib/plays';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { SuggestEditModal } from '../components/contribute/ContributeModals';
import SEO from '../components/SEO';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import CriticReviewsSection from '../components/film/CriticReviewsSection';
import ReviewSection from '../components/film/ReviewSection';
import PlayGallerySection from '../components/plays/PlayGallerySection';
import MobilePlayDetailView from '../components/plays/mobile/MobilePlayDetailView';

export default function PlayDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_limited';
  const [play, setPlay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBoxOfficeModal, setShowBoxOfficeModal] = useState(false);
  const [showPlayEdit, setShowPlayEdit] = useState(false);
  const [showAdminBoxOffice, setShowAdminBoxOffice] = useState(false);
  const boxOfficeInfo = useMemo(() => formatPlayBoxOffice(play), [play]);

  const loadPlay = React.useCallback(async () => {
    if (!slug) return;
    const data = await fetchPlayBySlug(slug);
    setPlay(data);
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    loadPlay().finally(() => setLoading(false));
  }, [loadPlay]);

  const rawCredits = play?.credits || [];
  const playDateLabel = play ? getPlayDateLabel(play, '') : '';

  // Deduplicate performers by person ID or name to prevent repeated cards for multi-hyphenate roles
  const uniquePerformers = React.useMemo(() => {
    const map = new Map();
    for (const cred of rawCredits) {
      const person = cred.person || {};
      const key = person.id || person.name || cred.id;
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, {
          id: cred.id,
          person,
          roles: new Set([cred.role].filter(Boolean)),
          characters: new Set([cred.character_name].filter(Boolean)),
        });
      } else {
        const existing = map.get(key);
        if (cred.role) existing.roles.add(cred.role);
        if (cred.character_name) existing.characters.add(cred.character_name);
        if (!existing.person.photo_url && person.photo_url) {
          existing.person = person;
        }
      }
    }

    return Array.from(map.values()).map(item => {
      // Normalize roles to prevent "Director" and "Director & Producer" redundantly repeating
      const rawRoles = Array.from(item.roles);
      const cleanedRoles = [];
      for (const r of rawRoles) {
        if (!cleanedRoles.some(cr => cr.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(cr.toLowerCase()))) {
          cleanedRoles.push(r);
        } else {
          // Keep the more descriptive one
          const idx = cleanedRoles.findIndex(cr => cr.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(cr.toLowerCase()));
          if (r.length > cleanedRoles[idx].length) {
            cleanedRoles[idx] = r;
          }
        }
      }

      return {
        ...item,
        roleDisplay: cleanedRoles.join(' · ') || 'Performer',
        characterDisplay: Array.from(item.characters).join(', '),
      };
    });
  }, [rawCredits]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!play) {
    return (
      <div className="min-h-screen bg-bg text-text-primary flex flex-col items-center justify-center p-6 text-center">
        <Icon icon="solar:masks-line-duotone" className="w-20 h-20 text-text-muted opacity-40 mb-4" />
        <h1 className="text-2xl font-bold text-text-primary mb-2">Stage Play Not Found</h1>
        <p className="text-text-muted text-sm mb-6 max-w-md">We couldn't find a theatrical play matching this page.</p>
        <Link to="/plays" className="px-6 py-2.5 rounded-xl bg-brand text-on-brand font-bold hover:bg-brand-hover transition-colors text-sm">
          Return to Theatre Index
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-28 md:pb-20">
      <SEO 
        title={`${play.title} (${playDateLabel}) - Stage Play | MuviDB`}
        description={play.synopsis || `Explore stage play production details, playwright ${play.playwright}, director ${play.director}, and ensemble cast on MuviDB.`}
      />

      {/* Mobile-First Stage Experience (< md) */}
      <MobilePlayDetailView
        play={play}
        playDateLabel={playDateLabel}
        uniquePerformers={uniquePerformers}
        images={play.images || []}
        isAdmin={isAdmin}
        onSuggestEdit={() => setShowPlayEdit(true)}
        onEditBoxOffice={() => setShowAdminBoxOffice(true)}
        onImagesUpdated={loadPlay}
      />

      {/* Desktop Stage Experience (>= md) */}
      <div className="hidden md:block">
      {/* Play Hero Header */}
      <section className="relative border-b border-border bg-surface/40 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <Link to="/plays" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-brand transition-colors mb-6 font-semibold">
            <Icon icon="solar:alt-arrow-left-linear" className="w-4 h-4" />
            Back to All Plays
          </Link>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Poster Card */}
            <div className="w-full md:w-64 flex-shrink-0">
              <ImageWithFallback
                src={play.poster_url || play.banner_url}
                alt={play.title}
                fallbackType="film"
                name={play.title}
                className="w-full h-80 object-cover rounded-2xl border border-border shadow-2xl"
                width={512}
                sizes="(max-width: 767px) 100vw, 256px"
                loading="eager"
              />
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-brand/15 border border-brand/30 text-brand text-xs font-bold uppercase tracking-wider">
                  <Icon icon="solar:masks-bold" className="inline-block mr-1 text-sm" />
                  {play.genre || 'Stage Production'}
                </span>
                {playDateLabel && (
                  <span className="text-sm font-semibold text-text-muted">
                    {playDateLabel}
                  </span>
                )}
                <span className="px-3 py-1 rounded-full bg-surface border border-border text-xs text-text-muted font-bold capitalize">
                  {play.status?.replace('_', ' ')}
                </span>
                {Boolean(play.box_office_domestic > 0) ? (
                  <div className="inline-flex items-center gap-1.5">
                    <Link
                      to={`/plays/${play.slug || play.id}/box-office`}
                      className="px-3.5 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-500/50 text-amber-400 text-xs font-bold tracking-wider inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer group"
                      title="Click to view admissions, ticket tiers & venue breakdown"
                    >
                      <Icon icon="solar:ticket-sale-bold" className="text-sm group-hover:scale-110 transition-transform" />
                      <span>{boxOfficeInfo?.fullBadge || `₦${Number(play.box_office_domestic).toLocaleString()} Box Office`}</span>
                      {boxOfficeInfo?.isEstimate && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Est.
                        </span>
                      )}
                      <Icon icon="solar:alt-arrow-right-linear" className="text-xs opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowAdminBoxOffice(true)}
                        className="p-1.5 rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors cursor-pointer"
                        title="Edit Play Box Office"
                      >
                        <Icon icon="solar:pen-bold" className="text-xs" />
                      </button>
                    )}
                  </div>
                ) : isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setShowAdminBoxOffice(true)}
                    className="px-3 py-1 rounded-full bg-brand/15 border border-brand/30 text-brand text-xs font-bold inline-flex items-center gap-1 hover:bg-brand/25 transition-colors cursor-pointer"
                  >
                    <Icon icon="solar:add-circle-bold" className="text-xs" />
                    <span>Add Box Office Figures</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setShowPlayEdit(true)}
                  className="px-3 py-1 rounded-full bg-surface-2 hover:bg-surface-3 border border-border text-text-secondary hover:text-text-primary text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
                  title="Suggest edits or updates for this stage production"
                >
                  <Icon icon="solar:pen-linear" className="text-xs text-brand" />
                  <span>Suggest Edit</span>
                </button>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-text-primary mb-4">
                {play.title}
              </h1>

              {/* Key Crew Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-xs bg-surface border border-border p-4 rounded-xl">
                <div>
                  <span className="text-text-muted uppercase font-semibold block">Playwright</span>
                  <span className="text-text-primary font-bold text-sm">{play.playwright || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold block">Director</span>
                  <span className="text-text-primary font-bold text-sm">{play.director || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold block">Run Dates</span>
                  <span className="text-text-primary font-bold text-sm">{playDateLabel || 'Date TBA'}</span>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold block">Venue & City</span>
                  <span className="text-brand font-bold text-sm">{play.venue ? `${play.venue} (${play.city})` : play.city || 'N/A'}</span>
                </div>
              </div>

              {/* Synopsis */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">Production Overview</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {play.synopsis || 'An acclaimed theatrical stage play celebrating storytelling and live dramatic craft.'}
                </p>
              </div>

              {play.source_url && (
                <a
                  href={play.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-brand hover:text-brand-hover transition-colors"
                >
                  <Icon icon="solar:link-round-bold" className="w-4 h-4" />
                  Original Source
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 space-y-12">
        {/* Ensemble Stage Cast Section */}
        <section className="pt-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand mb-1">Company & Ensemble</p>
              <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <Icon icon="solar:users-group-two-rounded-bold" className="text-brand w-6 h-6" />
                Stage Ensemble & Performers ({uniquePerformers.length})
              </h2>
            </div>
            {uniquePerformers.length > 0 && (
              <span className="text-xs text-text-muted font-medium hidden sm:inline-block">
                {uniquePerformers.length} credited {uniquePerformers.length === 1 ? 'member' : 'members'}
              </span>
            )}
          </div>

          {uniquePerformers.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-12 text-center">
              <Icon icon="solar:user-rounded-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
              <p className="text-lg font-bold text-text-primary mb-1">No stage performers linked yet</p>
              <p className="text-xs text-text-muted">Performers for this production will appear here as cast credits are added.</p>
            </div>
          ) : (
            <div className="flex overflow-x-auto snap-x scrollbar-none gap-3.5 pb-2 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 sm:gap-5">
              {uniquePerformers.map((item) => {
                const person = item.person || {};
                return (
                  <Link
                    key={item.id}
                    to={`/people/${person.slug || person.id}`}
                    className="group bg-surface/70 hover:bg-surface border border-border/80 hover:border-brand/60 rounded-2xl p-4 flex flex-col justify-between items-center text-center transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-brand/5 min-h-[210px] w-[150px] shrink-0 snap-start sm:w-auto"
                  >
                    <div className="flex flex-col items-center w-full">
                      <div className="relative mb-3">
                        <ImageWithFallback
                          src={person.photo_url}
                          alt={person.name || 'Performer'}
                          fallbackType="avatar"
                          name={person.name || 'Performer'}
                          className="w-20 h-20 rounded-full object-cover ring-2 ring-border/80 group-hover:ring-brand/60 transition-all shadow-lg shadow-black/20 group-hover:scale-105 duration-300"
                          width={160}
                          sizes="80px"
                          loading="lazy"
                        />
                      </div>
                      <h3 className="text-xs font-bold text-text-primary group-hover:text-brand transition-colors line-clamp-1 w-full px-1">
                        {person.name || 'Unknown Performer'}
                      </h3>
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 mt-2 rounded-full bg-brand/10 text-brand border border-brand/20 line-clamp-1 max-w-full">
                        {item.roleDisplay}
                      </span>
                    </div>

                    <div className="w-full mt-2 pt-2 border-t border-border/40">
                      {item.characterDisplay ? (
                        <p className="text-[11px] text-text-muted italic line-clamp-1 font-medium">
                          as {item.characterDisplay}
                        </p>
                      ) : (
                        <p className="text-[11px] text-text-muted/40 italic">
                          Stage credit
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Stage Show Gallery & Production Stills */}
        <PlayGallerySection
          play={play}
          images={play.images || []}
          isAdmin={isAdmin}
          onImagesUpdated={loadPlay}
        />

        {/* Critic Reviews Section */}
        <CriticReviewsSection playId={play.id} user={user} />

        {/* Audience Reviews & Reactions */}
        <ReviewSection playId={play.id} currentUser={user} filmTitle={play.title} />
      </div>
      </div>

      {/* Theatrical Box Office Breakdown Modal */}
      {showBoxOfficeModal && (
        <PlayBoxOfficeModal
          play={play}
          playDateLabel={playDateLabel}
          isAdmin={isAdmin}
          onClose={() => setShowBoxOfficeModal(false)}
        />
      )}

      {/* Suggest Edit / Change Request Modal */}
      {showPlayEdit && (
        <SuggestEditModal
          target="play"
          targetId={play.id}
          targetName={play.title}
          current={{
            title: play.title,
            venue: play.venue,
            city: play.city,
            playwright: play.playwright,
            director: play.director,
            genre: play.genre,
            synopsis: play.synopsis,
            box_office_domestic: play.box_office_domestic,
            box_office_tickets_sold: play.box_office_tickets_sold,
            box_office_source: play.box_office_source,
          }}
          onClose={() => setShowPlayEdit(false)}
        />
      )}

      {/* Admin Play Box Office Edit Modal */}
      {showAdminBoxOffice && (
        <AdminPlayBoxOfficeModal
          play={play}
          onClose={() => setShowAdminBoxOffice(false)}
          onUpdated={(updatedPlay) => {
            setPlay((prev) => ({
              ...prev,
              ...updatedPlay,
            }));
          }}
        />
      )}
    </div>
  );
}

function AdminPlayBoxOfficeModal({ play, onClose, onUpdated }) {
  const [gross, setGross] = useState(play.box_office_domestic != null ? String(play.box_office_domestic) : '');
  const [tickets, setTickets] = useState(play.box_office_tickets_sold != null ? String(play.box_office_tickets_sold) : '');
  const [currency, setCurrency] = useState(play.box_office_currency || 'NGN');
  const [source, setSource] = useState(play.box_office_source || 'Official Venue Reporting');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasExistingFigures = play.box_office_domestic != null || play.box_office_tickets_sold != null;

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete all box office figures for "${play.title}"?`)) {
      return;
    }
    setDeleting(true);
    try {
      const { data, error } = await supabase
        .from('plays')
        .update({
          box_office_domestic: null,
          box_office_tickets_sold: null,
          box_office_currency: null,
          box_office_source: null,
          box_office_updated_at: null,
          box_office_metrics: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', play.id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Stage play box office deleted successfully!');
      if (onUpdated) onUpdated(data);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not delete play box office.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedGross = gross ? Number(String(gross).replace(/[^0-9.]/g, '')) : null;
      const parsedTickets = tickets ? Number(String(tickets).replace(/[^0-9]/g, '')) : null;

      const { data, error } = await supabase
        .from('plays')
        .update({
          box_office_domestic: parsedGross,
          box_office_tickets_sold: parsedTickets,
          box_office_currency: currency,
          box_office_source: source.trim() || 'Official Venue Reporting',
          updated_at: new Date().toISOString(),
        })
        .eq('id', play.id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Stage play box office updated successfully!');
      if (onUpdated) onUpdated(data);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not update play box office.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-lg font-black text-text-primary">Edit Stage Play Box Office</h3>
            <p className="text-xs text-text-muted mt-0.5">{play.title}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text-primary cursor-pointer">
            <Icon icon="solar:close-circle-bold" className="text-2xl" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-text-secondary block mb-1">Total Gross Revenue</label>
            <input
              type="text"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              placeholder="e.g. 54000000 or ₦54,000,000"
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-text-secondary block mb-1">Tickets Sold / Admissions</label>
              <input
                type="number"
                value={tickets}
                onChange={(e) => setTickets(e.target.value)}
                placeholder="e.g. 2420"
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-text-secondary block mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
              >
                <option value="NGN">NGN (₦)</option>
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-text-secondary block mb-1">Source / Verification Proof</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Ticket Tailor report, Press Release"
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
            {hasExistingFigures ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Completely remove box office figures from this stage play"
              >
                {deleting ? (
                  <>
                    <Icon icon="solar:spinner-linear" className="animate-spin" width="16" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Icon icon="solar:trash-bin-trash-bold" width="16" />
                    <span>Delete Figures</span>
                  </>
                )}
              </button>
            ) : <div />}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="px-5 py-2.5 bg-brand text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-brand-hover transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-brand/20"
              >
                {saving ? (
                  <>
                    <Icon icon="solar:spinner-linear" className="animate-spin" width="16" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-bold" width="16" />
                    <span>Save Figures</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function PlayBoxOfficeModal({ play, playDateLabel, onClose, isAdmin = false }) {
  if (!play) return null;

  const modalBoxOffice = useMemo(() => formatPlayBoxOffice(play), [play]);

  const tiers = useMemo(() => {
    if (!play) return [];
    const raw = play.box_office_metrics?.tier_breakdown || play.box_office_metrics?.tier_pricing || play.ticket_pricing;
    if (Array.isArray(raw)) {
      return raw.map((item, i) => {
        if (typeof item === 'string') return { name: item, price: 0, sold: 0, gross: 0 };
        const name = item?.type || item?.name || item?.tier || item?.category || `Tier ${i + 1}`;
        const sold = Number(item?.sold ?? item?.sold_tickets ?? item?.tickets ?? 0);
        const price = Number(item?.priceNgn ?? item?.price ?? (typeof item?.amount === 'number' ? item.amount : 0));
        const gross = Number(item?.grossNgn ?? item?.gross_revenue ?? item?.gross ?? (sold > 0 && price > 0 ? sold * price : 0));
        return {
          name: String(name).trim(),
          sold: Number.isFinite(sold) ? sold : 0,
          price: Number.isFinite(price) ? price : 0,
          gross: Number.isFinite(gross) ? gross : 0,
        };
      }).filter(t => t && t.name);
    }
    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([k, v], i) => {
        let price = 0;
        let sold = 0;
        let gross = 0;
        if (typeof v === 'number') price = v;
        else if (typeof v === 'string') price = Number(v.replace(/[^0-9]/g, '')) || 0;
        else if (typeof v === 'object' && v !== null) {
          sold = Number(v.sold ?? v.sold_tickets ?? v.tickets ?? 0);
          price = Number(v.priceNgn ?? v.price ?? (typeof v.amount === 'number' ? v.amount : 0));
          gross = Number(v.gross ?? v.grossNgn ?? v.gross_revenue ?? (sold > 0 && price > 0 ? sold * price : 0));
        }
        return {
          name: String(k || `Tier ${i + 1}`).trim(),
          sold: Number.isFinite(sold) ? sold : 0,
          price: Number.isFinite(price) ? price : 0,
          gross: Number.isFinite(gross) ? gross : 0,
        };
      }).filter(t => t && t.name);
    }
    return [];
  }, [play]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
              <Icon icon="solar:ticket-sale-bold" className="text-sm" />
              <span>Theatrical Stage Box Office & Admissions</span>
            </div>
            <h3 className="text-xl font-black text-text-primary font-heading tracking-tight">
              {play.title}
            </h3>
            {playDateLabel && (
              <p className="text-xs text-text-muted mt-0.5">{playDateLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-bold" className="text-2xl" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              {modalBoxOffice?.isEstimate ? 'Gross Revenue (Est.)' : 'Gross Revenue'}
            </span>
            <p className="text-2xl font-black text-amber-400 font-heading">
              {modalBoxOffice?.primaryFormatted || `₦${Number(play.box_office_domestic || 0).toLocaleString()}`}
            </p>
            {modalBoxOffice?.convertedFormatted && (
              <span className="text-xs font-bold text-amber-300/80 block">
                {modalBoxOffice.convertedFormatted}
              </span>
            )}
            <span className="text-[10px] text-text-muted font-mono block">
              {modalBoxOffice?.isEstimate ? 'Industry estimated live revenue' : 'Stage box office revenue'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Admissions</span>
            <p className="text-2xl font-black text-purple-300 font-heading flex items-center gap-1.5">
              <Icon icon="solar:users-group-two-rounded-bold" className="text-purple-400 text-xl" />
              <span>{Number(play.box_office_tickets_sold || 0).toLocaleString()}</span>
            </p>
            <span className="text-[10px] text-text-muted font-mono block">Tickets sold across all tiers</span>
          </div>
        </div>



        {/* Venue & Location */}
        <div className="p-4 rounded-xl bg-surface-2/50 border border-border/60 space-y-2 text-xs">
          <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Performance Venue & Location</h4>
          <div className="flex items-start gap-2.5">
            <Icon icon="solar:map-point-wave-bold" className="text-brand text-lg shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-text-primary">{play.venue || 'Venue TBA'}</p>
              <p className="text-text-muted text-[11px]">{play.city || 'City TBA'}</p>
            </div>
          </div>
        </div>

        {/* Source verification footer — visible ONLY to admins */}
        {isAdmin && (
          <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-text-muted bg-surface-2/30 -mx-6 -mb-6 p-4 rounded-b-2xl">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:shield-check-bold" className="text-emerald-400 text-sm" />
              <span>Verified Source (Admin): <strong className="text-text-primary">{play.box_office_source || 'Immersia'}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE STICKY BOTTOM ACTION DOCK (md:hidden) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0D10]/95 backdrop-blur-xl border-t border-purple-500/25 px-4 py-2.5 flex items-center justify-between gap-3 md:hidden shadow-[0_-8px_25px_rgba(0,0,0,0.85)] pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {play.source_url ? (
          <a
            href={play.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-[42px] px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all"
          >
            <Icon icon="solar:ticket-sale-bold" className="text-base" />
            <span className="truncate">{tiers.length > 0 ? `Get Tickets · From ₦${Math.min(...tiers.map(t => t.price)).toLocaleString()}` : 'Get Tickets / Book'}</span>
          </a>
        ) : (
          <div className="flex-1 flex items-center gap-2 text-xs font-bold text-white/90 truncate">
            <Icon icon="solar:map-point-wave-bold" className="text-brand text-base shrink-0" />
            <span className="truncate">{play.venue ? `${play.venue} (${play.city})` : play.city || 'Live Stage Production'}</span>
          </div>
        )}

        {/* Share Button */}
        <button
          type="button"
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: play.title,
                text: `Experience "${play.title}" live on stage at ${play.venue || play.city}`,
                url: window.location.href,
              }).catch(() => {});
            } else {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Play link copied to clipboard!');
            }
          }}
          className="w-11 h-11 shrink-0 rounded-xl bg-white/[0.08] border border-white/15 text-white/80 hover:text-white flex items-center justify-center transition-all active:scale-95"
          title="Share Play"
          aria-label="Share Stage Play"
        >
          <Icon icon="solar:share-linear" className="text-lg" />
        </button>
      </div>
    </div>
  );
}
