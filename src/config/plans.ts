/**
 * Centralized Subscription & Monetization Plans for MuviDB
 * Single source of truth for pricing across Studio Pro, Talent Pro, and Developer APIs.
 */

export interface SubscriptionPlan {
  id: string;
  name: string;
  category: 'company' | 'talent' | 'developer';
  amount: number; // in NGN
  amountFormatted: string;
  billingCycle: 'monthly' | 'annual' | 'free';
  tagline: string;
  features: string[];
  limits: {
    maxTalents?: number;
    apiRequestsPerDay?: number;
    teamSeats?: number;
  };
  highlighted?: boolean;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  // ── COMPANY / STUDIO TIERS ──
  company_free: {
    id: 'company_free',
    name: 'Studio Standard',
    category: 'company',
    amount: 0,
    amountFormatted: '₦0',
    billingCycle: 'free',
    tagline: 'Claim your studio and manage your filmography for free',
    features: [
      'Unlimited film catalogue & release updates',
      'Full cast & crew billing management (zero duplicates)',
      'Basic Studio Profile with logo & banner',
      'Manage up to 3 talents on your official roster',
      'Basic API Access (1,000 requests/day)',
      '2 team member seats',
    ],
    limits: {
      maxTalents: 3,
      apiRequestsPerDay: 1000,
      teamSeats: 2,
    },
  },

  studio_pro_monthly: {
    id: 'studio_pro_monthly',
    name: 'Studio Pro (Monthly)',
    category: 'company',
    amount: 25000,
    amountFormatted: '₦25,000',
    billingCycle: 'monthly',
    tagline: 'Enterprise-grade catalog management, unlimited roster & high-volume APIs',
    features: [
      'Everything in Studio Standard',
      'Unlimited Talent Roster (representation badges on actor pages)',
      'High-throughput Developer API (100,000 req/day)',
      'Live automated box office webhooks & syndication',
      'Multi-seat collaboration (up to 10 staff members)',
      'Verified Studio Badge & priority indexing',
      'Dedicated WhatsApp & tech account manager',
    ],
    limits: {
      maxTalents: Infinity,
      apiRequestsPerDay: 100000,
      teamSeats: 10,
    },
    highlighted: true,
  },

  studio_pro_annual: {
    id: 'studio_pro_annual',
    name: 'Studio Pro (Annual)',
    category: 'company',
    amount: 240000,
    amountFormatted: '₦240,000',
    billingCycle: 'annual',
    tagline: 'Get 2 months free with annual studio billing (₦20,000/month)',
    features: [
      'Everything in Studio Pro Monthly',
      '2 Months Free discount',
      'Custom catalog data exports (CSV / JSON)',
      'Direct film premiere promotional boost on MuviDB home slate',
    ],
    limits: {
      maxTalents: Infinity,
      apiRequestsPerDay: 100000,
      teamSeats: 10,
    },
  },

  // ── ACTOR / TALENT PRO TIERS ──
  talent_free: {
    id: 'talent_free',
    name: 'Actor Standard',
    category: 'talent',
    amount: 0,
    amountFormatted: '₦0',
    billingCycle: 'free',
    tagline: 'Claim your official actor profile on MuviDB',
    features: [
      'Verified personal filmography & credits',
      '1 Primary headshot photo',
      'Official bio & social links',
    ],
    limits: {},
  },

  talent_pro_monthly: {
    id: 'talent_pro_monthly',
    name: 'Talent Pro (Monthly)',
    category: 'talent',
    amount: 4500,
    amountFormatted: '₦4,500',
    billingCycle: 'monthly',
    tagline: 'Direct booking contacts, video showreels & casting visibility',
    features: [
      'Official Golden Verified Actor Checkmark',
      'Direct Booking Gateway (Agent/Manager WhatsApp, phone & email)',
      'Video Showreel Section (YouTube/Vimeo scene reels & monologues)',
      'Live Availability Status (e.g. "Open for Features", "On Set")',
      'Photo Portfolio Gallery (up to 10 high-res looks)',
      'Casting Search Priority (ranked above standard profiles)',
      'Weekly Profile View Analytics ("Who viewed your page")',
    ],
    limits: {},
    highlighted: true,
  },

  talent_pro_annual: {
    id: 'talent_pro_annual',
    name: 'Talent Pro (Annual)',
    category: 'talent',
    amount: 45000,
    amountFormatted: '₦45,000',
    billingCycle: 'annual',
    tagline: 'Annual career representation pass with 2 months free',
    features: [
      'Everything in Talent Pro Monthly',
      '2 Months Free discount (save ₦9,000/year)',
      'Exportable Actor CV / One-Sheet (PDF with QR code)',
      'Featured placement on MuviDB Rising Stars discovery carousel',
    ],
    limits: {},
  },

  // ── DEVELOPER ONLY ──
  api_starter: {
    id: 'api_starter',
    name: 'Developer API Starter',
    category: 'developer',
    amount: 10000,
    amountFormatted: '₦10,000',
    billingCycle: 'monthly',
    tagline: 'Programmatic African Cinema data for apps and startups',
    features: [
      '25,000 requests/day',
      'Full movies, box office, cast & crew data',
      'Community Discord developer support',
    ],
    limits: {
      apiRequestsPerDay: 25000,
    },
  },
};

export const PLANS = SUBSCRIPTION_PLANS;

/**
 * Get plan by ID with safe fallback
 */
export function getPlan(planId: string): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.studio_pro_monthly;
}

/**
 * Format currency in Nigerian Naira
 */
export function formatNaira(amount: number): string {
  if (!amount) return '₦0';
  return `₦${Number(amount).toLocaleString()}`;
}
