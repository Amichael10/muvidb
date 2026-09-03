import { useState, useEffect, lazy, Suspense, Component } from 'react';
import type { ReactNode, ComponentType } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { QuickViewProvider } from './context/QuickViewContext';
import ErrorPage from './components/ErrorPage';

// Eager: landing page only (keeps first paint / LCP fast)
import Home from './pages/Home';

// Retry a lazy import once by hard-reloading when the chunk fails to load. A
// stale chunk reference after a deploy (or a dropped mobile request) is the
// classic cause of a blank page that a manual reload "fixes" — this does that
// reload automatically, guarded so it can never loop.
let chunkReloadInProgress = false;

function lazyWithRetry(factory: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err) => {
      const key = 'chunk-reload-ts';
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 10000) {
        // Several route chunks can fail together after a deployment (the admin
        // layout and its index page, for example). Once one failure schedules a
        // reload, keep every concurrent import suspended instead of allowing a
        // second failure to reach the global error boundary first.
        if (chunkReloadInProgress) return new Promise<never>(() => {});
        chunkReloadInProgress = true;
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return new Promise<never>(() => {}); // stay suspended through the reload
      }
      if (chunkReloadInProgress) return new Promise<never>(() => {});
      throw err; // reloaded recently already — let the error boundary show
    })
  );
}

