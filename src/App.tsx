import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { QuickViewProvider } from './context/QuickViewContext';

// Eager: landing page only (keeps first paint / LCP fast)
import Home from './pages/Home';

// Lazy public pages — code-split out of the initial bundle
const FilmDetail = lazy(() => import('./pages/FilmDetail'));
const Search = lazy(() => import('./pages/Search'));
const Browse = lazy(() => import('./pages/Browse'));
const TVShows = lazy(() => import('./pages/TVShows'));
const WatchPlatform = lazy(() => import('./pages/WatchPlatform'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProDashboard = lazy(() => import('./pages/ProDashboard'));
const ClaimProfile = lazy(() => import('./pages/ClaimProfile'));
const PersonDetail = lazy(() => import('./pages/PersonDetail'));
const Showtimes = lazy(() => import('./pages/Showtimes'));
const Cinemas = lazy(() => import('./pages/Cinemas'));
const CinemaDetail = lazy(() => import('./pages/CinemaDetail'));
const Companies = lazy(() => import('./pages/Companies'));
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'));
const PeopleList = lazy(() => import('./pages/PeopleList'));
const Channels = lazy(() => import('./pages/Channels'));
const ChannelDetail = lazy(() => import('./pages/ChannelDetail'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Waitlist = lazy(() => import('./pages/Waitlist'));

// Lazy admin pages — kept entirely out of the public bundle
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminFilms = lazy(() => import('./pages/admin/AdminFilms'));
const AdminPeople = lazy(() => import('./pages/admin/AdminPeople'));
const AdminCredits = lazy(() => import('./pages/admin/AdminCredits'));
const AdminCompanies = lazy(() => import('./pages/admin/AdminCompanies'));
const AdminClaims = lazy(() => import('./pages/admin/AdminClaims'));
const AdminContributions = lazy(() => import('./pages/admin/AdminContributions'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminCinemas = lazy(() => import('./pages/admin/AdminCinemas'));
const AdminChannels = lazy(() => import('./pages/admin/AdminChannels'));
const AdminCinemaFilms = lazy(() => import('./pages/admin/AdminCinemaFilms'));
const AdminCinemaScraping = lazy(() => import('./pages/admin/AdminCinemaScraping'));
const AdminCreditsExtractor = lazy(() => import('./pages/admin/AdminCreditsExtractor'));
const AdminChannelDetail = lazy(() => import('./pages/admin/AdminChannelDetail'));
const AdminImport = lazy(() => import('./pages/admin/AdminImport'));
const AdminAI = lazy(() => import('./pages/admin/AdminAI'));
const AdminSpotlight = lazy(() => import('./pages/admin/AdminSpotlight'));
const AdminTop10 = lazy(() => import('./pages/admin/AdminTop10'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));
const AdminAutomation = lazy(() => import('./pages/admin/AdminAutomation'));
const AdminCountries = lazy(() => import('./pages/admin/AdminCountries'));

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
    const handleScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <QuickViewProvider>
          <Router>
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
            <Layout>
              <Suspense fallback={<div className="min-h-screen bg-bg" />}>
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
                <Route path="/companies/:slug" element={<CompanyDetail />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />

                {/* Onboarding */}
                <Route path="/waitlist" element={<Waitlist />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

                {/* Protected Routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/pro-dashboard" element={<ProtectedRoute allowedRoles={['professional', 'admin']}><ProDashboard /></ProtectedRoute>} />
                <Route path="/claim" element={<ProtectedRoute><ClaimProfile /></ProtectedRoute>} />

                {/* Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'admin_limited']}><AdminLayout /></ProtectedRoute>}>
                  <Route index element={<AdminOverview />} />
                  <Route path="films" element={<AdminFilms />} />
                  <Route path="people" element={<AdminPeople />} />
                  <Route path="credits" element={<AdminCredits />} />
                  <Route path="credits/extractor" element={<AdminCreditsExtractor />} />
                  <Route path="companies" element={<AdminCompanies />} />
                  <Route path="claims" element={<AdminClaims />} />
                  <Route path="contributions" element={<AdminContributions />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="cinemas" element={<AdminCinemas />} />
                  <Route path="channels" element={<AdminChannels />} />
                  <Route path="channels/:id" element={<AdminChannelDetail />} />
                  <Route path="cinema-films" element={<AdminCinemaFilms />} />
                  <Route path="cinema-scraping" element={<AdminCinemaScraping />} />
                  <Route path="ai" element={<AdminAI />} />
                  <Route path="import" element={<AdminImport />} />
                  <Route path="spotlight" element={<AdminSpotlight />} />
                  <Route path="top10" element={<AdminTop10 />} />
                  <Route path="automation" element={<AdminAutomation />} />
                  <Route path="countries" element={<AdminCountries />} />
                  <Route path="logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminLogs /></ProtectedRoute>} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </Layout>
          </SmoothScroll>
        </Router>
        </QuickViewProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}