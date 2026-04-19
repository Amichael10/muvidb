/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Home from './pages/Home';
import FilmDetail from './pages/FilmDetail';
import Search from './pages/Search';
import Browse from './pages/Browse';
import Login from './pages/Login';
import Signup from './pages/Signup';
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
import Channels from './pages/Channels';
import ChannelDetail from './pages/ChannelDetail';
import AdminChannels from './pages/admin/AdminChannels';
import AdminYouTubeVideos from './pages/admin/AdminYouTubeVideos';
import AdminCinemaFilms from './pages/admin/AdminCinemaFilms';
import AdminCinemaScraping from './pages/admin/AdminCinemaScraping';

function BackToTop() {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return visible ? (
    <button 
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
      className="fixed bottom-8 right-8 bg-gold text-bg p-4 rounded-full shadow-[0_0_20px_rgba(212,160,23,0.4)] hover:scale-110 active:scale-95 transition-all duration-300 z-50 flex items-center justify-center min-h-[44px] min-w-[44px]"
      aria-label="Back to top"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"/>
        <polyline points="5 12 12 5 19 12"/>
      </svg>
    </button>
  ) : null;
}

function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: ReactNode, 
  allowedRoles?: string[] 
}) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    setTimeout(() => {
      toast.error("You don't have permission to access this page.");
    }, 0);
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAdminPath = location.pathname.toLowerCase().startsWith('/admin');

  return (
    <div className={`min-h-screen flex flex-col bg-bg text-text-primary ${isAdminPath ? 'admin-mode' : ''}`}>
      {!isAdminPath && <Navbar />}
      <main className="flex-grow">
        {children}
      </main>
      {!isAdminPath && <Footer />}
      {!isAdminPath && <BackToTop />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster 
          position="top-center" 
          toastOptions={{
            style: {
              background: '#1A1A1A',
              color: '#F2F2F2',
              border: '1px solid #333333',
            },
            success: {
              iconTheme: {
                primary: '#D4A017',
                secondary: '#1A1A1A',
              },
            },
          }} 
        />
        <Layout>
          <Routes>

            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/film/:id" element={<FilmDetail />} />
            <Route path="/films/:id" element={<FilmDetail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* People */}
            <Route path="/people" element={<PeopleList />} />
            <Route path="/people/:id" element={<PersonDetail />} />

            {/* Showtimes */}
            <Route path="/showtimes" element={<Showtimes />} />

            {/* Cinemas */}
            <Route path="/cinemas" element={<Cinemas />} />
            <Route path="/cinemas/:id" element={<CinemaDetail />} />

            {/* Channels */}
            <Route path="/channels" element={<Channels />} />
            <Route path="/channels/:id" element={<ChannelDetail />} />

            {/* Companies */}
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/:id" element={<CompanyDetail />} />

            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/pro" 
              element={
                <ProtectedRoute allowedRoles={['professional', 'admin']}>
                  <ProDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/claim" 
              element={
                <ProtectedRoute>
                  <ClaimProfile />
                </ProtectedRoute>
              } 
            />

            {/* Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              } 
            >
              <Route index element={<AdminOverview />} />
              <Route path="films" element={<AdminFilms />} />
              <Route path="people" element={<AdminPeople />} />
              <Route path="credits" element={<AdminCredits />} />
              <Route path="companies" element={<AdminCompanies />} />
              <Route path="claims" element={<AdminClaims />} />
              <Route path="youtube" element={<AdminYouTube />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="cinemas" element={<AdminCinemas />} />
              <Route path="channels" element={<AdminChannels />} />
              <Route path="youtube-videos" element={<AdminYouTubeVideos />} />
              <Route path="cinema-films" element={<AdminCinemaFilms />} />
              <Route path="cinema-scraping" element={<AdminCinemaScraping />} />
            </Route>

          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}