// Lazy public pages — code-split out of the initial bundle
const FilmDetail = lazyWithRetry(() => import('./pages/FilmDetail'));
const Search = lazyWithRetry(() => import('./pages/Search'));
const Browse = lazyWithRetry(() => import('./pages/Browse'));
const TVShows = lazyWithRetry(() => import('./pages/TVShows'));
const WatchPlatform = lazyWithRetry(() => import('./pages/WatchPlatform'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const Signup = lazyWithRetry(() => import('./pages/Signup'));
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const ProDashboard = lazyWithRetry(() => import('./pages/ProDashboard'));

const PersonDetail = lazyWithRetry(() => import('./pages/PersonDetail'));
const Showtimes = lazyWithRetry(() => import('./pages/Showtimes'));
const Cinemas = lazyWithRetry(() => import('./pages/Cinemas'));
const CinemaDetail = lazyWithRetry(() => import('./pages/CinemaDetail'));
const Companies = lazyWithRetry(() => import('./pages/Companies'));
const CompanyDetail = lazyWithRetry(() => import('./pages/CompanyDetail'));
const PeopleList = lazyWithRetry(() => import('./pages/PeopleList'));
const Channels = lazyWithRetry(() => import('./pages/Channels'));
const ChannelDetail = lazyWithRetry(() => import('./pages/ChannelDetail'));
const Terms = lazyWithRetry(() => import('./pages/Terms'));
const Privacy = lazyWithRetry(() => import('./pages/Privacy'));
const Waitlist = lazyWithRetry(() => import('./pages/Waitlist'));
const About = lazyWithRetry(() => import('./pages/About'));
const Awards = lazyWithRetry(() => import('./pages/Awards'));
const AwardDetail = lazyWithRetry(() => import('./pages/AwardDetail'));
const Contact = lazyWithRetry(() => import('./pages/Contact'));
const Careers = lazyWithRetry(() => import('./pages/Careers'));
const CareerDetail = lazyWithRetry(() => import('./pages/CareerDetail'));
const CriticsList = lazyWithRetry(() => import('./pages/CriticsList'));
const CriticDetail = lazyWithRetry(() => import('./pages/CriticDetail'));
const PlaysList = lazyWithRetry(() => import('./pages/PlaysList'));
const PlayDetail = lazyWithRetry(() => import('./pages/PlayDetail'));
const TitleChecker = lazyWithRetry(() => import('./pages/TitleChecker'));

// Lazy admin pages — kept entirely out of the public bundle
const AdminLayout = lazyWithRetry(() => import('./pages/admin/AdminLayout'));
const AdminOverview = lazyWithRetry(() => import('./pages/admin/AdminOverview'));
const AdminFilms = lazyWithRetry(() => import('./pages/admin/AdminFilms'));
const AdminPeople = lazyWithRetry(() => import('./pages/admin/AdminPeople'));
const AdminPeopleEnrichment = lazyWithRetry(() => import('./pages/admin/AdminPeopleEnrichment'));
const AdminCredits = lazyWithRetry(() => import('./pages/admin/AdminCredits'));
const AdminCompanies = lazyWithRetry(() => import('./pages/admin/AdminCompanies'));
const AdminClaims = lazyWithRetry(() => import('./pages/admin/AdminClaims'));
const AdminOutreach = lazyWithRetry(() => import('./pages/admin/AdminOutreach'));
const AdminContributions = lazyWithRetry(() => import('./pages/admin/AdminContributions'));
const AdminNewReleases = lazyWithRetry(() => import('./pages/admin/AdminNewReleases'));
const AdminUsers = lazyWithRetry(() => import('./pages/admin/AdminUsers'));
const AdminCinemas = lazyWithRetry(() => import('./pages/admin/AdminCinemas'));
const AdminChannels = lazyWithRetry(() => import('./pages/admin/AdminChannels'));
const AdminCinemaFilms = lazyWithRetry(() => import('./pages/admin/AdminCinemaFilms'));
const AdminCinemaScraping = lazyWithRetry(() => import('./pages/admin/AdminCinemaScraping'));
const AdminCreditsExtractor = lazyWithRetry(() => import('./pages/admin/AdminCreditsExtractor'));
const AdminEditorial = lazyWithRetry(() => import('./pages/admin/AdminEditorial'));
const AdminChannelDetail = lazyWithRetry(() => import('./pages/admin/AdminChannelDetail'));
const AdminImport = lazyWithRetry(() => import('./pages/admin/AdminImport'));
const AdminAI = lazyWithRetry(() => import('./pages/admin/AdminAI'));
const AdminDeduplicator = lazyWithRetry(() => import('./pages/admin/AdminDeduplicator'));
const AdminSpotlight = lazyWithRetry(() => import('./pages/admin/AdminSpotlight'));
const AdminJobs = lazyWithRetry(() => import('./pages/admin/AdminJobs'));
const AdminTop10 = lazyWithRetry(() => import('./pages/admin/AdminTop10'));
const AdminLogs = lazyWithRetry(() => import('./pages/admin/AdminLogs'));
const AdminAutomation = lazyWithRetry(() => import('./pages/admin/AdminAutomation'));
const AdminCountries = lazyWithRetry(() => import('./pages/admin/AdminCountries'));
const AdminCritics = lazyWithRetry(() => import('./pages/admin/AdminCritics'));
const AdminPlays = lazyWithRetry(() => import('./pages/admin/AdminPlays'));

// Components
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import MobileNav from './components/layout/MobileNav';
import SmoothScroll from './components/layout/SmoothScroll';
import CookieConsent from './components/CookieConsent';
import QuickViewModal from './components/film/QuickViewModal';

// Protected Route Wrapper
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  
  // Force onboarding if not complete
  if (!user.onboarded && user.role !== 'admin' && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Prevent accessing onboarding if already complete
  if (user.onboarded && location.pathname === '/onboarding') {
    return <Navigate to={user.role === 'professional' ? '/pro-dashboard' : '/dashboard'} replace />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      const footer = document.querySelector('footer');
      const footerVisible = footer ? footer.getBoundingClientRect().top < window.innerHeight : false;
      setVisible(window.scrollY > 400 && !footerVisible);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);
  if (!visible) return null;
  return (
    <button 
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-28 right-6 bg-brand/90 hover:bg-brand text-white p-3 rounded-full shadow-xl z-50 transition-all hover:scale-110 active:scale-95 lg:bottom-12 lg:right-12 lg:p-4 border border-white/10"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
    </button>
  );
}

function Layout({ children }) {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  const isOnboardingPath = location.pathname === '/onboarding';
  const isWaitlistPath = location.pathname === '/waitlist';
  
  const hideLayout = isAdminPath || isOnboardingPath || isWaitlistPath;
  
  return (
    <div className="min-h-screen flex flex-col bg-bg text-text-primary">
      {!hideLayout && <Navbar />}
      <main className={`flex-grow ${!hideLayout ? 'pt-24 pb-20 lg:pb-0' : ''}`}>
        {children}
      </main>
      {!hideLayout && <Footer />}
      {!hideLayout && <MobileNav />}
      {!hideLayout && <BackToTop />}
    </div>
  );
}

// Visible loading state for lazy pages — a spinner, not a blank black screen,
// so a slow chunk load never looks like a crash.
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand" />
    </div>
  );
}

