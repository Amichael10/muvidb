import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

/**
 * Mirrors the <Routes> tree that used to live in src/App.tsx. Framework mode
 * code-splits every route automatically, so the lazyWithRetry() wrappers are no
 * longer needed. No loaders yet — pages still fetch in useEffect exactly as they
 * did as an SPA (see docs/SSR_MIGRATION.md, Phase 1).
 */
export default [
  index('pages/Home.jsx'),

  // ---- Public ----
  route('films/:slug', 'pages/FilmDetail.jsx'),
  // Legacy singular alias. Same module, so it needs an explicit unique route id.
  route('film/:slug', 'pages/FilmDetail.jsx', { id: 'film-detail-legacy-alias' }),
  route('search', 'pages/Search.jsx'),
  route('browse', 'pages/Browse.jsx'),
  route('tv-shows', 'pages/TVShows.jsx'),
  route('watch/:platform', 'pages/WatchPlatform.jsx'),
  route('login', 'pages/Login.jsx'),
  route('signup', 'pages/Signup.jsx'),
  route('people', 'pages/PeopleList.jsx'),
  route('people/:slug', 'pages/PersonDetail.jsx'),
  route('showtimes', 'pages/Showtimes.jsx'),
  route('cinemas', 'pages/Cinemas.jsx'),
  route('cinemas/:id', 'pages/CinemaDetail.jsx'),
  route('channels', 'pages/Channels.jsx'),
  route('channels/:slug', 'pages/ChannelDetail.jsx'),
  route('companies', 'pages/Companies.jsx'),
  route('companies/:id', 'pages/CompanyDetail.jsx'),
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
