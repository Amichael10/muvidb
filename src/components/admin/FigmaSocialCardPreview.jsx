import React from 'react';
import { Icon } from '@iconify/react';

/**
 * Returns platform-specific branding with authentic colors and icons
 */
export function getPlatformBranding(candidate, series) {
  const text = `${candidate?.data?.watchAvailability || ''} ${candidate?.data?.platformDisplayName || ''} ${candidate?.data?.platform || ''} ${candidate?.category || ''} ${candidate?.name || ''} ${series?.slug || ''} ${series?.name || ''}`.toLowerCase();

  if (candidate?.data?.lifecycle === 'upcoming' || candidate?.data?.coming_soon) {
    return {
      name: 'Coming Soon',
      badge: 'UPCOMING RELEASE',
      accent: '#FF7A00',
      bgGlow: 'rgba(255, 122, 0, 0.25)',
      platformIcon: 'solar:calendar-date-bold',
      status: candidate?.data?.release_date ? `RELEASES ${candidate.data.release_date}` : 'COMING SOON',
      subtext: 'Track this release on MuviDB',
      ctaText: 'EXPLORE ON MUVIDB.COM',
    };
  }
  
  if (text.includes('nollistream')) {
    return {
      name: 'NolliStream',
      badge: 'NOLLISTREAM EXCLUSIVE',
      accent: '#FF7A00',
      bgGlow: 'rgba(255, 122, 0, 0.25)',
      platformIcon: 'solar:play-circle-bold',
      status: 'NOW STREAMING',
      subtext: 'Watch on Nollistream.com',
      ctaText: 'STREAM ON NOLLISTREAM',
    };
  }
  if (text.includes('docuth')) {
    return {
      name: 'Docuth',
      badge: 'NOW ON DOCUTH',
      accent: '#06B6D4',
      bgGlow: 'rgba(6, 182, 212, 0.25)',
      platformIcon: 'solar:tv-bold',
      status: 'NOW STREAMING',
      subtext: 'Documentaries & Cinema on Docuth',
      ctaText: 'STREAM ON DOCUTH',
    };
  }
  if (text.includes('ebonylife')) {
    return {
      name: 'EbonyLife ON',
      badge: 'EBONYLIFE ON PLUS',
      accent: '#E11D48',
      bgGlow: 'rgba(225, 29, 72, 0.25)',
      platformIcon: 'solar:clapperboard-bold',
      status: 'NOW STREAMING',
      subtext: 'Stream on EbonyLife ON Plus',
      ctaText: 'STREAM ON EBONYLIFE ON',
    };
  }
  if (text.includes('prime') || text.includes('amazon')) {
    return {
      name: 'Prime Video',
      badge: 'NOW ON PRIME',
      accent: '#00A8E1',
      bgGlow: 'rgba(0, 168, 225, 0.25)',
      platformIcon: 'ri:amazon-fill',
      status: 'NOW STREAMING',
      subtext: 'Only on Prime Video',
      ctaText: 'STREAM ON PRIME VIDEO',
    };
  }
  if (text.includes('netflix')) {
    return {
      name: 'Netflix',
      badge: 'NOW ON NETFLIX',
      accent: '#E50914',
      bgGlow: 'rgba(229, 9, 20, 0.25)',
      platformIcon: 'simple-icons:netflix',
      status: 'NOW STREAMING',
      subtext: 'Only on Netflix',
      ctaText: 'STREAM ON NETFLIX',
    };
  }
  if (text.includes('youtube')) {
    return {
      name: 'YouTube',
      badge: 'FREE ON YOUTUBE',
      accent: '#FF0000',
      bgGlow: 'rgba(255, 0, 0, 0.25)',
      platformIcon: 'ri:youtube-fill',
      status: 'NOW STREAMING',
      subtext: 'Free Nollywood on YouTube',
      ctaText: 'WATCH ON YOUTUBE',
    };
  }
  if (text.includes('cinema') || candidate?.data?.is_in_cinemas) {
    return {
      name: 'In Cinemas',
      badge: 'IN CINEMAS NOW',
      accent: '#F59E0B',
      bgGlow: 'rgba(245, 158, 11, 0.25)',
      platformIcon: 'solar:ticket-bold',
      status: 'IN CINEMAS NOW',
      subtext: 'Check showtimes at cinemas near you',
      ctaText: 'BOOK CINEMA TICKETS',
    };
  }

  // Neutral fallback: never make an unsupported streaming or "new" claim.
  return {
    name: candidate?.data?.platformDisplayName || 'MuviDB Spotlight',
    badge: candidate?.data?.lifecycleLabel || 'FILM SPOTLIGHT',
    accent: '#FF7A00',
    bgGlow: 'rgba(255, 122, 0, 0.25)',
    platformIcon: 'solar:play-bold',
    status: candidate?.data?.lifecycleLabel || 'DISCOVER THIS FILM',
    subtext: candidate?.data?.watchAvailability || 'Verified Nollywood & African Cinema',
    ctaText: 'EXPLORE ON MUVIDB.COM',
  };
}