// Catches render errors (including a genuinely failed chunk after we've already
// tried reloading) and offers a recovery action instead of a black void.
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  declare props: { children: ReactNode };
  state: { hasError: boolean } = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error('App error boundary caught:', error);
  }
  render() {
    if (this.state.hasError) {
      return <ErrorPage variant="error" />;
    }
    return this.props.children;
  }
}

const ROUTE_TITLES: Record<string, string> = {
  '/': 'MuviDB | The Digital Database of African Cinema',
  '/login': 'MuviDB | Sign In',
  '/signup': 'MuviDB | Join',
  '/dashboard': 'MuviDB | Dashboard',
  '/pro-dashboard': 'MuviDB Pro | Dashboard',
  '/admin': 'MuviDB | Admin Overview',
  '/admin/films': 'MuviDB | Admin Films',
  '/admin/people': 'MuviDB | Admin People',
  '/admin/people-enrichment': 'MuviDB | People Enrichment',
  '/admin/credits': 'MuviDB | Admin Credits',
  '/admin/companies': 'MuviDB | Admin Companies',
  '/admin/claims': 'MuviDB | Profile Claims',
  '/admin/outreach': 'MuviDB | Admin Outreach',
  '/admin/contributions': 'MuviDB | Contributions',
  '/admin/new-releases': 'MuviDB | New Releases',
  '/admin/users': 'MuviDB | User Management',
  '/admin/cinemas': 'MuviDB | Admin Cinemas',
  '/admin/channels': 'MuviDB | Admin Channels',
  '/admin/cinema-films': 'MuviDB | Admin Cinema Films',
  '/admin/cinema-scraping': 'MuviDB | Cinema Scraping',
  '/admin/ai': 'MuviDB | AI Suite',
  '/admin/deduplicator': 'MuviDB | Deduplicator',
  '/admin/import': 'MuviDB | Data Import',
  '/admin/spotlight': 'MuviDB | Spotlight',
  '/admin/jobs': 'MuviDB | Admin Jobs',
  '/admin/top10': 'MuviDB | Admin Top 10',
  '/admin/automation': 'MuviDB | Automation',
  '/admin/countries': 'MuviDB | Admin Countries',
  '/admin/critics': 'MuviDB | Admin Critics',
  '/admin/plays': 'MuviDB | Admin Plays',
  '/admin/logs': 'MuviDB | System Logs',
  '/search': 'MuviDB | Search',
  '/browse': 'MuviDB | Browse Movies',
  '/tv-shows': 'MuviDB | TV Shows',
  '/people': 'MuviDB | People',
  '/showtimes': 'MuviDB | Showtimes',
  '/cinemas': 'MuviDB | Cinemas',
  '/channels': 'MuviDB | Channels',
  '/companies': 'MuviDB | Companies',
  '/terms': 'MuviDB | Terms of Service',
  '/privacy': 'MuviDB | Privacy Policy',
  '/about': 'MuviDB | About Us',
  '/awards': 'MuviDB | Awards',
  '/contact': 'MuviDB | Contact Us',
  '/careers': 'MuviDB | Careers',
  '/critics': 'MuviDB | Critics',
  '/plays': 'MuviDB | Plays',
  '/tools/title-checker': 'MuviDB | Nollywood Title Radar',
  '/title-checker': 'MuviDB | Nollywood Title Radar',
  '/onboarding': 'MuviDB | Complete Your Profile',
  '/waitlist': 'MuviDB | The Home of African Cinema',
};

