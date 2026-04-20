import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  Search, 
  Moon, 
  Sun, 
  Bell, 
  User, 
  LogOut, 
  ChevronDown, 
  X,
  Clapperboard
} from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState(['King of Boys', 'Funke Akindele', 'Anikulapo']);
  
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
          flex items-center justify-between px-4 md:px-8 lg:px-12
        `}
      >
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center text-black shadow-lg shadow-gold/20 group-hover:scale-110 transition-transform">
            <Clapperboard size={24} />
          </div>
          <span className="font-heading font-bold text-gold text-2xl tracking-tight hidden sm:block">
            Lumi
          </span>
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
                    ? 'bg-gold text-black shadow-md' 
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
            className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-gold hover:bg-gold/10 rounded-full transition-all active:scale-90"
            aria-label="Search"
          >
            <Search size={20} />
          </button>

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-gold hover:bg-gold/10 rounded-full transition-all active:scale-90"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2 md:gap-4">
              {/* Notification Bell */}
              <button className="relative w-10 h-10 flex items-center justify-center text-text-secondary hover:text-gold hover:bg-gold/10 rounded-full transition-all active:scale-90">
                <Bell size={20} />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-terracotta rounded-full border-2 border-surface"></span>
              </button>

              {/* User Avatar & Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1 pl-1 pr-3 bg-surface-2 hover:bg-surface-3 border border-border rounded-full transition-all active:scale-95 shadow-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-gold font-bold text-xs">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                  <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-3 w-56 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[110]">
                    <div className="p-4 border-b border-border bg-surface-2/50">
                      <p className="text-sm font-bold text-text-primary line-clamp-1">{user.name}</p>
                      <p className="text-xs text-text-muted line-clamp-1">{user.email}</p>
                      {user.role === 'admin' && (
                        <span className="mt-2 inline-block px-2 py-0.5 bg-terracotta/10 text-terracotta text-[10px] font-bold rounded uppercase tracking-wider">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors">
                        <User size={16} />
                        My Profile
                      </Link>
                      {user.role === 'admin' && (
                        <Link to="/admin" className="flex items-center gap-3 px-3 py-2 text-sm text-terracotta hover:bg-terracotta/5 rounded-lg transition-colors">
                          <Clapperboard size={16} />
                          Admin Panel
                        </Link>
                      )}
                      <button 
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors mt-1"
                      >
                        <LogOut size={16} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link 
              to="/login"
              className="px-6 py-2 border-2 border-gold text-gold rounded-full font-bold text-sm btn-hover shadow-lg shadow-gold/5"
            >
              Sign In
            </Link>
          )}
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
              <h2 className="font-heading text-2xl md:text-3xl text-text-primary">Search Lumi</h2>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="w-12 h-12 flex items-center justify-center text-text-muted hover:text-text-primary bg-white/5 hover:bg-white/10 rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSearch} className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-gold transition-colors" size={24} />
              <input 
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search films, actors, directors..."
                className="w-full bg-white/5 border-2 border-white/10 focus:border-gold rounded-3xl py-6 pl-16 pr-6 text-xl md:text-2xl text-text-primary placeholder-text-muted outline-none transition-all shadow-2xl"
              />
            </form>

            <div className="mt-12">
              <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">Trending Searches</h3>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button 
                    key={term}
                    onClick={() => {
                      setSearchQuery(term);
                      navigate(`/search?q=${encodeURIComponent(term)}`);
                      setIsSearchOpen(false);
                    }}
                    className="px-5 py-2.5 bg-white/5 hover:bg-gold hover:text-black border border-white/10 rounded-full text-sm text-text-secondary transition-all active:scale-95"
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