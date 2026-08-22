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
      accent: '#FF5A1F',
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
      accent: '#FF5A1F',
      platformIcon: 'solar:ticket-bold',
      status: 'IN CINEMAS NOW',
      subtext: 'Get tickets at cinema locations',
      ctaText: 'BOOK CINEMA TICKETS',
    };
  }

  // Default to Where To Watch / African Cinema Spotlight
  return {
    name: candidate?.data?.platformDisplayName || 'Circuits',
    badge: 'WHERE TO WATCH',
    accent: '#FF5A1F',
    platformIcon: 'solar:play-bold',
    status: candidate?.data?.coming_soon ? 'COMING SOON' : 'NOW STREAMING',
    subtext: candidate?.data?.watchAvailability || 'Available across Africa & Worldwide',
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
        className={`relative w-full aspect-[4/5] overflow-hidden rounded-2xl bg-[#FAF8F5] text-[#111111] shadow-2xl border border-black/5 select-none font-sans flex flex-col justify-between p-6 ${className}`}
      >
        {/* Decorative Grid Lines */}
        <div className="absolute left-[48%] top-0 bottom-0 w-px bg-black/[0.07] pointer-events-none" />
        <div className="absolute left-0 right-0 top-[14%] h-px bg-black/[0.07] pointer-events-none" />
        <div className="absolute left-[47.6%] top-[14%] -translate-y-1/2 w-2 h-2 rounded-full bg-[#FF5A1F]" />

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
                <span className="text-[8px] font-bold tracking-widest text-[#FF5A1F] uppercase mt-0.5">
                  EVERY FILM. EVERY CREDIT.
                </span>
              </div>
            </div>
            <div className="h-6 w-px bg-black/15 mx-1" />
            <div className="flex flex-col text-[8px] font-black tracking-wider leading-tight text-[#111111]">
              <span>DISCOVER<span className="text-[#FF5A1F]">.</span></span>
              <span>CREDIT<span className="text-[#FF5A1F]">.</span></span>
              <span>CELEBRATE<span className="text-[#FF5A1F]">.</span></span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#111111]">
              {series?.name || 'TALENT SPOTLIGHT'}
            </span>
            <span className="text-[10px] font-bold text-[#FF5A1F]">01</span>
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
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#FF5A1F]">
            {candidate?.data?.department || 'ACTOR SPOTLIGHT'}
          </span>
          <div className="h-0.5 w-16 bg-[#FF5A1F] mt-1 mb-3" />

          <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tight text-[#111111] leading-[1.05] break-words">
            {title}
          </h1>

          <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-black/60 uppercase tracking-wider">
            <Icon icon="solar:globus-linear" width="14" className="text-[#FF5A1F]" />
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
                  <Icon icon="solar:star-bold" width="12" className="text-[#FF5A1F]" />
                  <span className="truncate">{k.title || k.name || k}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="relative z-10 flex items-center justify-between pt-4 border-t border-black/10 mt-auto">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#FF5A1F] text-[#FF5A1F]">
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

  // 2. Movie & "WHERE TO WATCH" Showcase Layout (Matching media_1787362114936.jpg)
  return (
    <div
      className={`relative w-full aspect-[4/5] overflow-hidden rounded-2xl bg-[#FBF9F5] text-[#111111] shadow-2xl border border-black/5 select-none font-sans flex flex-col justify-between p-6 ${className}`}
    >
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
              <span className="text-[7.5px] font-extrabold tracking-widest text-[#FF5A1F] uppercase mt-0.5">
                EVERY FILM. EVERY CREDIT.
              </span>
            </div>
          </div>
          <div className="h-6 w-px bg-black/15 mx-1" />
          <div className="flex flex-col text-[8px] font-black tracking-wider leading-tight text-[#111111]">
            <span>DISCOVER<span className="text-[#FF5A1F]">.</span></span>
            <span>CREDIT<span className="text-[#FF5A1F]">.</span></span>
            <span>CELEBRATE<span className="text-[#FF5A1F]">.</span></span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#111111]">
            WHERE TO WATCH
          </span>
          <span className="text-[10px] font-bold text-[#FF5A1F]">01</span>
        </div>
      </div>

      {/* Main Split Body: Left Details & Right Curved Poster Shield */}
      <div className="relative z-10 grid grid-cols-12 gap-3 items-center flex-1 my-2">
        {/* Left Platform Showcase Column (6 cols) */}
        <div className="col-span-6 flex flex-col justify-center space-y-3.5 pr-2">
          {/* Platform Badge */}
          <div>
            <span
              className="inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: branding.accent }}
            >
              {branding.badge}
            </span>
          </div>

          {/* Platform Icon & Title */}
          <div>
            <div
              className="flex items-center gap-2 mb-1"
              style={{ color: branding.accent }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl border-2 shadow-sm"
                style={{ borderColor: branding.accent, backgroundColor: `${branding.accent}12` }}
              >
                <Icon icon={branding.platformIcon} width="20" />
              </div>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-[#183B56] leading-tight">
              {branding.name}
            </h2>
            <div
              className="h-1 w-16 rounded-full mt-1.5"
              style={{ backgroundColor: branding.accent }}
            />
          </div>

          {/* Availability Block */}
          <div className="flex items-start gap-2.5 pt-1">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2"
              style={{ borderColor: branding.accent, color: branding.accent }}
            >
              <Icon icon="solar:calendar-date-bold" width="15" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#183B56]">
                {branding.status}
              </span>
              <span className="text-[10px] font-medium text-[#6E7C87] line-clamp-1">
                {branding.subtext}
              </span>
            </div>
          </div>

          {/* CTA Block */}
          <div className="flex items-center gap-2.5 pt-1">
            <div style={{ color: branding.accent }}>
              <Icon icon="solar:play-circle-bold" width="28" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[8.5px] font-bold uppercase tracking-widest text-[#6E7C87]">
                EXPLORE MORE ON
              </span>
              <span
                className="text-[11px] font-black uppercase tracking-wider"
                style={{ color: branding.accent }}
              >
                MUVIDB.COM
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Signature Curved Poster Shield (6 cols) */}
        <div className="col-span-6 relative h-full min-h-[220px] flex items-center justify-end">
          {/* Olive Wedge Accent Behind Poster Top Right */}
          <div className="absolute -top-3 -right-3 w-32 h-32 bg-[#D5CFB8] rounded-full opacity-60 filter blur-xl" />
          
          {/* Framed Poster Container with Signature Rounded Arch */}
          <div className="relative w-full h-[95%] overflow-hidden rounded-l-[42px] rounded-r-2xl border-2 border-black/10 bg-black shadow-2xl flex flex-col justify-end">
            {displayImage ? (
              <img
                src={displayImage}
                alt={title}
                className="absolute inset-0 h-full w-full object-cover filter contrast-105 brightness-95"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1A1C23] text-white/30 p-4 text-center">
                <Icon icon="solar:film-strip-bold" width="40" />
                <span className="text-xs mt-2 font-bold">{title}</span>
              </div>
            )}

            {/* Bottom Gradient Overlay for Title Legibility */}
            <div className="relative z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-8 flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest text-[#FF5A1F]">
                {country} {year ? `• ${year}` : ''}
              </span>
              <span className="text-xs font-black text-white leading-tight uppercase line-clamp-1">
                {title}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Row: Dot Grid + Brand Tagline */}
      <div className="relative z-10 flex items-end justify-between pt-2 border-t border-black/10">
        {/* Orange Dot Matrix (6 cols x 3 rows) */}
        <div className="grid grid-cols-6 gap-1.5 py-1">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="h-1 w-1 rounded-full bg-[#FF5A1F]/75" />
          ))}
        </div>

        <span className="text-[8px] font-extrabold uppercase tracking-widest text-black/40">
          EVERY FILM. EVERY CREDIT. EVERY STORY.
        </span>
      </div>
    </div>
  );
}
