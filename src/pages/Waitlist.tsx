import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { getFriendlyErrorMessage } from '../utils/errors';

export default function Waitlist() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    document.title = "Ensembla | The Home of African Cinema";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    if (!supabase) {
      toast.error('Supabase client not initialized.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert([{ email }]);

      if (error) {
        if (error.code === '23505') {
          setIsSubmitted(true);
          toast.success("You're already on the list!");
          return;
        }
        throw error;
      }

      setIsSubmitted(true);
      toast.success("Welcome to Ensembla!");
    } catch (err: any) {
      console.error('Waitlist error:', err);
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-bg font-['Outfit'] transition-colors duration-500 selection:bg-brand selection:text-white">
      {/* Theme Styles */}
      <style>{`
        .glow-text {
          text-shadow: 0 0 20px var(--color-brand-muted);
        }
        .glow-border {
          box-shadow: 0 0 15px var(--color-brand-muted);
        }
        .cyber-gradient {
          background: linear-gradient(to right, var(--color-brand), var(--color-brand-hover));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      {/* Background with subtle texture */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,var(--color-brand-muted),transparent_70%)]"></div>
        <div className={`absolute inset-0 grid-bg ${isDark ? 'opacity-[0.03]' : 'opacity-[0.08]'}`}></div>
        <img 
          src="/images/waitlist-bg.png" 
          alt="" 
          className={`w-full h-full object-cover opacity-20 ${isDark ? 'grayscale' : 'grayscale invert'}`}
        />
        <div className={`absolute inset-0 bg-gradient-to-b from-bg ${isDark ? 'via-bg/90' : 'via-bg/70'} to-bg`}></div>
      </div>

      <header className="absolute top-0 left-0 w-full p-8 md:p-12 z-20 flex justify-between items-center">
        <Link to="/" className="flex items-center group shrink-0">
          <img 
            src={theme === 'dark' ? "/images/Ensembla Brand/Wordmark White.svg" : "/images/Ensembla Brand/Wordmark.svg"} 
            alt="Ensembla" 
            className="h-7 object-contain group-hover:scale-105 transition-all duration-500" 
          />
        </Link>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleTheme}
            className={`p-3 rounded-2xl transition-all active:scale-95 group border-2 ${
              isDark 
                ? 'bg-surface-2 border-white/10 hover:border-brand text-brand' 
                : 'bg-white border-gray-100 hover:border-brand shadow-md text-brand'
            }`}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            )}
          </button>
          <div className="hidden md:flex items-center gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
            <span>Movies</span>
            <span>Filmmakers</span>
            <span>Community</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full max-w-5xl px-6 py-24 text-center">
        {!isSubmitted ? (
          <div className="space-y-12 animate-fadeIn">
            {/* Value Proposition */}
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${isDark ? 'bg-surface-2 border-border' : 'bg-white border-gray-200'} border shadow-sm mb-4`}>
                <div className={`w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_8px_var(--color-brand)] animate-pulse`}></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Join the growing community</span>
              </div>
              
              <h2 className="text-5xl md:text-8xl font-bold tracking-[-0.03em] text-text-primary leading-[1.05] transition-colors">
                The home of <br /> 
                <span className="cyber-gradient drop-shadow-sm font-black">African Cinema.</span>
              </h2>
              
              <p className="max-w-2xl mx-auto text-base md:text-xl font-medium text-text-secondary leading-relaxed">
                The definitive archive and professional network for African film. 
                Discover thousands of movies, track your watching history, and connect 
                with the storytellers shaping the future.
              </p>
            </div>

            {/* Clear Call to Action */}
            <div className="max-w-md mx-auto space-y-4">
              <form onSubmit={handleSubmit} className="relative group">
                <div className={`flex flex-col sm:flex-row gap-2 ${isDark ? 'bg-surface border-border' : 'bg-white border-gray-200'} p-1.5 rounded-2xl border shadow-2xl transition-all focus-within:border-brand/30 glow-border`}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className={`flex-grow bg-transparent border-none px-6 py-4 text-sm font-medium text-text-primary focus:outline-none focus:ring-0 ${isDark ? 'placeholder:text-text-muted/60' : 'placeholder:text-text-muted/80'}`}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-brand hover:bg-brand-hover text-white text-sm font-black px-8 py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-brand/20 disabled:opacity-50"
                  >
                    {isLoading ? 'Joining...' : 'Get Early Access'}
                  </button>
                </div>
              </form>
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest">
                No spam. Only the best of African cinema.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="pt-24 grid grid-cols-1 md:grid-cols-3 gap-12 text-left border-t border-border/50">
              <div className="space-y-4">
                <div className={`w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19.82 2H4.18C2.97 2 2 2.97 2 4.18v15.64C2 21.03 2.97 22 4.18 22h15.64c1.21 0 2.18-.97 2.18-2.18V4.18C22 2.97 21.03 2 19.82 2z"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M2 12h20"/><path d="M2 7h5"/><path d="M2 17h5"/><path d="M17 17h5"/><path d="M17 7h5"/></svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary transition-colors">Deep Archive</h3>
                <p className="text-sm text-text-secondary opacity-70 leading-relaxed">Access our database of African films, from historical classics to the latest cinematic releases.</p>
              </div>
              <div className="space-y-4">
                <div className={`w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary transition-colors">Industry Profiles</h3>
                <p className="text-sm text-text-secondary opacity-70 leading-relaxed">Connect with directors, producers, and actors. Claim your professional profile to showcase your filmography.</p>
              </div>
              <div className="space-y-4">
                <div className={`w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary transition-colors">Your Watchlist</h3>
                <p className="text-sm text-text-secondary opacity-70 leading-relaxed">Keep track of every film you've watched and build your own library of African cinematic excellence.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-xl mx-auto py-20 animate-fadeIn space-y-8">
            <div className={`w-20 h-20 bg-brand/10 text-brand border-brand/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border shadow-xl rotate-3`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-text-primary transition-colors">You're on the list.</h2>
            <p className="text-lg text-text-secondary opacity-80 max-w-md mx-auto">
              We'll send an invite to <strong>{email}</strong> as soon as we're ready for you. In the meantime, follow us for updates.
            </p>
            <div className="pt-8">
              <button
                onClick={() => setIsSubmitted(false)}
                className={`text-sm font-bold text-brand hover:underline underline-offset-8 transition-all`}
              >
                Go back
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto w-full p-8 border-t border-border/50 text-center relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] transition-colors text-text-secondary">
          Ensembla Protocol © 2026 — Pioneering the African Archive
        </p>
      </footer>
    </div>
  );
}
