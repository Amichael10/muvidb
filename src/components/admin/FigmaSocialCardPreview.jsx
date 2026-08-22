import React from 'react';
import { Icon } from '@iconify/react';

/**
 * Returns platform-specific branding for the Figma card
 */
export function getPlatformBranding(candidate, series) {
  const text = `${candidate?.data?.watchAvailability || ''} ${candidate?.data?.platformDisplayName || ''} ${candidate?.name || ''} ${series?.slug || ''} ${series?.name || ''}`.toLowerCase();
  
  if (text.includes('prime') || text.includes('amazon')) {
    return {
      name: 'Prime Video',
      badge: 'NEW ON',
      accent: '#00A8E1',
      platformIcon: 'ri:amazon-fill',
      status: 'NOW STREAMING',
      subtext: 'Only on Prime Video',
      ctaText: 'STREAM ON PRIME VIDEO',
    };
  }
  if (text.includes('netflix')) {
    return {
      name: 'Netflix',
      badge: 'NEW ON',
      accent: '#E50914',
      platformIcon: 'simple-icons:netflix',
      status: 'NOW STREAMING',
      subtext: 'Only on Netflix',
      ctaText: 'STREAM ON NETFLIX',
    };
  }
  if (text.includes('youtube')) {
    return {
      name: 'YouTube',
      badge: 'FREE ON',
      accent: '#FF0000',
      platformIcon: 'ri:youtube-fill',
      status: 'NOW STREAMING',
      subtext: 'Free on YouTube',
      ctaText: 'WATCH ON YOUTUBE',
    };
  }
  if (text.includes('circuit')) {
    return {
      name: 'Circuits',
      badge: 'NEW ON',
      accent: '#FF7A00',
      platformIcon: 'solar:play-bold',
      status: 'NOW STREAMING',
      subtext: 'Only on Circuits.tv',
      ctaText: 'STREAM ON CIRCUITS.TV',
    };
  }
  if (text.includes('cinema') || candidate?.data?.is_in_cinemas) {
    return {
      name: 'In Cinemas',
      badge: 'IN CINEMAS',
      accent: '#FF7A00',
      platformIcon: 'solar:ticket-bold',
      status: 'IN CINEMAS NOW',
      subtext: 'Get tickets at cinema locations',
      ctaText: 'BOOK CINEMA TICKETS',
    };
  }

  // Default to Where To Watch / African Cinema Spotlight
  return {
    name: candidate?.data?.platformDisplayName || 'Circuits',
    badge: 'NEW ON',
    accent: '#FF7A00',
    platformIcon: 'solar:play-bold',
    status: candidate?.data?.coming_soon ? 'COMING SOON' : 'NOW STREAMING',
    subtext: candidate?.data?.watchAvailability || 'Only on Circuits.tv',
    ctaText: 'EXPLORE ON MUVIDB.COM',
  };
}

