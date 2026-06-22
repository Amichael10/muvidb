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
            Last Updated: June 2026
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 mt-16 space-y-10 leading-relaxed font-sans text-text-secondary">

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">1. Agreement to These Terms</h2>
          <p>
            Welcome to MuviDB ("MuviDB", "Platform", "we", "us", or "our"), an online database
            for discovering, rating, and exploring Nollywood and African film. These Terms of
            Service ("Terms") govern your access to and use of our website and services. By
            accessing or using MuviDB, creating an account, or clicking to accept these Terms,
            you agree to be bound by them. If you do not agree, you may not use the Platform.
          </p>
          <p>
            These Terms incorporate our <Link to="/privacy" className="text-brand hover:underline font-bold">Privacy Policy</Link> by
            reference. Please read it to understand how we handle your personal information.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">2. Eligibility</h2>
          <p>
            You must be at least 13 years old (or the minimum age of digital consent in your
            jurisdiction) to use MuviDB, and old enough to form a binding contract. By using the
            Platform, you represent that you meet these requirements and that the information you
            provide is accurate and truthful.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">3. The Service</h2>
          <p>
            MuviDB lets you browse a database of films and talent, rate and review films, react to
            films, build watchlists, follow actors and crew, and suggest corrections or missing
            information about films and talent. We may add, change, suspend, or remove features at
            any time. Some features require a registered account.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">4. Accounts & Security</h2>
          <p>
            To use certain features you must create an account, either with your email and a
            password or through a third-party sign-in such as Google. You agree to provide
            accurate, current, and complete information and to keep it up to date.
          </p>
          <p>
            You are responsible for safeguarding your account credentials and for all activity
            that occurs under your account. Notify us promptly at support@muvidb.com if you
            suspect any unauthorized use. We are not liable for losses arising from your failure
            to protect your credentials.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">5. Your Reviews, Ratings & Suggestions</h2>
          <p>
            As a member you can rate films, write reviews, react to films (such as likes and
            dislikes), build watchlists, and suggest corrections or missing information about
            films and talent. You keep ownership of the words you write.
          </p>
          <p>
            By posting a review, rating, or suggestion, you simply allow MuviDB to store and
            display it on the Platform so that your contribution can appear on the relevant pages.
            You are responsible for what you post and agree that it is your own, is accurate to
            the best of your knowledge, and does not break the law or infringe anyone's rights.
          </p>
          <p>
            Suggestions are submitted to help us improve the accuracy and completeness of the
            database. We may review, edit, decline, or remove contributions — for example, to
            correct information or to take down content that breaks these Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">6. Acceptable Use & Community Guidelines</h2>
          <p>
            MuviDB is a collaborative community celebrating African cinema. When using the
            Platform, you agree not to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Post content that is offensive, defamatory, hateful, harassing, threatening, or abusive.</li>
            <li>Submit false, misleading, or impersonating information, including fake reviews or suggestions.</li>
            <li>Infringe anyone's intellectual property, privacy, or other rights.</li>
            <li>Post spam, commercial promotions, or advertisements without our permission.</li>
            <li>Scrape, crawl, copy, or harvest the database or any content except as expressly permitted by us.</li>
            <li>Attempt to gain unauthorized access to the Platform, other accounts, or our systems, or interfere with the service's security or operation.</li>
            <li>Use automated means or bots to access the Platform in a way that burdens our infrastructure.</li>
          </ul>
          <p>
            We may, at our discretion, remove content that violates these Terms or is otherwise
            objectionable, and suspend or terminate accounts for repeated or serious violations.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">7. Intellectual Property</h2>
          <p>
            The MuviDB name, logo, wordmarks, design, software, and the selection and arrangement
            of the database are owned by MuviDB or its licensors and are protected by applicable
            laws. Except for your own User Content, you may not copy, modify, distribute, or
            create derivative works from the Platform without our written permission.
          </p>
          <p>
            Film titles, synopses, posters, trailers, and related metadata are the property of
            their respective owners and are presented for informational, educational, and
            indexing purposes. Where film data is sourced from third parties, it remains subject
            to those parties' terms. If you believe content on MuviDB infringes your rights,
            contact us at support@muvidb.com and we will review the matter.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">8. Third-Party Content & Links</h2>
          <p>
            The Platform may display or link to third-party content and services, such as video
            trailers, streaming availability, cinema showtimes, and external websites. We do not
            control, endorse, or assume responsibility for third-party content, and your use of
            such services is governed by the relevant third party's own terms and policies.
            Showtimes, prices, and streaming availability are provided for convenience and may be
            inaccurate or out of date.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">9. Disclaimers</h2>
          <p>
            MuviDB is provided on an "as is" and "as available" basis. While we work to keep our
            film and talent data accurate, we make no warranties — express or implied — about the
            accuracy, completeness, reliability, availability, or security of the Platform or its
            content. Your use of the Platform is at your own risk.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">10. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, MuviDB and its operators will not be liable
            for any indirect, incidental, special, consequential, or punitive damages, or for any
            loss of data, profits, or goodwill, arising from your use of or inability to use the
            Platform. Nothing in these Terms excludes liability that cannot lawfully be excluded.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">11. Indemnification</h2>
          <p>
            You agree to indemnify and hold MuviDB and its operators harmless from any claims,
            damages, losses, or expenses (including reasonable legal fees) arising out of your
            User Content, your use of the Platform, or your breach of these Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">12. Suspension & Termination</h2>
          <p>
            You may stop using MuviDB and delete your account at any time from your Dashboard. We
            may suspend or terminate your access if you breach these Terms, if required by law, or
            to protect the Platform and its users. Provisions that by their nature should survive
            termination — including intellectual property, disclaimers, limitation of liability,
            and indemnification — will continue to apply.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">13. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. When we make material changes, we will
            update the "Last Updated" date above and, where appropriate, notify you. Your
            continued use of MuviDB after changes take effect means you accept the revised Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">14. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the Federal Republic of Nigeria, without
            regard to its conflict-of-law rules. Subject to any mandatory rights you have under
            the law of your country of residence, you agree that the courts of Nigeria will have
            jurisdiction over any dispute arising from these Terms or your use of the Platform.
          </p>
        </section>

        <section className="space-y-4 border-t border-border pt-8 text-center text-xs text-text-muted">
          <p>
            If you have any questions about these Terms, please contact us at
            {' '}<a href="mailto:support@muvidb.com" className="text-brand hover:underline">support@muvidb.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
