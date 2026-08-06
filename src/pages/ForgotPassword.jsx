import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/layout/AuthLayout';
import { getFriendlyErrorMessage } from '../utils/errors';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { requestPasswordReset } = useAuth();

  useEffect(() => {
    document.title = 'MuviDB | Forgot Password';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      await requestPasswordReset(trimmed);
      setSent(true);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-12 space-y-2">
        <h2 className="font-heading font-bold text-4xl md:text-5xl text-text-primary tracking-tighter uppercase italic leading-none">
          Reset <span className="text-brand">Password</span>
        </h2>
        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] opacity-60">
          We&apos;ll email you a secure link
        </p>
      </div>

      {sent ? (
        <div className="space-y-8">
          <div className="rounded-xl border border-border bg-surface-2/40 px-6 py-6 space-y-3">
            <p className="text-sm font-semibold text-text-primary leading-relaxed">
              If an account exists for <span className="text-brand">{email.trim()}</span>, we sent a reset link.
            </p>
            <p className="text-xs text-text-muted leading-relaxed">
              Check your inbox and spam folder. The link expires after a short time. Google sign-in accounts should use Continue with Google instead.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center bg-brand text-white text-[10px] font-black uppercase tracking-widest py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand/20"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              autoComplete="email"
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
            {isLoading ? 'Sending…' : 'Send reset link'}
          </button>

          <p className="text-center pt-4">
            <Link to="/login" className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
