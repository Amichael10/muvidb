import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

export default function Privacy() {
  useEffect(() => {
    document.title = "MuviDB | Privacy Policy";
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
            Privacy Policy
          </h1>
          <p className="text-text-muted text-xs uppercase tracking-widest font-bold opacity-60">
            Last Updated: May 2026
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 mt-16 space-y-10 leading-relaxed font-sans text-text-secondary">
        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">1. Overview</h2>
          <p>
            MuviDB ("we", "us", "our") values your privacy. This Privacy Policy describes how we collect, use, store, and share your personal information when you visit, register, or interact with our Nollywood database platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">2. Information We Collect</h2>
          <p>
            To provide our film database and curation services, we collect the following types of information:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account Information:</strong> Your name, email address, password, role preferences, and profile statistics submitted upon registration.</li>
            <li><strong>User Engagement Content:</strong> Movie ratings, review text, watchlist selections, and talent profiles you choose to follow.</li>
            <li><strong>Professional Portfolios:</strong> Identity verification details, bios, and headshots provided during claiming requests.</li>
            <li><strong>Technical Usage Details:</strong> IP addresses, browser types, session activity, and device identifiers collected automatically via browser cookies or analytics integrations.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">3. How We Use Your Information</h2>
          <p>
            We process your personal information to deliver a high-quality Nollywood discovery experience, specifically to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Create and maintain your user account.</li>
            <li>Render your public reviews, custom ratings, and curated lists.</li>
            <li>Process and audit professional profile claim requests.</li>
            <li>Personalize recommendations, horizontal rows, and newsletter digests.</li>
            <li>Monitor security, prevent abuse, and optimize server performance.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">4. Information Sharing & Third Parties</h2>
          <p>
            MuviDB will never sell your personal information. We only share details in specific, necessary circumstances:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Public Profiles:</strong> Your username, public reviews, and shared watchlists are visible to visitors to foster community interactions.</li>
            <li><strong>Database Hosting:</strong> We utilize secure database hosting providers (like Supabase and PostgreSQL) to store data safely.</li>
            <li><strong>Legal Requirements:</strong> We may disclose information if required to comply with regulatory authorities, laws, or active investigations.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">5. Data Retention & Security</h2>
          <p>
            We maintain robust administrative, physical, and technical safeguards (including HTTPS encryption and token-based access controls) to protect your information against unauthorized access, loss, or disclosure.
          </p>
          <p>
            Your account data is kept as long as your account remains active. You can request account deletion or change your details at any time inside your Dashboard.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">6. Your Rights</h2>
          <p>
            Depending on your jurisdiction, you have specific rights regarding your personal data:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The right to access and receive a copy of your personal data.</li>
            <li>The right to request rectification of inaccurate data.</li>
            <li>The right to request data erasure ("Right to be Forgotten").</li>
            <li>The right to withdraw consent for emails or digests.</li>
          </ul>
        </section>

        <section className="space-y-4 border-t border-border pt-8 text-center text-xs text-text-muted">
          <p>If you wish to exercise your rights or ask questions about our privacy policies, please contact support@muvidb.com.</p>
        </section>
      </div>
    </div>
  );
}
