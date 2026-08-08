import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

/**
 * Privacy Policy aligned to the Nigeria Data Protection Act 2023 (NDPA)
 * and the NDPC General Application and Implementation Directive (GAID) 2025.
 * This is a transparency notice for data subjects (NDPA s.27 / GAID Art. 27).
 * It does not replace registration, audits, DPIAs, or other controller duties.
 */
export default function Privacy() {
  useEffect(() => {
    document.title = 'MuviDB | Privacy Policy';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="w-full min-h-screen bg-bg text-text-primary pb-24">
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 py-16 pt-32 relative z-10 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-brand text-xs font-bold uppercase tracking-widest hover:gap-3 transition-all mb-6"
          >
            <Icon icon="solar:alt-arrow-left-linear" /> Back to Home
          </Link>
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-text-primary tracking-tighter mb-4">
            Privacy Policy
          </h1>
          <p className="text-text-muted text-xs uppercase tracking-widest font-bold opacity-60">
            Last updated: August 2026
          </p>
          <p className="mt-3 text-text-muted text-xs max-w-lg mx-auto leading-relaxed">
            Written to meet transparency duties under the Nigeria Data Protection Act 2023
            (NDPA) and the NDPC GAID 2025.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-16 space-y-10 leading-relaxed font-sans text-text-secondary">

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            1. Who we are (data controller)
          </h2>
          <p>
            MuviDB (&quot;MuviDB&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates an online Nollywood and African
            film database. For the purposes of the <strong>Nigeria Data Protection Act 2023
            (NDPA)</strong>, MuviDB is the <strong>data controller</strong> of personal data
            processed through this website and related services.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Controller:</strong> MuviDB
            </li>
            <li>
              <strong>Place of business / operations:</strong> Nigeria
            </li>
            <li>
              <strong>Privacy contact (internal redress):</strong>{' '}
              <a href="mailto:privacy@muvidb.com" className="text-brand hover:underline">
                privacy@muvidb.com
              </a>{' '}
              (or{' '}
              <a href="mailto:support@muvidb.com" className="text-brand hover:underline">
                support@muvidb.com
              </a>
              )
            </li>
          </ul>
          <p>
            This Policy explains what personal data we collect, why, the lawful basis we rely
            on, who receives it, how long we keep it, your rights, and how to complain. Reading
            or acknowledging this Policy is <strong>not</strong> the same as giving consent.
            Where the NDPA requires consent, we ask for it separately (for example, via our
            cookie banner for optional analytics).
          </p>
          <p>
            The NDPA and the Nigeria Data Protection Commission&apos;s{' '}
            <strong>General Application and Implementation Directive (GAID) 2025</strong> are
            the primary Nigerian framework we follow. The former Nigeria Data Protection
            Regulation (NDPR) 2019 has been superseded for these purposes. Where relevant for
            visitors in the EEA or UK, we also describe practices consistently with the EU/UK
            GDPR.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            2. Personal data we collect
          </h2>
          <p>
            We aim to collect only what is adequate, relevant, and limited to what we need
            (NDPA data-minimisation principle). Categories we process today:
          </p>

          <h3 className="text-base font-bold text-text-primary pt-2">a. Account information</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Name</strong> — provided at sign-up, or supplied by Google if you use
              Google sign-in.
            </li>
            <li>
              <strong>Email address</strong> — to create your account, verify it, sign you in,
              and contact you about your account or security.
            </li>
            <li>
              <strong>Password</strong> — when you register with email/password, it is hashed
              and stored by our authentication provider. We do not store passwords in plain text.
            </li>
            <li>
              <strong>Profile photo (avatar)</strong> — optional; uploaded by you or provided
              by Google sign-in.
            </li>
          </ul>

          <h3 className="text-base font-bold text-text-primary pt-2">b. Content and activity you create</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Ratings, reactions, and reviews</strong> — star ratings, like/dislike
              reactions, and written review text.
            </li>
            <li>
              <strong>Watchlists and follows</strong> — films you save and talent you follow.
            </li>
            <li>
              <strong>Suggestions and contributions</strong> — corrections or missing
              information you submit about films, people, or related catalogue data.
            </li>
            <li>
              <strong>Profile claims</strong> — information you submit when claiming a public
              talent profile (for verification).
            </li>
          </ul>

          <h3 className="text-base font-bold text-text-primary pt-2">c. Technical and usage information</h3>
          <p>
            When you use MuviDB, our systems and (where you consent) our analytics provider may
            process:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>IP address and approximate location</strong> — typically city/region
              level from IP. We do not collect precise GPS location.
            </li>
            <li>
              <strong>Device and browser information</strong> — device type, OS, browser, screen
              size.
            </li>
            <li>
              <strong>Usage data</strong> — pages viewed, clicks, and navigation paths.
            </li>
            <li>
              <strong>Error and diagnostic data</strong> — technical details when something
              fails, so we can fix it.
            </li>
          </ul>
          <p>
            We do not sell personal data, do not use analytics for advertising networks, and do
            not run video-style session replays of your screen.
          </p>

          <h3 className="text-base font-bold text-text-primary pt-2">d. Sensitive personal data</h3>
          <p>
            We do not intentionally collect sensitive personal data (such as health, biometric,
            genetic, religious, or political data as defined under the NDPA). Please do not put
            sensitive information in reviews or profile text. If you do, we may delete it when we
            become aware of it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            3. How we collect information
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Directly from you</strong> — registration, login, reviews, watchlists,
              follows, contributions, claims, and contact messages.
            </li>
            <li>
              <strong>Automatically</strong> — essential cookies/local storage for sign-in and
              preferences; optional analytics cookies only after you accept.
            </li>
            <li>
              <strong>From third-party sign-in</strong> — if you choose Google sign-in, Google
              shares your name, email, and profile picture so we can create or access your
              account.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            4. Purposes and lawful bases (NDPA s.25)
          </h2>
          <p>
            Under the NDPA, every processing activity needs a specific lawful basis. We rely on
            the following:
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2/40 text-text-primary text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-bold">Purpose</th>
                  <th className="px-4 py-3 font-bold">Lawful basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3">
                    Create and maintain your account; authenticate sign-in; store reviews,
                    watchlists, follows, and contributions you choose to make
                  </td>
                  <td className="px-4 py-3">
                    <strong>Contract</strong> — necessary to provide the service you request
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    Publish public profile elements (display name, avatar, reviews/ratings you
                    post)
                  </td>
                  <td className="px-4 py-3">
                    <strong>Contract</strong> and your choice to post public content
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    Review profile claims and catalogue suggestions; keep the database accurate
                  </td>
                  <td className="px-4 py-3">
                    <strong>Contract</strong> / <strong>legitimate interests</strong> — running
                    a reliable film database
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    Security, fraud prevention, abuse detection, and debugging
                  </td>
                  <td className="px-4 py-3">
                    <strong>Legitimate interests</strong> — protecting users and the platform
                    (balanced against your rights)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    Service and security notices about your account
                  </td>
                  <td className="px-4 py-3">
                    <strong>Contract</strong> / <strong>legitimate interests</strong>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    Optional product analytics (usage measurement to improve MuviDB)
                  </td>
                  <td className="px-4 py-3">
                    <strong>Consent</strong> — via cookie banner; withdraw anytime
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    Light personalisation (e.g. content rows or recommendations based on on-site
                    activity)
                  </td>
                  <td className="px-4 py-3">
                    <strong>Legitimate interests</strong> — improving relevance; you may object
                    (see §9)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    Comply with law or valid legal process
                  </td>
                  <td className="px-4 py-3">
                    <strong>Legal obligation</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Where we rely on consent, you may withdraw it at any time without affecting
            processing that was lawful before withdrawal. Silence or inactivity is not consent.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            5. Cookies and analytics
          </h2>
          <p>
            We use essential cookies and similar technologies needed to keep you signed in and
            remember basic preferences. Optional analytics cookies run only if you accept them
            in our consent banner. You can change your choice anytime via &quot;Cookie settings&quot; in
            the footer.
          </p>
          <p>
            You can also control cookies in your browser. Blocking essential cookies may break
            sign-in or other core features.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            6. Who we share data with (recipients)
          </h2>
          <p>
            <strong>We do not sell your personal data.</strong> We share it only as follows:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Public content.</strong> Your display name, avatar, and reviews/ratings
              you post are visible to visitors. Do not put private information in public posts.
            </li>
            <li>
              <strong>Service providers (processors)</strong> who process data on our
              instructions under written arrangements:
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>
                  <strong>Hosting and authentication</strong> (currently Supabase) — store
                  account and catalogue-related data; manage sign-in. Purpose: operate the
                  service securely.
                </li>
                <li>
                  <strong>Analytics</strong> (currently PostHog, only if you consent) — measure
                  usage and errors. Purpose: improve the product.
                </li>
                <li>
                  <strong>Sign-in provider</strong> (e.g. Google) — only if you choose that
                  sign-in method. Purpose: authenticate you.
                </li>
                <li>
                  <strong>Infrastructure / CDN / email</strong> providers as needed to deliver
                  the site and transactional messages.
                </li>
              </ul>
            </li>
            <li>
              <strong>Film metadata sources</strong> — used to enrich catalogue information; we
              do not send your personal account data to them for that purpose.
            </li>
            <li>
              <strong>Legal and safety</strong> — where required by law, regulation, or valid
              legal process, or to protect MuviDB, users, or the public.
            </li>
            <li>
              <strong>Business transfers</strong> — if MuviDB is involved in a merger,
              acquisition, or asset sale, data may transfer subject to this Policy and
              applicable law.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            7. International transfers
          </h2>
          <p>
            MuviDB is operated from Nigeria. Some processors store or process data outside
            Nigeria (for example, in the United States or the EU). When personal data is
            transferred from Nigeria to another country, we do so in line with NDPA Part VII
            (ss. 41–43), including by using providers that offer an adequate level of protection
            through law, contractual clauses, binding corporate rules, or other recognised
            safeguards, or where another NDPA condition for transfer applies. We keep a record
            of the basis for such transfers as required.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            8. Retention
          </h2>
          <p>
            We keep personal data only as long as needed for the purposes above, or as required
            by law (NDPA retention principle). Typical periods:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Account data and your content</strong> — for the life of your account.
              After you delete your account, we delete or anonymise personal data within a
              reasonable period (and aim to complete this within six months), except where we
              must keep records for legal claims, security, or compliance.
            </li>
            <li>
              <strong>Analytics data</strong> — retained according to our analytics
              provider&apos;s settings and only while useful for product improvement; then
              deleted or aggregated.
            </li>
            <li>
              <strong>Security and abuse logs</strong> — kept for a limited period needed to
              investigate incidents and protect the service.
            </li>
            <li>
              <strong>Incomplete sign-ups / unused claim materials</strong> — deleted when no
              longer needed, generally within six months if the relationship does not proceed,
              unless needed for legal claims.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            9. Automated decision-making and personalisation
          </h2>
          <p>
            We do <strong>not</strong> use automated decision-making that produces legal or
            similarly significant effects about you (for example, automated credit, employment,
            or access decisions).
          </p>
          <p>
            We may use limited on-site personalisation or recommendations based on browsing or
            account activity to surface relevant films. This does not significantly affect your
            legal rights. You may object to this processing by contacting us at the privacy
            email above, or by adjusting available in-product settings where offered.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            10. Security
          </h2>
          <p>
            We implement technical and organisational measures appropriate to the volume and
            sensitivity of the data we hold — including HTTPS in transit, hashed passwords,
            access controls, and database row-level security. No method of transmission or
            storage is perfectly secure; we work to protect your information but cannot
            guarantee absolute security.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            11. Personal data breaches
          </h2>
          <p>
            If we become aware of a personal data breach that is likely to result in a risk to
            individuals&apos; rights and freedoms, we will notify the{' '}
            <strong>Nigeria Data Protection Commission (NDPC)</strong> within{' '}
            <strong>72 hours</strong> of becoming aware of it, where required under NDPA s.40.
            If the breach is likely to result in a <strong>high risk</strong> to you, we will
            also inform affected data subjects without undue delay, in clear language, including
            steps you can take to protect yourself — or make a public notice if individual notice
            is not feasible.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            12. Your rights (NDPA Part VI)
          </h2>
          <p>Subject to the NDPA, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Access</strong> — obtain confirmation and a copy of personal data we hold
              about you.
            </li>
            <li>
              <strong>Rectification</strong> — correct inaccurate or incomplete data.
            </li>
            <li>
              <strong>Erasure</strong> — request deletion where the Act allows (&quot;right to be
              forgotten&quot;).
            </li>
            <li>
              <strong>Restriction and objection</strong> — limit or object to certain processing,
              including processing based on legitimate interests and personalisation.
            </li>
            <li>
              <strong>Data portability</strong> — receive data you provided in a structured,
              commonly used, machine-readable format, where applicable.
            </li>
            <li>
              <strong>Withdraw consent</strong> — where processing is based on consent, without
              affecting earlier lawful processing.
            </li>
          </ul>
          <p>
            <strong>How to exercise your rights:</strong> update details or request deletion from
            your Dashboard where available, or email{' '}
            <a href="mailto:privacy@muvidb.com" className="text-brand hover:underline">
              privacy@muvidb.com
            </a>{' '}
            /{' '}
            <a href="mailto:support@muvidb.com" className="text-brand hover:underline">
              support@muvidb.com
            </a>
            . We will respond within a reasonable time and in line with NDPA timelines.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            13. Complaints
          </h2>
          <p>
            <strong>Internal redress:</strong> contact us first at{' '}
            <a href="mailto:privacy@muvidb.com" className="text-brand hover:underline">
              privacy@muvidb.com
            </a>{' '}
            so we can try to resolve your concern promptly.
          </p>
          <p>
            <strong>Regulator:</strong> if you are in Nigeria (or otherwise entitled under the
            NDPA) and believe your rights have been breached, you may lodge a complaint with the{' '}
            <strong>Nigeria Data Protection Commission (NDPC)</strong> under NDPA s.46. See{' '}
            <a
              href="https://ndpc.gov.ng"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              ndpc.gov.ng
            </a>{' '}
            for current complaint channels. EEA/UK residents may also contact their local
            supervisory authority.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            14. Children
          </h2>
          <p>
            Under the NDPA, a &quot;child&quot; has the meaning in the Child&apos;s Rights Act (generally
            under 18). MuviDB is not directed at children, and we do not knowingly create
            accounts for, or collect personal data from, persons under 18. If you believe a child
            has provided personal data to us, contact us and we will take steps to delete it.
            Nothing in this Policy authorises processing of a child&apos;s data inconsistently with
            the Child&apos;s Rights Act.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-heading font-black text-text-primary tracking-tight">
            15. Changes to this Policy
          </h2>
          <p>
            We may update this Policy to reflect changes in our practices or the law. We will
            revise the &quot;Last updated&quot; date above and, for material changes, take additional steps
            to notify you where appropriate (for example, a notice on the site or by email).
            Continued use after an update means you are informed of the revised Policy; it does
            not by itself create consent for processing that requires a fresh consent.
          </p>
        </section>

        <section className="space-y-4 border-t border-border pt-8 text-center text-xs text-text-muted">
          <p>
            Questions about this Policy or your data rights:{' '}
            <a href="mailto:privacy@muvidb.com" className="text-brand hover:underline">
              privacy@muvidb.com
            </a>
            {' · '}
            <a href="mailto:support@muvidb.com" className="text-brand hover:underline">
              support@muvidb.com
            </a>
          </p>
          <p className="pt-2">
            Related:{' '}
            <Link to="/terms" className="text-brand hover:underline">
              Terms of Service
            </Link>
            {' · '}
            <Link to="/contact" className="text-brand hover:underline">
              Contact
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
