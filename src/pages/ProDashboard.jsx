import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Skeleton } from '../components/ui/Skeleton';

export default function ProDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [claimState, setClaimState] = useState('unclaimed');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    filmStats: []
  });

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState('');
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');

  // New Profile Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProfileData, setNewProfileData] = useState({
    name: user?.name || '',
    role: 'Actor',
    bio: ''
  });

  useEffect(() => {
    document.title = "Lumi Pro | Dashboard";
    if (user?.id) {
      checkClaimStatus();
    }
    
    const hasSeenModal = localStorage.getItem('lumi_pro_welcome_seen');
    if (!hasSeenModal && user?.role === 'professional' && !user.linked_profile_id) {
      setShowWelcomeModal(true);
    }
  }, [user]);

  const checkClaimStatus = async () => {
    setLoading(true);
    try {
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
        // Check if they created a profile that is pending verification
        const { data: createdPerson } = await supabase
          .from('people')
          .select('*')
          .eq('claimed_by', user.id)
          .single();

        if (createdPerson) {
          setSelectedPerson(createdPerson);
          setClaimState('pending');
        } else {
          // Check for traditional claims
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
      }
    } catch (err) {
      console.error('Check claim error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProStats = async (personId) => {
    try {
      const { data: credits } = await supabase
        .from('credits')
        .select('*, films(*)')
        .eq('person_id', personId);
      
      if (credits) {
        const filmsList = credits.map(c => c.films).filter(Boolean);
        setStats({
          filmStats: filmsList
        });
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  const handleSaveBio = async () => {
    if (!selectedPerson) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('people')
        .update({ bio: editedBio })
        .eq('id', selectedPerson.id);
      
      if (error) throw error;
      
      setSelectedPerson({ ...selectedPerson, bio: editedBio });
      setIsEditingBio(false);
      toast.success('Bio updated.');
    } catch (err) {
      toast.error('Failed to update bio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileData.name || !newProfileData.bio) {
        toast.error('Name and Bio are required.');
        return;
    }
    setIsSubmitting(true);
    try {
      const { data: profileId, error } = await supabase.rpc('create_pro_profile', {
        user_id: user.id,
        pro_name: newProfileData.name,
        pro_role: newProfileData.role,
        pro_bio: newProfileData.bio
      });

      if (error) throw error;

      toast.success('Profile created. Pending verification.');
      setShowCreateModal(false);
      checkClaimStatus();
    } catch (err) {
      console.error('Create profile error:', err);
      toast.error('Failed to create profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: 'solar:user-linear' },
    { id: 'network', label: 'Network', icon: 'solar:users-group-rounded-linear' },
    { id: 'projects', label: 'Projects', icon: 'solar:clapperboard-edit-linear' },
    { id: 'stats', label: 'Insights', icon: 'solar:chart-linear' },
    { id: 'settings', label: 'Settings', icon: 'solar:settings-linear' }
  ];

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-7xl mx-auto border-x border-border flex pt-20 min-h-screen">
        <aside className="hidden md:flex w-72 border-r border-border flex-col justify-between py-12 shrink-0 bg-surface-2/5">
          <nav className="space-y-2 px-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl text-xs font-bold transition-all duration-300 ${
                  activeTab === tab.id ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-text-muted hover:text-brand hover:bg-surface border border-transparent hover:border-border'
                }`}
              >
                <Icon icon={tab.icon} className="text-lg opacity-60" />
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="px-8 py-6 border-t border-border mt-auto">
             <p className="text-[10px] font-bold text-text-muted mb-4 uppercase tracking-wider">System status</p>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-[10px] font-bold text-text-primary">Online</span>
             </div>
          </div>
        </aside>

        <main className="flex-1 p-8 md:p-16 relative">
          {loading ? (
             <div className="space-y-12">
                {/* Profile Header Skeleton */}
                <div className="flex items-end justify-between border-b border-border pb-6 animate-shimmer">
                    <div className="h-10 w-64 bg-surface-2 rounded-lg"></div>
                    <div className="h-4 w-24 bg-surface-2 rounded-md"></div>
                </div>

                {/* Profile Card Skeleton */}
                <div className="bg-surface border border-border rounded-2xl p-10 flex flex-col md:flex-row gap-10 animate-shimmer">
                    <div className="w-40 h-40 rounded-2xl bg-surface-2 shrink-0"></div>
                    <div className="space-y-6 flex-1">
                        <div className="space-y-2">
                            <div className="h-10 w-1/2 bg-surface-2 rounded-lg"></div>
                            <div className="h-4 w-24 bg-surface-2 rounded-md"></div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-4 w-full bg-surface-2 rounded-md"></div>
                            <div className="h-4 w-full bg-surface-2 rounded-md"></div>
                            <div className="h-4 w-2/3 bg-surface-2 rounded-md"></div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-shimmer">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-surface border border-border p-8 rounded-2xl space-y-4">
                            <div className="h-3 w-20 bg-surface-2 rounded-md"></div>
                            <div className="h-10 w-16 bg-surface-2 rounded-lg"></div>
                        </div>
                    ))}
                </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {activeTab === 'profile' && (
                <div className="space-y-12">
                   {claimState === 'unclaimed' && (
                      <div className="max-w-2xl mx-auto space-y-12 py-12 text-center">
                        <div className="w-20 h-20 bg-surface border border-border rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                          <Icon icon="solar:lock-password-linear" className="text-4xl text-text-muted opacity-40" />
                        </div>
                        <div className="space-y-4">
                          <h2 className="text-4xl font-bold text-text-primary tracking-tight">Connect profile</h2>
                          <p className="text-sm font-medium text-text-muted max-w-sm mx-auto leading-relaxed">To manage your filmography and career statistics, you must connect your account to a professional profile.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                          <Link to="/claim" className="inline-block bg-brand text-white py-4 px-10 rounded-xl text-xs font-bold hover:scale-[1.02] transition-all shadow-lg shadow-brand/20">Connect profile</Link>
                          <button 
                            onClick={() => setShowCreateModal(true)} 
                            className="inline-block bg-surface-2 text-text-primary py-4 px-10 rounded-xl text-xs font-bold hover:border-brand border border-border transition-all"
                          >
                            Create profile
                          </button>
                        </div>
                      </div>
                   )}
                   {claimState === 'pending' && selectedPerson && (
                      <div className="space-y-12">
                         <div className="bg-brand/5 border border-brand/20 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-6">
                               <div className="w-14 h-14 bg-brand/10 text-brand rounded-xl flex items-center justify-center text-2xl">
                                 <Icon icon="solar:history-linear" />
                               </div>
                               <div className="space-y-1">
                                  <h2 className="text-2xl font-bold text-text-primary tracking-tight">Under review</h2>
                                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Your profile is being reviewed by the administration.</p>
                                </div>
                            </div>
                            <div className="px-5 py-2 bg-brand/10 border border-brand/20 rounded-lg text-[10px] font-bold text-brand uppercase tracking-wider">Estimated time: 24 hours</div>
                         </div>
                         <div className="bg-surface border border-border rounded-2xl p-10 flex flex-col md:flex-row gap-10 opacity-60">
                            <div className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-surface-2 shadow-xl shrink-0">
                               <img src={selectedPerson.photo_url || selectedPerson.photo || 'https://via.placeholder.com/300'} alt={selectedPerson.name} className="w-full h-full object-cover grayscale" />
                            </div>
                            <div className="space-y-6">
                               <div className="space-y-2">
                                 <h1 className="text-4xl font-bold text-text-primary tracking-tight">{selectedPerson.name}</h1>
                                 <p className="text-brand text-xs font-bold uppercase tracking-wider">{selectedPerson.role || 'FILMMAKER'}</p>
                               </div>
                               <p className="text-text-muted text-sm leading-relaxed border-l-2 border-brand/20 pl-6 italic">"{selectedPerson.bio}"</p>
                            </div>
                         </div>
                      </div>
                   )}
                   {claimState === 'approved' && selectedPerson && (
                      <div className="space-y-12">
                         <div className="flex items-end justify-between border-b border-border pb-6">
                            <h2 className="text-3xl font-bold text-text-primary tracking-tight">Professional profile</h2>
                            <button onClick={() => { setEditedBio(selectedPerson.bio); setIsEditingBio(true); }} className="text-[10px] font-bold text-brand uppercase tracking-wider hover:underline">Edit bio</button>
                         </div>
                         <div className="bg-surface border border-border rounded-2xl p-10 flex flex-col md:flex-row gap-10">
                            <div className="relative group shrink-0">
                               <div className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-surface-2 shadow-xl">
                                  <img src={selectedPerson.photo_url || selectedPerson.photo} alt={selectedPerson.name} className="w-full h-full object-cover" />
                               </div>
                               <button onClick={() => { setPhotoUrl(selectedPerson.photo_url || selectedPerson.photo); setIsEditingPhoto(true); }} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                 <span className="text-[10px] font-bold text-white uppercase tracking-wider">Update photo</span>
                               </button>
                            </div>
                            <div className="space-y-6">
                               <div className="space-y-2">
                                 <h1 className="text-4xl font-bold text-text-primary tracking-tight">{selectedPerson.name}</h1>
                                 <p className="text-brand text-xs font-bold uppercase tracking-wider">{selectedPerson.role || 'FILMMAKER'}</p>
                               </div>
                               <p className="text-text-muted text-sm leading-relaxed border-l-2 border-brand/20 pl-6 italic">"{selectedPerson.bio}"</p>
                            </div>
                         </div>
                      </div>
                   )}
                </div>
              )}

              {activeTab === 'network' && (
                <div className="space-y-12">
                   <h2 className="text-3xl font-bold text-text-primary tracking-tight border-b border-border pb-6">Network</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-surface border border-border rounded-2xl p-8 space-y-4 group hover:border-brand transition-all cursor-pointer">
                         <div className="flex items-center justify-between">
                           <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Producers</h3>
                           <span className="text-[9px] font-bold text-brand uppercase tracking-wider">Coming soon</span>
                         </div>
                         <p className="text-xs text-text-muted leading-relaxed opacity-60">Connect with production houses and independent executive producers for collaboration.</p>
                      </div>
                      <div className="bg-surface border border-border rounded-2xl p-8 space-y-4 group hover:border-brand transition-all cursor-pointer">
                         <div className="flex items-center justify-between">
                           <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Guild directory</h3>
                           <span className="text-[9px] font-bold text-brand uppercase tracking-wider">Coming soon</span>
                         </div>
                         <p className="text-xs text-text-muted leading-relaxed opacity-60">Official contact channels for AGN, DGN, and other technical Nollywood guilds.</p>
                      </div>
                   </div>
                   <div className="bg-surface-2/10 border border-border rounded-2xl p-12 text-center space-y-6">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider opacity-40">Contact information is exclusive to verified accounts.</p>
                      <button className="bg-surface border border-border py-3 px-8 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:border-brand transition-all">View updates</button>
                   </div>
                </div>
              )}

              {activeTab === 'projects' && (
                <div className="space-y-12">
                   <div className="flex items-end justify-between border-b border-border pb-6">
                     <h2 className="text-3xl font-bold text-text-primary tracking-tight">Project board</h2>
                     <button className="bg-brand text-white py-3 px-6 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:scale-[1.02] transition-all">Post project</button>
                   </div>
                   <div className="grid grid-cols-1 gap-6">
                      <div className="bg-surface border border-border rounded-xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                         <div className="space-y-2">
                           <span className="text-[8px] font-bold bg-brand/10 text-brand px-2 py-0.5 rounded uppercase tracking-wider">Development</span>
                           <h3 className="text-lg font-bold text-text-primary">Untitled project</h3>
                           <p className="text-xs font-medium text-text-muted">Looking for: Cinematographer, Lead actress</p>
                         </div>
                         <button className="text-[10px] font-bold text-brand uppercase tracking-wider border border-brand/20 px-6 py-2 rounded-lg hover:bg-brand hover:text-white transition-all">Apply</button>
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'stats' && (
                <div className="space-y-12">
                  <h2 className="text-3xl font-bold text-text-primary tracking-tight border-b border-border pb-6">Insights</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-surface border border-border p-8 rounded-2xl">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-4 opacity-60">Total reach</p>
                      <p className="text-4xl font-bold text-brand">N/A</p>
                    </div>
                    <div className="bg-surface border border-border p-8 rounded-2xl">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-4 opacity-60">Active credits</p>
                      <p className="text-4xl font-bold text-text-primary">{stats.filmStats.length}</p>
                    </div>
                    <div className="bg-surface border border-border p-8 rounded-2xl">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-4 opacity-60">Impact score</p>
                      <p className="text-4xl font-bold text-text-primary">N/A</p>
                    </div>
                  </div>
                  <div className="bg-surface border border-border rounded-2xl p-10 space-y-8">
                    <h3 className="text-2xl font-bold text-text-primary tracking-tight">Market trends</h3>
                    <div className="h-64 bg-bg rounded-xl border border-border flex items-center justify-center relative overflow-hidden">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider opacity-40">Performance tracking coming soon...</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-12">
                   <h2 className="text-3xl font-bold text-text-primary tracking-tight border-b border-border pb-6">Settings</h2>
                   <div className="bg-surface border border-border rounded-2xl p-8 max-w-2xl space-y-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider opacity-60">Full name</label>
                        <input type="text" defaultValue={user?.name} className="w-full bg-bg border border-border text-text-primary rounded-xl px-6 py-4 text-sm font-medium focus:border-brand transition-all outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider opacity-60">Email address</label>
                        <input type="email" defaultValue={user?.email} disabled className="w-full bg-surface-2 border border-border text-text-muted rounded-xl px-6 py-4 text-sm font-medium opacity-50 outline-none" />
                      </div>
                      <button className="bg-brand text-white py-4 px-10 rounded-xl text-xs font-bold hover:scale-[1.02] transition-all shadow-lg shadow-brand/20">Save changes</button>
                   </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {isEditingBio && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-bg/90 backdrop-blur-xl" onClick={() => setIsEditingBio(false)}></div>
          <div className="bg-surface border border-border rounded-3xl p-10 max-w-2xl w-full relative z-10 space-y-8 animate-in zoom-in-95 duration-500 shadow-2xl">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-text-primary tracking-tight">Edit bio</h2>
              <p className="text-xs font-medium text-text-muted opacity-60">Update your professional description.</p>
            </div>
            <textarea value={editedBio} onChange={(e) => setEditedBio(e.target.value)} className="w-full h-64 bg-surface-2/50 border border-border text-text-primary rounded-xl p-6 text-sm leading-relaxed focus:border-brand focus:outline-none transition-all resize-none" placeholder="Write your professional bio..." />
            <div className="flex gap-4">
              <button onClick={() => setIsEditingBio(false)} className="flex-1 bg-surface-2 text-text-primary py-4 rounded-xl text-xs font-bold hover:bg-border transition-all">Cancel</button>
              <button onClick={handleSaveBio} disabled={isSubmitting} className="flex-1 bg-brand text-white py-4 rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand/20 disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditingPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-bg/90 backdrop-blur-xl" onClick={() => setIsEditingPhoto(false)}></div>
          <div className="bg-surface border border-border rounded-3xl p-12 max-w-lg w-full relative z-10 space-y-8 animate-in zoom-in-95 duration-500 shadow-2xl">
            <div className="space-y-2"><h2 className="font-heading font-bold text-4xl text-text-primary tracking-tighter">Profile Photo</h2><p className="text-[10px] font-bold text-text-muted opacity-60">Provide a high-quality URL for your headshot.</p></div>
            <div className="space-y-4">
              <div className="w-32 h-32 mx-auto rounded-2xl overflow-hidden border-2 border-border"><img src={photoUrl || 'https://via.placeholder.com/150'} alt="Preview" className="w-full h-full object-cover" /></div>
              <input type="text" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="w-full bg-surface-2/50 border border-border text-text-primary rounded-xl px-6 py-4 text-xs font-bold focus:border-brand focus:outline-none transition-all" placeholder="https://example.com/photo.jpg" />
            </div>
            <div className="flex gap-4"><button onClick={() => setIsEditingPhoto(false)} className="flex-1 bg-surface-2 text-text-primary py-4 rounded-xl text-xs font-bold hover:bg-border transition-all">Cancel</button><button onClick={handleSavePhoto} disabled={isSubmitting} className="flex-1 bg-brand text-white py-4 rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand/20 disabled:opacity-50">{isSubmitting ? 'Updating...' : 'Update Photo'}</button></div>
          </div>
        </div>
      )}

      {showWelcomeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-bg/90 backdrop-blur-xl"></div>
          <div className="bg-surface border border-border rounded-3xl p-12 max-w-lg w-full relative z-10 text-center space-y-8 animate-in zoom-in-95 duration-500 shadow-2xl">
             <div className="w-20 h-20 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4 border border-brand/20"><span className="text-3xl">🎭</span></div>
             <h2 className="font-heading font-bold text-4xl text-text-primary tracking-tighter">Welcome to Pro</h2>
             <p className="text-text-muted text-xs font-bold leading-relaxed opacity-60">Lumi Pro is the management portal for industry professionals. Connect your profile to manage your filmography and access insights.</p>
             <button onClick={() => { setShowWelcomeModal(false); localStorage.setItem('lumi_pro_welcome_seen', 'true'); }} className="w-full bg-brand text-white py-5 rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand/20">Continue</button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-bg/90 backdrop-blur-xl" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-surface border border-border rounded-3xl p-10 max-w-xl w-full relative z-10 space-y-8 animate-in zoom-in-95 duration-500 shadow-2xl">
            <div className="space-y-2">
                <h2 className="font-heading font-bold text-4xl text-text-primary tracking-tighter">Create Profile</h2>
                <p className="text-xs font-bold text-text-muted opacity-60">Establish your presence in the database.</p>
            </div>
            
            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted opacity-60">Stage Name</label>
                    <input 
                      type="text" 
                      value={newProfileData.name} 
                      onChange={(e) => setNewProfileData({...newProfileData, name: e.target.value})}
                      className="w-full bg-surface-2/50 border border-border text-text-primary rounded-xl px-6 py-4 text-xs font-bold focus:border-brand outline-none transition-all" 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted opacity-60">Primary Role</label>
                    <select 
                      value={newProfileData.role} 
                      onChange={(e) => setNewProfileData({...newProfileData, role: e.target.value})}
                      className="w-full bg-surface-2/50 border border-border text-text-primary rounded-xl px-6 py-4 text-xs font-bold focus:border-brand outline-none transition-all appearance-none"
                    >
                        <option value="Actor">Actor</option>
                        <option value="Director">Director</option>
                        <option value="Producer">Producer</option>
                        <option value="Cinematographer">Cinematographer</option>
                        <option value="Writer">Writer</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted opacity-60">Professional Bio</label>
                    <textarea 
                      value={newProfileData.bio} 
                      onChange={(e) => setNewProfileData({...newProfileData, bio: e.target.value})}
                      className="w-full h-32 bg-surface-2/50 border border-border text-text-primary rounded-xl p-6 text-sm leading-relaxed focus:border-brand outline-none transition-all resize-none" 
                    />
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 bg-surface-2 text-text-primary py-4 rounded-xl text-xs font-bold hover:bg-border transition-all">Cancel</button>
                <button onClick={handleCreateProfile} disabled={isSubmitting} className="flex-1 bg-brand text-white py-4 rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand/20 disabled:opacity-50">
                    {isSubmitting ? 'Creating...' : 'Create Profile'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
