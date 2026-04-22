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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Pending Claims</h1>
          <span className="bg-surface-2 text-text-muted px-3 py-1 rounded-full text-sm font-medium">
            {claims.length}
          </span>
        </div>
      </div>

      {claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="w-24 h-24 text-green-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-2xl font-bold text-text-primary mb-2">All claims reviewed.</h3>
          <p className="text-text-muted">You're up to date.</p>
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
                className="bg-surface rounded-lg p-6 border border-border flex flex-col lg:flex-row gap-6"
              >
                {/* LEFT SECTION */}
                <div className="flex flex-col items-center text-center lg:w-48 shrink-0">
                  {claim.people?.photo_url ? (
                    <img src={claim.people.photo_url} alt={claim.people.name} className="w-20 h-20 rounded-full object-cover bg-surface-2 mb-3" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-surface-2 flex items-center justify-center text-2xl font-bold text-text-primary mb-3">
                      {getInitials(claim.people?.name)}
                    </div>
                  )}
                  <div className="font-bold text-text-primary text-lg leading-tight mb-1">
                    {claim.people?.name || 'Unknown Person'}
                  </div>
                  <div className="text-text-muted text-xs mb-3">Profile being claimed</div>
                  <Link to={`/people/${claim.person_id}`} className="text-gold text-sm hover:underline" target="_blank" rel="noopener noreferrer">
                    View Profile →
                  </Link>
                </div>

                {/* MIDDLE SECTION */}
                <div className="flex-1 flex flex-col justify-center border-t border-border lg:border-t-0 lg:border-l lg:pl-6 pt-6 lg:pt-0">
                  <div className="mb-4">
                    <div className="font-bold text-text-primary text-lg">
                      {claim.users?.name || 'Unknown User'}
                    </div>
                    <div className="text-text-muted text-sm">
                      {claim.users?.email}
                    </div>
                    <div className="text-text-muted text-xs mt-1">
                      Submitted {new Date(claim.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  
                  {claim.note && (
                    <div className="bg-surface-2/50 border-l-4 border-gold p-4 rounded-r-lg">
                      <p className="text-text-primary italic whitespace-pre-wrap text-sm">
                        "{claim.note}"
                      </p>
                    </div>
                  )}
                </div>

                {/* RIGHT SECTION */}
                <div className="flex flex-col justify-center gap-3 lg:w-64 shrink-0 border-t border-border lg:border-t-0 lg:border-l lg:pl-6 pt-6 lg:pt-0">
                  {rejectingId === claim.id ? (
                    <div className="flex flex-col gap-3">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)"
                        className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-sm focus:border-red-500 focus:outline-none resize-none h-24"
                      />
                      <button
                        onClick={() => handleReject(claim)}
                        disabled={isProcessing}
                        className="w-full bg-red-500 text-white font-semibold py-2 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {isProcessing ? 'Processing...' : 'Confirm Rejection'}
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                        disabled={isProcessing}
                        className="w-full text-text-muted hover:text-text-primary font-medium py-1 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(claim)}
                        disabled={isProcessing}
                        className="w-full bg-green-600 text-white font-semibold py-3 rounded-md hover:bg-green-500 transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectingId(claim.id)}
                        disabled={isProcessing}
                        className="w-full border border-red-500/50 text-red-400 font-semibold py-3 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        Reject
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
