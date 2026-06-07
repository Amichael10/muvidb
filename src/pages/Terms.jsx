import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

export default function Terms() {
  useEffect(() => {
    document.title = "MuviDB | Terms of Service";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="w-full min-h-screen bg-bg text-text-primary pb-24">
      {/* Header Banner */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-4 py-16 pt-32 relative z-10 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-brand text-xs font-bold uppercase tracking-widest hover:gap-3 transition-all mb-6">
            <Icon icon="solar:alt-arrow-left-linear" /> Back to Home
          </Link>
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-text-primary tracking-tighter mb-4">
            Terms of Service
          </h1>
          <p className="text-text-muted text-xs uppercase tracking-widest font-bold opacity-60">
            Last Updated: May 2026
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 mt-16 space-y-10 leading-relaxed font-sans text-text-secondary">
        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">1. Agreement to Terms</h2>
          <p>
            Welcome to MuviDB ("Platform", "we", "us", "our"). By accessing or using our platform, website, and services, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">2. User Accounts</h2>
          <p>
            To access certain features of MuviDB, including rating films, writing reviews, following talent, and managing watchlists, you must create a user account. You agree to provide accurate, current, and complete information during registration and to update such information as necessary to maintain its accuracy.
          </p>
          <p>
            You are entirely responsible for maintaining the confidentiality of your account credentials and for any activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">3. Community Guidelines & Content</h2>
          <p>
            MuviDB is a collaborative platform dedicated to celebrating Nollywood. When posting reviews, comments, ratings, or biographical details, you agree to abide by the following guidelines:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>No offensive, defamatory, harassing, or abusive content.</li>
            <li>No intellectual property violations. Only submit ratings and reviews that are your own original thoughts.</li>
            <li>No commercial promotions, spam, or advertisements.</li>
            <li>Respect other members of the community, even during passionate debates about cinematic works.</li>
          </ul>
          <p>
            We reserve the right, in our sole discretion, to remove any user-submitted content that violates these guidelines or is otherwise objectionable, and to suspend or terminate user accounts for repeated violations.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">4. Intellectual Property</h2>
          <p>
            All content on MuviDB, including text, logos, trademarks, wordmarks, graphics, code, and database arrangements (excluding user-submitted reviews and standard movie posters/trailers sourced externally), is the property of MuviDB or its licensors and is protected by intellectual property laws.
          </p>
          <p>
            Movie metadata, posters, and trailers are displayed under fair-use guidelines for educational and search/indexing purposes. Users may not scrape, copy, or redistribute database contents without explicit permission from us.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">5. Professional Profiles & Claiming</h2>
          <p>
            MuviDB features professional profiles for actors, directors, producers, and crew members. Verified industry professionals may "Claim" their profile to manage their portfolio, upload bio details, and curate their credits.
          </p>
          <p>
            Claim requests are manually audited. We reserve the right to reject claim applications that fail to verify identity, or to revoke claims if false details are provided.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">6. Limitation of Liability</h2>
          <p>
            MuviDB is provided on an "as-is" and "as-available" basis. We make no warranties, express or implied, regarding the accuracy, completeness, availability, or security of the database or services. We will not be liable for any damages resulting from your use or inability to use the platform.
          </p>
        </section>

        <section className="space-y-4 border-t border-border pt-8 text-center text-xs text-text-muted">
          <p>If you have any questions regarding these Terms, please contact us at support@muvidb.com.</p>
        </section>
      </div>
    </div>
  );
}
