/**
 * YouTube Box Office & Streaming Analytics Engine (ViewStats-inspired for Nollywood)
 *
 * Implements calibrated Nollywood streaming revenue estimation, mid-roll ad density
 * multipliers, diaspora audience mix modeling, and view velocity metrics.
 */

export interface RevenueEstimate {
  lowUsd: number;
  highUsd: number;
  lowNgn: number;
  highNgn: number;
  formattedUsd: string;
  formattedNgn: string;
  effectiveRpmUsd: string;
  tier: 'blockbuster' | 'hit' | 'moderate' | 'emerging';
}

export interface StreamingVelocity {
  daysActive: number;
  viewsPerDay: number;
  formattedViewsPerDay: string;
  badge: {
    label: string;
    icon: string;
    color: string;
  };
}

// Current benchmark USD to NGN parallel/official exchange rate for digital ad payouts
export const USD_TO_NGN = 1480;

/**
 * Format large currency amounts concisely (e.g. ₦4.5M, $12.8K)
 */
export function formatCompactCurrency(amount: number, currency: 'NGN' | 'USD'): string {
  if (amount <= 0) return currency === 'NGN' ? '₦0' : '$0';

  if (currency === 'NGN') {
    if (amount >= 1_000_000_000) {
      return `₦${(amount / 1_000_000_000).toFixed(1)}B`;
    }
    if (amount >= 1_000_000) {
      return `₦${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (amount >= 1_000) {
      return `₦${(amount / 1_000).toFixed(0)}K`;
    }
    return `₦${Math.round(amount).toLocaleString()}`;
  }

  // USD
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${Math.round(amount).toLocaleString()}`;
}

/**
 * Parses runtime string or minutes into numeric minutes
 */
export function parseRuntimeMinutes(runtime?: number | string | null): number {
  if (!runtime) return 90; // Default Nollywood feature baseline

  if (typeof runtime === 'number') {
    return runtime > 0 ? runtime : 90;
  }

  const str = String(runtime).trim();

  // Handle ISO 8601 duration e.g. PT1H45M30S or PT95M
  const isoMatch = str.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1] || '0', 10);
    const mins = parseInt(isoMatch[2] || '0', 10);
    return hours * 60 + mins;
  }

  // Handle "1h 45m" or "105 mins"
  const hrMatch = str.match(/(\d+)\s*h/i);
  const minMatch = str.match(/(\d+)\s*m/i);
  if (hrMatch || minMatch) {
    const h = hrMatch ? parseInt(hrMatch[1], 10) : 0;
    const m = minMatch ? parseInt(minMatch[1], 10) : 0;
    return h * 60 + m;
  }

  const directNum = parseInt(str, 10);
  return !isNaN(directNum) && directNum > 0 ? directNum : 90;
}

/**
 * Calculates calibrated Nollywood YouTube ad revenue range.
 * Accounts for runtime (mid-roll ad frequency) and language/diaspora audience mix.
 */
