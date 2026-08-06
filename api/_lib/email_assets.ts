const SITE = 'https://muvidb.com';

export const WELCOME_EMAIL_ASSETS = {
  logoUrl: `${SITE}/images/MuviDB%20Brand/Black%20Wordmark.svg`,
  social: {
    instagram: 'https://www.instagram.com/muvidb_/',
    x: 'https://twitter.com/muvidb_',
    tiktok: 'https://www.tiktok.com/@muvidb',
    linkedin: 'https://www.linkedin.com/company/muvidb/',
  },
} as const;

export type WelcomeCollage = {
  featuredPerson: string;
  actor: string;
  filmmaker: string;
  moviePoster: string;
  productionStill: string;
};

export const FALLBACK_POSTER = `${SITE}/images/film-placeholder.webp`;

export const FALLBACK_COLLAGE: WelcomeCollage = {
  featuredPerson: FALLBACK_POSTER,
  actor: FALLBACK_POSTER,
  filmmaker: FALLBACK_POSTER,
  moviePoster: FALLBACK_POSTER,
  productionStill: FALLBACK_POSTER,
};

export const SITE_URL = SITE;
