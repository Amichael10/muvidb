import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export default function OAuthAuthorize() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const clientId = searchParams.get('client_id') || 'chatgpt';
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const codeChallenge = searchParams.get('code_challenge') || '';
  const codeChallengeMethod = searchParams.get('code_challenge_method') || 'S256';
  const scope = searchParams.get('scope') || 'mcp:tools';

  const [authorizing, setAuthorizing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    document.title = 'MuviDB | Connect to ChatGPT (OAuth)';
  }, []);

  const handleAuthorize = async () => {
    if (!redirectUri) {
      toast.error('Missing redirect_uri in authorization request');
      return;
    }

    setAuthorizing(true);
    try {
      // Get current Supabase session token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        toast.error('Please log in again to continue');
        setAuthorizing(false);
        return;
      }

      const res = await fetch('/api/oauth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userToken: accessToken,
          clientId,
          redirectUri,
          codeChallenge,
          codeChallengeMethod,
          state,
          scope
        })
      });

      const data = await res.json();
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.message || 'Authorization failed');
      }

      // Redirect back to ChatGPT / client callback
      window.location.href = data.redirectUrl;
    } catch (err) {
      console.error('OAuth authorization error:', err);
      toast.error(err.message || 'Authorization failed');
      setAuthorizing(false);
    }
  };

  const handleCancel = () => {
    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set('error', 'access_denied');
      url.searchParams.set('error_description', 'The user cancelled the authorization request.');
      if (state) url.searchParams.set('state', state);
      window.location.href = url.toString();
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) throw error;
      toast.success('Signed in successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to sign in');
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-surface border border-border/80 rounded-3xl p-7 sm:p-9 shadow-2xl relative overflow-hidden">
        {/* Top Glow Accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-brand/10 rounded-full blur-3xl pointer-events-none" />

        {/* Integration Header */}
        <div className="flex items-center justify-center gap-4 mb-7">
          <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-black text-xl shadow-inner">
            M
          </div>
          <div className="flex items-center text-text-muted">
            <Icon icon="solar:link-round-linear" className="text-xl" />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#10a37f]/10 border border-[#10a37f]/25 flex items-center justify-center text-[#10a37f] text-2xl shadow-inner">
            <Icon icon="simple-icons:openai" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="font-heading font-black text-2xl text-text-primary tracking-tight">
            Connect to ChatGPT
          </h1>
          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
            Authorize ChatGPT to access MuviDB with your account permissions.
          </p>
        </div>

        {/* If user is NOT logged in */}
        {!user ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-brand/5 border border-brand/20 text-xs text-brand leading-relaxed">
              Log in to your MuviDB account to complete the connection.
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl bg-bg border border-border focus:border-brand focus:outline-none text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-bg border border-border focus:border-brand focus:outline-none text-sm text-text-primary"
              />
            </div>
            <button
              type="submit"
              disabled={signingIn}
              className="w-full py-3.5 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {signingIn ? (
                <>
                  <Icon icon="solar:spinner-linear" className="animate-spin text-lg" />
                  Signing In...
                </>
              ) : (
                'Sign In & Authorize'
              )}
            </button>
            <p className="text-center text-xs text-text-muted mt-3">
              Don't have an account?{' '}
              <Link to="/signup" className="text-brand font-bold hover:underline">
                Sign up free
              </Link>
            </p>
          </form>
        ) : (
          /* User is logged in — show Consent Screen */
          <div className="space-y-6">
            <div className="p-3.5 rounded-xl bg-surface-elevated border border-border flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-sm">
                {(user.name || user.email || 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-text-primary truncate">{user.name || 'MuviDB User'}</p>
                <p className="text-[11px] text-text-muted truncate">{user.email}</p>
              </div>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-brand/10 text-brand">
                {user.role || 'Fan'}
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                ChatGPT will be able to:
              </p>
              <div className="space-y-2.5 text-xs text-text-muted">
                <div className="flex items-start gap-2.5">
                  <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0 mt-0.5" />
                  <span>Search Nollywood films, TV series, synopsis, and verified credits</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0 mt-0.5" />
                  <span>Fetch live streaming platforms (Netflix, Prime, YouTube) and cinema showtimes</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Icon icon="solar:check-circle-bold" className="text-brand text-base shrink-0 mt-0.5" />
                  <span>Retrieve box office records, awards (AMAA, AMVCA), and artist filmographies</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleAuthorize}
                disabled={authorizing}
                className="w-full py-3.5 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
              >
                {authorizing ? (
                  <>
                    <Icon icon="solar:spinner-linear" className="animate-spin text-lg" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:verified-check-bold" className="text-lg" />
                    Authorize ChatGPT
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={authorizing}
                className="w-full py-3 rounded-xl bg-surface-elevated hover:bg-border/40 text-text-muted hover:text-text-primary text-xs font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-7 pt-5 border-t border-border/60 text-center">
          <p className="text-[11px] text-text-muted">
            Secured by MuviDB Model Context Protocol (MCP) ·{' '}
            <Link to="/privacy" className="underline hover:text-text-primary">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
