import { useEffect } from 'react';

const About = () => {
  useEffect(() => {
    document.title = 'About Us | MuviDB';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="max-w-4xl mx-auto px-4 py-32">
        <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tighter mb-8">
          About <span className="text-brand">MuviDB</span>
        </h1>
        
        <div className="space-y-8 text-lg text-text-muted leading-relaxed">
          <p>
            MuviDB is a Nollywood and African film database. Fans use it to discover movies and TV
            shows, cinema showtimes, streaming availability, cast and crew, ratings, and free
            YouTube titles. Professionals can claim talent profiles and keep their credits up to date.
          </p>

          <p>
            We organize African cinema in one place — latest releases, free-to-watch YouTube films,
            and titles on platforms like Netflix, Prime Video, and others — so every story is easier
            to find.
          </p>

          <div className="bg-surface border border-border p-8 rounded-xl space-y-4">
            <h2 className="text-2xl font-heading font-bold text-text-primary">Google services we use</h2>
            <p className="text-base">
              <strong className="text-text-primary">Google Sign-In</strong> — optional account
              creation; we receive your name, email, and profile photo only if you choose to sign in
              with Google.
            </p>
            <p className="text-base">
              <strong className="text-text-primary">YouTube Data API</strong> — public catalogue
              metadata (titles, thumbnails, statistics, channel information) so MuviDB can list free
              African films and trailers. We do not access private YouTube account data.
            </p>
            <p className="text-base">
              Details are in our{' '}
              <a href="/privacy" className="text-brand font-bold hover:underline">Privacy Policy</a>
              {' '}and{' '}
              <a href="/terms" className="text-brand font-bold hover:underline">Terms</a>.
            </p>
          </div>

          <div className="bg-surface border border-border p-8 rounded-xl mt-12">
            <h2 className="text-2xl font-heading font-bold text-text-primary mb-4">Connect With Us</h2>
            <p className="mb-6">
              Join our growing community of film lovers and creators. Follow us on social media for the latest updates, recommendations, and behind-the-scenes content.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="https://twitter.com/muvidb_" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-surface-2 hover:bg-surface border border-border hover:border-brand px-6 py-3 rounded-lg font-bold text-sm transition-all group"
              >
                <span className="text-brand group-hover:scale-110 transition-transform">𝕏</span>
                Follow @muvidb_ on X (Twitter)
              </a>
              <a 
                href="https://instagram.com/muvidb_" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-surface-2 hover:bg-surface border border-border hover:border-brand px-6 py-3 rounded-lg font-bold text-sm transition-all group"
              >
                <span className="text-brand group-hover:scale-110 transition-transform">IG</span>
                Follow @muvidb_ on Instagram
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
