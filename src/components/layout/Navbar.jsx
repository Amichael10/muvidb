import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Icon } from '@iconify/react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState(['King of Boys', 'Funke Akindele', 'Anikulapo']);
  const [unreadNotifications, setUnreadNotifications] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    
    // Stop/Start Lenis scrolling when search is open
    const lenis = window.lenis;
    if (lenis) {
      if (isSearchOpen) {
        lenis.stop();
      } else {
        lenis.start();
      }
    }
  }, [isSearchOpen]);

  // Close search and menus on route change
  useEffect(() => {
    setIsSearchOpen(false);
    setIsUserMenuOpen(false);
  }, [location]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { name: 'Browse', path: '/browse' },
    { name: 'Showtimes', path: '/showtimes' },
    { name: 'Cinemas', path: '/cinemas' },
    { name: 'Channels', path: '/channels' },
    { name: 'People', path: '/people' },
    { name: 'Companies', path: '/companies' },
  ];

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 border-b border-transparent
          ${isScrolled ? 'bg-surface/80 backdrop-blur-xl border-border h-[64px]' : 'bg-transparent h-[80px] md:h-[90px]'}
        `}
      >
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8 border-x border-white/5">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center group shrink-0">
          <img 
            src={theme === 'dark' ? "/images/Ensembla Brand/Wordmark White.svg" : "/images/Ensembla Brand/Wordmark.svg"} 
            alt="Ensembla" 
            className="h-9 object-contain group-hover:scale-105 transition-all duration-500" 
          />
        </Link>

        {/* Center: Navigation Links (Desktop Only) */}
        <div className="hidden lg:flex items-center gap-1 bg-surface-2/50 backdrop-blur-sm border border-border p-1 rounded-full">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
                  ${isActive 
                    ? 'bg-brand text-white shadow-md' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  }
                `}
              >
                {link.name}
              </Link>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          {/* Search Button */}
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-brand hover:bg-brand/10 rounded-full transition-all active:scale-90"
            aria-label="Search"
          >
            <Icon icon="solar:magnifer-linear" width="22" height="22" />
          </button>

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-brand hover:bg-brand/10 rounded-full transition-all active:scale-90"
            aria-label="Toggle theme"
          >
            <Icon icon={theme === 'dark' ? 'solar:sun-2-linear' : 'solar:moon-linear'} width="22" height="22" />
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2 md:gap-4">
              {/* Notification Bell */}
              <button className="relative w-10 h-10 flex items-center justify-center text-text-secondary hover:text-brand hover:bg-brand/10 rounded-full transition-all active:scale-90">
                <Icon icon="solar:bell-linear" width="22" height="22" />
                {unreadNotifications && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand rounded-full border-2 border-surface"></span>
                )}
              </button>

              {/* User Avatar & Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-3 p-1 pl-3 pr-3 bg-surface-2 hover:bg-surface-3 border border-border rounded-full transition-all active:scale-95 shadow-sm group"
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-bold tracking-tight text-text-primary group-hover:text-brand transition-colors">{user.name}</p>
                    <p className="text-[8px] font-bold text-brand tracking-wider">
                      {user.role === 'user' ? 'Member' : user.role === 'professional' ? 'Pro' : user.role}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-brand font-bold text-xs overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0) || 'U'
                    )}
                  </div>
                  <Icon icon="solar:alt-arrow-down-linear" width="14" height="14" className={`text-text-muted transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-3 w-56 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[110]">
                    <div className="p-4 border-b border-border bg-surface-2/50">
                      <p className="text-sm font-bold text-text-primary line-clamp-1">{user.name}</p>
                      <p className="text-xs text-text-muted line-clamp-1">{user.email}</p>
                      {(user.role === 'admin' || user.role === 'admin_limited') && (
                        <span className="mt-2 inline-block px-2 py-0.5 bg-brand/10 text-brand text-[10px] font-bold rounded tracking-wide">
                          {user.role === 'admin' ? 'Admin' : 'Sub-Admin'}
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <Link 
                        to={(user.role === 'admin' || user.role === 'admin_limited') ? "/admin" : (user.role === 'professional' ? "/pro-dashboard" : "/dashboard")} 
                        className="flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Icon icon="solar:user-linear" width="18" height="18" />
                        Your Profile
                      </Link>
                      {(user.role === 'admin' || user.role === 'admin_limited') && (
                        <Link to="/admin" className="flex items-center gap-3 px-3 py-2 text-sm text-brand hover:bg-brand/5 rounded-lg transition-colors">
                          <Icon icon="solar:clapperboard-play-linear" width="18" height="18" />
                          Admin Panel
                        </Link>
                      )}
                      <button 
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors mt-1"
                      >
                        <Icon icon="solar:logout-linear" width="18" height="18" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link 
              to="/login"
              className="px-6 py-2 border-2 border-brand text-brand rounded-full font-bold text-sm btn-hover shadow-lg shadow-brand/5"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>

      {/* Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[150] flex flex-col pt-[64px] animate-in fade-in duration-300">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={() => setIsSearchOpen(false)}
          ></div>
          
          {/* Content */}
          <div className="relative w-full max-w-4xl mx-auto px-4 mt-12 md:mt-24">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-heading text-2xl md:text-3xl text-text-primary">Search</h2>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="w-12 h-12 flex items-center justify-center text-text-muted hover:text-text-primary bg-white/5 hover:bg-white/10 rounded-full transition-all"
              >
                <Icon icon="solar:close-circle-linear" width="28" height="28" />
              </button>
            </div>

            <form onSubmit={handleSearch} className="relative group">
              <Icon icon="solar:magnifer-linear" className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand transition-colors" width="28" height="28" />
              <input 
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search films, actors, directors..."
                className="w-full bg-white/5 border-2 border-white/10 focus:border-brand rounded-3xl py-6 pl-16 pr-6 text-xl md:text-2xl text-text-primary placeholder-text-muted outline-none transition-all shadow-2xl"
              />
            </form>

            <div className="mt-12">
              <h3 className="text-sm font-bold text-text-muted tracking-wide mb-4">Popular Searches</h3>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button 
                    key={term}
                    onClick={() => {
                      setSearchQuery(term);
                      navigate(`/search?q=${encodeURIComponent(term)}`);
                      setIsSearchOpen(false);
                    }}
                    className="px-5 py-2.5 bg-white/5 hover:bg-brand hover:text-white border border-white/10 rounded-full text-sm text-text-secondary transition-all active:scale-95"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}