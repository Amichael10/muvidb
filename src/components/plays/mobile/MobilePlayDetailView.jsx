import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../../ui/ImageWithFallback';
import CriticReviewsSection from '../../film/CriticReviewsSection';
import ReviewSection from '../../film/ReviewSection';
import { formatPlayBoxOffice } from '../../../lib/plays';

function formatBoxOffice(amount) {
  if (!amount || amount <= 0) return null;
  const num = Number(amount);
  if (num >= 1_000_000_000) return `₦${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `₦${(num / 1_000_000).toFixed(1)}M`;
  return `₦${num.toLocaleString()}`;
}

export default function MobilePlayDetailView({
  play,
  playDateLabel = '',
  uniquePerformers = [],
  isAdmin = false,
  onSuggestEdit = null,
  onEditBoxOffice = null,
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'ensemble' | 'reviews'
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  if (!play) return null;

  const isRunning = play.status === 'currently_running';
  const isUpcoming = play.status === 'upcoming';
  const boxOfficeInfo = formatPlayBoxOffice(play);
  const boxOfficeStr = boxOfficeInfo?.shortBadge || null;
  const poster = play.poster_url || play.banner_url;

  return (
    <div className="w-full pb-32 md:hidden">
      {/* 1. CINEMATIC MOBILE STAGE HERO */}
      <div className="relative w-full aspect-[4/5] max-h-[500px] overflow-hidden bg-black select-none">
        {/* Poster Media */}
        <ImageWithFallback
          src={poster}
          alt={play.title}
          fallbackType="film"
          name={play.title}
          className="w-full h-full object-cover transform scale-105"
          sizes="100vw"
        />

        {/* Ambient Gradient Scrims */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D10] via-[#0B0D10]/50 to-black/40 pointer-events-none" />

        {/* Top Floating Navigation */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-20">
          <Link
            to="/plays"
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all shadow-md"
            aria-label="Back to Theatre Index"
          >
            <Icon icon="solar:alt-arrow-left-linear" className="text-xl" />
          </Link>

          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md border shadow-lg ${
            isRunning
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : isUpcoming
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-black/60 text-text-muted border-white/10'
          }`}>
            {isRunning && (
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <span>{isRunning ? 'Live On Stage' : isUpcoming ? 'Upcoming' : 'Archive'}</span>
          </div>
        </div>

        {/* Bottom Hero Info Cluster */}
        <div className="absolute bottom-4 left-4 right-4 space-y-2 z-10">
          {/* Metadata Chips */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
            <span className="px-2.5 py-0.5 rounded-md bg-brand/20 border border-brand/40 text-brand uppercase tracking-wider backdrop-blur-sm">
              {play.genre || 'Stage Play'}
            </span>
            {boxOfficeStr ? (
              <div className="inline-flex items-center gap-1">
                <Link
                  to={`/plays/${play.slug || play.id}/box-office`}
                  className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1"
                >
                  <Icon icon="solar:ticket-sale-bold" className="text-xs" />
                  <span>{boxOfficeStr} Box Office</span>
                </Link>
                {isAdmin && onEditBoxOffice && (
                  <button
                    type="button"
                    onClick={onEditBoxOffice}
                    className="p-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    title="Edit Box Office"
                  >
                    <Icon icon="solar:pen-bold" className="text-[10px]" />
                  </button>
                )}
              </div>
            ) : isAdmin && onEditBoxOffice ? (
              <button
                type="button"
                onClick={onEditBoxOffice}
                className="px-2.5 py-0.5 rounded-md bg-brand/20 border border-brand/40 text-brand flex items-center gap-1"
              >
                <Icon icon="solar:add-circle-bold" className="text-xs" />
                <span>+ Box Office</span>
              </button>
            ) : null}
            {onSuggestEdit && (
              <button
                type="button"
                onClick={onSuggestEdit}
                className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 text-[10px]"
              >
                <Icon icon="solar:pen-linear" className="text-xs text-brand" />
                <span>Suggest Edit</span>
              </button>
            )}
            {playDateLabel && (
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-text-secondary backdrop-blur-sm">
                {playDateLabel}
              </span>
            )}
          </div>

          {/* Play Title */}
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight line-clamp-2 leading-tight drop-shadow-md">
            {play.title}
          </h1>

          {/* Venue & City */}
          {(play.venue || play.city) && (
            <p className="text-xs font-semibold text-text-secondary flex items-center gap-1.5 drop-shadow-sm">
              <Icon icon="solar:map-point-bold" className="text-brand shrink-0" />
              <span>{play.venue ? `${play.venue}${play.city ? ` · ${play.city}` : ''}` : play.city}</span>
            </p>
          )}
        </div>
      </div>

      {/* 2. TABBED SECTION CONTROLLER */}
      <div className="sticky top-14 z-30 w-full bg-[#0B0D10]/95 backdrop-blur-md border-b border-white/5 px-4 py-2 shadow-md shadow-black/40">
        <div className="grid grid-cols-3 gap-1 bg-surface-2/60 p-1 rounded-xl border border-border/60">
          {[
            { id: 'overview', label: 'Overview', icon: 'solar:info-circle-linear' },
            { id: 'ensemble', label: `Cast (${uniquePerformers.length})`, icon: 'solar:users-group-two-rounded-linear' },
            { id: 'reviews', label: 'Reviews', icon: 'solar:chat-round-dots-linear' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all min-h-[38px] select-none ${
                  isActive
                    ? 'bg-brand text-white shadow-sm shadow-brand/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon icon={tab.icon} className="text-sm" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TAB CONTENT */}
      <div className="px-4 pt-4 space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Key Creative Heads Card */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                Artistic Leadership & Run Details
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-surface-2/60 p-3 rounded-xl border border-border/40">
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Playwright</span>
                  <span className="font-bold text-text-primary mt-0.5 block truncate">
                    {play.playwright || 'N/A'}
                  </span>
                </div>
                <div className="bg-surface-2/60 p-3 rounded-xl border border-border/40">
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Director</span>
                  <span className="font-bold text-text-primary mt-0.5 block truncate">
                    {play.director || 'N/A'}
                  </span>
                </div>
                <div className="bg-surface-2/60 p-3 rounded-xl border border-border/40">
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Run Schedule</span>
                  <span className="font-bold text-text-primary mt-0.5 block truncate">
                    {playDateLabel || 'Date TBA'}
                  </span>
                </div>
                <div className="bg-surface-2/60 p-3 rounded-xl border border-border/40">
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Location</span>
                  <span className="font-bold text-brand mt-0.5 block truncate">
                    {play.city || 'TBA'}
                  </span>
                </div>
              </div>
            </div>

            {/* Synopsis Card */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 shadow-sm space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                Production Overview
              </h3>
              <p className={`text-xs text-text-secondary leading-relaxed ${
                synopsisExpanded ? '' : 'line-clamp-4'
              }`}>
                {play.synopsis || 'An acclaimed theatrical stage play celebrating storytelling, heritage, and dramatic live craft on African stages.'}
              </p>
              {play.synopsis && play.synopsis.length > 200 && (
                <button
                  onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                  className="text-xs font-bold text-brand hover:underline pt-1 block"
                >
                  {synopsisExpanded ? 'Show less' : 'Read full synopsis'}
                </button>
              )}
            </div>

            {/* Stage Ensemble Preview (First 4 performers) */}
            {uniquePerformers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-primary">
                    Ensemble Highlights
                  </h3>
                  <button
                    onClick={() => setActiveTab('ensemble')}
                    className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
                  >
                    <span>All {uniquePerformers.length} Cast</span>
                    <Icon icon="solar:arrow-right-linear" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {uniquePerformers.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="bg-surface border border-border/70 rounded-xl p-2.5 flex items-center gap-2.5 shadow-xs"
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-surface-2 shrink-0 border border-border">
                        <ImageWithFallback
                          src={item.person?.photo_url}
                          alt={item.person?.name}
                          fallbackType="person"
                          name={item.person?.name}
                          className="w-full h-full object-cover"
                          sizes="44px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-text-primary block truncate">
                          {item.person?.name}
                        </span>
                        <span className="text-[10px] text-amber-400 font-semibold block truncate">
                          {item.characterDisplay || item.roleDisplay}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ENSEMBLE CAST TAB */}
        {activeTab === 'ensemble' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-heading text-sm font-black text-text-primary">
                Full Company & Stage Ensemble
              </h3>
              <span className="text-xs text-text-muted font-bold">
                {uniquePerformers.length} Performers
              </span>
            </div>

            {uniquePerformers.length === 0 ? (
              <div className="text-center py-16 bg-surface/50 border border-border rounded-2xl">
                <Icon icon="solar:users-group-two-rounded-linear" className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold text-text-primary">Ensemble credits coming soon</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uniquePerformers.map((item) => (
                  <div
                    key={item.id}
                    className="bg-surface border border-border/80 rounded-2xl p-3 flex items-center gap-3 shadow-xs"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-2 shrink-0 border border-border shadow-xs">
                      <ImageWithFallback
                        src={item.person?.photo_url}
                        alt={item.person?.name}
                        fallbackType="person"
                        name={item.person?.name}
                        className="w-full h-full object-cover"
                        sizes="56px"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {item.person?.slug ? (
                        <Link
                          to={`/people/${item.person.slug}`}
                          className="font-bold text-sm text-text-primary hover:text-brand transition-colors block truncate"
                        >
                          {item.person.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-sm text-text-primary block truncate">
                          {item.person?.name}
                        </span>
                      )}

                      {item.characterDisplay && (
                        <p className="text-xs font-semibold text-amber-400 truncate mt-0.5">
                          as {item.characterDisplay}
                        </p>
                      )}

                      <p className="text-[10px] text-text-muted uppercase tracking-wider truncate mt-0.5">
                        {item.roleDisplay}
                      </p>
                    </div>

                    {item.person?.slug && (
                      <Link
                        to={`/people/${item.person.slug}`}
                        className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:text-brand shrink-0"
                      >
                        <Icon icon="solar:arrow-right-linear" className="text-sm" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <CriticReviewsSection playId={play.id} />
            <div className="border-t border-white/5 pt-6">
              <ReviewSection playId={play.id} />
            </div>
          </div>
        )}
      </div>

      {/* 4. FIXED BOTTOM ACTION DOCK */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0D10]/95 backdrop-blur-lg border-t border-white/10 px-4 py-3 shadow-2xl flex items-center gap-3">
        {play.source_url ? (
          <a
            href={play.source_url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-brand/30 active:scale-95 transition-all min-h-[46px]"
          >
            <Icon icon="solar:ticket-bold" className="text-base" />
            <span>Get Tickets / Details</span>
          </a>
        ) : (
          <Link
            to="/plays"
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold uppercase tracking-wider active:scale-95 transition-all min-h-[46px]"
          >
            <Icon icon="solar:masks-bold" className="text-base" />
            <span>Explore More Plays</span>
          </Link>
        )}

        {Boolean(play.box_office_domestic > 0) && (
          <Link
            to={`/plays/${play.slug || play.id}/box-office`}
            className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider active:scale-95 transition-all min-h-[46px]"
          >
            <Icon icon="solar:chart-square-bold" className="text-base" />
            <span>{boxOfficeInfo?.shortBadge ? `${boxOfficeInfo.shortBadge} Box Office` : 'Box Office'}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
