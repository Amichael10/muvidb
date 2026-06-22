import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-bg border-t border-border">
      <div className="relative mt-auto pt-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 relative z-10 border-x border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="space-y-6">
              <Link to="/" className="flex items-center group">
                <img
                  src="/images/MuviDB Brand/White Wordmark.png"
                  alt="MuviDB"
                  className="h-8 object-contain group-hover:scale-105 transition-transform"
                />
              </Link>
              <p className="text-text-muted text-sm leading-relaxed max-w-xs font-medium">
                The premier film database for Nollywood. Preserving the legacy, celebrating the future.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold text-text-primary mb-6 uppercase tracking-widest">Discover</h3>
              <ul className="space-y-4">
                <li><Link to="/" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">Home</Link></li>
                <li><Link to="/browse" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">Browse Movies</Link></li>
                <li><Link to="/browse?sort=rating" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">Top Rated</Link></li>
                <li><Link to="/browse?sort=new" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">New Releases</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-xs font-bold text-text-primary mb-6 uppercase tracking-widest">People</h3>
              <ul className="space-y-4">
                <li><Link to="/browse?type=actors" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">Actors</Link></li>
                <li><Link to="/browse?type=directors" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">Directors</Link></li>
                <li><Link to="/browse?type=producers" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">Producers</Link></li>
                <li><Link to="/browse?type=writers" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">Writers</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold text-text-primary mb-6 uppercase tracking-widest">Platform</h3>
              <ul className="space-y-4">
                <li><Link to="/login" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">Sign In</Link></li>
                <li><Link to="/signup" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">Join MuviDB</Link></li>
                <li><Link to="/dashboard" className="text-xs font-bold text-text-muted hover:text-brand transition-colors">Dashboard</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-white/5 relative">
            {/* African Culture Image (Clean & Sharp) */}
            <div className="w-full h-auto mb-8 overflow-hidden flex justify-center items-end relative">
              <img 
                src="/assets/footer-people.png" 
                alt="African Culture" 
                className="w-full max-w-7xl object-contain object-bottom transition-all duration-700"
              />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
              <p className="text-[10px] font-bold text-text-muted opacity-40 uppercase tracking-widest">
                © {new Date().getFullYear()} MuviDB Database. All rights reserved.
              </p>
              <div className="flex gap-8">
                <Link to="/terms" className="text-[10px] font-bold text-text-muted hover:text-brand transition-colors uppercase tracking-widest">Terms</Link>
                <Link to="/privacy" className="text-[10px] font-bold text-text-muted hover:text-brand transition-colors uppercase tracking-widest">Privacy</Link>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event('open-cookie-consent'))}
                  className="text-[10px] font-bold text-text-muted hover:text-brand transition-colors uppercase tracking-widest"
                >
                  Cookie Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
