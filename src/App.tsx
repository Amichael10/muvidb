import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Public Pages
import Home from './pages/Home';
import FilmDetail from './pages/FilmDetail';
import Search from './pages/Search';
import Browse from './pages/Browse';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import ProDashboard from './pages/ProDashboard';
import ClaimProfile from './pages/ClaimProfile';
import PersonDetail from './pages/PersonDetail';
import Showtimes from './pages/Showtimes';
import Cinemas from './pages/Cinemas';
import CinemaDetail from './pages/CinemaDetail';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import PeopleList from './pages/PeopleList';
import Channels from './pages/Channels';
import ChannelDetail from './pages/ChannelDetail';

import Waitlist from './pages/Waitlist';

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminFilms from './pages/admin/AdminFilms';
import AdminPeople from './pages/admin/AdminPeople';
import AdminCredits from './pages/admin/AdminCredits';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminClaims from './pages/admin/AdminClaims';
import AdminYouTube from './pages/admin/AdminYouTube';
import AdminUsers from './pages/admin/AdminUsers';
import AdminCinemas from './pages/admin/AdminCinemas';
import AdminChannels from './pages/admin/AdminChannels';
import AdminYouTubeVideos from './pages/admin/AdminYouTubeVideos';
import AdminCinemaFilms from './pages/admin/AdminCinemaFilms';
import AdminCinemaScraping from './pages/admin/AdminCinemaScraping';
import AdminChannelDetail from './pages/admin/AdminChannelDetail';
import AdminImport from './pages/admin/AdminImport';
import AdminAI from './pages/admin/AdminAI';

// Components
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import MobileNav from './components/layout/MobileNav';
import SmoothScroll from './components/layout/SmoothScroll';

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
      className="fixed bottom-24 right-4 bg-brand text-white p-3 rounded-full shadow-lg z-50 transition-all hover:scale-110 active:scale-95 lg:bottom-8 lg:right-8 lg:p-4"
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
            <Layout>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/films/:id" element={<FilmDetail />} />
                <Route path="/film/:id" element={<FilmDetail />} />
                <Route path="/search" element={<Search />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/people" element={<PeopleList />} />
                <Route path="/people/:id" element={<PersonDetail />} />
                <Route path="/showtimes" element={<Showtimes />} />
                <Route path="/cinemas" element={<Cinemas />} />
                <Route path="/cinemas/:id" element={<CinemaDetail />} />
                <Route path="/channels" element={<Channels />} />
                <Route path="/channels/:id" element={<ChannelDetail />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/companies/:id" element={<CompanyDetail />} />

                {/* Onboarding */}
                <Route path="/waitlist" element={<Waitlist />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

                {/* Protected Routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/pro-dashboard" element={<ProtectedRoute allowedRoles={['professional', 'admin']}><ProDashboard /></ProtectedRoute>} />
                <Route path="/claim" element={<ProtectedRoute><ClaimProfile /></ProtectedRoute>} />

                {/* Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
                  <Route index element={<AdminOverview />} />
                  <Route path="films" element={<AdminFilms />} />
                  <Route path="people" element={<AdminPeople />} />
                  <Route path="credits" element={<AdminCredits />} />
                  <Route path="companies" element={<AdminCompanies />} />
                  <Route path="claims" element={<AdminClaims />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="cinemas" element={<AdminCinemas />} />
                  <Route path="channels" element={<AdminChannels />} />
                  <Route path="channels/:id" element={<AdminChannelDetail />} />
                  <Route path="cinema-films" element={<AdminCinemaFilms />} />
                  <Route path="cinema-scraping" element={<AdminCinemaScraping />} />
                  <Route path="ai" element={<AdminAI />} />
                  <Route path="import" element={<AdminImport />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </SmoothScroll>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}