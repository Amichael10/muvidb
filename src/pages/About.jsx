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
            MuviDB is your ultimate destination for discovering, tracking, and engaging with movies and TV shows from around the world. Our mission is to create a comprehensive and accessible database for film enthusiasts, professionals, and casual viewers alike.
          </p>
          
          <p>
            We believe that every great story deserves to be found. Whether you're looking for the latest cinema releases, free-to-watch YouTube films, or hidden gems on streaming platforms, MuviDB organizes everything in one intuitive platform.
          </p>
          
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
