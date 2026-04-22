import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import FilmCard from '../components/film/FilmCard';
import PersonCard from '../components/person/PersonCard';

// Mock data removed as it was causing reference errors

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('watchlist');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Real database state
  const [watchlist, setWatchlist] = useState([]);
  const [following, setFollowing] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [watchedFilms, setWatchedFilms] = useState(new Set());
  const [editingReviewId, setEditingReviewId] = useState(null);

  useEffect(() => {
    document.title = "FilmDba | Dashboard";
    if (user?.id) {
      fetchAllData();
    }
  }, [user?.id]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Watchlist
      const { data: wlData } = await supabase
        .from('watchlist')
        .select('*, films(*)')
        .eq('user_id', user.id);
      
      if (wlData) {
        setWatchlist(wlData.map(item => item.films));
      }

      // 2. Fetch Following (people)
      const { data: followData } = await supabase
        .from('followers')
        .select('*, people(*)')
        .eq('user_id', user.id);
      
      if (followData) {
        setFollowing(followData.map(item => item.people));
      }

      // 3. Fetch Reviews
      const { data: revData } = await supabase
        .from('reviews')
        .select('*, films(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (revData) {
        setReviews(revData.map(r => ({
          ...r,
          film: r.films
        })));
      }

    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromWatchlist = async (film) => {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('film_id', film.id);
    
    if (!error) {
      setWatchlist(prev => prev.filter(f => f.id !== film.id));
      toast.success('Removed from watchlist');
    }
  };

  const handleToggleWatched = (film) => {
    setWatchedFilms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(film.id)) {
        newSet.delete(film.id);
      } else {
        newSet.add(film.id);
      }
      return newSet;
    });
  };

  const handleUnfollow = async (personId) => {
    const { error } = await supabase
      .from('followers')
      .delete()
      .eq('user_id', user.id)
      .eq('person_id', personId);
    
    if (!error) {
      setFollowing(prev => prev.filter(p => p.id !== personId));
      toast.success('Unfollowed');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);
    
    if (!error) {
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      toast.success('Review deleted');
    }
  };

  const tabs = [
    { id: 'watchlist', label: 'Watchlist', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
    )},
    { id: 'following', label: 'Following', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    )},
    { id: 'reviews', label: 'My Reviews', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    )},
    { id: 'settings', label: 'Settings', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    )}
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col fixed inset-0 z-[60] overflow-hidden">
      {/* TOP HEADER BAR */}
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-text-muted hover:text-gold transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </Link>
          <h1 className="font-heading font-bold text-xl text-text-primary">My Dashboard</h1>
        </div>

        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <span className="text-sm font-medium hidden sm:block">{user.name}</span>
            <div className="w-9 h-9 rounded-full bg-gold text-bg flex items-center justify-center font-bold text-sm">
              {user.name.charAt(0)}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-text-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-surface-2 border border-border rounded-xl shadow-xl py-2 z-50">
              <button 
                onClick={() => { setActiveTab('settings'); setIsDropdownOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface hover:text-gold transition-colors"
              >
                Profile Settings
              </button>
              {user.role === 'professional' && (
                <Link 
                  to="/dashboard/pro"
                  className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface hover:text-gold transition-colors"
                >
                  Switch to Pro
                </Link>
              )}
              <div className="h-px bg-border my-1"></div>
              <button 
                onClick={() => { logout(); navigate('/'); }}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-surface transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR NAVIGATION */}
        <aside className="hidden md:flex w-60 bg-surface border-r border-border flex-col justify-between py-6 shrink-0">
          <nav className="space-y-2 px-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-gold/10 text-gold border-l-2 border-gold' 
                    : 'text-text-muted hover:text-gold hover:bg-surface-2 border-l-2 border-transparent'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="px-4">
            <div className="bg-terracotta/10 border border-terracotta/20 rounded-xl p-4">
              <h4 className="font-bold text-terracotta text-sm mb-1">Upgrade to Pro</h4>
              <p className="text-xs text-text-muted mb-3">Claim your filmmaker profile and get verified.</p>
              <Link to="/settings/upgrade" className="text-xs font-bold text-terracotta hover:underline">
                Learn More →
              </Link>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-bg custom-scrollbar">
          <div className="max-w-5xl mx-auto">
            
            {/* WATCHLIST TAB */}
            {activeTab === 'watchlist' && (
              <div className="animate-in fade-in duration-500">
                <div className="mb-8">
                  <h2 className="font-heading font-bold text-3xl text-text-primary flex items-center gap-3">
                    My Watchlist
                    <span className="bg-surface-2 text-text-muted text-sm px-3 py-1 rounded-full border border-border">
                      {watchlist.length}
                    </span>
                  </h2>
                  <p className="text-text-muted mt-1">Films you've saved to watch</p>
                </div>

                {watchlist.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {watchlist.map(film => (
                      <FilmCard 
                        key={film.id} 
                        film={film} 
                        size="md" 
                        actionType="remove"
                        onAction={handleRemoveFromWatchlist}
                        showWatchedToggle={true}
                        isWatched={watchedFilms.has(film.id)}
                        onToggleWatched={handleToggleWatched}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-surface border border-border rounded-2xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold/50 mb-6">
                      <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.4-2.2 1.5-2.5l13.5-4c1.1-.3 2.2.4 2.5 1.5l.6 2.4z"/><path d="m2.6 10.4 17.2-5.1"/><path d="m6 3.4 1.4 4.1"/><path d="m10.3 2.1 1.4 4.1"/><path d="m14.6.8 1.4 4.1"/><path d="m18.9-.5 1.4 4.1"/><path d="M21.4 11.6 3 17l.9 2.4c.3 1.1 1.5 1.8 2.6 1.5l13.5-4c1.1-.3 1.8-1.5 1.5-2.6l-.1-2.7z"/><path d="m2.6 16.4 17.2-5.1"/><path d="m6 19.4 1.4-4.1"/><path d="m10.3 20.7 1.4-4.1"/><path d="m14.6 22 1.4-4.1"/><path d="m18.9 23.3 1.4-4.1"/>
                    </svg>
                    <h3 className="font-heading font-bold text-2xl text-text-primary mb-2">Your watchlist is empty</h3>
                    <p className="text-text-muted mb-6 max-w-md">Start browsing films and save ones you want to watch later.</p>
                    <Link to="/browse" className="bg-gold text-bg px-8 py-3 rounded-full font-bold hover:scale-105 active:scale-95 transition-all duration-300">
                      Browse Films
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* FOLLOWING TAB */}
            {activeTab === 'following' && (
              <div className="animate-in fade-in duration-500">
                <div className="mb-8">
                  <h2 className="font-heading font-bold text-3xl text-text-primary">People You Follow</h2>
                </div>

                {following.length > 0 ? (
                  <div className="space-y-4">
                    {following.map(person => (
                      <div key={person.id} className="flex flex-col sm:flex-row items-center gap-4 bg-surface p-4 rounded-2xl border border-border">
                        <img src={person.photo} alt={person.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
                        <div className="flex-1 text-center sm:text-left">
                          <Link to={`/person/${person.id}`} className="font-bold text-text-primary hover:text-gold transition-colors text-lg">
                            {person.name}
                          </Link>
                          <p className="text-sm text-text-muted">{person.role}</p>
                        </div>
                          <div className="text-[10px] bg-brand/10 text-brand px-2 py-1 rounded font-bold uppercase tracking-wider">
                            Active
                          </div>
                        <button 
                          onClick={() => handleUnfollow(person.id)}
                          className="w-full sm:w-auto px-4 py-2 rounded-full border border-border text-text-muted hover:text-red-400 hover:border-red-400 transition-colors text-sm font-medium"
                        >
                          Unfollow
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-surface border border-border rounded-2xl">
                    <h3 className="font-heading font-bold text-2xl text-text-primary mb-2">You're not following anyone yet</h3>
                    <p className="text-text-muted mb-6">Keep track of your favorite actors, directors, and writers.</p>
                    <Link to="/search" className="bg-gold text-bg px-8 py-3 rounded-full font-bold hover:scale-105 active:scale-95 transition-all duration-300">
                      Discover Filmmakers
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* MY REVIEWS TAB */}
            {activeTab === 'reviews' && (
              <div className="animate-in fade-in duration-500">
                <div className="mb-8">
                  <h2 className="font-heading font-bold text-3xl text-text-primary flex items-center gap-3">
                    Your Reviews
                    <span className="bg-surface-2 text-text-muted text-sm px-3 py-1 rounded-full border border-border">
                      {reviews.length}
                    </span>
                  </h2>
                </div>

                {reviews.length > 0 ? (
                  <div className="space-y-6">
                    {reviews.map(review => (
                      <div key={review.id} className="bg-surface p-6 rounded-2xl border border-border">
                        <div className="flex gap-4">
                          <Link to={`/film/${review.film.id}`} className="shrink-0">
                            <img src={review.film.poster} alt={review.film.title} className="w-16 h-24 object-cover rounded-lg hover:opacity-80 transition-opacity" />
                          </Link>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Link to={`/film/${review.film.id}`} className="font-bold text-text-primary hover:text-gold transition-colors text-lg">
                                  {review.film.title}
                                </Link>
                                <span className="text-text-muted text-sm ml-2">({review.film.year})</span>
                              </div>
                              <div className="text-xs text-text-muted">{review.created_at}</div>
                            </div>
                            
                            <div className="flex items-center gap-1 bg-gold/10 text-gold px-2 py-1 rounded w-fit text-sm font-bold mb-3">
                              {review.rating} <span className="text-gold/70 text-xs font-normal">/10</span>
                            </div>
                            
                            {editingReviewId === review.id ? (
                              <div className="mt-4 space-y-3">
                                <textarea 
                                  className="w-full bg-bg border border-border rounded-xl p-3 text-text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
                                  rows="3"
                                  defaultValue={review.body}
                                ></textarea>
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingReviewId(null)} className="bg-gold text-bg px-4 py-2 rounded-lg text-sm font-bold">Save</button>
                                  <button onClick={() => setEditingReviewId(null)} className="border border-border text-text-muted px-4 py-2 rounded-lg text-sm font-medium hover:text-text-primary">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-text-muted text-sm leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">
                                {review.body}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {!editingReviewId && (
                          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                            <button 
                              onClick={() => setEditingReviewId(review.id)}
                              className="flex items-center gap-1 text-text-muted hover:text-gold transition-colors text-sm font-medium"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteReview(review.id)}
                              className="flex items-center gap-1 text-text-muted hover:text-red-400 transition-colors text-sm font-medium"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-surface border border-border rounded-2xl">
                    <h3 className="font-heading font-bold text-2xl text-text-primary mb-2">You haven't reviewed any films yet</h3>
                    <p className="text-text-muted mb-6">Share your thoughts on Nollywood films with the community.</p>
                    <Link to="/browse" className="bg-gold text-bg px-8 py-3 rounded-full font-bold hover:scale-105 active:scale-95 transition-all duration-300">
                      Browse Films to Review
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="animate-in fade-in duration-500 max-w-2xl">
                <div className="mb-8">
                  <h2 className="font-heading font-bold text-3xl text-text-primary">Account Settings</h2>
                </div>

                <div className="space-y-10">
                  {/* Profile Section */}
                  <section className="bg-surface p-6 md:p-8 rounded-2xl border border-border">
                    <h3 className="font-bold text-lg text-text-primary mb-6">Profile Information</h3>
                    
                    <div className="flex items-center gap-6 mb-8">
                      <div className="w-24 h-24 rounded-full border-2 border-dashed border-gold flex flex-col items-center justify-center bg-surface-2 text-text-muted cursor-pointer hover:bg-gold/5 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span className="text-[10px] uppercase font-bold tracking-wider">Upload</span>
                      </div>
                      <div className="text-sm text-text-muted">
                        Recommended: Square image, at least 400x400px.
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Full Name</label>
                        <input type="text" defaultValue={user.name} className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Email Address</label>
                        <input type="email" defaultValue={user.email} disabled className="w-full bg-surface-2 border border-border text-text-muted rounded-xl px-4 py-3 cursor-not-allowed opacity-70" />
                      </div>
                      <button className="bg-gold text-bg px-6 py-3 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all duration-300">
                        Save Changes
                      </button>
                    </div>
                  </section>

                  {/* Security Section */}
                  <section className="bg-surface p-6 md:p-8 rounded-2xl border border-border">
                    <h3 className="font-bold text-lg text-text-primary mb-6">Security</h3>
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Current Password</label>
                        <input type="password" placeholder="••••••••" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">New Password</label>
                        <input type="password" placeholder="••••••••" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                        <div className="flex gap-1 mt-2">
                          <div className="h-1 flex-1 rounded-full bg-surface-2"></div>
                          <div className="h-1 flex-1 rounded-full bg-surface-2"></div>
                          <div className="h-1 flex-1 rounded-full bg-surface-2"></div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Confirm New Password</label>
                        <input type="password" placeholder="••••••••" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                      </div>
                      <button className="border border-gold text-gold px-6 py-3 rounded-xl font-bold hover:bg-gold hover:text-bg active:scale-95 transition-all duration-300">
                        Update Password
                      </button>
                    </div>
                  </section>

                  {/* Danger Zone */}
                  <section className="bg-red-500/5 border border-red-500/20 p-6 md:p-8 rounded-2xl">
                    <h3 className="font-bold text-lg text-red-400 mb-2">Danger Zone</h3>
                    <p className="text-sm text-text-muted mb-6">This action is permanent and cannot be undone. All your reviews, watchlist, and profile data will be erased.</p>
                    <button className="border border-red-500 text-red-500 px-6 py-3 rounded-xl font-bold hover:bg-red-500 hover:text-bg active:scale-95 transition-all duration-300">
                      Delete Account
                    </button>
                  </section>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
