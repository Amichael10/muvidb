import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { getAwardOrg, AWARD_LOGOS } from '../../lib/awards';

const SIZE_MAP = {
  xs: {
    container: 'w-6 h-6 rounded-md',
    img: 'p-0.5',
    icon: 12,
    text: 'text-[8px]',
  },
  sm: {
    container: 'w-8 h-8 rounded-lg',
    img: 'p-1',
    icon: 14,
    text: 'text-[9px]',
  },
  md: {
    container: 'w-12 h-12 rounded-xl',
    img: 'p-1.5',
    icon: 20,
    text: 'text-[11px]',
  },
  lg: {
    container: 'w-16 h-16 rounded-2xl',
    img: 'p-2',
    icon: 28,
    text: 'text-xs',
  },
  xl: {
    container: 'w-24 h-24 rounded-2xl',
    img: 'p-3',
    icon: 38,
    text: 'text-sm',
  },
};

/**
 * AwardLogo
 * Renders a verified festival/award ceremony logo (mirrored from FilmFreeway or official archives).
 * Falls back to an exquisite gold/accent laurel emblem if logo is absent or fails to load.
 */
export default function AwardLogo({
  org,
  size = 'md',
  className = '',
  imgClassName = '',
  showLaurel = true,
}) {
  const [imgError, setImgError] = useState(false);

  const orgMeta = useMemo(() => {
    if (!org) return null;
    if (typeof org === 'object') return org;
    return getAwardOrg(org);
  }, [org]);

  const logoSrc = useMemo(() => {
    if (!orgMeta) return null;
    if (orgMeta.logoUrl) return orgMeta.logoUrl;
    if (orgMeta.id && AWARD_LOGOS[orgMeta.id]) return AWARD_LOGOS[orgMeta.id];
    if (typeof org === 'string' && AWARD_LOGOS[org]) return AWARD_LOGOS[org];
    return null;
  }, [orgMeta, org]);

  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const accent = orgMeta?.accent || 'var(--color-brand)';
  const label = orgMeta?.label || orgMeta?.id || (typeof org === 'string' ? org : 'Award');

  // Fallback Laurel Insignia
  if (!logoSrc || imgError) {
    return (
      <div
        className={`relative shrink-0 flex flex-col items-center justify-center border border-border/80 bg-surface-2 text-center overflow-hidden transition-all duration-300 group-hover:border-brand/40 ${sizeConfig.container} ${className}`}
        style={{
          boxShadow: `0 2px 8px -2px ${accent}25`,
        }}
        title={orgMeta?.full || label}
      >
        {/* Subtle accent backdrop glow */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: accent }}
        />

        {showLaurel ? (
          <div className="relative flex flex-col items-center justify-center leading-none">
            <Icon
              icon="solar:cup-star-bold"
              width={sizeConfig.icon}
              style={{ color: accent }}
              className="drop-shadow-sm"
            />
            {size !== 'xs' && (
              <span
                className={`font-heading font-black tracking-wider uppercase mt-0.5 line-clamp-1 max-w-full px-1 text-text-primary ${sizeConfig.text}`}
              >
                {label.slice(0, 5)}
              </span>
            )}
          </div>
        ) : (
          <span
            className={`font-heading font-black uppercase text-text-primary ${sizeConfig.text}`}
          >
            {label.slice(0, 4)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center border border-border/80 bg-surface-2/95 shadow-sm overflow-hidden transition-all duration-300 group-hover:border-brand/40 group-hover:shadow-md ${sizeConfig.container} ${className}`}
      style={{
        boxShadow: `0 2px 10px -3px ${accent}20`,
      }}
      title={orgMeta?.full || label}
    >
      <img
        src={logoSrc}
        alt={`${label} Logo`}
        loading="lazy"
        onError={() => setImgError(true)}
        className={`w-full h-full object-contain filter contrast-105 transition-transform duration-300 group-hover:scale-105 ${sizeConfig.img} ${imgClassName}`}
      />
    </div>
  );
}