export default function FigmaSocialCardPreview({
  candidate,
  series,
  displayImage,
  className = '',
}) {
  const isPerson = candidate?.type === 'person' || series?.slug?.includes('spotlight') || series?.slug?.includes('actor') || series?.slug?.includes('birthday');
  const branding = getPlatformBranding(candidate, series);
  const title = candidate?.name || 'Film Title';
  const year = candidate?.data?.year || candidate?.year || '';
  const country = candidate?.country || candidate?.data?.country || 'Nollywood';

  // 1. Person / Talent Spotlight Layout
  if (isPerson) {
    return (
      <div
        className={`relative w-full aspect-square overflow-hidden rounded-2xl bg-[#FAF8F5] text-[#111111] shadow-2xl border border-black/5 select-none font-sans flex flex-col justify-between p-6 ${className}`}
      >
        {/* Decorative Grid Lines */}
        <div className="absolute left-[48%] top-0 bottom-0 w-px bg-black/[0.07] pointer-events-none" />
        <div className="absolute left-0 right-0 top-[14%] h-px bg-black/[0.07] pointer-events-none" />
        <div className="absolute left-[47.6%] top-[14%] -translate-y-1/2 w-2 h-2 rounded-full bg-[#FF7A00]" />

        {/* Top Header Lockup */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img
                src="/images/MuviDB Brand/MuviDB Icon.png"
                alt="MuviDB"
                className="h-7 w-auto object-contain"
                onError={e => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight text-[#111111] leading-none">
                  MuviDB
                </span>
                <span className="text-[8px] font-bold tracking-widest text-[#FF7A00] uppercase mt-0.5">
                  EVERY FILM. EVERY CREDIT.
                </span>
              </div>
            </div>
            <div className="h-6 w-px bg-black/15 mx-1" />
            <div className="flex flex-col text-[8px] font-black tracking-wider leading-tight text-[#111111]">
              <span>DISCOVER<span className="text-[#FF7A00]">.</span></span>
              <span>CREDIT<span className="text-[#FF7A00]">.</span></span>
              <span>CELEBRATE<span className="text-[#FF7A00]">.</span></span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#111111]">
              {series?.name || 'TALENT SPOTLIGHT'}
            </span>
            <span className="text-[10px] font-bold text-[#FF7A00]">01</span>
          </div>
        </div>

        {/* Talent Portrait on the right */}
        <div className="absolute right-0 bottom-0 top-[14%] w-[52%] overflow-hidden flex items-end justify-center pointer-events-none">
          {displayImage ? (
            <img
              src={displayImage}
              alt={title}
              className="h-full w-full object-cover object-top filter contrast-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black/5 text-black/20">
              <Icon icon="solar:user-bold" width="64" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F5] via-transparent to-transparent opacity-40" />
        </div>

        {/* Left Column: Actor Info */}
        <div className="relative z-10 mt-6 max-w-[46%] flex flex-col">
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#FF7A00]">
            {candidate?.data?.department || 'ACTOR SPOTLIGHT'}
          </span>
          <div className="h-0.5 w-16 bg-[#FF7A00] mt-1 mb-3" />

          <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tight text-[#111111] leading-[1.05] break-words">
            {title}
          </h1>

          <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-black/60 uppercase tracking-wider">
            <Icon icon="solar:globus-linear" width="14" className="text-[#FF7A00]" />
            <span>{country}</span>
          </div>

          {candidate?.subtext && (
            <p className="text-[11px] text-black/70 mt-3 line-clamp-3 leading-relaxed font-normal">
              {candidate.subtext}
            </p>
          )}

          {/* Known For Chips */}
          {candidate?.data?.knownFor && candidate.data.knownFor.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-black/50">
                KNOWN FOR
              </span>
              {candidate.data.knownFor.slice(0, 2).map((k, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs font-bold text-[#111111]">
                  <Icon icon="solar:star-bold" width="12" className="text-[#FF7A00]" />
                  <span className="truncate">{k.title || k.name || k}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="relative z-10 flex items-center justify-between pt-4 border-t border-black/10 mt-auto">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#FF7A00] text-[#FF7A00]">
              <Icon icon="solar:arrow-right-linear" width="16" />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-black/50">
                VIEW FULL PROFILE
              </div>
              <div className="text-xs font-black text-[#111111]">
                MuviDB.com
              </div>
            </div>
          </div>
          <span className="text-[8px] font-extrabold uppercase tracking-widest text-black/40">
            EVERY FILM. EVERY CREDIT.
          </span>
        </div>
      </div>
    );
  }

  // 2. Movie & "WHERE TO WATCH" Showcase Layout (Exact Figma Match 1:1)
  return (
    <div
      className={`relative w-full aspect-square overflow-hidden rounded-2xl bg-[#FFFFFF] text-[#111111] shadow-2xl border border-black/10 select-none font-sans ${className}`}
    >
      {/* SVG Background Layer with Signature Organic Curved Poster Arch */}
      <svg
        viewBox="0 0 1000 1000"
        className="absolute inset-0 h-full w-full pointer-events-none z-0"
      >
        <defs>
          {/* Exact Organic Figma Cutout Path */}
          <clipPath id="figma-where-to-watch-shield">
            <path d="M 540 80 C 540 80, 430 350, 310 680 C 260 850, 310 960, 480 980 L 1000 1000 L 1000 0 L 680 0 C 580 0, 540 30, 540 80 Z" />
          </clipPath>
          <linearGradient id="poster-title-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="40%" stopColor="#000000" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Top-Right Warm Olive Backdrop Tab */}
        <path
          d="M 640 0 C 640 0, 680 80, 780 80 L 1000 80 L 1000 0 Z"
          fill="#D5CFB8"
        />

        {/* Clipped Movie Poster Art */}
        <g clipPath="url(#figma-where-to-watch-shield)">
          {displayImage ? (
            <image
              href={displayImage}
              x="260"
              y="0"
              width="740"
              height="1000"
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <rect x="260" y="0" width="740" height="1000" fill="#181B22" />
          )}

          {/* Bottom Shadow Gradient for Title Legibility */}
          <rect
            x="260"
            y="700"
            width="740"
            height="300"
            fill="url(#poster-title-gradient)"
          />

          {/* Film Title Overlay at Base of Poster */}
          <text
            x="630"
            y="920"
            textAnchor="middle"
            fill="#FF7A00"
            fontSize="20"
            fontWeight="900"
            letterSpacing="3"
            fontFamily="sans-serif"
          >
            {`${country.toUpperCase()}${year ? ` • ${year}` : ''}`}
          </text>
          <text
            x="630"
            y="960"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="34"
            fontWeight="900"
            letterSpacing="1"
            fontFamily="sans-serif"
          >
            {title.toUpperCase().slice(0, 24)}
          </text>
        </g>
      </svg>

      {/* Foreground Interactive Content Layer */}
      <div className="relative z-10 flex flex-col justify-between h-full p-6">
        {/* Top Header Lockup */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/images/MuviDB Brand/MuviDB Icon.png"
              alt="MuviDB"
              className="h-8 w-auto object-contain"
              onError={e => {
                e.target.style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-[#111111] leading-none">
                MuviDB
              </span>
              <span className="text-[7.5px] font-extrabold tracking-widest text-[#FF7A00] uppercase mt-0.5">
                EVERY FILM. EVERY CREDIT.
              </span>
            </div>
          </div>
          <div className="h-6 w-px bg-black/15 mx-1" />
          <div className="flex flex-col text-[8px] font-black tracking-wider leading-tight text-[#111111]">
            <span>DISCOVER<span className="text-[#FF7A00]">.</span></span>
            <span>CREDIT<span className="text-[#FF7A00]">.</span></span>
            <span>CELEBRATE<span className="text-[#FF7A00]">.</span></span>
          </div>
        </div>

        {/* Left Column Platform Details */}
        <div className="max-w-[42%] space-y-4 my-auto pt-2">
          {/* Orange Badge */}
          <div>
            <span
              className="inline-flex items-center rounded-md px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: branding.accent }}
            >
              {branding.badge}
            </span>
          </div>

          {/* Platform Icon & Bold Condensed Title */}
          <div>
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 mb-2 shadow-sm"
              style={{ borderColor: branding.accent, color: branding.accent }}
            >
              <Icon icon={branding.platformIcon} width="24" />
            </div>
            <h2
              className="text-3xl lg:text-4xl font-black tracking-tight text-[#162D4A] leading-none"
            >
              {branding.name}
            </h2>
            <div
              className="h-1 w-20 rounded-full mt-2"
              style={{ backgroundColor: branding.accent }}
            />
          </div>

          {/* Now Streaming Block */}
          <div className="flex items-start gap-2.5 pt-1">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2"
              style={{ borderColor: branding.accent, color: branding.accent }}
            >
              <Icon icon="solar:calendar-date-bold" width="16" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#162D4A]">
                {branding.status}
              </span>
              <span className="text-[10px] font-semibold text-[#7E8B9B] line-clamp-1">
                {branding.subtext}
              </span>
            </div>
          </div>

          {/* CTA Block */}
          <div className="flex items-center gap-2.5 pt-1">
            <div style={{ color: branding.accent }}>
              <Icon icon="solar:play-circle-bold" width="30" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#7E8B9B]">
                EXPLORE MORE ON
              </span>
              <span
                className="text-xs font-black uppercase tracking-wider"
                style={{ color: branding.accent }}
              >
                MUVIDB.COM
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Footer Dot Matrix (6 cols x 4 rows) */}
        <div className="pt-2">
          <div className="grid grid-cols-6 gap-1.5 w-24">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="h-1 w-1 rounded-full bg-[#FF7A00]/80" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