function PageTitleHandler() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (ROUTE_TITLES[path]) {
      document.title = ROUTE_TITLES[path];
      return;
    }
    if (path.startsWith('/films/') || path.startsWith('/film/')) {
      document.title = 'MuviDB | Film Details';
    } else if (path.startsWith('/people/')) {
      document.title = 'MuviDB | Person Details';
    } else if (path.startsWith('/cinemas/')) {
      document.title = 'MuviDB | Cinema Details';
    } else if (path.startsWith('/channels/')) {
      document.title = 'MuviDB | Channel Details';
    } else if (path.startsWith('/companies/')) {
      document.title = 'MuviDB | Company Details';
    } else if (path.startsWith('/admin')) {
      document.title = 'MuviDB | Admin';
    } else {
      document.title = 'MuviDB | The Digital Database of African Cinema';
    }
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <QuickViewProvider>
          <Router>
            <PageTitleHandler />
            <SmoothScroll>
              <Toaster 
              position="top-center" 
              toastOptions={{
                style: {
                  background: '#1A1A1A',
                  color: '#F2F2F2',
                  border: '1px solid #333333',
                },
              }} 
              
            />
            <CookieConsent />
            <QuickViewModal />
            {/* Signature: subtle film grain over the whole app */}
            <div className="film-grain" aria-hidden="true" />
            <Layout>
              <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/films/:slug" element={<FilmDetail />} />
                <Route path="/film/:slug" element={<FilmDetail />} />
                <Route path="/search" element={<Search />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/tv-shows" element={<TVShows />} />
                <Route path="/watch/:platform" element={<WatchPlatform />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/people" element={<PeopleList />} />
                <Route path="/people/:slug" element={<PersonDetail />} />
                <Route path="/showtimes" element={<Showtimes />} />
                <Route path="/cinemas" element={<Cinemas />} />
                <Route path="/cinemas/:id" element={<CinemaDetail />} />
                <Route path="/channels" element={<Channels />} />
                <Route path="/channels/:slug" element={<ChannelDetail />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/companies/:id" element={<CompanyDetail />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/about" element={<About />} />
                <Route path="/awards" element={<Awards />} />
                <Route path="/awards/:id" element={<AwardDetail />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/careers/:slug" element={<CareerDetail />} />
                <Route path="/critics" element={<CriticsList />} />
                <Route path="/critics/:slug" element={<CriticDetail />} />
                <Route path="/plays" element={<PlaysList />} />
                <Route path="/plays/:slug" element={<PlayDetail />} />
                <Route path="/tools/title-search" element={<TitleChecker />} />
                <Route path="/title-search" element={<TitleChecker />} />
                <Route path="/tools/title-checker" element={<TitleChecker />} />
                <Route path="/title-checker" element={<TitleChecker />} />

                {/* Onboarding */}
                <Route path="/waitlist" element={<Waitlist />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

                {/* Protected Routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/pro-dashboard" element={<ProtectedRoute allowedRoles={['professional', 'admin']}><ProDashboard /></ProtectedRoute>} />


                {/* Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'admin_limited']}><AdminLayout /></ProtectedRoute>}>
                  <Route index element={<AdminOverview />} />
                  <Route path="films" element={<AdminFilms />} />
                  <Route path="people" element={<AdminPeople />} />
                  <Route path="people-enrichment" element={<ProtectedRoute allowedRoles={['admin']}><AdminPeopleEnrichment /></ProtectedRoute>} />
                  <Route path="credits" element={<AdminCredits />} />
                  <Route path="credits/extractor" element={<AdminCreditsExtractor />} />
                  <Route path="companies" element={<AdminCompanies />} />
                  <Route path="claims" element={<AdminClaims />} />
                  <Route path="outreach" element={<ProtectedRoute allowedRoles={['admin']}><AdminOutreach /></ProtectedRoute>} />
                  <Route path="contributions" element={<AdminContributions />} />
                  <Route path="new-releases" element={<AdminNewReleases />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="cinemas" element={<AdminCinemas />} />
                  <Route path="channels" element={<AdminChannels />} />
                  <Route path="channels/:id" element={<AdminChannelDetail />} />
                  <Route path="cinema-films" element={<AdminCinemaFilms />} />
                  <Route path="cinema-scraping" element={<AdminCinemaScraping />} />
                  <Route path="ai" element={<AdminAI />} />
                  <Route path="editorial" element={<AdminEditorial />} />
                  <Route path="deduplicator" element={<AdminDeduplicator />} />
                  <Route path="import" element={<AdminImport />} />
                  <Route path="spotlight" element={<AdminSpotlight />} />
                  <Route path="jobs" element={<AdminJobs />} />
                  <Route path="top10" element={<AdminTop10 />} />
                  <Route path="title-search" element={<TitleChecker />} />
                  <Route path="title-checker" element={<TitleChecker />} />
                  <Route path="automation" element={<AdminAutomation />} />
                  <Route path="countries" element={<AdminCountries />} />
                  <Route path="critics" element={<AdminCritics />} />
                  <Route path="plays" element={<AdminPlays />} />
                  <Route path="logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminLogs /></ProtectedRoute>} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
              </ErrorBoundary>
            </Layout>
          </SmoothScroll>
        </Router>
        </QuickViewProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
