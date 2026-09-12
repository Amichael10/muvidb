import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { formatBoxOffice } from '../../utils/format';

export default function IndustryPulseBar({ topBoxOfficeFilm, topYoutubeFilm, topCriticFilm }) {
  return (
    <section className="relative z-20 -mt-2 mb-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border/80 bg-surface/80 backdrop-blur-xl p-3 sm:p-4 shadow-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        
        {/* Live Industry Ticker Items */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
          {/* Pulse Live Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/15 border border-brand/30 text-brand text-[10px] font-black uppercase tracking-wider shrink-0">
            <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
            <span>Nollywood Pulse</span>
          </div>

          {/* 1. Box Office Leader */}
          <Link
            to={topBoxOfficeFilm ? `/films/${topBoxOfficeFilm.slug || topBoxOfficeFilm.id}` : '/browse?sort=box_office'}
            className="group/item inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2/60 hover:bg-surface-2 border border-border/60 hover:border-amber-500/40 transition-all text-xs"
          >
            <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Icon icon="solar:cup-star-bold" className="text-xs" />
            </span>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Theatrical King:</span>
              <span className="font-bold text-text-primary group-hover/item:text-brand transition-colors truncate max-w-[140px] sm:max-w-[180px]">
                {topBoxOfficeFilm?.title || 'A Tribe Called Judah'}
              </span>
              <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                {topBoxOfficeFilm?.box_office ? formatBoxOffice(topBoxOfficeFilm.box_office) : '₦1.40B'}
              </span>
            </div>
          </Link>

          {/* 2. YouTube Viral Hit */}
          <Link
            to={topYoutubeFilm ? `/films/${topYoutubeFilm.slug || topYoutubeFilm.id}` : '/watch/youtube'}
            className="group/item inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2/60 hover:bg-surface-2 border border-border/60 hover:border-red-500/40 transition-all text-xs"
          >
            <span className="w-5 h-5 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
              <Icon icon="simple-icons:youtube" className="text-xs" />
            </span>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider hidden sm:inline">YouTube Hit:</span>
              <span className="font-bold text-text-primary group-hover/item:text-brand transition-colors truncate max-w-[130px] sm:max-w-[160px]">
                {topYoutubeFilm?.title || 'Jagun Jagun'}
              </span>
              <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 shrink-0">
                {topYoutubeFilm?.view_count ? `${(topYoutubeFilm.view_count / 1_000_000).toFixed(1)}M Views` : '12.4M Views'}
              </span>
            </div>
          </Link>

          {/* 3. Top Critic Metascore */}
          <Link
            to="/critics"
            className="group/item hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2/60 hover:bg-surface-2 border border-border/60 hover:border-emerald-500/40 transition-all text-xs"
          >
            <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-black text-[10px]">
              85
            </span>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Accredited Critics:</span>
              <span className="font-bold text-text-primary group-hover/item:text-brand transition-colors truncate max-w-[140px]">
                Metascores Live
              </span>
            </div>
          </Link>
        </div>

        {/* Fast Category Quick-Jumps */}
        <div className="flex items-center gap-1.5 border-t lg:border-t-0 lg:border-l border-border/60 pt-2.5 lg:pt-0 lg:pl-4 overflow-x-auto scrollbar-hide shrink-0">
          <Link
            to="/showtimes"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-brand hover:text-white border border-border text-[11px] font-bold text-text-secondary transition-all"
          >
            <Icon icon="solar:ticket-bold" className="text-brand" />
            <span>Cinemas</span>
          </Link>
          <Link
            to="/watch/youtube"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-red-600 hover:text-white border border-border text-[11px] font-bold text-text-secondary transition-all"
          >
            <Icon icon="simple-icons:youtube" className="text-red-500" />
            <span>YouTube Free</span>
          </Link>
          <Link
            to="/watch/netflix"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-[#E50914] hover:text-white border border-border text-[11px] font-bold text-text-secondary transition-all"
          >
            <Icon icon="simple-icons:netflix" className="text-[#E50914]" />
            <span>Streaming</span>
          </Link>
          <Link
            to="/companies"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-brand hover:text-white border border-border text-[11px] font-bold text-text-secondary transition-all"
          >
            <Icon icon="solar:buildings-2-bold" className="text-brand" />
            <span>Studios</span>
          </Link>
          <Link
            to="/critics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-emerald-600 hover:text-white border border-border text-[11px] font-bold text-text-secondary transition-all"
          >
            <Icon icon="solar:pen-bold" className="text-emerald-400" />
            <span>Critics</span>
          </Link>
        </div>

      </div>
    </section>
  );
}