export default function FigmaSocialCardPreview({
  candidate,
  series,
  displayImage,
  className = '',
}) {
  const seriesSlug = (series?.slug || '').toLowerCase();
  const isPerson = candidate?.type === 'person' ||
    series?.category === 'people' ||
    series?.category === 'craft' ||
    seriesSlug.includes('spotlight') ||
    seriesSlug.includes('actor') ||
    seriesSlug.includes('talent') ||
    seriesSlug.includes('filmography') ||
    seriesSlug.includes('face') ||
    seriesSlug.includes('camera') ||
    seriesSlug.includes('birthday');

  const branding = getPlatformBranding(candidate, series);
  const title = candidate?.name || (isPerson ? 'Nollywood Star' : 'Featured Film');
  const year = candidate?.data?.year || candidate?.year || '';
  const country = candidate?.country || candidate?.data?.country || 'Nollywood';
  const heroImage = displayImage || candidate?.imageUrl || candidate?.data?.photo_url || candidate?.data?.poster_url;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. TALENT / ACTOR SPOTLIGHT CARD (Dark Luxury Editorial Aesthetic)
  // ──────────────────────────────────────────────────────────────────────────
  if (isPerson) {
    const knownForList = candidate?.data?.knownFor || [];
    const department = candidate?.data?.department || candidate?.category || 'Actor Spotlight';
    const filmCount = candidate?.data?.film_count || knownForList.length || null;

    return (
      <div
        className={`relative w-full aspect-square overflow-hidden rounded-2xl bg-[#090C12] text-white shadow-2xl border border-white/10 select-none font-sans flex flex-col justify-between p-6 ${className}`}
      >
        {/* Background Ambient Glows */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF7A00]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#E5A00D]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Lockup */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img
                src="/images/MuviDB Brand/MuviDB Icon.png"
                alt="MuviDB"
                className="h-7 w-auto object-contain drop-shadow-[0_0_12px_rgba(255,122,0,0.4)]"
                onError={e => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="flex flex-col">
                <span className="font-black text-base tracking-tight text-white leading-none">
                  MuviDB
                </span>
                <span className="text-[7.5px] font-extrabold tracking-widest text-[#FF7A00] uppercase mt-0.5">
                  EVERY FILM. EVERY CREDIT.
                </span>
              </div>
            </div>
            <div className="h-5 w-px bg-white/20 mx-1" />
            <div className="flex flex-col text-[7.5px] font-black tracking-wider leading-tight text-white/70">
              <span>DISCOVER<span className="text-[#FF7A00]">.</span></span>
              <span>CREDIT<span className="text-[#FF7A00]">.</span></span>
              <span>CELEBRATE<span className="text-[#FF7A00]">.</span></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#FF7A00] backdrop-blur-md">
              <Icon icon="solar:star-bold" width="10" />
              {series?.name || 'TALENT SPOTLIGHT'}
            </span>
          </div>
        </div>

        {/* Hero Talent Portrait Blend on the Right */}
        <div className="absolute right-0 top-0 bottom-0 w-[52%] overflow-hidden pointer-events-none">
          {heroImage ? (
            <img
              src={heroImage}
              alt={title}
              className="h-full w-full object-cover object-top filter contrast-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/20">
              <Icon icon="solar:user-bold" width="80" />
            </div>
          )}
          {/* Gradient Masks */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#090C12] via-[#090C12]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090C12] via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#090C12] via-transparent to-transparent opacity-80" />
        </div>

        {/* Left Column: Actor Info & Filmography */}
        <div className="relative z-10 my-auto max-w-[55%] flex flex-col pt-3">
          {/* Category Tag */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#FF7A00]/20 border border-[#FF7A00]/40 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-widest text-[#FF7A00]">
              <Icon icon="solar:clapperboard-play-bold" width="10" />
              {department}
            </span>
            {filmCount && (
              <span className="text-[10px] font-bold text-white/60">
                • {filmCount} Verified Credits
              </span>
            )}
          </div>

          {/* Hero Name */}
          <h1 className="mt-2 text-2xl lg:text-3xl font-black uppercase tracking-tight text-white leading-[1.05] drop-shadow-md">
            {title}
          </h1>

          {/* Nationality Pill */}
          <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-white/80 uppercase tracking-wider">
            <Icon icon="solar:globus-bold" width="12" className="text-[#FF7A00]" />
            <span>{country}</span>
          </div>

          {/* Bio Snippet */}
          {candidate?.subtext && (
            <div className="mt-3 rounded-lg bg-white/[0.06] border border-white/10 p-2.5 backdrop-blur-md">
              <p className="text-[10.5px] text-white/85 line-clamp-2 leading-relaxed font-normal">
                {candidate.subtext}
              </p>
            </div>
          )}

          {/* Known For Strip */}
          {knownForList.length > 0 && (
            <div className="mt-3.5 space-y-1.5">
              <span className="text-[8.5px] font-black uppercase tracking-widest text-[#FF7A00]">
                KNOWN FOR
              </span>
              <div className="flex flex-col gap-1.5">
                {knownForList.slice(0, 2).map((k, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg bg-white/[0.08] border border-white/15 px-2.5 py-1.5 backdrop-blur-md"
                  >
                    <Icon icon="solar:film-bold" width="12" className="text-[#FF7A00] shrink-0" />
                    <span className="text-[11px] font-black text-white truncate">
                      {k.title || k.name || k}
                    </span>
                    {k.year && (
                      <span className="text-[9px] font-bold text-white/50 shrink-0 ml-auto">
                        {k.year}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="relative z-10 flex items-center justify-between pt-3 border-t border-white/10 mt-auto">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF7A00] text-black shadow-lg shadow-[#FF7A00]/40">
              <Icon icon="solar:arrow-right-bold" width="14" />
            </div>
            <div>
              <div className="text-[8px] font-bold uppercase tracking-widest text-white/50">
                VIEW FULL FILMOGRAPHY
              </div>
              <div className="text-xs font-black text-white tracking-wide">
                MuviDB.com
              </div>
            </div>
          </div>
          <span className="text-[7.5px] font-extrabold uppercase tracking-widest text-white/40">
            EVERY FILM. EVERY CREDIT.
          </span>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. MOVIE & "WHERE TO WATCH" SHOWCASE CARD (Cinematic Poster & Platform Lockup)
  // ──────────────────────────────────────────────────────────────────────────
  const genres = Array.isArray(candidate?.data?.genres) ? candidate.data.genres.slice(0, 2).join(' • ') : 'African Cinema';

  return (
    <div
      className={`relative w-full aspect-square overflow-hidden rounded-2xl bg-[#090C12] text-white shadow-2xl border border-white/10 select-none font-sans flex flex-col justify-between p-6 ${className}`}
    >
      {/* Background Poster Artwork */}
      <div className="absolute right-0 top-0 bottom-0 w-[55%] overflow-hidden pointer-events-none">
        {heroImage ? (
          <img
            src={heroImage}
            alt={title}
            className="h-full w-full object-cover object-center filter contrast-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/20">
            <Icon icon="solar:clapperboard-bold" width="80" />
          </div>
        )}
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#090C12] via-[#090C12]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090C12] via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#090C12] via-transparent to-transparent opacity-80" />
      </div>

      {/* Top Header Lockup */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/images/MuviDB Brand/MuviDB Icon.png"
              alt="MuviDB"
              className="h-7 w-auto object-contain drop-shadow-[0_0_12px_rgba(255,122,0,0.4)]"
              onError={e => {
                e.target.style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <span className="font-black text-base tracking-tight text-white leading-none">
                MuviDB
              </span>
              <span className="text-[7.5px] font-extrabold tracking-widest text-[#FF7A00] uppercase mt-0.5">
                EVERY FILM. EVERY CREDIT.
              </span>
            </div>
          </div>
          <div className="h-5 w-px bg-white/20 mx-1" />
          <div className="flex flex-col text-[7.5px] font-black tracking-wider leading-tight text-white/70">
            <span>DISCOVER<span className="text-[#FF7A00]">.</span></span>
            <span>CREDIT<span className="text-[#FF7A00]">.</span></span>
            <span>CELEBRATE<span className="text-[#FF7A00]">.</span></span>
          </div>
        </div>

        {/* Where To Watch Header Pill */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#FF7A00] backdrop-blur-md">
            <Icon icon="solar:play-stream-bold" width="10" />
            {series?.name || 'WHERE TO WATCH'}
          </span>
        </div>
      </div>

      {/* Left Column Platform & Movie Details */}
      <div className="relative z-10 my-auto max-w-[55%] flex flex-col pt-3">
        {/* Streaming Platform Badge */}
        <div>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-md"
            style={{
              backgroundColor: branding.accent,
              boxShadow: `0 0 16px ${branding.bgGlow}`,
            }}
          >
            <Icon icon={branding.platformIcon} width="13" />
            {branding.badge}
          </span>
        </div>

        {/* Platform Display Name */}
        <h2 className="mt-2 text-2xl lg:text-3xl font-black uppercase tracking-tight text-white leading-none drop-shadow-md">
          {branding.name}
        </h2>
        <div
          className="h-1 w-16 rounded-full mt-1.5 mb-2.5"
          style={{ backgroundColor: branding.accent }}
        />

        {/* Film Title */}
        <div className="rounded-xl bg-white/[0.07] border border-white/15 p-3 backdrop-blur-md shadow-xl">
          <div className="text-[8.5px] font-black uppercase tracking-widest text-[#FF7A00]">
            FEATURED FILM
          </div>
          <h3 className="text-base lg:text-lg font-black uppercase text-white leading-tight mt-0.5 line-clamp-2">
            {title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[9.5px] font-semibold text-white/60">
            <span>{country}</span>
            {year && <span>• {year}</span>}
            {genres && <span>• {genres}</span>}
          </div>
        </div>

        {/* Now Streaming Status */}
        <div className="flex items-center gap-2 mt-2.5">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
            style={{ borderColor: branding.accent, color: branding.accent }}
          >
            <Icon icon="solar:calendar-date-bold" width="12" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] font-black uppercase tracking-wider text-white">
              {branding.status}
            </span>
            <span className="text-[8.5px] font-medium text-white/50 truncate">
              {branding.subtext}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Footer Lockup */}
      <div className="relative z-10 flex items-center justify-between pt-3 border-t border-white/10 mt-auto">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-black shadow-md"
            style={{ backgroundColor: branding.accent }}
          >
            <Icon icon="solar:play-bold" width="12" />
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-white/50">
              EXPLORE FULL CREDITS ON
            </div>
            <div className="text-xs font-black text-white tracking-wide">
              MuviDB.com
            </div>
          </div>
        </div>
        <span className="text-[7.5px] font-extrabold uppercase tracking-widest text-white/40">
          EVERY FILM. EVERY CREDIT.
        </span>
      </div>
    </div>
  );
}
