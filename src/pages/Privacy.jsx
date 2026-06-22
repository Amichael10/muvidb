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
            Last Updated: June 2026
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 mt-16 space-y-10 leading-relaxed font-sans text-text-secondary">

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">1. Overview</h2>
          <p>
            MuviDB ("MuviDB", "we", "us", or "our") operates an online Nollywood and African
            film database where members can discover films, rate and review them, build
            watchlists, follow talent, and — for industry professionals — claim their public
            talent profile. This Privacy Policy explains what personal information we collect,
            why we collect it, how we use and share it, how long we keep it, and the rights you
            have over it.
          </p>
          <p>
            This Policy is written to align with the <strong>Nigeria Data Protection Act 2023
            (NDPA)</strong> and the Nigeria Data Protection Regulation, and — for users in the
            European Economic Area and the United Kingdom — the <strong>EU/UK General Data
            Protection Regulation (GDPR)</strong>. By creating an account or using MuviDB, you
            acknowledge the practices described here.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">2. Information We Collect</h2>
          <p>
            We aim to collect only what we need to run the service. The categories below
            reflect what MuviDB actually collects today.
          </p>

          <h3 className="text-base font-bold text-text-primary pt-2">a. Account information</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Name</strong> — the name you provide at sign-up (or the name supplied by Google if you sign in with Google).</li>
            <li><strong>Email address</strong> — used to create your account, verify it, sign you in, and contact you about your account.</li>
            <li><strong>Password</strong> — when you register with email and password, your password is securely hashed and stored by our authentication provider. We never see or store your password in plain text.</li>
            <li><strong>Profile photo (avatar)</strong> — optional; this may be a picture you upload or the profile picture provided by Google when you sign in with Google.</li>
          </ul>

          <h3 className="text-base font-bold text-text-primary pt-2">b. Content and activity you create</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Ratings and reviews</strong> — the star ratings and written review text you submit for films.</li>
            <li><strong>Watchlist</strong> — the films you save to watch.</li>
            <li><strong>Follows</strong> — the actors, directors, and other talent you choose to follow.</li>
            <li><strong>Suggestions</strong> — corrections or missing information you suggest about films and talent, so we can review and improve the database.</li>
          </ul>

          <h3 className="text-base font-bold text-text-primary pt-2">c. Technical and usage information (analytics)</h3>
          <p>
            When you use MuviDB, a third-party analytics provider automatically collects technical
            and usage information on our behalf so we can understand how the product is used and
            fix problems. This includes:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>IP address and approximate location</strong> — your location (typically at the city/region level) is estimated from your IP address. We do not collect precise GPS location.</li>
            <li><strong>Device and browser information</strong> — such as device type, operating system, browser, and screen size.</li>
            <li><strong>Usage data</strong> — pages you view, links and buttons you click, and the order in which you move through the site.</li>
            <li><strong>Error and diagnostic data</strong> — technical details captured when something goes wrong, so we can fix it.</li>
          </ul>
          <p>
            We use this analytics data only in aggregate to improve MuviDB. We do not record
            video-like replays of your screen activity, we do not use this data for advertising,
            and we never sell it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">3. How We Collect Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Directly from you</strong> — when you register, log in, write a review, build a watchlist, follow talent, or submit a profile claim.</li>
            <li><strong>Automatically</strong> — through cookies and similar technologies and our analytics provider, as you browse and interact with MuviDB.</li>
            <li><strong>From third-party sign-in</strong> — if you choose to sign in with a third-party provider such as Google, that provider shares your name, email address, and profile picture with us so we can create or access your account.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">4. How We Use Your Information</h2>
          <p>We use the information described above to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Create, secure, and maintain your account and authenticate your sign-in.</li>
            <li>Publish your ratings, reviews, and (where you make them public) your watchlists and follows.</li>
            <li>Review the suggestions you submit to keep the database accurate and complete.</li>
            <li>Personalise your experience, such as recommendations and content rows.</li>
            <li>Understand how MuviDB is used, measure performance, and improve features.</li>
            <li>Detect, investigate, and prevent abuse, fraud, security incidents, and policy violations.</li>
            <li>Communicate with you about your account, including service and security notices.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">5. Our Legal Bases for Processing</h2>
          <p>
            Under the NDPA and GDPR, we rely on the following legal bases:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Performance of a contract</strong> — to provide the account and services you sign up for (e.g. storing your reviews, watchlist, and profile).</li>
            <li><strong>Consent</strong> — for analytics, session recording, and non-essential cookies. Where consent is the basis, you may withdraw it at any time.</li>
            <li><strong>Legitimate interests</strong> — to keep the platform secure, prevent abuse, and improve our service, balanced against your rights and freedoms.</li>
            <li><strong>Legal obligation</strong> — where we must process or disclose information to comply with applicable law.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">6. Cookies & Analytics</h2>
          <p>
            We use cookies and similar local-storage technologies that are necessary to keep you
            signed in and to remember your preferences, as well as analytics cookies used to
            measure usage. You can control or delete cookies through your browser settings;
            disabling essential cookies may prevent parts of MuviDB from working correctly.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">7. Information Sharing & Service Providers</h2>
          <p>
            <strong>We do not sell your personal information.</strong> We share data only in the
            following circumstances:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Public content.</strong> Your display name, profile photo, and the reviews and ratings you post are visible to other visitors of MuviDB. Please do not include information in a review that you do not want to be public.</li>
            <li><strong>Service providers (data processors) who operate the platform on our behalf:</strong>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>A <strong>hosting and authentication provider</strong> — to store your data securely and manage sign-in.</li>
                <li>An <strong>analytics provider</strong> — to measure usage and track errors.</li>
                <li>A <strong>third-party sign-in provider</strong> — only if you choose to sign in with it (e.g. Google).</li>
                <li>A <strong>film metadata provider</strong> — which supplies film information; we send no personal information to it.</li>
              </ul>
            </li>
            <li><strong>Legal and safety.</strong> We may disclose information where required by law, regulation, or valid legal process, or to protect the rights, safety, and security of MuviDB, our users, or the public.</li>
            <li><strong>Business transfers.</strong> If MuviDB is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction, subject to this Policy.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">8. International Data Transfers</h2>
          <p>
            MuviDB is operated from Nigeria, but some of our service providers store and process
            data on servers located outside Nigeria, including in the United States. When your
            information is transferred across borders, we take steps
            to ensure it remains protected to a standard consistent with the NDPA and GDPR,
            including relying on providers that offer appropriate safeguards and contractual
            data-protection commitments.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">9. Data Retention</h2>
          <p>
            We keep your account information and the content you create for as long as your
            account remains active. Analytics data and session recordings are retained only for
            as long as needed for the purposes described above, after which they are deleted or
            anonymised in line with our provider's retention settings. When you delete your
            account, we delete or anonymise your personal information, except where we are
            required to keep certain records to comply with the law or to resolve disputes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">10. Data Security</h2>
          <p>
            We maintain administrative, technical, and organisational safeguards designed to
            protect your information — including HTTPS encryption in transit, hashed passwords,
            token-based access controls, and row-level security on our database. No method of
            transmission or storage is completely secure, so while we work hard to protect your
            information, we cannot guarantee absolute security.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">11. Your Rights</h2>
          <p>
            Subject to applicable law, you have the right to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Access</strong> — request a copy of the personal information we hold about you.</li>
            <li><strong>Rectification</strong> — ask us to correct inaccurate or incomplete information.</li>
            <li><strong>Erasure</strong> — request deletion of your personal information ("right to be forgotten").</li>
            <li><strong>Restriction & objection</strong> — ask us to limit or stop certain processing, including analytics and session recording.</li>
            <li><strong>Portability</strong> — receive your data in a structured, commonly used, machine-readable format.</li>
            <li><strong>Withdraw consent</strong> — withdraw consent at any time where we rely on it, without affecting processing already carried out.</li>
          </ul>
          <p>
            You can update your details or request account deletion from your Dashboard, or by
            contacting us using the details below. If you are in Nigeria and believe your data
            rights have been breached, you may lodge a complaint with the Nigeria Data Protection
            Commission (NDPC). If you are in the EEA or UK, you may complain to your local data
            protection authority.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">12. Children's Privacy</h2>
          <p>
            MuviDB is not directed to children under the age of 13 (or the minimum age required in
            your jurisdiction), and we do not knowingly collect personal information from them. If
            you believe a child has provided us with personal information, please contact us and
            we will take steps to delete it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">13. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we make material changes, we
            will update the "Last Updated" date above and, where appropriate, notify you. Your
            continued use of MuviDB after an update means you accept the revised Policy.
          </p>
        </section>

        <section className="space-y-4 border-t border-border pt-8 text-center text-xs text-text-muted">
          <p>
            For questions about this Policy or to exercise your data rights, contact us at
            {' '}<a href="mailto:support@muvidb.com" className="text-brand hover:underline">support@muvidb.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
