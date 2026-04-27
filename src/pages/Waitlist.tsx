import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export default function Waitlist() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    document.title = "Lumi | Join the Waitlist";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    if (!supabase) {
      toast.error('Supabase client not initialized. Check your environment variables.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert([{ email }]);

      if (error) {
        if (error.code === '23505') { // Unique violation
          setIsSubmitted(true);
          toast.success("You're already on the list!");
          return;
        }
        throw error;
      }

      setIsSubmitted(true);
      toast.success("You're on the list!");
    } catch (err: any) {
      console.error('Waitlist error:', err);
      toast.error(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-bg">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/images/waitlist-bg.png" 
          alt="Background" 
          className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/80 to-bg"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute inset-0 grid-bg opacity-10"></div>
      </div>

      <div className="relative z-10 w-full max-w-4xl px-6 py-20 text-center">
        {/* Logo/Brand */}
        <div className="mb-16 flex justify-center scale-75 md:scale-100">
          <Link to="/" className="group">
            <h1 className="text-5xl md:text-7xl font-heading font-bold tracking-tighter italic uppercase leading-none text-text-primary group-hover:scale-105 transition-transform duration-500">
              LUMI<span className="text-brand">.</span>
            </h1>
          </Link>
        </div>

        {/* Content */}
        {!isSubmitted ? (
          <div className="space-y-12 animate-fadeIn max-w-2xl mx-auto">
            <div className="space-y-6">
              <h2 className="text-5xl md:text-8xl font-heading font-extrabold tracking-tight uppercase italic leading-[0.85] text-text-primary">
                THE FUTURE OF <br />
                <span className="text-brand">AFRICAN CINEMA</span>
              </h2>
              <p className="max-w-md mx-auto text-[11px] md:text-[12px] font-black text-text-muted uppercase tracking-[0.4em] leading-loose opacity-60">
                Lumi is the first premium film archive and social protocol for the next generation of storytellers. Join the waitlist for exclusive early access.
              </p>
            </div>

            {/* Waitlist Form */}
            <div className="relative max-w-md mx-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-brand/20 to-brand-hover/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
              <form onSubmit={handleSubmit} className="relative group">
                <div className="flex flex-col md:flex-row gap-0 bg-surface/40 backdrop-blur-3xl border border-white/5 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="NAME@PROTOCOL.COM"
                    className="flex-grow bg-transparent border-none px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-text-primary focus:outline-none focus:ring-0 placeholder:text-text-muted/30"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-brand hover:bg-brand-hover text-white text-[11px] font-black uppercase tracking-[0.3em] px-10 py-6 transition-all active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
                  >
                    {isLoading ? 'JOINING...' : 'JOIN WAITLIST'}
                  </button>
                </div>
              </form>
            </div>

            {/* Benefits Row */}
            <div className="pt-16 grid grid-cols-2 md:grid-cols-3 gap-12 border-t border-white/5">
              <div className="space-y-3">
                <div className="text-brand font-heading font-black italic text-4xl tracking-tighter leading-none opacity-20">01</div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">Early Access</p>
              </div>
              <div className="space-y-3">
                <div className="text-brand font-heading font-black italic text-4xl tracking-tighter leading-none opacity-20">02</div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">Founder Status</p>
              </div>
              <div className="hidden md:block space-y-3">
                <div className="text-brand font-heading font-black italic text-4xl tracking-tighter leading-none opacity-20">03</div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">Archive Credits</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-10 animate-fadeIn max-w-xl mx-auto py-10">
            <div className="w-24 h-24 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-10 border border-brand/20 shadow-[0_0_30px_rgba(255,92,0,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="space-y-6">
              <h2 className="text-5xl md:text-7xl font-heading font-extrabold tracking-tight uppercase italic leading-[0.9] text-text-primary">
                YOU'RE ON <br />
                <span className="text-brand">THE LIST</span>
              </h2>
              <p className="max-w-md mx-auto text-[11px] md:text-[12px] font-black text-text-muted uppercase tracking-[0.4em] leading-loose opacity-60">
                Welcome to the protocol. We'll reach out to you as soon as we're ready to onboard new users.
              </p>
            </div>
            <div className="pt-10">
              <button
                onClick={() => setIsSubmitted(false)}
                className="text-[10px] font-black text-brand uppercase tracking-[0.3em] hover:underline transition-all"
              >
                GO BACK
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-32 opacity-20 hover:opacity-40 transition-opacity">
          <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.6em]">
            © 2026 LUMI PROTOCOL — ARCHIVING THE STORY
          </p>
        </div>
      </div>
    </div>
  );
}
