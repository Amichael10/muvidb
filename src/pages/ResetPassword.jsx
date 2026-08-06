import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/layout/AuthLayout';
import { getFriendlyErrorMessage } from '../utils/errors';

/**
 * Landing page for Supabase password-recovery links.
 * redirectTo should be https://muvidb.com/reset-password (allowlisted in Supabase Auth).
 */
export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [done, setDone] = useState(false);

  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'MuviDB | Set New Password';
  }, []);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
        setChecking(false);
      }
    });

    // Recovery session may already be established when the page loads.
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session?.user) {
        setReady(true);
      }
      setChecking(false);
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <AuthLayout>
        <p className="text-sm text-text-muted font-semibold">Verifying reset link…</p>
      </AuthLayout>
    );
  }

  if (!ready && !done) {
    return (
      <AuthLayout>
        <div className="mb-10 space-y-2">
          <h2 className="font-heading font-bold text-4xl text-text-primary tracking-tighter uppercase italic leading-none">
            Link <span className="text-brand">Invalid</span>
          </h2>
        </div>
        <p className="text-sm text-text-muted leading-relaxed mb-8">
          This reset link is invalid or has expired. Request a new one from the forgot password page.
        </p>
        <Link
          to="/forgot-password"
          className="inline-flex w-full items-center justify-center bg-brand text-white text-[10px] font-black uppercase tracking-widest py-4 rounded-xl"
        >
          Request new link
        </Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="space-y-6">
          <h2 className="font-heading font-bold text-4xl text-text-primary tracking-tighter uppercase italic leading-none">
            Password <span className="text-brand">Updated</span>
          </h2>
          <p className="text-sm text-text-muted">Redirecting you to sign in…</p>
          <Link to="/login" className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline">
            Sign in now
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-12 space-y-2">
        <h2 className="font-heading font-bold text-4xl md:text-5xl text-text-primary tracking-tighter uppercase italic leading-none">
          New <span className="text-brand">Password</span>
        </h2>
        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] opacity-60">
          Choose a strong password
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={`w-full bg-surface-2/50 border ${error ? 'border-red-500' : 'border-border'} text-text-primary placeholder-text-muted/30 rounded-xl px-6 py-4 pr-12 text-[11px] font-bold tracking-widest focus:outline-none focus:border-brand transition-all`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-muted hover:text-brand transition-colors text-[10px] font-bold uppercase"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">
            Confirm Password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className={`w-full bg-surface-2/50 border ${error ? 'border-red-500' : 'border-border'} text-text-primary placeholder-text-muted/30 rounded-xl px-6 py-4 text-[11px] font-bold tracking-widest focus:outline-none focus:border-brand transition-all`}
          />
          {error && (
            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mt-2">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-brand text-white text-[10px] font-black uppercase tracking-widest py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
        >
          {isLoading ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  );
}
