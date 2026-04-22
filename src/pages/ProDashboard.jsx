import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export default function ProDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Missing helper functions
  const handleCloseModal = () => {
    setShowWelcomeModal(false);
    localStorage.setItem('filmdba_pro_welcome_seen', 'true');
  };

  const handleFindMyProfile = () => {
    handleCloseModal();
    setActiveTab('profile');
  };
  
  const [activeTab, setActiveTab] = useState('profile');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  // Profile Claim State: 'unclaimed', 'pending', 'approved'
  const [claimState, setClaimState] = useState('unclaimed');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPeople, setFilteredPeople] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimReason, setClaimReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    totalViews: 0,
    totalFilms: 0,
    followers: 0,
    avgRating: 0,
    filmStats: []
  });

  useEffect(() => {
    document.title = "FilmDba Pro | Dashboard";
    if (user?.id) {
      checkClaimStatus();
    }
    
    // Check if welcome modal should be shown
    const hasSeenModal = localStorage.getItem('filmdba_pro_welcome_seen');
    if (!hasSeenModal && user?.role === 'professional' && !user.linked_profile_id) {
      setShowWelcomeModal(true);
    }
  }, [user]);

  const checkClaimStatus = async () => {
    setLoading(true);
    try {
      // 1. Check if already linked
      if (user.linked_profile_id) {
        const { data: person } = await supabase
          .from('people')
          .select('*')
          .eq('id', user.linked_profile_id)
          .single();
        
        if (person) {
          setSelectedPerson(person);
          setClaimState('approved');
          fetchProStats(person.id);
        }
      } else {
        // 2. Check for pending claim
        const { data: claim } = await supabase
          .from('profile_claims')
          .select('*, people(*)')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .single();
        
        if (claim) {
          setSelectedPerson(claim.people);
          setClaimState('pending');
        }
      }
    } catch (err) {
      console.error('Check claim error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProStats = async (personId) => {
    try {
      // Fetch credits with films
      const { data: credits } = await supabase
        .from('credits')
        .select('*, films(*)')
        .eq('person_id', personId);
      
      if (credits) {
        const filmsList = credits.map(c => c.films).filter(Boolean);
        const totalViews = filmsList.reduce((acc, f) => acc + (f.view_count || 0), 0);
        const avgRating = filmsList.length > 0 
          ? (filmsList.reduce((acc, f) => acc + (f.average_rating || 0), 0) / filmsList.length).toFixed(1)
          : 0;

        setStats({
          totalViews,
          totalFilms: filmsList.length,
          followers: 0,
          avgRating,
          filmStats: filmsList
        });
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  useEffect(() => {
    if (searchQuery.length > 2) {
      const delaySearch = setTimeout(async () => {
        const { data } = await supabase
          .from('people')
          .select('*')
          .ilike('name', `%${searchQuery}%`)
          .limit(5);
        setFilteredPeople(data || []);
      }, 300);
      return () => clearTimeout(delaySearch);
    } else {
      setFilteredPeople([]);
    }
  }, [searchQuery]);

  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profile_claims')
        .insert({
          user_id: user.id,
          person_id: selectedPerson.id,
          status: 'pending',
          notes: claimReason
        });
      
      if (error) throw error;
      
      toast.success('Claim submitted! Our admins will review it.');
      setClaimState('pending');
      setShowClaimForm(false);
    } catch (err) {
      toast.error('Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const myFilms = stats.filmStats;
  const tabs = [
    { id: 'profile', label: 'My Profile', icon: '🎭' },
    { id: 'films', label: 'My Films', icon: '🎬' },
    { id: 'credits', label: 'Credits', icon: '📋' },
    { id: 'stats', label: 'Stats', icon: '📊' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col fixed inset-0 z-[60] overflow-hidden">
      {/* WELCOME MODAL */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4">
          <div className="bg-surface p-8 rounded-2xl max-w-md w-full border border-border text-center shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
              🎬
            </div>
            <h2 className="font-heading font-bold text-2xl text-text-primary mb-3">Welcome to FilmDba Pro</h2>
            <p className="text-text-muted mb-8">
              You're one step away from managing your official Nollywood profile. Search for your name below to claim your profile and get verified.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleFindMyProfile}
                className="w-full bg-gold text-bg py-3 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all duration-300"
              >
                Find My Profile
              </button>
              <button 
                onClick={handleCloseModal}
                className="w-full text-text-muted hover:text-text-primary py-2 text-sm font-medium transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER BAR */}
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-text-muted hover:text-gold transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </Link>
          <h1 className="font-heading font-bold text-xl text-text-primary">Pro Dashboard</h1>
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
              <Link 
                to="/dashboard"
                className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface hover:text-gold transition-colors"
              >
                Switch to Fan View
              </Link>
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
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          {claimState === 'approved' && (
            <div className="px-4">
              <div className="bg-gold/10 border border-gold/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gold text-bg flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <h4 className="font-bold text-gold text-sm">Verified Pro</h4>
                  <p className="text-xs text-text-muted">Profile active</p>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-bg custom-scrollbar">
          <div className="max-w-5xl mx-auto">
            
            {/* MY PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="animate-in fade-in duration-500">
                
                {/* STATE A: Unclaimed */}
                {claimState === 'unclaimed' && (
                  <div className="max-w-2xl mx-auto">
                    <div className="border-2 border-dashed border-gold/30 bg-surface/50 rounded-2xl p-8 md:p-12 text-center">
                      <div className="w-20 h-20 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                        🎬
                      </div>
                      <h2 className="font-heading font-bold text-3xl text-text-primary mb-3">Claim Your FilmDba Profile</h2>
                      <p className="text-text-muted mb-8 max-w-md mx-auto">
                        Find your existing profile to verify your identity and take control of your page.
                      </p>
                      
                      {!showClaimForm ? (
                        <div className="space-y-6">
                          <div className="relative max-w-md mx-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input 
                              type="text" 
                              placeholder="Search your name..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-bg border border-border text-text-primary rounded-full pl-12 pr-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                            />
                          </div>
                          
                          {searchQuery && (
                            <div className="bg-bg border border-border rounded-xl p-2 max-w-md mx-auto text-left max-h-60 overflow-y-auto custom-scrollbar">
                              {filteredPeople.length > 0 ? (
                                filteredPeople.map(person => (
                                  <div key={person.id} className="flex items-center justify-between p-3 hover:bg-surface rounded-lg transition-colors">
                                    <div className="flex items-center gap-3">
                                      <img src={person.photo} alt={person.name} className="w-10 h-10 rounded-full object-cover" />
                                      <div>
                                        <div className="font-bold text-text-primary text-sm">{person.name}</div>
                                        <div className="text-xs text-text-muted">{person.role}</div>
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => { setSelectedPerson(person); setShowClaimForm(true); }}
                                      className="text-xs font-bold text-gold bg-gold/10 px-3 py-1.5 rounded-full hover:bg-gold hover:text-bg transition-colors"
                                    >
                                      This is me
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div className="p-4 text-center text-sm text-text-muted">No profiles found matching "{searchQuery}"</div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <form onSubmit={handleSubmitClaim} className="text-left bg-bg p-6 rounded-xl border border-border max-w-md mx-auto animate-in slide-in-from-bottom-4 duration-300">
                          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                            <img src={selectedPerson.photo} alt={selectedPerson.name} className="w-12 h-12 rounded-full object-cover" />
                            <div>
                              <div className="font-bold text-text-primary">Claiming: {selectedPerson.name}</div>
                              <button type="button" onClick={() => setShowClaimForm(false)} className="text-xs text-gold hover:underline">Not you? Search again</button>
                            </div>
                          </div>
                          
                          <div className="space-y-5">
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Tell us why you're claiming this profile</label>
                              <textarea 
                                required
                                value={claimReason}
                                onChange={(e) => setClaimReason(e.target.value)}
                                placeholder="e.g. I am Funke Akindele, director of Omo Ghetto. My Instagram is @funkejenifa"
                                className="w-full bg-surface border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all min-h-[100px]"
                              ></textarea>
                            </div>
                            
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Upload ID or proof</label>
                              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-gold/50 transition-colors cursor-pointer bg-surface">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-text-muted"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                <span className="text-sm text-text-muted">Click to upload document</span>
                              </div>
                            </div>
                            
                            <button type="submit" className="w-full bg-gold text-bg py-3 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all duration-300">
                              Submit Claim
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                    
                    {/* Dev helper removed as it was causing reference errors */}
                  </div>
                )}

                {/* STATE B: Pending */}
                {claimState === 'pending' && (
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-8 md:p-12 text-center">
                      <div className="w-20 h-20 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                        ⏳
                      </div>
                      <h2 className="font-heading font-bold text-3xl text-text-primary mb-3">Your profile claim is under review</h2>
                      <p className="text-text-muted mb-8 max-w-md mx-auto">
                        We'll notify you by email once approved. This usually takes 1–2 business days.
                      </p>
                      
                      <div className="bg-surface border border-border rounded-xl p-6 text-left max-w-md mx-auto mb-6">
                        <h3 className="text-sm font-bold text-text-primary mb-4 border-b border-border pb-2">Submission Details</h3>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-text-muted">Profile:</span>
                            <span className="font-medium text-text-primary">{selectedPerson?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted">Date Submitted:</span>
                            <span className="font-medium text-text-primary">Today</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted">Status:</span>
                            <span className="font-medium text-amber-500">In Review</span>
                          </div>
                        </div>
                      </div>
                      
                      <button onClick={() => setClaimState('unclaimed')} className="text-sm font-bold text-gold hover:underline">
                        Edit Submission
                      </button>
                    </div>
                    
                    {/* Dev helper to skip to approved */}
                    <div className="mt-8 text-center">
                      <button onClick={() => setClaimState('approved')} className="text-xs text-text-muted hover:text-gold underline">
                        [Dev] Approve Claim
                      </button>
                    </div>
                  </div>
                )}

                {/* STATE C: Approved */}
                {claimState === 'approved' && selectedPerson && (
                  <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
                    <div className="flex justify-between items-start mb-8">
                      <h2 className="font-heading font-bold text-3xl text-text-primary">Public Profile</h2>
                      <button className="bg-surface-2 border border-border text-text-primary px-4 py-2 rounded-full text-sm font-medium hover:border-gold transition-colors flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        Edit Profile
                      </button>
                    </div>

                    <div className="bg-surface border border-border rounded-2xl p-8 mb-8">
                      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                        <div className="relative shrink-0">
                          <img src={selectedPerson.photo} alt={selectedPerson.name} className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-surface-2" />
                          <div className="absolute bottom-2 right-2 bg-gold text-bg p-1.5 rounded-full shadow-lg" title="Verified Professional">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                          <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary mb-2 flex items-center justify-center md:justify-start gap-3">
                            {selectedPerson.name}
                          </h1>
                          <p className="text-gold font-medium mb-4">{selectedPerson.role}</p>
                          <p className="text-text-muted leading-relaxed max-w-2xl mb-6">
                            {selectedPerson.bio}
                          </p>
                          
                          <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            <div className="bg-surface-2 px-4 py-2 rounded-lg border border-border">
                              <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Known Credits</div>
                              <div className="font-bold text-lg text-text-primary">{selectedPerson.film_count}</div>
                            </div>
                            <div className="bg-surface-2 px-4 py-2 rounded-lg border border-border">
                              <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Followers</div>
                              <div className="font-bold text-lg text-text-primary">{(selectedPerson.popularity / 1000).toFixed(1)}k</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Edit Form (Inline) */}
                    <div className="bg-surface border border-border rounded-2xl p-8">
                      <h3 className="font-bold text-xl text-text-primary mb-6 border-b border-border pb-4">Edit Details</h3>
                      
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Display Name</label>
                            <input type="text" defaultValue={selectedPerson.name} className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Primary Role</label>
                            <input type="text" defaultValue={selectedPerson.role} className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                          </div>
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider flex justify-between">
                            <span>Biography</span>
                            <span>{selectedPerson.bio.length} / 500</span>
                          </label>
                          <textarea 
                            defaultValue={selectedPerson.bio}
                            rows="4"
                            className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                          ></textarea>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Date of Birth</label>
                            <input type="date" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Nationality</label>
                            <input type="text" defaultValue="Nigerian" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Gender</label>
                            <select className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all appearance-none">
                              <option>Female</option>
                              <option>Male</option>
                              <option>Non-binary</option>
                              <option>Prefer not to say</option>
                            </select>
                          </div>
                        </div>

                        <h4 className="font-bold text-lg text-text-primary mt-8 mb-4 border-b border-border pb-2">Social Links</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Instagram</label>
                            <input type="text" placeholder="@username" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Twitter / X</label>
                            <input type="text" placeholder="@username" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">YouTube</label>
                            <input type="url" placeholder="https://youtube.com/c/..." className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Personal Website</label>
                            <input type="url" placeholder="https://..." className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                          </div>
                        </div>
                        
                        <div className="pt-6 flex justify-end">
                          <button className="bg-gold text-bg px-8 py-3 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all duration-300">
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MY FILMS TAB */}
            {activeTab === 'films' && claimState === 'approved' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="font-heading font-bold text-3xl text-text-primary">Your Filmography</h2>
                    <p className="text-text-muted mt-1">Manage your credited projects</p>
                  </div>
                  <button className="border border-gold text-gold px-4 py-2 rounded-lg font-bold hover:bg-gold hover:text-bg transition-colors text-sm flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Missing Film
                  </button>
                </div>

                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
                  {['All', 'Actor', 'Director', 'Writer', 'Producer'].map(filter => (
                    <button key={filter} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === 'All' ? 'bg-gold text-bg' : 'bg-surface border border-border text-text-muted hover:text-text-primary'}`}>
                      {filter}
                    </button>
                  ))}
                </div>

                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                  {myFilms.length > 0 ? (
                    <div className="divide-y divide-border">
                      {myFilms.map(film => (
                        <div key={film.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-6 hover:bg-surface-2 transition-colors">
                          <img src={film.poster} alt={film.title} className="w-16 h-24 object-cover rounded-lg shrink-0" />
                          <div className="flex-1 text-center sm:text-left">
                            <h3 className="font-bold text-lg text-text-primary mb-1">
                              <Link to={`/film/${film.id}`} className="hover:text-gold transition-colors">{film.title}</Link>
                              <span className="text-text-muted text-sm font-normal ml-2">({film.year})</span>
                            </h3>
                            <div className="text-sm text-text-muted mb-2">
                              {film.director === selectedPerson?.name ? 'Director' : 'Actor'}
                              {film.cast.includes(selectedPerson?.name) && ' • Character Name'}
                            </div>
                            <div className="inline-flex items-center gap-1 bg-gold/10 text-gold px-2 py-0.5 rounded text-xs font-bold">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Verified Credit
                            </div>
                          </div>
                          <button className="text-sm font-medium text-terracotta hover:underline shrink-0">
                            Request Correction
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <p className="text-text-muted">No films found for this profile.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CREDITS TAB */}
            {activeTab === 'credits' && claimState === 'approved' && (
              <div className="animate-in fade-in duration-500">
                <div className="mb-8">
                  <h2 className="font-heading font-bold text-3xl text-text-primary">All Credits</h2>
                </div>
                
                <div className="bg-surface border border-border rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-muted">
                        <th className="p-4 font-medium cursor-pointer hover:text-text-primary">Film ↕</th>
                        <th className="p-4 font-medium cursor-pointer hover:text-text-primary">Year ↕</th>
                        <th className="p-4 font-medium cursor-pointer hover:text-text-primary">Role ↕</th>
                        <th className="p-4 font-medium">Character</th>
                        <th className="p-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {myFilms.map(film => (
                        <tr key={film.id} className="hover:bg-surface-2 transition-colors">
                          <td className="p-4 font-medium text-text-primary">{film.title}</td>
                          <td className="p-4 text-text-muted">{film.year}</td>
                          <td className="p-4 text-text-muted">{film.director === selectedPerson?.name ? 'Director' : 'Actor'}</td>
                          <td className="p-4 text-text-muted">{film.cast.includes(selectedPerson?.name) ? 'Lead Role' : '-'}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 bg-gold/10 text-gold px-2 py-0.5 rounded text-xs font-bold">
                              Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* STATS TAB */}
            {activeTab === 'stats' && claimState === 'approved' && (
              <div className="animate-in fade-in duration-500">
                <div className="mb-8">
                  <h2 className="font-heading font-bold text-3xl text-text-primary">Your Performance Stats</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
                  <div className="bg-surface border border-border rounded-2xl p-6">
                    <div className="text-3xl font-bold text-gold mb-1">
                      {(myFilms.reduce((acc, f) => acc + (f.view_count || 0), 0) / 1000000).toFixed(1)}M
                    </div>
                    <div className="text-sm text-text-muted mb-3">Total Views</div>
                    <div className="text-xs text-green-400 font-medium flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      +12% this month
                    </div>
                  </div>
                  <div className="bg-surface border border-border rounded-2xl p-6">
                    <div className="text-3xl font-bold text-gold mb-1">{myFilms.length}</div>
                    <div className="text-sm text-text-muted mb-3">Total Films</div>
                    <div className="text-xs text-text-muted font-medium flex items-center gap-1">
                      No change
                    </div>
                  </div>
                  <div className="bg-surface border border-border rounded-2xl p-6">
                    <div className="text-3xl font-bold text-gold mb-1">4,821</div>
                    <div className="text-sm text-text-muted mb-3">Followers</div>
                    <div className="text-xs text-green-400 font-medium flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      +54 this week
                    </div>
                  </div>
                  <div className="bg-surface border border-border rounded-2xl p-6">
                    <div className="text-3xl font-bold text-gold mb-1">
                      {(myFilms.reduce((acc, f) => acc + (f.average_rating || 0), 0) / (myFilms.length || 1)).toFixed(1)}
                    </div>
                    <div className="text-sm text-text-muted mb-3">Avg. Rating</div>
                    <div className="text-xs text-green-400 font-medium flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      +0.2 this year
                    </div>
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 mb-8">
                  <h3 className="font-bold text-lg text-text-primary mb-6">Views by Film</h3>
                  <div className="h-64 flex items-end gap-4 md:gap-8 pt-4">
                    {myFilms.map((film, i) => {
                      const maxViews = Math.max(...myFilms.map(f => f.view_count || 0), 1);
                      const heightPercent = Math.max(((film.view_count || 0) / maxViews) * 100, 5);
                      return (
                        <div key={film.id} className="flex-1 flex flex-col items-center gap-3 group">
                          <div className="w-full relative h-full flex items-end justify-center">
                            <div 
                              className="w-full max-w-[60px] rounded-t-md bg-gradient-to-t from-terracotta to-gold transition-all duration-500 group-hover:opacity-80"
                              style={{ height: `${heightPercent}%` }}
                            ></div>
                            <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-2 border border-border text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                              {((film.view_count || 0) / 1000000).toFixed(1)}M views
                            </div>
                          </div>
                          <div className="text-xs text-text-muted text-center truncate w-full px-1" title={film.title}>
                            {film.title.length > 12 ? film.title.substring(0, 10) + '...' : film.title}
                          </div>
                        </div>
                      );
                    })}
                    {myFilms.length === 0 && (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        No data available
                      </div>
                    )}
                  </div>
                </div>

                {myFilms.length > 0 && (
                  <div>
                    <h3 className="font-bold text-lg text-text-primary mb-4">Top Performing Film</h3>
                    <div className="relative rounded-2xl overflow-hidden border border-border group">
                      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-transparent z-10"></div>
                      <img src={myFilms[0].backdrop} alt={myFilms[0].title} className="w-full h-64 md:h-80 object-cover group-hover:scale-105 transition-transform duration-700" />
                      
                      <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 z-20 flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-gold text-bg text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Most Viewed</span>
                            <span className="text-gold font-bold flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              {myFilms[0].average_rating || 'N/A'}
                            </span>
                          </div>
                          <h4 className="font-heading font-bold text-3xl text-text-primary mb-1">{myFilms[0].title}</h4>
                          <p className="text-text-muted text-sm max-w-xl line-clamp-2">{myFilms[0].synopsis}</p>
                        </div>
                        <Link to={`/film/${myFilms[0].id}`} className="bg-surface/50 backdrop-blur-md border border-border text-text-primary px-6 py-3 rounded-xl font-bold hover:bg-gold hover:text-bg hover:border-gold transition-all shrink-0 text-center">
                          View Film Page
                        </Link>
                      </div>
                    </div>
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
                  {/* Professional Info Section */}
                  <section className="bg-surface p-6 md:p-8 rounded-2xl border border-border">
                    <h3 className="font-bold text-lg text-text-primary mb-6">Professional Information</h3>
                    
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Company / Studio Name</label>
                        <input type="text" placeholder="e.g. Golden Effects Pictures" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">IMDB Profile Link (Optional)</label>
                        <input type="url" placeholder="https://imdb.com/name/..." className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Years Active (From)</label>
                          <input type="number" placeholder="YYYY" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Years Active (To)</label>
                          <input type="text" placeholder="Present" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Primary Profession</label>
                        <select className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all appearance-none">
                          <option>Actor</option>
                          <option>Director</option>
                          <option>Writer</option>
                          <option>Producer</option>
                          <option>Cinematographer</option>
                          <option>Editor</option>
                        </select>
                      </div>
                      <button className="bg-gold text-bg px-6 py-3 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all duration-300 mt-2">
                        Save Professional Info
                      </button>
                    </div>
                  </section>

                  {/* Notification Preferences */}
                  <section className="bg-surface p-6 md:p-8 rounded-2xl border border-border">
                    <h3 className="font-bold text-lg text-text-primary mb-6">Notification Preferences</h3>
                    <div className="space-y-6">
                      {[
                        "Email me when someone follows me",
                        "Email me when a film I'm credited on gets reviewed",
                        "Email me when my profile claim status changes",
                        "Weekly FilmDba digest"
                      ].map((pref, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm text-text-primary">{pref}</span>
                          <button className={`w-12 h-6 rounded-full transition-colors relative ${i !== 3 ? 'bg-gold' : 'bg-surface-2 border border-border'}`}>
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-bg transition-all ${i !== 3 ? 'left-7' : 'left-1'}`}></div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Basic Profile Section (from Fan Dashboard) */}
                  <section className="bg-surface p-6 md:p-8 rounded-2xl border border-border">
                    <h3 className="font-bold text-lg text-text-primary mb-6">Account Details</h3>
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Full Name</label>
                        <input type="text" defaultValue={user.name} className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Email Address</label>
                        <input type="email" defaultValue={user.email} disabled className="w-full bg-surface-2 border border-border text-text-muted rounded-xl px-4 py-3 cursor-not-allowed opacity-70" />
                      </div>
                      <button className="border border-border text-text-primary px-6 py-3 rounded-xl font-bold hover:border-gold transition-all duration-300">
                        Update Account
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {/* Fallback for unapproved tabs */}
            {['films', 'credits', 'stats'].includes(activeTab) && claimState !== 'approved' && (
              <div className="animate-in fade-in duration-500 max-w-2xl mx-auto text-center py-20">
                <div className="w-20 h-20 bg-surface border border-border text-text-muted rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                  🔒
                </div>
                <h2 className="font-heading font-bold text-2xl text-text-primary mb-3">Profile Verification Required</h2>
                <p className="text-text-muted mb-8">
                  You need to claim and verify your profile before you can access your filmography, credits, and performance stats.
                </p>
                <button 
                  onClick={() => setActiveTab('profile')}
                  className="bg-gold text-bg px-8 py-3 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all duration-300"
                >
                  Go to Claim Profile
                </button>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
