import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/layout/AuthLayout';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('fan');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { signup, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Lumi | Join";
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
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
      }
    } catch (err) {
      setError(err.message || 'Account creation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-10 space-y-2">
        <h2 className="font-heading font-bold text-4xl md:text-5xl text-text-primary tracking-tighter uppercase italic leading-none">
          Join <span className="text-brand">Lumi</span>
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

        <div className="pt-2">
          <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-4 opacity-60">
            Account Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setRole('fan')}
              className={`flex flex-col items-start p-6 rounded-xl border-2 text-left transition-all duration-500 ${
                role === 'fan' 
                  ? 'border-brand bg-brand/5' 
                  : 'border-border bg-surface-2/30 hover:border-text-muted'
              }`}
            >
              <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${role === 'fan' ? 'text-brand' : 'text-text-primary'}`}>
                FAN HUB
              </span>
              <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest opacity-60 italic">LISTS & RATES</span>
            </button>

            <button
              type="button"
              onClick={() => setRole('professional')}
              className={`flex flex-col items-start p-6 rounded-xl border-2 text-left transition-all duration-500 ${
                role === 'professional' 
                  ? 'border-brand bg-brand/5' 
                  : 'border-border bg-surface-2/30 hover:border-text-muted'
              }`}
            >
              <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${role === 'professional' ? 'text-brand' : 'text-text-primary'}`}>
                INDUSTRY
              </span>
              <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest opacity-60 italic">FILMOGRAPHY</span>
            </button>
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
            I AGREE TO <Link to="#" className="text-brand hover:underline">PROTOCOL</Link> & <Link to="#" className="text-brand hover:underline">PRIVACY</Link>
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

      {/* Google Button */}
      <button
        type="button"
        onClick={() => loginWithGoogle()}
        className="w-full bg-white text-bg text-[10px] font-black uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white/90 active:scale-95 transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        GOOGLE CONNECT
      </button>

      <p className="text-center mt-10">
        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">ALREADY HAVE AN ACCOUNT? </span>
        <Link to="/login" className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline">
          SIGN IN
        </Link>
      </p>
    </AuthLayout>
  );
}
