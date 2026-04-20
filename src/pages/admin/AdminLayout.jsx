import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const { user } = useAuth();

  const navItems = [
    { path: '/admin', label: 'Overview', icon: '📊', exact: true },
    { path: '/admin/films', label: 'Films', icon: '🎬' },
    { path: '/admin/people', label: 'People', icon: '👤' },
    { path: '/admin/credits', label: 'Credits', icon: '🎭' },
    { path: '/admin/companies', label: 'Companies', icon: '🏢' },
    { path: '/admin/claims', label: 'Pending Claims', icon: '📋' },
    { path: '/admin/youtube', label: 'Data Sources', icon: '💾' },
    { path: '/admin/users', label: 'Users', icon: '👥' },
    { path: '/admin/cinemas', label: 'Cinemas', icon: '🎭' },
    { path: '/admin/channels', label: 'Channels', icon: '📺' },
    { path: '/admin/youtube-videos', label: 'YT Videos', icon: '🎞️' },
    { path: '/admin/cinema-films', label: 'Cinema Films', icon: '🎟️' },
    { path: '/admin/cinema-scraping', label: 'Scraping', icon: '🔄' },
  ];

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[260px] bg-[#0A0F1E] border-r border-border flex flex-col flex-shrink-0">
        <div className="p-6">
          <p className="text-gold text-xs font-bold uppercase tracking-wider mb-2">Admin Panel</p>
          <div className="inline-flex items-center px-3 py-1 bg-[#C1440E] text-white text-sm font-medium rounded-full">
            Reel9ja Admin
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-[#D4A017]/10 text-gold border-l-4 border-gold'
                    : 'text-text-muted hover:bg-surface hover:text-text-primary border-l-4 border-transparent'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-gold font-bold text-lg">
              {user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-text-primary font-medium truncate">{user?.name || 'Admin User'}</p>
              <p className="text-text-muted text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <Link
            to="/"
            className="block w-full text-center py-2 text-sm text-text-muted hover:text-gold transition-colors"
          >
            Exit Admin
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0A0F1E]">
        {/* Header Bar */}
        <header className="h-16 bg-[#13192B] border-b border-border flex items-center justify-between px-8 flex-shrink-0">
          <h1 className="text-xl font-semibold text-text-primary">
            {/* We could dynamically set this based on route, but for now it's fine */}
            Dashboard
          </h1>
          <div className="flex items-center gap-6">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-muted hover:text-gold transition-colors flex items-center gap-2"
            >
              View Site 
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </Link>
            <button className="relative text-text-muted hover:text-gold transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                3
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