export function calculateYoutubeBoxOffice(options: {
  viewCount: number;
  runtimeMinutes?: number | string | null;
  language?: string | null;
  title?: string;
}): RevenueEstimate {
  const views = Math.max(0, Number(options.viewCount || 0));
  const runtime = parseRuntimeMinutes(options.runtimeMinutes);

  // 1. Runtime Multiplier
  // Standard video (< 30 min): 1.0x (pre-roll only)
  // Medium feature (30 - 70 min): 1.35x (1-2 mid-rolls)
  // Full-length feature (75 - 120 min): 1.85x (4-7 mid-rolls)
  // Extended epic (> 120 min): 2.25x (8-12 mid-rolls)
  let runtimeMultiplier = 1.0;
  if (runtime >= 120) {
    runtimeMultiplier = 2.25;
  } else if (runtime >= 75) {
    runtimeMultiplier = 1.85;
  } else if (runtime >= 30) {
    runtimeMultiplier = 1.35;
  }

  // 2. Audience / Diaspora Mix
  // Check if title or language points to domestic indigenous or mainstream English drama
  const langText = `${options.language || ''} ${options.title || ''}`.toLowerCase();
  const isIndigenous = /yoruba|hausa|igbo|apatatv|yorubahood|odunlade|ibrahim yekini/i.test(langText);

  // Base RPM (net creator earnings per 1,000 views before duration multiplier):
  // Indigenous: ~70% domestic ($0.50-$0.80), ~30% diaspora ($4-$8) -> Base $0.85 - $1.60
  // English / Crossover: ~45% domestic, ~55% diaspora ($6-$12) -> Base $1.40 - $2.75
  const baseRpmLow = isIndigenous ? 0.85 : 1.40;
  const baseRpmHigh = isIndigenous ? 1.60 : 2.75;

  const effectiveLowRpm = baseRpmLow * runtimeMultiplier;
  const effectiveHighRpm = baseRpmHigh * runtimeMultiplier;

  const lowUsd = (views / 1000) * effectiveLowRpm;
  const highUsd = (views / 1000) * effectiveHighRpm;

  const lowNgn = lowUsd * USD_TO_NGN;
  const highNgn = highUsd * USD_TO_NGN;

  let tier: RevenueEstimate['tier'] = 'emerging';
  if (views >= 10_000_000) tier = 'blockbuster';
  else if (views >= 3_000_000) tier = 'hit';
  else if (views >= 1_000_000) tier = 'moderate';

  return {
    lowUsd: Math.round(lowUsd),
    highUsd: Math.round(highUsd),
    lowNgn: Math.round(lowNgn),
    highNgn: Math.round(highNgn),
    formattedUsd: `${formatCompactCurrency(lowUsd, 'USD')} – ${formatCompactCurrency(highUsd, 'USD')}`,
    formattedNgn: `${formatCompactCurrency(lowNgn, 'NGN')} – ${formatCompactCurrency(highNgn, 'NGN')}`,
    effectiveRpmUsd: `$${effectiveLowRpm.toFixed(2)} – $${effectiveHighRpm.toFixed(2)}`,
    tier,
  };
}

/**
 * Calculates view velocity and pacing (average daily views since release).
 */
export function calculateStreamingVelocity(options: {
  viewCount: number;
  releaseDate?: string | null;
  year?: number | string | null;
}): StreamingVelocity {
  const views = Math.max(0, Number(options.viewCount || 0));
  const now = Date.now();

  let releaseTimestamp = 0;
  if (options.releaseDate) {
    const parsed = new Date(options.releaseDate).getTime();
    if (!isNaN(parsed) && parsed > 0 && parsed <= now) {
      releaseTimestamp = parsed;
    }
  }

  if (!releaseTimestamp && options.year) {
    const y = parseInt(String(options.year), 10);
    if (!isNaN(y) && y >= 2000) {
      releaseTimestamp = new Date(`${y}-06-01`).getTime();
    }
  }

  // Fallback: 180 days default if no date known
  const daysActive = releaseTimestamp
    ? Math.max(1, Math.round((now - releaseTimestamp) / (1000 * 60 * 60 * 24)))
    : 180;

  const viewsPerDay = Math.round(views / daysActive);

  let formattedViewsPerDay = `${viewsPerDay.toLocaleString('en-US')}/day`;
  if (viewsPerDay >= 1_000_000) {
    formattedViewsPerDay = `${(viewsPerDay / 1_000_000).toFixed(1)}M/day`;
  } else if (viewsPerDay >= 1_000) {
    formattedViewsPerDay = `${(viewsPerDay / 1_000).toFixed(1)}K/day`;
  }

  let badge = {
    label: 'Steady Streamer',
    icon: 'solar:chart-linear',
    color: 'text-text-muted bg-surface-2 border-border',
  };

  if (viewsPerDay >= 40_000 || views >= 10_000_000) {
    badge = {
      label: 'Viral Velocity',
      icon: 'solar:flame-bold',
      color: 'text-brand bg-brand/10 border-brand/20',
    };
  } else if (viewsPerDay >= 15_000 || views >= 5_000_000) {
    badge = {
      label: 'High Pacing',
      icon: 'solar:bolt-bold',
      color: 'text-brand-hover bg-brand/10 border-brand/20',
    };
  } else if (viewsPerDay >= 5_000 || views >= 1_000_000) {
    badge = {
      label: 'Box Office Hit',
      icon: 'solar:star-bold',
      color: 'text-text-primary bg-surface-3 border-border',
    };
  }

  return {
    daysActive,
    viewsPerDay,
    formattedViewsPerDay,
    badge,
  };
}

