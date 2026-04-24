import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminClaims() {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profile_claims')
        .select(`
          *,
          users(name, email, avatar_url),
          people(name, photo_url, is_verified)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClaims(data || []);
    } catch (error) {
      console.error('Error fetching claims:', error);
      // toast.error('Failed to load claims');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (claim) => {
    if (!user?.id) return;
    setIsProcessing(true);
    try {
      // 1. UPDATE profile_claims
      const { error: claimError } = await supabase
        .from('profile_claims')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', claim.id);
      if (claimError) throw claimError;

      // 2. UPDATE people
      const { error: peopleError } = await supabase
        .from('people')
        .update({ is_verified: true })
        .eq('id', claim.person_id);
      if (peopleError) throw peopleError;

      // 3. UPDATE users
      const { error: userError } = await supabase
        .from('users')
        .update({
          linked_profile_id: claim.person_id,
          role: 'professional'
        })
        .eq('id', claim.user_id);
      if (userError) throw userError;

      toast.success(`${claim.people?.name} verified ✓`);
      setClaims(claims.filter(c => c.id !== claim.id));
    } catch (error) {
      console.error('Error approving claim:', error);
      toast.error('Failed to approve claim');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (claim) => {
    if (!user?.id) return;
    setIsProcessing(true);
    try {
      const updateData = {
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profile_claims')
        .update(updateData)
        .eq('id', claim.id);

      if (error) throw error;

      toast.success('Claim rejected');
      setClaims(claims.filter(c => c.id !== claim.id));
      setRejectingId(null);
      setRejectReason('');
    } catch (error) {
      console.error('Error rejecting claim:', error);
      toast.error('Failed to reject claim');
    } finally {
      setIsProcessing(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-48 bg-surface-2 animate-pulse rounded-lg"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-surface-2 animate-pulse rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Review Queue</p>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Identity Claims</h1>
            <span className="bg-brand/10 text-brand px-3 py-1 rounded-full text-xs font-bold border border-brand/20">
              {claims.length} pending
            </span>
          </div>
        </div>
      </header>

      {claims.length === 0 ? (
        <div className="card-cal flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">Queue empty</h3>
          <p className="text-text-muted text-sm max-w-xs mx-auto">There are no pending identity claims requiring review at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {claims.map((claim) => (
              <motion.div
                key={claim.id}
                initial={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden', marginTop: 0, marginBottom: 0 }}
                transition={{ duration: 0.3 }}
                className="card-cal p-8 flex flex-col lg:flex-row gap-8 hover:border-brand/20 transition-all group"
              >
                {/* LEFT SECTION */}
                <div className="flex flex-col items-center text-center lg:w-48 shrink-0">
                  {claim.people?.photo_url ? (
                    <img src={claim.people.photo_url} alt="" className="w-24 h-24 rounded-full object-cover bg-surface-2 border border-border mb-4 grayscale group-hover:grayscale-0 transition-all" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-surface-2 flex items-center justify-center text-2xl font-bold text-text-muted border border-border mb-4">
                      {getInitials(claim.people?.name)}
                    </div>
                  )}
                  <div className="font-bold text-text-primary text-base leading-tight mb-2">
                    {claim.people?.name || 'Unknown record'}
                  </div>
                  <div className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-4 opacity-60">Database record</div>
                  <Link to={`/people/${claim.person_id}`} className="text-brand text-xs font-bold hover:underline" target="_blank" rel="noopener noreferrer">
                    View profile
                  </Link>
                </div>

                {/* MIDDLE SECTION */}
                <div className="flex-1 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-border lg:pl-8 pt-8 lg:pt-0">
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-bold text-text-primary">{claim.users?.name || 'Anonymous user'}</span>
                      <span className="text-xs text-text-muted font-medium px-2 py-0.5 bg-surface-2 rounded-md border border-border">Claimant</span>
                    </div>
                    <div className="text-text-muted text-xs font-medium">
                      {claim.users?.email}
                    </div>
                    <div className="text-text-muted text-[10px] font-bold mt-2 opacity-60">
                      Requested on {new Date(claim.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  
                  {claim.note && (
                    <div className="bg-surface-2 border-l-2 border-brand p-5 rounded-r-lg">
                      <p className="text-text-primary text-sm font-medium italic leading-relaxed">
                        "{claim.note}"
                      </p>
                    </div>
                  )}
                </div>

                {/* RIGHT SECTION */}
                <div className="flex flex-col justify-center gap-3 lg:w-64 shrink-0 border-t lg:border-t-0 lg:border-l border-border lg:pl-8 pt-8 lg:pt-0">
                  {rejectingId === claim.id ? (
                    <div className="flex flex-col gap-3">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)"
                        className="w-full bg-surface-2 border border-border text-text-primary rounded-lg px-4 py-3 text-xs focus:border-red-500 outline-none resize-none h-24"
                      />
                      <button
                        onClick={() => handleReject(claim)}
                        disabled={isProcessing}
                        className="w-full bg-red-500 text-white font-bold py-3 rounded-lg text-xs hover:bg-red-600 transition-all disabled:opacity-50"
                      >
                        {isProcessing ? 'Rejecting...' : 'Reject request'}
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                        disabled={isProcessing}
                        className="w-full text-text-muted hover:text-text-primary font-bold py-1 text-[10px] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(claim)}
                        disabled={isProcessing}
                        className="w-full bg-brand text-white font-bold py-4 rounded-xl text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand/20 disabled:opacity-50"
                      >
                        Approve claim
                      </button>
                      <button
                        onClick={() => setRejectingId(claim.id)}
                        disabled={isProcessing}
                        className="w-full border border-border bg-surface-2 text-text-muted font-bold py-4 rounded-xl text-xs hover:border-red-500/30 hover:text-red-500 transition-all disabled:opacity-50"
                      >
                        Decline request
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
