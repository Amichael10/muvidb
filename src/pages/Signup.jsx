import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/layout/AuthLayout';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { getFriendlyErrorMessage } from '../utils/errors';
import { requestWelcomeEmail } from '../lib/welcomeEmail';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const role = 'fan'; // Only fan accounts are offered at signup
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { signup, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "MuviDB | Join";
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin' || user.role === 'admin_limited') {
        navigate('/admin');
      } else if (!user.onboarded) {
        navigate('/onboarding');
      } else {
        navigate(user.role === 'professional' ? '/pro-dashboard' : '/dashboard');
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    if (!agreedToTerms) {
      setError('Please agree to the terms to continue.');
      return;
    }

    setIsLoading(true);
    try {
      // Manual signup includes the role and marks as onboarded
      const { user: signUpUser, session } = await signup(name, email, password, role, true);
      if (signUpUser && !session) {
        setError('Please check your email to verify your account.');
      } else if (session) {
        // Kick welcome email immediately when signup returns a live session
        // (email confirmation disabled). AuthContext also retries on profile load.
        void requestWelcomeEmail(name, { force: true });
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-10 space-y-2">
        <h2 className="font-heading font-bold text-4xl md:text-5xl text-text-primary tracking-tighter uppercase italic leading-none">
          Join <span className="text-brand">MuviDB</span>
        </h2>
        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] opacity-60">
          Create your archive profile
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full bg-surface-2/50 border border-border text-text-primary rounded-xl px-6 py-4 text-[11px] font-bold tracking-widest focus:border-brand focus:outline-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@email.com"
            className="w-full bg-surface-2/50 border border-border text-text-primary rounded-xl px-6 py-4 text-[11px] font-bold tracking-widest focus:border-brand focus:outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-surface-2/50 border border-border text-text-primary rounded-xl px-6 py-4 text-[11px] font-bold tracking-widest focus:border-brand focus:outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">
              Confirm
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-surface-2/50 border border-border text-text-primary rounded-xl px-6 py-4 text-[11px] font-bold tracking-widest focus:border-brand focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="w-4 h-4 border-2 border-border rounded bg-surface-2/50 checked:bg-brand checked:border-brand transition-all cursor-pointer accent-brand"
            />
          <label htmlFor="terms" className="text-[9px] font-black text-text-muted uppercase tracking-widest cursor-pointer opacity-60">
            I AGREE TO THE <Link to="/terms" className="text-brand hover:underline">TERMS &amp; CONDITIONS</Link> AND <Link to="/privacy" className="text-brand hover:underline">PRIVACY POLICY</Link>
          </label>
        </div>

        {error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-brand text-white text-[10px] font-black uppercase tracking-widest py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
        >
          {isLoading ? 'CREATING...' : 'CREATE ACCOUNT'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center my-10">
        <div className="flex-grow border-t border-border opacity-50"></div>
        <span className="flex-shrink-0 mx-4 text-[9px] font-black text-text-muted uppercase tracking-[0.3em] opacity-40">OR JOIN VIA</span>
        <div className="flex-grow border-t border-border opacity-50"></div>
      </div>

      <GoogleSignInButton mode="signup" onClick={() => loginWithGoogle()} />

      <p className="text-center mt-10">
        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">ALREADY HAVE AN ACCOUNT? </span>
        <Link to="/login" className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline">
          SIGN IN
        </Link>
      </p>
    </AuthLayout>
  );
}
