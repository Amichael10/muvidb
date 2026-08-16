import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/layout/AuthLayout';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { getFriendlyErrorMessage } from '../utils/errors';
import { requestWelcomeEmail } from '../lib/welcomeEmail';
import { Icon } from '@iconify/react';
import { PROFESSIONAL_ROLES } from '../lib/professionalRoles';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountType, setAccountType] = useState('fan');
  const [professionalRoles, setProfessionalRoles] = useState([]);
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
    if (accountType === 'professional' && professionalRoles.length === 0) {
      setError('Select at least one professional role.');
      return;
    }

    setIsLoading(true);
    try {
      const role = accountType === 'professional' ? 'professional' : 'fan';
      const { user: signUpUser, session } = await signup(name, email, password, role, accountType === 'fan', {
        account_intent: accountType,
        professional_roles: professionalRoles,
      });
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
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">How will you use MuviDB?</label>
          <div className="grid grid-cols-2 gap-3">
            {[['fan', 'Film fan', 'solar:heart-angle-linear'], ['professional', 'Industry professional', 'solar:clapperboard-text-linear']].map(([value, label, icon]) => (
              <button key={value} type="button" onClick={() => setAccountType(value)} className={`rounded-xl border p-4 text-left transition-all ${accountType === value ? 'border-brand bg-brand/10 text-brand' : 'border-border bg-surface-2/40 text-text-muted hover:border-brand/40'}`}>
                <Icon icon={icon} width="22" />
                <strong className="mt-3 block text-[10px] uppercase tracking-wider">{label}</strong>
              </button>
            ))}
          </div>
        </div>

        {accountType === 'professional' && (
          <div className="space-y-3 rounded-xl border border-border bg-surface-2/30 p-4">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-text-primary">Select every role that applies</p><p className="mt-1 text-[10px] leading-5 text-text-muted">These choices personalize onboarding. Professional tools remain locked until a profile claim is verified.</p></div>
            <div className="flex flex-wrap gap-2">
              {PROFESSIONAL_ROLES.map((item) => {
                const selected = professionalRoles.includes(item.value);
                return <button key={item.value} type="button" onClick={() => setProfessionalRoles((current) => selected ? current.filter((role) => role !== item.value) : [...current, item.value])} className={`rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-wider ${selected ? 'border-brand bg-brand text-white' : 'border-border text-text-muted hover:border-brand'}`}>{selected ? '✓ ' : ''}{item.label}</button>;
              })}
            </div>
            <p className="text-[9px] text-text-muted">Actor verification is available now. Other role-specific verification tools will be added without requiring a new account.</p>
          </div>
        )}

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

      {accountType === 'fan' ? <GoogleSignInButton mode="signup" onClick={() => loginWithGoogle()} /> : <p className="rounded-xl border border-border bg-surface-2/40 p-4 text-center text-[10px] leading-5 text-text-muted">Professional signup currently uses email so your selected industry roles are preserved. Google signup remains available for fan accounts.</p>}

      <p className="text-center mt-10">
        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">ALREADY HAVE AN ACCOUNT? </span>
        <Link to="/login" className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline">
          SIGN IN
        </Link>
      </p>
    </AuthLayout>
  );
}
