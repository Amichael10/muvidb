import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import PersonCard from '../components/person/PersonCard';

export default function ClaimProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPeople, setFilteredPeople] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [claimReason, setClaimReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    document.title = "Lumi | Claim Profile";
    if (user?.id) {
       checkExistingClaim();
    }
  }, [user?.id]);

  const checkExistingClaim = async () => {
    const { data } = await supabase
      .from('profile_claims')
      .select('status')
      .eq('user_id', user.id)
      .single();
    
    if (data && (data.status === 'pending' || data.status === 'approved')) {
      toast.success('Redirecting to your dashboard...');
      navigate('/pro-dashboard');
    }
  };

  useEffect(() => {
    if (searchQuery.length > 2) {
      const delaySearch = setTimeout(async () => {
        const { data } = await supabase
          .from('people')
          .select('*')
          .ilike('name', `%${searchQuery}%`)
          .limit(8);
        setFilteredPeople(data || []);
      }, 300);
      return () => clearTimeout(delaySearch);
    } else {
      setFilteredPeople([]);
    }
  }, [searchQuery]);

  const handleSelect = (person) => {
    setSelectedPerson(person);
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmed) return;
    
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
      setIsSubmitted(true);
    } catch (err) {
      toast.error('Failed to submit claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-bg pt-24 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
        <div className="bg-surface border border-border rounded-2xl p-8 md:p-12 text-center max-w-md w-full animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-6 relative">
            <svg className="w-12 h-12 text-brand animate-in zoom-in duration-500 delay-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 className="font-heading font-bold text-3xl text-text-primary mb-4 uppercase tracking-tighter italic">Claim Submitted!</h2>
          <p className="text-text-muted mb-8 leading-relaxed text-sm">
            We'll review your claim and email you at <strong className="text-text-primary">{user.email}</strong> within 1-2 business days.
          </p>
          <Link to="/pro-dashboard" className="block w-full bg-brand text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-lg shadow-brand/20">
            GO TO DASHBOARD
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pt-32 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {/* STEP INDICATOR */}
        <div className="mb-16">
          <div className="flex items-center justify-between relative max-w-md mx-auto">
            <div className="absolute left-0 top-[20px] w-full h-[1px] bg-border -z-10"></div>
            <div className="absolute left-0 top-[20px] h-[1px] bg-brand transition-all duration-500 -z-10" style={{ width: `${(step - 1) * 50}%` }}></div>
            
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex flex-col items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-500 ${
                  step > num 
                    ? 'bg-brand text-white border-brand' 
                    : step === num 
                      ? 'bg-brand text-white shadow-lg shadow-brand/20 scale-110' 
                      : 'bg-surface border border-border text-text-muted'
                } border-2`}>
                  {step > num ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : num}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${step >= num ? 'text-brand' : 'text-text-muted opacity-40'}`}>
                  {num === 1 ? 'SEARCH' : num === 2 ? 'SELECT' : 'SUBMIT'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-[0.03] pointer-events-none"></div>
          
          {/* STEP 1: SEARCH */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 relative z-10">
              <h2 className="font-heading font-bold text-4xl text-text-primary mb-2 text-center tracking-tighter uppercase italic">Find Your Profile</h2>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] text-center mb-12 opacity-60">
                SEARCH FOR YOUR NAME TO ESTABLISH YOUR OFFICIAL LUMI RECORD
              </p>
              
              <div className="relative max-w-xl mx-auto mb-12">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <input 
                  type="text" 
                  placeholder="legal name..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bg border border-border text-text-primary rounded-xl pl-16 pr-6 py-5 focus:outline-none focus:border-brand transition-all text-sm font-bold tracking-widest"
                  autoFocus
                />
              </div>

              {searchQuery && (
                <div className="mt-12">
                  {filteredPeople.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {filteredPeople.map(person => (
                        <div key={person.id} className="relative group">
                          <PersonCard person={person} />
                          <div className="absolute inset-0 bg-bg/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl p-4">
                            <button 
                              onClick={() => handleSelect(person)}
                              className="bg-brand text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform w-full"
                            >
                              SELECT
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-surface-2/30 rounded-xl border border-border border-dashed">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">NO ARCHIVE MATCH FOR "{searchQuery.toUpperCase()}"</p>
                      <button className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline">REQUEST NEW ENTRY</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SELECT */}
          {step === 2 && selectedPerson && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 text-center max-w-md mx-auto relative z-10">
              <h2 className="font-heading font-bold text-4xl text-text-primary mb-12 tracking-tighter uppercase italic">Is this <span className="text-brand">you?</span></h2>
              
              <div className="bg-bg border border-border rounded-2xl p-8 mb-8">
                <img src={selectedPerson.photo} alt={selectedPerson.name} className="w-32 h-32 rounded-full object-cover mx-auto mb-6 border-4 border-surface shadow-2xl" />
                <h3 className="font-heading font-bold text-2xl text-text-primary mb-1 uppercase tracking-tighter">
                  {selectedPerson.name}
                </h3>
                <p className="text-brand text-[10px] font-black uppercase tracking-[0.2em] mb-6">{selectedPerson.role}</p>
                
                <div className="flex justify-center gap-8 text-[9px] font-black uppercase tracking-widest border-t border-border pt-6">
                  <div>
                    <span className="block text-text-muted opacity-60 mb-1">CREDITS</span>
                    <span className="text-text-primary">{selectedPerson.film_count}</span>
                  </div>
                  <div>
                    <span className="block text-text-muted opacity-60 mb-1">FOLLOWERS</span>
                    <span className="text-text-primary">{(selectedPerson.popularity / 1000).toFixed(1)}K</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => setStep(3)}
                  className="w-full bg-brand text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-lg shadow-brand/20"
                >
                  YES, ESTABLISH CONNECTION
                </button>
                <button 
                  onClick={() => setStep(1)}
                  className="w-full text-text-muted hover:text-text-primary py-2 text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  WRONG IDENTITY, SEARCH AGAIN
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUBMIT */}
          {step === 3 && selectedPerson && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-lg mx-auto relative z-10">
              <div className="flex items-center gap-6 mb-12 pb-8 border-b border-border">
                <img src={selectedPerson.photo} alt={selectedPerson.name} className="w-20 h-20 rounded-full object-cover border-2 border-brand" />
                <div>
                  <div className="text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60 mb-1">ESTABLISHING SESSION FOR</div>
                  <div className="font-bold text-2xl text-text-primary uppercase tracking-tighter">{selectedPerson.name}</div>
                </div>
                <button onClick={() => setStep(1)} className="ml-auto text-[10px] font-black text-brand uppercase tracking-widest hover:underline">CHANGE</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">Verification Details</label>
                  <textarea 
                    required
                    value={claimReason}
                    onChange={(e) => setClaimReason(e.target.value)}
                    placeholder="provide links to socials, agency contacts, or official documentation for verification..."
                    className="w-full bg-bg border border-border text-text-primary rounded-xl px-6 py-4 focus:outline-none focus:border-brand transition-all min-h-[150px] text-[11px] font-bold tracking-widest"
                  ></textarea>
                </div>

                <div className="bg-surface-2/50 p-6 rounded-xl border border-border flex items-start gap-4">
                  <input 
                    type="checkbox" 
                    id="confirm" 
                    required
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 w-5 h-5 border-2 border-border rounded bg-bg checked:bg-brand checked:border-brand transition-all cursor-pointer accent-brand"
                  />
                  <label htmlFor="confirm" className="text-[10px] font-black text-text-muted uppercase tracking-widest cursor-pointer select-none leading-relaxed opacity-70">
                    I CONFIRM I AM THE PERSON NAMED ABOVE OR THEIR AUTHORIZED REPRESENTATIVE. FALSE CLAIMS WILL RESULT IN PERMANENT BAN.
                  </label>
                </div>

                <button 
                  type="submit" 
                  disabled={!confirmed || !claimReason || isSubmitting}
                  className="w-full bg-brand text-white py-5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-brand/20"
                >
                  {isSubmitting ? 'PROCESSING...' : 'SUBMIT ARCHIVE CLAIM'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
