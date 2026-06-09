import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Icon } from '@iconify/react';
import { films, people as initialPeople } from '../data/mockData';
import PersonCard from '../components/person/PersonCard';

export default function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState(null); // 'film', 'person', 'credit'
  const [people, setPeople] = useState([]);
  const [dbFilms, setDbFilms] = useState([]);
  const [filmsCount, setFilmsCount] = useState(0);
  const [peopleCount, setPeopleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [apiStatus, setApiStatus] = useState({ youtube: 'checking', tmdb: 'checking' });

  useEffect(() => {
    const checkApi = async (svc) => {
      try {
        const res = await fetch(`/api/health?service=${svc}`);
        const d = await res.json();
        setApiStatus(prev => ({ ...prev, [svc]: d.status }));
      } catch { setApiStatus(prev => ({ ...prev, [svc]: 'error' })); }
    };
    checkApi('youtube'); checkApi('tmdb');
  }, []);

  const [claims, setClaims] = useState([]);
  const [verifications, setVerifications] = useState([]);

  const [rejectingClaimId, setRejectingClaimId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [verifySubTab, setVerifySubTab] = useState('new');

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApproveVerification = async (person) => {
    try {
      const { error } = await supabase
        .from('people')
        .update({ is_verified: true, status: 'official' })
        .eq('id', person.id);
      
      if (error) throw error;
      
      setVerifications(verifications.filter(v => v.id !== person.id));
      showToast(`Profile Verified — ${person.name} is now official`);
    } catch (err) {
      console.error('Approval error:', err);
    }
  };

  const handleApproveClaim = async (claim) => {
    try {
        const { error: claimError } = await supabase.from('profile_claims').update({ status: 'approved' }).eq('id', claim.id);
        const { error: personError } = await supabase.from('people').update({ is_verified: true, status: 'official', claimed_by: claim.user_id }).eq('id', claim.person_id);
        const { error: userError } = await supabase.from('users').update({ linked_profile_id: claim.person_id }).eq('id', claim.user_id);

        if (claimError || personError || userError) throw new Error('Update failed');

        setClaims(claims.filter(c => c.id !== claim.id));
        showToast(`Claim approved for ${claim.people.name}`);
    } catch (err) {
        console.error('Claim approval error:', err);
    }
  };

  useEffect(() => {
    document.title = "MuviDB | Admin Panel";
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Get Counts
      const { count: fCount } = await supabase.from('films').select('*', { count: 'exact', head: true });
      const { count: pCount } = await supabase.from('people').select('*', { count: 'exact', head: true });
      
      setFilmsCount(fCount || 0);
      setPeopleCount(pCount || 0);

      // Get Lists
      const { data: fList } = await supabase.from('films').select('*').order('created_at', { ascending: false }).limit(20);
      const { data: pList } = await supabase.from('people').select('*').order('popularity_score', { ascending: false }).limit(20);
      
      setDbFilms(fList || []);
      setPeople(pList || []);

      // Get Claims & Verifications
      const { data: claimList } = await supabase.from('profile_claims').select('*, people(*)').eq('status', 'pending');
      const { data: verifyList } = await supabase.from('people').select('*').eq('status', 'pending');
      
      setClaims(claimList || []);
      setVerifications(verifyList || []);
      
      // Get Recent Activity
      const { data: recentFilms } = await supabase
        .from('films')
        .select('title, updated_at')
        .order('updated_at', { ascending: false })
        .limit(3);
        
      setRecentActivity(recentFilms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== 'admin') {
    alert("You don't have permission to access that page.");
    return <Navigate to="/dashboard" />;
  }

  const openDrawer = (type) => {
    setDrawerType(type);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setDrawerType(null), 300);
  };

  const handleSync = () => {
    setIsSyncing(true);
    setSyncComplete(false);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncComplete(true);
      setTimeout(() => setSyncComplete(false), 3000);
    }, 2000);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'solar:chart-bold' },
    { id: 'films', label: 'Films', icon: 'solar:clapperboard-play-bold' },
    { id: 'people', label: 'People', icon: 'solar:user-bold' },
    { id: 'credits', label: 'Credits', icon: 'solar:masks-bold' },
    { id: 'companies', label: 'Companies', icon: 'solar:buildings-bold' },
    { id: 'verifications', label: 'Verifications', icon: 'solar:shield-check-bold', badge: (claims.length + verifications.length) > 0 ? (claims.length + verifications.length) : null },
    { id: 'sync', label: 'YouTube Sync', icon: 'solar:refresh-bold' },
    { id: 'settings', label: 'Settings', icon: 'solar:settings-bold' }
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col fixed inset-0 z-[60] overflow-hidden">
      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-surface border border-border text-text-primary px-6 py-3 rounded-xl shadow-2xl z-[100] animate-in slide-in-from-top-4 fade-in duration-300 flex items-center gap-3">
          <svg className="text-green-500" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {toastMessage}
        </div>
      )}

      {/* HEADER */}
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-text-muted hover:text-brand transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-heading font-bold text-xl text-text-primary">Admin Panel</h1>
            <span className="bg-brand/20 text-brand text-[10px] font-bold px-3 py-1 rounded">MuviDB Staff</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-brand/20">
            {user.name.charAt(0)}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-64 bg-surface border-r border-border flex-col justify-between py-6 shrink-0 overflow-y-auto hidden md:flex">
          <nav className="space-y-1 px-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-brand/10 text-brand border-l-2 border-brand' 
                    : 'text-text-muted hover:text-brand hover:bg-surface-2 border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon icon={tab.icon} className="text-xl" />
                  {tab.label}
                </div>
                {tab.badge && (
                  <span className="bg-amber-500 text-bg text-xs font-bold px-2 py-0.5 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-bg custom-scrollbar relative">
          <div className="max-w-6xl mx-auto">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="animate-in fade-in duration-500">
                <h2 className="font-heading font-bold text-3xl text-text-primary mb-8">Dashboard Overview</h2>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-10">
                  <div className="bg-surface border border-border rounded-2xl p-6">
                    <div className="text-3xl font-bold text-text-primary mb-1">{filmsCount}</div>
                    <div className="text-sm text-text-muted">Total Films</div>
                  </div>
                  <div className="bg-surface border border-border rounded-2xl p-6">
                    <div className="text-3xl font-bold text-text-primary mb-1">{peopleCount}</div>
                    <div className="text-sm text-text-muted">Total People</div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
                    <div className="text-3xl font-bold text-amber-500 mb-1">{claims.length}</div>
                    <div className="text-sm text-amber-500/80 font-medium">Pending Claims</div>
                  </div>
                  
                  {/* System Health Indicators */}
                  <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-sm text-text-muted">YouTube API</span>
                       <span className={`w-2 h-2 rounded-full ${apiStatus.youtube === 'active' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                    </div>
                    <div className="text-xl font-bold text-text-primary tracking-tight">{apiStatus.youtube}</div>
                  </div>
                  
                  <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-sm text-text-muted">TMDB API</span>
                       <span className={`w-2 h-2 rounded-full ${apiStatus.tmdb === 'active' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                    </div>
                    <div className="text-xl font-bold text-text-primary tracking-tight">{apiStatus.tmdb}</div>
                  </div>

                  <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-sm text-text-muted">MuviDB AI Core</span>
                       <span className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <div className="text-lg font-bold text-text-primary tracking-tight">Gemini-1.5-Flash</div>
                  </div>
                </div>

                <h3 className="font-bold text-xl text-text-primary mb-6">Recent Activity</h3>
                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <div className="divide-y divide-border">
                    <div className="p-4 flex items-start gap-4 border-l-4 border-brand bg-surface-2/50">
                      <Icon icon="solar:star-bold" className="text-2xl mt-1 text-brand" />
                      <div>
                        <p className="text-text-primary font-medium">New review on King of Boys</p>
                        <p className="text-sm text-text-muted">5 mins ago</p>
                      </div>
                    </div>
                    <div className="p-4 flex items-start gap-4 border-l-4 border-amber-500">
                      <Icon icon="solar:clipboard-list-bold" className="text-2xl mt-1 text-amber-500" />
                      <div>
                        <p className="text-text-primary font-medium">Profile claim submitted — Genevieve Nnaji</p>
                        <p className="text-sm text-text-muted">1 hour ago</p>
                      </div>
                    </div>
                    <div className="p-4 flex items-start gap-4 border-l-4 border-blue-500">
                      <Icon icon="solar:user-plus-bold" className="text-2xl mt-1 text-blue-500" />
                      <div>
                        <p className="text-text-primary font-medium">New user signup (fan)</p>
                        <p className="text-sm text-text-muted">2 hours ago</p>
                      </div>
                    </div>
                    <div className="p-4 flex items-start gap-4 border-l-4 border-green-500">
                      <Icon icon="solar:refresh-bold" className="text-2xl mt-1 text-green-500" />
                      <div>
                        <p className="text-text-primary font-medium">YouTube sync completed — 6 films updated</p>
                        <p className="text-sm text-text-muted">3 hours ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FILMS TAB */}
            {activeTab === 'films' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="font-heading font-bold text-3xl text-text-primary">Films Database</h2>
                  <button onClick={() => openDrawer('film')} className="bg-brand text-white px-6 py-2 rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand/20">
                    + Add Movie
                  </button>
                </div>

                <div className="flex gap-4 mb-6">
                  <div className="flex-1 relative">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" placeholder="Search films..." className="w-full bg-surface border border-border text-text-primary rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-gold" />
                  </div>
                  <select className="bg-surface border border-border text-text-primary rounded-lg px-4 py-2 focus:outline-none focus:border-gold appearance-none min-w-[150px]">
                    <option>All Statuses</option>
                    <option>Released</option>
                    <option>Post-Production</option>
                  </select>
                  <select className="bg-surface border border-border text-text-primary rounded-lg px-4 py-2 focus:outline-none focus:border-gold appearance-none min-w-[150px]">
                    <option>All Genres</option>
                    <option>Drama</option>
                    <option>Comedy</option>
                    <option>Thriller</option>
                  </select>
                </div>

                <div className="bg-surface border border-border rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-muted">
                        <th className="p-4 font-medium w-16">Poster</th>
                        <th className="p-4 font-medium">Title</th>
                        <th className="p-4 font-medium">Year</th>
                        <th className="p-4 font-medium">Genre</th>
                        <th className="p-4 font-medium">Rating</th>
                        <th className="p-4 font-medium">Views</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {dbFilms.map((film, i) => (
                        <tr key={film.id} className={`hover:bg-surface-2 transition-colors ${i % 2 === 0 ? 'bg-bg/30' : 'bg-transparent'}`}>
                          <td className="p-4">
                            <img src={film.poster_url || film.poster} alt={film.title} className="w-10 h-14 object-cover rounded" />
                          </td>
                          <td className="p-4 font-bold text-text-primary">{film.title}</td>
                          <td className="p-4 text-text-muted">{film.year}</td>
                          <td className="p-4 text-text-muted truncate max-w-[150px]">{(film.genres || []).join(', ')}</td>
                          <td className="p-4 text-gold font-medium">{film.tmdb_rating || film.rating}</td>
                          <td className="p-4 text-text-muted">{( (film.view_count || film.views || 0) / 1000000).toFixed(1)}M</td>
                          <td className="p-4">
                            <span className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded uppercase tracking-wider">{film.status}</span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-3">
                              <button onClick={() => openDrawer('film')} className="text-text-muted hover:text-gold transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                              </button>
                              <button className="text-text-muted hover:text-red-400 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PEOPLE TAB */}
            {activeTab === 'people' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="font-heading font-bold text-3xl text-text-primary">People Database</h2>
                  <button onClick={() => openDrawer('person')} className="bg-gold text-bg px-6 py-2 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all">
                    + Add Person
                  </button>
                </div>
                
                <div className="bg-surface border border-border rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-muted">
                        <th className="p-4 font-medium w-16">Photo</th>
                        <th className="p-4 font-medium">Name</th>
                        <th className="p-4 font-medium">Role</th>
                        <th className="p-4 font-medium">Films</th>
                        <th className="p-4 font-medium">Verified</th>
                        <th className="p-4 font-medium">Popularity</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {people.map((person, i) => (
                        <tr key={person.id} className={`hover:bg-surface-2 transition-colors ${i % 2 === 0 ? 'bg-bg/30' : 'bg-transparent'}`}>
                          <td className="p-4">
                            <img src={person.photo_url || person.photo} alt={person.name} className="w-10 h-10 object-cover rounded-full" />
                          </td>
                          <td className="p-4 font-bold text-text-primary">{person.name}</td>
                          <td className="p-4 text-text-muted">{person.role}</td>
                          <td className="p-4 text-text-muted">{person.film_count || 0}</td>
                          <td className="p-4">
                            {person.is_verified ? (
                              <span className="bg-gold/10 text-gold text-xs px-2 py-1 rounded uppercase tracking-wider">Yes</span>
                            ) : (
                              <span className="bg-surface-2 text-text-muted text-xs px-2 py-1 rounded uppercase tracking-wider">No</span>
                            )}
                          </td>
                          <td className="p-4 text-text-muted">{(person.popularity / 1000).toFixed(1)}k</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-3">
                              <button onClick={() => openDrawer('person')} className="text-text-muted hover:text-gold transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                              </button>
                              <button className="text-text-muted hover:text-red-400 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CREDITS TAB */}
            {activeTab === 'credits' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="font-heading font-bold text-3xl text-text-primary">Credits Management</h2>
                  <button onClick={() => openDrawer('credit')} className="bg-gold text-bg px-6 py-2 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all">
                    + Add Credit
                  </button>
                </div>
                
                <div className="bg-surface border border-border rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-muted">
                        <th className="p-4 font-medium">Person</th>
                        <th className="p-4 font-medium">Film</th>
                        <th className="p-4 font-medium">Role</th>
                        <th className="p-4 font-medium">Character</th>
                        <th className="p-4 font-medium">Billing Order</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {/* Mock credits derived from films data */}
                      <tr className="hover:bg-surface-2 transition-colors bg-bg/30">
                        <td className="p-4 font-bold text-text-primary">Sola Sobowale</td>
                        <td className="p-4 text-text-muted">King of Boys</td>
                        <td className="p-4 text-text-muted">Actor</td>
                        <td className="p-4 text-text-muted">Eniola Salami</td>
                        <td className="p-4 text-text-muted">1</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-3">
                            <button className="text-text-muted hover:text-gold transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                            <button className="text-text-muted hover:text-red-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                          </div>
                        </td>
                      </tr>
                      <tr className="hover:bg-surface-2 transition-colors">
                        <td className="p-4 font-bold text-text-primary">Kemi Adetiba</td>
                        <td className="p-4 text-text-muted">King of Boys</td>
                        <td className="p-4 text-text-muted">Director</td>
                        <td className="p-4 text-text-muted">-</td>
                        <td className="p-4 text-text-muted">1</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-3">
                            <button className="text-text-muted hover:text-gold transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                            <button className="text-text-muted hover:text-red-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VERIFICATIONS TAB */}
            {activeTab === 'verifications' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-10">
                  <div className="space-y-1">
                    <h2 className="font-heading font-bold text-3xl text-text-primary tracking-tighter">Review Hub</h2>
                    <p className="text-xs font-bold text-text-muted opacity-60">Manage professional profiles and database integrity</p>
                  </div>
                  <div className="flex bg-surface border border-border p-1 rounded-xl">
                    <button 
                      onClick={() => setVerifySubTab('new')} 
                      className={`px-6 py-2 rounded-lg text-[10px] font-bold transition-all ${verifySubTab === 'new' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      New Profiles ({verifications.length})
                    </button>
                    <button 
                      onClick={() => setVerifySubTab('claims')} 
                      className={`px-6 py-2 rounded-lg text-[10px] font-bold transition-all ${verifySubTab === 'claims' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      Claims ({claims.length})
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                    {verifySubTab === 'new' ? (
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {verifications.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {verifications.map(p => (
                                        <div key={p.id} className="bg-surface border border-border rounded-2xl p-6 flex gap-6">
                                            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-border">
                                                <img src={p.photo_url || p.photo || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <div>
                                                    <h4 className="font-bold text-text-primary">{p.name}</h4>
                                                    <p className="text-brand text-xs font-bold">{p.role}</p>
                                                </div>
                                                <p className="text-xs text-text-muted line-clamp-2">"{p.bio}"</p>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleApproveVerification(p)} className="flex-1 bg-green-500/10 text-green-500 text-[10px] font-bold py-2 rounded-lg border border-green-500/20 hover:bg-green-500 hover:text-bg transition-all">Approve</button>
                                                    <button className="flex-1 bg-red-500/10 text-red-500 text-[10px] font-bold py-2 rounded-lg border border-red-500/20 hover:bg-red-500 hover:text-bg transition-all">Reject</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-20 border-2 border-dashed border-border rounded-3xl text-center space-y-4">
                                    <Icon icon="solar:stars-minimalistic-bold" className="text-4xl mx-auto opacity-20" />
                                    <p className="text-xs font-bold text-text-muted opacity-40">No new profile requests at this time</p>
                                </div>
                            )}
                        </section>
                    ) : (
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {claims.length > 0 ? (
                                <div className="space-y-4">
                                    {claims.map(claim => (
                                        <div key={claim.id} className="bg-surface border border-border rounded-2xl p-6 flex flex-col md:flex-row gap-8 items-center">
                                            <div className="flex items-center gap-4 min-w-[200px]">
                                                <img src={claim.people?.photo_url || claim.people?.photo} className="w-12 h-12 rounded-full object-cover border border-border" />
                                                <div>
                                                    <p className="text-xs font-bold text-text-muted">Database Profile</p>
                                                    <p className="font-bold text-text-primary">{claim.people?.name}</p>
                                                </div>
                                            </div>
                                            <div className="flex-1 text-center md:text-left">
                                                <p className="text-xs font-bold text-text-muted mb-1">Claimant Identity</p>
                                                <p className="text-sm font-medium text-text-primary">{claim.claimantName} ({claim.claimantEmail})</p>
                                                <p className="text-xs text-text-muted mt-2">"{claim.message}"</p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={() => handleApproveClaim(claim)} className="bg-brand text-white text-[10px] font-bold px-6 py-3 rounded-xl hover:scale-105 transition-all shadow-lg shadow-brand/20">Approve Claim</button>
                                                <button className="text-red-500 text-[10px] font-bold px-6 py-3 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-all">Reject</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-20 border-2 border-dashed border-border rounded-3xl text-center space-y-4">
                                    <Icon icon="solar:clipboard-list-bold" className="text-4xl mx-auto opacity-20" />
                                    <p className="text-xs font-bold text-text-muted opacity-40">No profile claims pending review</p>
                                </div>
                            )}
                        </section>
                    )}
                </div>
              </div>
            )}

            {/* YOUTUBE SYNC TAB */}
            {activeTab === 'sync' && (
              <div className="animate-in fade-in duration-500">
                <h2 className="font-heading font-bold text-3xl text-text-primary mb-8">YouTube Stats Sync</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-surface border border-border rounded-2xl p-6">
                    <div className="text-sm text-text-muted mb-1">Last Synced</div>
                    <div className="text-xl font-bold text-text-primary">2 hours ago</div>
                  </div>
                  <div className="bg-surface border border-border rounded-2xl p-6">
                    <div className="text-sm text-text-muted mb-1">Films with YouTube IDs</div>
                    <div className="text-xl font-bold text-text-primary">6 of 6</div>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div>
                      <div className="text-sm text-green-500 font-bold uppercase tracking-wider">Status</div>
                      <div className="text-lg font-bold text-text-primary">All films up to date</div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-xl text-text-primary">Films Sync Status</h3>
                  <button 
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="bg-gold text-bg px-8 py-3 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-70 disabled:hover:scale-100 flex items-center gap-2 min-w-[200px] justify-center"
                  >
                    {isSyncing ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-bg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Syncing 6 films...
                      </>
                    ) : syncComplete ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Sync Complete
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
                        Sync All Films
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-surface border border-border rounded-2xl overflow-hidden overflow-x-auto mb-8">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-muted">
                        <th className="p-4 font-medium">Film Title</th>
                        <th className="p-4 font-medium">YouTube ID</th>
                        <th className="p-4 font-medium">Last View Count</th>
                        <th className="p-4 font-medium">Synced At</th>
                        <th className="p-4 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {films.map((film, i) => (
                        <tr key={film.id} className={`hover:bg-surface-2 transition-colors ${i % 2 === 0 ? 'bg-bg/30' : 'bg-transparent'}`}>
                          <td className="p-4 font-bold text-text-primary">{film.title}</td>
                          <td className="p-4 text-text-muted font-mono text-xs">{film.trailer_youtube_id || 'abc123xyz'}</td>
                          <td className="p-4 text-text-muted">{film.views.toLocaleString()}</td>
                          <td className="p-4 text-text-muted">2 hours ago</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <span className="text-green-500 text-xs font-bold uppercase tracking-wider">Synced</span>
                              <button className="text-text-muted hover:text-gold transition-colors p-1" title="Sync this film">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-surface-2 border border-border rounded-xl p-4 text-sm text-text-muted flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gold"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <p>
                    Syncing calls the YouTube Data API v3. Your daily quota is 10,000 units. Each sync uses approximately 1 unit per film.
                  </p>
                </div>
              </div>
            )}

          </div>
        </main>

        {/* SLIDE-IN DRAWER */}
        {isDrawerOpen && (
          <>
            <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-[70]" onClick={closeDrawer}></div>
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface border-l border-border shadow-2xl z-[80] animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
                <h3 className="font-heading font-bold text-2xl text-text-primary">
                  {drawerType === 'film' ? 'Add Film' : drawerType === 'person' ? 'Add Person' : 'Add Credit'}
                </h3>
                <button onClick={closeDrawer} className="text-text-muted hover:text-text-primary p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {drawerType === 'film' && (
                  <form className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Title</label>
                      <input type="text" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Year</label>
                        <input type="number" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Runtime (mins)</label>
                        <input type="number" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Synopsis</label>
                      <textarea rows="4" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold"></textarea>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Language</label>
                        <input type="text" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">NFVCB Rating</label>
                        <select className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold appearance-none">
                          <option>G</option>
                          <option>PG</option>
                          <option>12</option>
                          <option>15</option>
                          <option>18</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Status</label>
                      <select className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold appearance-none">
                        <option>released</option>
                        <option>upcoming</option>
                        <option>post-production</option>
                        <option>filming</option>
                        <option>pre-production</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="inCinemas" className="w-5 h-5 accent-brand bg-bg border-border rounded" />
                        <label htmlFor="inCinemas" className="text-sm font-medium text-text-primary">In Cinemas</label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="comingSoon" className="w-5 h-5 accent-brand bg-bg border-border rounded" />
                        <label htmlFor="comingSoon" className="text-sm font-medium text-text-primary">Coming Soon</label>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">YouTube Trailer ID</label>
                      <input type="text" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Poster URL</label>
                      <input type="url" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Backdrop URL</label>
                      <input type="url" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                    </div>
                  </form>
                )}

                {drawerType === 'person' && (
                  <form className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Name</label>
                      <input type="text" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Bio</label>
                      <textarea rows="4" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold"></textarea>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Photo URL</label>
                      <input type="url" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Date of Birth</label>
                        <input type="date" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Gender</label>
                        <select className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold appearance-none">
                          <option>Female</option>
                          <option>Male</option>
                          <option>Non-binary</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Nationality</label>
                      <input type="text" defaultValue="Nigerian" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                    </div>
                    <div className="flex items-center gap-3 mt-6">
                      <input type="checkbox" id="verified" className="w-5 h-5 rounded border-border text-gold focus:ring-gold bg-bg accent-gold" />
                      <label htmlFor="verified" className="text-sm font-medium text-text-primary">Verified Profile</label>
                    </div>
                  </form>
                )}

                {drawerType === 'credit' && (
                  <form className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Person</label>
                      <select className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold appearance-none">
                        <option value="">Select a person...</option>
                        {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Film</label>
                      <select className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold appearance-none">
                        <option value="">Select a film...</option>
                        {films.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Role</label>
                      <select className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold appearance-none">
                        <option>Actor</option>
                        <option>Director</option>
                        <option>Writer</option>
                        <option>Producer</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Character Name (if Actor)</label>
                      <input type="text" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">Billing Order</label>
                      <input type="number" defaultValue="1" className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-3 focus:outline-none focus:border-gold" />
                    </div>
                  </form>
                )}
              </div>
              
              <div className="p-6 border-t border-border shrink-0 bg-surface">
                <button onClick={closeDrawer} className="w-full bg-gold text-bg py-3 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all">
                  Save {drawerType === 'film' ? 'Film' : drawerType === 'person' ? 'Person' : 'Credit'}
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
