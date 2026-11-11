import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { formatVideoEmbed } from '../../lib/portfolioClient';

/**
 * Lumi Mirror Modular Bento Grid
 * Presents the creator's showreel, signature cinema & stage works,
 * commercial impact metrics, and representation in tactile optical glass tiles.
 */
export default function LumiMirrorBento({
  portfolio,
  person,
  films = [],
  stageCredits = [],
  finish,
  metrics,
}) {
  const [isPlayingReel, setIsPlayingReel] = useState(false);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    projectType: 'Directing',
    budget: '',
    message: '',
  });

  const reelEmbedUrl = portfolio.featured_reel_url
    ? formatVideoEmbed(portfolio.featured_reel_url)
    : null;

  const handleInquirySubmit = (e) => {
    e.preventDefault();
    if (!inquiryForm.name || !inquiryForm.email || !inquiryForm.message) {
      toast.error('Please fill in required fields.');
      return;
    }

    const recipient = portfolio.inquiry_email || person.booking_email;
    if (recipient) {
      const subject = encodeURIComponent(`Project Inquiry: ${inquiryForm.projectType} from ${inquiryForm.name}`);
      const body = encodeURIComponent(
        `Name: ${inquiryForm.name}\nEmail: ${inquiryForm.email}\nProject Type: ${inquiryForm.projectType}\nBudget: ${inquiryForm.budget}\n\nMessage:\n${inquiryForm.message}`
      );
      window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    }

    toast.success('Inquiry dispatched!');
    setInquiryModalOpen(false);
  };

  return (
    <div className="space-y-4 w-full">
      {/* ================= TILE 1: FEATURED SHOWREEL ================= */}
      {reelEmbedUrl && (
        <section
          className={`rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-4 overflow-hidden relative group`}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Icon icon="solar:videocamera-record-bold" className="text-brand text-sm" />
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-300">
                Official Showreel
              </span>
            </div>
            {isPlayingReel && (
              <button
                type="button"
                onClick={() => setIsPlayingReel(false)}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <Icon icon="solar:close-circle-linear" width="14" />
                <span>Close</span>
              </button>
            )}
          </div>

          {isPlayingReel ? (
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black shadow-inner">
              <iframe
                src={`${reelEmbedUrl}&autoplay=1`}
                title={`${person.name} Showreel`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div
              onClick={() => setIsPlayingReel(true)}
              className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-zinc-950 group cursor-pointer shadow-lg"
            >
              <img
                src={films[0]?.backdrop_url || films[0]?.poster_url || person.photo_url}
                alt={`${person.name} Reel Thumbnail`}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-70 group-hover:opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform">
                  <Icon icon="solar:play-bold" width="24" className="ml-1 text-brand" />
                </div>
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                <span className="font-semibold drop-shadow-md">{person.name} Reel</span>
                <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono border border-white/15">
                  Watch HD
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ================= TILE 2: CAREER IMPACT METRICS ================= */}
      {metrics && metrics.hasCommercialFootprint && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {metrics.formattedBoxOffice && (
            <div
              className={`rounded-2xl ${finish.cardSurface} ${finish.specularEdge} p-4 flex flex-col justify-between`}
            >
              <div className="flex items-center gap-1.5 text-zinc-400 mb-2">
                <Icon icon="solar:clapperboard-play-bold" className="text-amber-400 text-sm" />
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                  Cinema Gross
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight font-serif">
                {metrics.formattedBoxOffice}
              </p>
              <p className="text-[10px] text-zinc-400 mt-1">Credited Box Office</p>
            </div>
          )}

          {metrics.formattedViews && (
            <div
              className={`rounded-2xl ${finish.cardSurface} ${finish.specularEdge} p-4 flex flex-col justify-between`}
            >
              <div className="flex items-center gap-1.5 text-zinc-400 mb-2">
                <Icon icon="simple-icons:youtube" className="text-red-500 text-sm" />
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                  YouTube Views
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono">
                {metrics.formattedViews}
              </p>
              <p className="text-[10px] text-zinc-400 mt-1">Global Audience Reach</p>
            </div>
          )}

          {metrics.formattedStageBoxOffice && (
            <div
              className={`rounded-2xl ${finish.cardSurface} ${finish.specularEdge} p-4 flex flex-col justify-between col-span-2 sm:col-span-1`}
            >
              <div className="flex items-center gap-1.5 text-zinc-400 mb-2">
                <Icon icon="solar:masks-bold" className="text-orange-400 text-sm" />
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                  Stage Gross
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight font-serif">
                {metrics.formattedStageBoxOffice}
              </p>
              <p className="text-[10px] text-zinc-400 mt-1">Theatre Admissions</p>
            </div>
          )}
        </section>
      )}

      {/* ================= TILE 3: SIGNATURE PRODUCTIONS ================= */}
      {films.length > 0 && (
        <section
          className={`rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-4 sm:p-5`}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Icon icon="solar:clapperboard-bold" className="text-brand text-sm" />
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-300">
                Signature Productions ({films.length})
              </span>
            </div>
            <Link
              to={`/people/${person.slug || person.id}`}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition"
            >
              <span>View Filmography</span>
              <Icon icon="solar:arrow-right-linear" width="12" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {films.slice(0, 3).map((film) => (
              <Link
                key={film.id}
                to={`/films/${film.slug || film.id}`}
                className="group relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 aspect-[2/3] shadow-md hover:border-white/30 transition-all hover:scale-[1.02]"
              >
                <img
                  src={film.poster_url || '/placeholder-poster.png'}
                  alt={film.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-2 sm:p-2.5">
                  <span className="text-[10px] font-mono text-zinc-400">{film.year}</span>
                  <p className="text-xs font-bold text-white truncate drop-shadow-sm leading-tight">
                    {film.title}
                  </p>
                  <p className="text-[10px] text-brand truncate font-medium mt-0.5">
                    {film.roles?.[0] || 'Contributor'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ================= TILE 4: STAGE & THEATRE PRODUCTIONS ================= */}
      {stageCredits.length > 0 && (
        <section
          className={`rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-4 sm:p-5`}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Icon icon="solar:masks-bold" className="text-orange-400 text-sm" />
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-300">
                Stage & Theatre ({stageCredits.length})
              </span>
            </div>
            <Link
              to="/plays"
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition"
            >
              <span>Explore Stage</span>
              <Icon icon="solar:arrow-right-linear" width="12" />
            </Link>
          </div>

          <div className="space-y-2">
            {stageCredits.slice(0, 2).map((credit, idx) => (
              <Link
                key={idx}
                to={`/plays/${credit.play?.slug || credit.play_id}`}
                className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition group"
              >
                <div className="w-10 h-14 rounded-xl overflow-hidden bg-zinc-900 shrink-0 border border-white/10">
                  <img
                    src={credit.play?.poster_url || '/placeholder-poster.png'}
                    alt={credit.play?.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-brand transition">
                    {credit.play?.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {credit.role || 'Performer'} • {credit.character_name || credit.play?.venue_name || 'Stage'}
                  </p>
                </div>
                <Icon
                  icon="solar:arrow-right-linear"
                  className="text-zinc-500 group-hover:text-white transition shrink-0"
                  width="14"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ================= TILE 5: DIRECT BOOKING & REPRESENTATION ================= */}
      <section
        className={`rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-4 sm:p-5 relative overflow-hidden`}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Icon icon="solar:hand-stars-bold" className="text-brand text-sm" />
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-300">
              Representation & Booking
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed mb-4 px-1">
          For directing commissions, acting representation, co-production queries, or festival invitations.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {person.booking_whatsapp && (
            <a
              href={`https://wa.me/${person.booking_whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                `Hello ${person.name}, I found your Lumi Mirror portfolio and would like to discuss a project.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition shadow-sm active:scale-95"
            >
              <Icon icon="simple-icons:whatsapp" width="16" />
              <span>Connect on WhatsApp</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => setInquiryModalOpen(true)}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs transition shadow-sm active:scale-95 ${
              person.booking_whatsapp
                ? 'bg-white/10 hover:bg-white/15 border border-white/20 text-white'
                : `${finish.accentBg} col-span-2`
            }`}
          >
            <Icon icon="solar:letter-bold" width="16" />
            <span>Send Direct Inquiry</span>
          </button>
        </div>
      </section>

      {/* Direct Inquiry Modal */}
      {inquiryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div
            className={`relative w-full max-w-md rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-6 shadow-2xl border border-white/20 animate-in fade-in duration-200`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Icon icon="solar:letter-bold" className="text-brand" />
                <span>Inquiry for {person.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setInquiryModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <Icon icon="solar:close-circle-bold" width="20" />
              </button>
            </div>

            <form onSubmit={handleInquirySubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={inquiryForm.name}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                  placeholder="e.g. Chioma Okafor"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Your Email</label>
                <input
                  type="email"
                  required
                  value={inquiryForm.email}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                  placeholder="chioma@production.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Project Type</label>
                  <select
                    value={inquiryForm.projectType}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, projectType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs focus:outline-none focus:border-brand"
                  >
                    <option value="Directing">Directing</option>
                    <option value="Acting">Acting / Cast</option>
                    <option value="Producing">Producing</option>
                    <option value="Writing">Screenwriting</option>
                    <option value="Stage">Stage / Theatre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Budget Range</label>
                  <input
                    type="text"
                    value={inquiryForm.budget}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, budget: e.target.value })}
                    placeholder="e.g. ₦15M - ₦50M"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Message</label>
                <textarea
                  rows={3}
                  required
                  value={inquiryForm.message}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                  placeholder="Briefly describe your production timeline and scope..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-brand resize-none"
                />
              </div>

              <button
                type="submit"
                className={`w-full py-3 rounded-xl font-bold text-xs tracking-wide transition shadow-lg ${finish.accentBg}`}
              >
                Send Inquiry to Agent
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
