import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

/**
 * Mirrors the <Routes> tree that used to live in src/App.tsx. Framework mode
 * code-splits every route automatically, so the lazyWithRetry() wrappers are no
 * longer needed. No loaders yet — pages still fetch in useEffect exactly as they
 * did as an SPA (see docs/SSR_MIGRATION.md, Phase 1).
 */
export default [
  index('routes/home.tsx'),

  // ---- Public ----
  // The six detail routes below use thin wrappers in src/routes/ that add a
  // server `loader` + `meta` to build the SEO head. That replaces the meta
  // injection api/seo.ts used to do via vercel.json rewrites — see
  // src/lib/seo.server.ts.
  route('films/:slug', 'routes/film-detail.tsx'),
  // Legacy singular alias. Same module, so it needs an explicit unique route id.
  route('film/:slug', 'routes/film-detail.tsx', { id: 'film-detail-legacy-alias' }),
  route('search', 'routes/search.tsx'),
  route('browse', 'routes/browse.tsx'),
  route('tv-shows', 'routes/tv-shows.tsx'),
  route('watch/:platform', 'routes/watch-platform.tsx'),
  route('login', 'pages/Login.jsx'),
  route('signup', 'pages/Signup.jsx'),
  route('people', 'routes/people-list.tsx'),
  route('people/:slug', 'routes/person-detail.tsx'),
  route('showtimes', 'routes/showtimes.tsx'),
  route('cinemas', 'routes/cinemas-list.tsx'),
  route('cinemas/:id', 'routes/cinema-detail.tsx'),
  route('channels', 'routes/channels-list.tsx'),
  route('channels/:slug', 'routes/channel-detail.tsx'),
  route('companies', 'routes/companies-list.tsx'),
  route('companies/:id', 'routes/company-detail.tsx'),
  route('terms', 'pages/Terms.jsx'),
  route('privacy', 'pages/Privacy.jsx'),
  route('about', 'pages/About.jsx'),
  route('contact', 'pages/Contact.jsx'),
  route('waitlist', 'pages/Waitlist.tsx'),

  // ---- Authenticated ----
  layout('routes/require-auth.tsx', [
    route('onboarding', 'pages/Onboarding.jsx'),
    route('dashboard', 'pages/Dashboard.jsx'),
  ]),
  layout('routes/require-pro.tsx', [
    route('pro-dashboard', 'pages/ProDashboard.jsx'),
  ]),

  // ---- Admin ----
  layout('routes/require-admin.tsx', [
    route('admin', 'pages/admin/AdminLayout.jsx', [
      index('pages/admin/AdminOverview.jsx'),
      route('films', 'pages/admin/AdminFilms.jsx'),
      route('people', 'pages/admin/AdminPeople.jsx'),
      route('credits', 'pages/admin/AdminCredits.jsx'),
      route('credits/extractor', 'pages/admin/AdminCreditsExtractor.jsx'),
      route('companies', 'pages/admin/AdminCompanies.jsx'),
      route('claims', 'pages/admin/AdminClaims.jsx'),
      route('contributions', 'pages/admin/AdminContributions.jsx'),
      route('new-releases', 'pages/admin/AdminNewReleases.jsx'),
      route('users', 'pages/admin/AdminUsers.jsx'),
      route('cinemas', 'pages/admin/AdminCinemas.jsx'),
      route('channels', 'pages/admin/AdminChannels.jsx'),
      route('channels/:id', 'pages/admin/AdminChannelDetail.jsx'),
      route('cinema-films', 'pages/admin/AdminCinemaFilms.jsx'),
      route('cinema-scraping', 'pages/admin/AdminCinemaScraping.jsx'),
      route('ai', 'pages/admin/AdminAI.jsx'),
      route('deduplicator', 'pages/admin/AdminDeduplicator.jsx'),
      route('import', 'pages/admin/AdminImport.jsx'),
      route('spotlight', 'pages/admin/AdminSpotlight.jsx'),
      route('top10', 'pages/admin/AdminTop10.jsx'),
      route('automation', 'pages/admin/AdminAutomation.jsx'),
      route('countries', 'pages/admin/AdminCountries.jsx'),

      // Full admins only — these three carried a second, stricter guard.
      layout('routes/require-admin-strict.tsx', [
        route('people-enrichment', 'pages/admin/AdminPeopleEnrichment.jsx'),
        route('outreach', 'pages/admin/AdminOutreach.jsx'),
        route('logs', 'pages/admin/AdminLogs.jsx'),
      ]),
    ]),
  ]),

  route('*', 'routes/catch-all.tsx'),
] satisfies RouteConfig;
