import * as React from 'react';
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

export type FeatureKey = 'whatsapp' | 'linkinbio' | 'roundup';

export interface HighlightItem {
  icon?: string;
  title: string;
  description: string;
}

export interface StepItem {
  step: string;
  title: string;
  description: string;
}

export interface MuviDbFeatureAnnouncementEmailProps {
  firstName?: string;
  featureKey?: FeatureKey;
  logoUrl?: string;
  preview?: string;
  categoryBadge?: string;
  eyebrow?: string;
  headline?: React.ReactNode;
  intro?: string;
  mockupDetails?: {
    posterUrl?: string;
    personPhotoUrl?: string;
    personName?: string;
    handle?: string;
    filmTitle?: string;
  };
  highlights?: HighlightItem[];
  steps?: StepItem[];
  calloutTitle?: string;
  calloutText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  exploreUrl?: string;
  helpUrl?: string;
  unsubscribeUrl?: string;
  social?: {
    instagram?: string;
    x?: string;
    tiktok?: string;
    linkedin?: string;
  };
}

const ORANGE = '#FF5A1F';
const TEXT = '#111315';
const MUTED = '#4B5563';
const LIGHT_BG = '#F9FAFB';
const BORDER_COLOR = '#E5E7EB';
const GREEN = '#25D366';

export const FEATURE_PRESETS = {
  whatsapp: {
    categoryBadge: '✨ NEW FEATURE',
    eyebrow: 'INSTANT WHATSAPP ALERTS',
    headline: (
      <>
        Never miss a premiere from your favourite actors & directors
        <span style={{ color: ORANGE }}>.</span>
      </>
    ),
    preview: 'Get instant WhatsApp alerts when African filmmakers drop new movies & trailers 🍿',
    intro:
      'You no longer need to hunt across scattered social media feeds to find out when new Nollywood and African cinema projects drop. With MuviDB WhatsApp Movie Alerts, you get trailer drops, premiere dates, and where-to-watch links delivered straight to your WhatsApp — the moment they go live.',
    ctaLabel: 'Turn On WhatsApp Alerts →',
    ctaUrl: 'https://muvidb.com/dashboard',
    secondaryCtaLabel: 'Explore African Cinema',
    secondaryCtaUrl: 'https://muvidb.com',
    calloutTitle: 'Zero-Spam Guarantee',
    calloutText:
      'Following 4 actors who star in the same new movie? Our intelligent deduplicator ensures you get exactly one beautiful alert with the official poster and streaming links — never spam.',
    highlights: [
      {
        title: 'Instant Premiere & Trailer Drops',
        description:
          'Be the first to see trailers, teaser drops, and theatrical release dates for the African stars and creators you follow.',
      },
      {
        title: 'Where to Watch Included',
        description:
          'Get direct links to cinema showtimes and official streaming platforms (Netflix, Prime Video, Showmax, YouTube) with every alert.',
      },
      {
        title: '1-Click Follow Across MuviDB',
        description:
          'Simply tap "Follow" on any filmmaker, actor, or crew profile on MuviDB and alerts begin automatically.',
      },
    ],
    steps: [
      {
        step: '01',
        title: 'Add your WhatsApp number',
        description: 'Save your phone number in your MuviDB profile settings in 10 seconds.',
      },
      {
        step: '02',
        title: 'Follow your favourite talent',
        description: 'Browse actors, directors, writers, and producers across the continent.',
      },
      {
        step: '03',
        title: 'Receive movie alerts',
        description: 'Get verified release alerts, trailers, and showtimes directly on WhatsApp.',
      },
    ],
  },
  linkinbio: {
    categoryBadge: '✨ NEW FOR CREATORS',
    eyebrow: 'MUVIDB LINK IN BIO',
    headline: (
      <>
        One verified link for your entire African cinema career
        <span style={{ color: ORANGE }}>.</span>
      </>
    ),
    preview: 'Introducing MuviDB Portfolios — The ultimate Link-in-Bio for African film talent 🎬',
    intro:
      'Say goodbye to cluttered generic link trees and outdated PDF resumes. MuviDB Link-in-Bio gives actors, directors, writers, cinematographers, and crew a cinematic personal portfolio page powered by verified industry credits.',
    ctaLabel: 'Claim Your Link-in-Bio Handle →',
    ctaUrl: 'https://muvidb.com/claim',
    secondaryCtaLabel: 'View Portfolio Showcase',
    secondaryCtaUrl: 'https://muvidb.com/portfolio/tomiwa',
    calloutTitle: 'Your Clean Personal @handle',
    calloutText:
      'Claim your direct handle (like muvidb.com/@yourname) to place directly into your Instagram, TikTok, and X bios. Show casting directors, producers, and fans exactly who you are.',
    highlights: [
      {
        title: 'Auto-Synced Verified Filmography',
        description:
          'Every movie and television credit you hold on MuviDB is automatically showcased with posters, roles, and streaming badges.',
      },
      {
        title: 'Embed Video Reel & Custom Links',
        description:
          'Feature your showreel or latest scene at the top of your page alongside custom links for press features, festival tickets, and socials.',
      },
      {
        title: 'Direct Booking & EPK Download',
        description:
          'Let casting directors and producers contact your reps via email/WhatsApp or download your Electronic Press Kit with 1 tap.',
      },
    ],
    steps: [
      {
        step: '01',
        title: 'Claim your profile',
        description: 'Search for your name on MuviDB and claim your official industry profile.',
      },
      {
        step: '02',
        title: 'Customize your portfolio',
        description: 'Pick your theme (Midnight, Gold, Neon, or Minimal), add your reel, and choose your @handle.',
      },
      {
        step: '03',
        title: 'Share your link',
        description: 'Add muvidb.com/@yourhandle to your Instagram, TikTok, and Twitter/X bios.',
      },
    ],
  },
  roundup: {
    categoryBadge: '⚡ PRODUCT UPDATE',
    eyebrow: 'WHAT’S NEW ON MUVIDB',
    headline: (
      <>
        Two game-changing updates for African film lovers and creators
        <span style={{ color: ORANGE }}>.</span>
      </>
    ),
    preview: 'New on MuviDB: Instant WhatsApp Movie Alerts + Creator Link-in-Bio Portfolios 🚀',
    intro:
      'We’ve just shipped two major features to make exploring, following, and working in African cinema seamless. Whether you watch African films or create them, here is everything new on MuviDB this month.',
    ctaLabel: 'Explore the New Features →',
    ctaUrl: 'https://muvidb.com/dashboard',
    secondaryCtaLabel: 'Learn More',
    secondaryCtaUrl: 'https://muvidb.com/about',
    calloutTitle: 'Built for the African Screen Ecosystem',
    calloutText:
      'Both features are designed specifically to eliminate friction — keeping fans instantly connected to real releases, while giving professionals the world-class digital presence they deserve.',
    highlights: [
      {
        title: '1. WhatsApp Movie & Premiere Alerts',
        description:
          'Get instant alerts on WhatsApp when actors and directors you follow release new movies, trailers, and cinema showtimes.',
      },
      {
        title: '2. Filmmaker Link-in-Bio Portfolios',
        description:
          'The verified portfolio for your social bio: auto-synced film credits, video reels, custom links, and direct booking inquiries.',
      },
      {
        title: '3. Zero-Duplicate Vetted Credits',
        description:
          'All credits are verified and synchronized directly with MuviDB’s comprehensive African cinema database.',
      },
    ],
    steps: [
      {
        step: '01',
        title: 'Sign in to MuviDB',
        description: 'Open your dashboard to manage your notifications and public presence.',
      },
      {
        step: '02',
        title: 'Enable WhatsApp alerts',
        description: 'Add your WhatsApp number to get release notifications for talent you follow.',
      },
      {
        step: '03',
        title: 'Claim your @handle portfolio',
        description: 'Launch your verified creator link-in-bio in just a few clicks.',
      },
    ],
  },
};

export default function MuviDbFeatureAnnouncementEmail({
  firstName = 'there',
  featureKey = 'whatsapp',
  logoUrl = 'https://muvidb.com/images/MuviDB%20Brand/Wordmark.png',
  preview,
  categoryBadge,
  eyebrow,
  headline,
  intro,
  mockupDetails,
  highlights,
  steps,
  calloutTitle,
  calloutText,
  ctaLabel,
  ctaUrl,
  secondaryCtaLabel,
  secondaryCtaUrl,
  exploreUrl = 'https://muvidb.com',
  helpUrl = 'https://muvidb.com/about',
  unsubscribeUrl = 'https://muvidb.com/dashboard',
  social = {
    instagram: 'https://www.instagram.com/muvidb_/',
    x: 'https://twitter.com/muvidb_',
    tiktok: 'https://www.tiktok.com/@muvidb',
    linkedin: 'https://www.linkedin.com/company/muvidb/',
  },
}: MuviDbFeatureAnnouncementEmailProps) {
  const preset = FEATURE_PRESETS[featureKey] || FEATURE_PRESETS.whatsapp;

  const resolvedPreview = preview || preset.preview;
  const resolvedBadge = categoryBadge || preset.categoryBadge;
  const resolvedEyebrow = eyebrow || preset.eyebrow;
  const resolvedHeadline = headline || preset.headline;
  const resolvedIntro = intro || (firstName ? `Hi ${firstName}, ${preset.intro.slice(0, 1).toLowerCase() + preset.intro.slice(1)}` : preset.intro);
  const resolvedHighlights = highlights || preset.highlights;
  const resolvedSteps = steps || preset.steps;
  const resolvedCalloutTitle = calloutTitle || preset.calloutTitle;
  const resolvedCalloutText = calloutText || preset.calloutText;
  const resolvedCtaLabel = ctaLabel || preset.ctaLabel;
  const resolvedCtaUrl = ctaUrl || preset.ctaUrl;
  const resolvedSecondaryCtaLabel = secondaryCtaLabel || preset.secondaryCtaLabel;
  const resolvedSecondaryCtaUrl = secondaryCtaUrl || preset.secondaryCtaUrl;

  return (
    <Html lang="en">
      <Head>
        <style>{`
          @media only screen and (max-width: 600px) {
            .mobile-container {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              border-radius: 0 !important;
            }
            .mobile-header {
              padding: 20px 18px 12px !important;
            }
            .mobile-hero {
              padding: 16px 18px 24px !important;
            }
            .mobile-heading {
              font-size: 26px !important;
              line-height: 32px !important;
            }
            .mobile-intro {
              font-size: 15px !important;
              line-height: 23px !important;
              margin: 14px 0 18px !important;
            }
            .mobile-btn {
              display: block !important;
              width: 100% !important;
              text-align: center !important;
              padding: 14px 20px !important;
              box-sizing: border-box !important;
              margin-bottom: 10px !important;
            }
            .mobile-sec-btn {
              display: block !important;
              width: 100% !important;
              text-align: center !important;
              padding: 12px 20px !important;
              box-sizing: border-box !important;
            }
            .mobile-mockup-wrapper {
              padding: 0 16px 20px !important;
            }
            .mobile-mockup-card {
              padding: 16px 14px !important;
              border-radius: 14px !important;
            }
            .mobile-highlights-section {
              padding: 22px 18px 26px !important;
            }
            .mobile-highlight-row {
              margin-bottom: 14px !important;
            }
            .mobile-highlight-card {
              padding: 14px 16px !important;
            }
            .mobile-steps-section {
              padding: 22px 18px 26px !important;
            }
            .mobile-step-col {
              display: block !important;
              width: 100% !important;
              margin-bottom: 12px !important;
            }
            .mobile-callout {
              margin: 20px 18px !important;
              padding: 18px 16px !important;
            }
            .mobile-footer {
              padding: 20px 18px 28px !important;
            }
          }
        `}</style>
      </Head>
      <Preview>{resolvedPreview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container} className="mobile-container">
          {/* Header */}
          <Section style={styles.header} className="mobile-header">
            <Row>
              <Column>
                <Img src={logoUrl} width="150" alt="MuviDB" style={styles.logo} />
              </Column>
              <Column align="right">
                <Link href={exploreUrl} style={styles.viewInBrowser}>
                  View in browser
                </Link>
              </Column>
            </Row>
          </Section>

          {/* Hero Section */}
          <Section style={styles.hero} className="mobile-hero">
            <Row>
              <Column>
                <div style={styles.badgeWrapper}>
                  <Text style={styles.categoryBadge}>{resolvedBadge}</Text>
                </div>
                <Text style={styles.eyebrow}>{resolvedEyebrow}</Text>
                <Heading style={styles.heading} className="mobile-heading">
                  {resolvedHeadline}
                </Heading>
                <Text style={styles.intro} className="mobile-intro">
                  {resolvedIntro}
                </Text>

                {/* Main CTA */}
                <Section style={{ marginTop: '20px', marginBottom: '8px' }}>
                  <Button href={resolvedCtaUrl} style={styles.button} className="mobile-btn">
                    {resolvedCtaLabel}
                  </Button>
                  {resolvedSecondaryCtaLabel && (
                    <Button
                      href={resolvedSecondaryCtaUrl}
                      style={styles.secondaryButton}
                      className="mobile-sec-btn"
                    >
                      {resolvedSecondaryCtaLabel}
                    </Button>
                  )}
                </Section>
              </Column>
            </Row>
          </Section>

          {/* Visual Mockup Section */}
          <Section style={styles.mockupWrapper} className="mobile-mockup-wrapper">
            {featureKey === 'whatsapp' ? (
              <WhatsAppMockupCard
                filmTitle={mockupDetails?.filmTitle || 'Lisabi: The Uprising'}
                actorName={mockupDetails?.personName || 'Lateef Adedimeji'}
                posterUrl={
                  mockupDetails?.posterUrl ||
                  'https://muvidb.com/images/film-placeholder.webp'
                }
              />
            ) : featureKey === 'linkinbio' ? (
              <PortfolioMockupCard
                personName={mockupDetails?.personName || 'Tomiwa Johnson'}
                handle={mockupDetails?.handle || 'tomiwa'}
                photoUrl={
                  mockupDetails?.personPhotoUrl ||
                  'https://muvidb.com/images/film-placeholder.webp'
                }
              />
            ) : (
              <RoundupMockupCard />
            )}
          </Section>

          {/* Feature Highlights Grid */}
          <Section style={styles.highlightsSection} className="mobile-highlights-section">
            <Text style={styles.sectionEyebrow}>KEY HIGHLIGHTS</Text>
            <Heading as="h3" style={styles.sectionTitle}>
              Designed for speed, clarity, and zero hassle
            </Heading>

            {resolvedHighlights.map((item, idx) => (
              <div key={idx} style={styles.highlightCard} className="mobile-highlight-card">
                <Text style={styles.highlightTitle}>
                  <span style={{ color: ORANGE, marginRight: '8px' }}>✦</span>
                  {item.title}
                </Text>
                <Text style={styles.highlightDescription}>{item.description}</Text>
              </div>
            ))}
          </Section>

          {/* How It Works Steps */}
          {resolvedSteps && resolvedSteps.length > 0 && (
            <Section style={styles.stepsSection} className="mobile-steps-section">
              <Text style={styles.sectionEyebrow}>GETTING STARTED</Text>
              <Heading as="h3" style={styles.sectionTitle}>
                How it works in 3 simple steps
              </Heading>
              <Row>
                {resolvedSteps.map((stepItem, idx) => (
                  <Column key={idx} style={styles.stepCol} className="mobile-step-col">
                    <div style={styles.stepCard}>
                      <div style={styles.stepNumberBadge}>{stepItem.step}</div>
                      <Text style={styles.stepTitle}>{stepItem.title}</Text>
                      <Text style={styles.stepDescription}>{stepItem.description}</Text>
                    </div>
                  </Column>
                ))}
              </Row>
            </Section>
          )}

          {/* Callout Box */}
          <Section style={styles.callout} className="mobile-callout">
            <Text style={styles.calloutBadge}>PRO TIP</Text>
            <Text style={styles.calloutHeading}>{resolvedCalloutTitle}</Text>
            <Text style={styles.calloutBody}>{resolvedCalloutText}</Text>
          </Section>

          {/* Bottom Action Bar */}
          <Section style={styles.bottomCtaSection}>
            <Heading as="h3" style={styles.bottomCtaHeading}>
              Ready to experience it?
            </Heading>
            <Button href={resolvedCtaUrl} style={styles.button} className="mobile-btn">
              {resolvedCtaLabel}
            </Button>
          </Section>

          {/* Signoff */}
          <Section style={styles.signoff}>
            <Text style={styles.signoffTitle}>Documenting & celebrating African cinema.</Text>
            <Text style={styles.signoffText}>
              — The <span style={{ color: ORANGE, fontWeight: 700 }}>MuviDB</span> Product Team
            </Text>
          </Section>

          <Hr style={styles.divider} />

          {/* Footer */}
          <Section style={styles.footer} className="mobile-footer">
            <Text style={styles.footerLabel}>Stay connected with African screen culture</Text>
            <Text style={styles.socialLinks}>
              {social.instagram && (
                <>
                  <Link href={social.instagram} style={styles.footerLink}>
                    Instagram
                  </Link>
                  {' · '}
                </>
              )}
              {social.x && (
                <>
                  <Link href={social.x} style={styles.footerLink}>
                    X / Twitter
                  </Link>
                  {' · '}
                </>
              )}
              {social.tiktok && (
                <>
                  <Link href={social.tiktok} style={styles.footerLink}>
                    TikTok
                  </Link>
                  {' · '}
                </>
              )}
              {social.linkedin && (
                <Link href={social.linkedin} style={styles.footerLink}>
                  LinkedIn
                </Link>
              )}
            </Text>
            <Text style={styles.legal}>
              Have feedback on this feature? Reply directly to this email or{' '}
              <Link href={helpUrl} style={styles.legalLink}>
                visit our About page
              </Link>
              .
              <br />© {new Date().getFullYear()} MuviDB. All rights reserved.
              <br />
              <Link href={unsubscribeUrl} style={styles.legalLink}>
                Manage notification preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** WhatsApp Chat Simulation Card */
function WhatsAppMockupCard({
  actorName,
  filmTitle,
  posterUrl,
}: {
  actorName: string;
  filmTitle: string;
  posterUrl: string;
}) {
  return (
    <div style={styles.mockupContainer} className="mobile-mockup-card">
      <div style={styles.mockupHeader}>
        <Row>
          <Column style={{ width: '36px' }}>
            <div style={styles.whatsappIconCircle}>
              <span style={{ fontSize: '18px', lineHeight: '28px' }}>💬</span>
            </div>
          </Column>
          <Column style={{ paddingLeft: '8px' }}>
            <Text style={styles.mockupSender}>
              MuviDB Alerts <span style={{ color: GREEN, fontWeight: 700 }}>✓ Verified</span>
            </Text>
            <Text style={styles.mockupSubtext}>WhatsApp Cloud Delivery</Text>
          </Column>
        </Row>
      </div>

      <div style={styles.whatsappBubble}>
        <Row>
          <Column style={{ width: '84px', verticalAlign: 'top' }}>
            <Img
              src={posterUrl}
              width="80"
              height="115"
              alt={filmTitle}
              style={{ borderRadius: '8px', objectFit: 'cover' }}
            />
          </Column>
          <Column style={{ paddingLeft: '12px', verticalAlign: 'top' }}>
            <Text style={styles.whatsappBubbleTag}>🍿 NEW RELEASE NOTIFICATION</Text>
            <Text style={styles.whatsappBubbleTitle}>
              <strong>{actorName}</strong> stars in the new title{' '}
              <span style={{ color: ORANGE }}>{filmTitle}</span>!
            </Text>
            <Text style={styles.whatsappBubbleSnippet}>
              Now showing in cinemas & streaming. Tap below to see official credits and trailers.
            </Text>
            <div style={styles.whatsappActionPill}>
              <Text style={styles.whatsappActionText}>👉 Watch Trailer & Showtimes</Text>
            </div>
          </Column>
        </Row>
      </div>
    </div>
  );
}

/** Filmmaker Link-in-Bio Simulation Card */
function PortfolioMockupCard({
  personName,
  handle,
  photoUrl,
}: {
  personName: string;
  handle: string;
  photoUrl: string;
}) {
  return (
    <div style={styles.mockupContainer} className="mobile-mockup-card">
      <div style={styles.portfolioCardInner}>
        <div style={styles.portfolioHeroRow}>
          <Row>
            <Column style={{ width: '64px', verticalAlign: 'middle' }}>
              <Img
                src={photoUrl}
                width="60"
                height="60"
                alt={personName}
                style={{ borderRadius: '999px', objectFit: 'cover', border: `2px solid ${ORANGE}` }}
              />
            </Column>
            <Column style={{ paddingLeft: '12px', verticalAlign: 'middle' }}>
              <Text style={styles.portfolioName}>
                {personName} <span style={{ color: '#EAB308' }}>★ PRO</span>
              </Text>
              <Text style={styles.portfolioHandle}>muvidb.com/@{handle}</Text>
              <Text style={styles.portfolioBio}>Actor & Producer • 32 Verified Screen Credits</Text>
            </Column>
          </Row>
        </div>

        {/* Portfolio Action Buttons */}
        <div style={styles.portfolioLinkButton}>
          <Text style={styles.portfolioLinkText}>🎬 Watch 2026 Showreel</Text>
        </div>
        <div style={styles.portfolioLinkButton}>
          <Text style={styles.portfolioLinkText}>📽️ Verified Filmography on MuviDB (32 Films)</Text>
        </div>
        <div style={styles.portfolioLinkButton}>
          <Text style={styles.portfolioLinkText}>📄 Download Electronic Press Kit (EPK)</Text>
        </div>
      </div>
    </div>
  );
}

/** Dual Feature Roundup Simulation Card */
function RoundupMockupCard() {
  return (
    <div style={styles.mockupContainer} className="mobile-mockup-card">
      <Row>
        <Column style={{ width: '50%', paddingRight: '8px' }}>
          <div style={styles.roundupHalfCard}>
            <Text style={styles.roundupIcon}>💬</Text>
            <Text style={styles.roundupCardTitle}>WhatsApp Movie Alerts</Text>
            <Text style={styles.roundupCardText}>Instant release drops on your phone.</Text>
          </div>
        </Column>
        <Column style={{ width: '50%', paddingLeft: '8px' }}>
          <div style={styles.roundupHalfCard}>
            <Text style={styles.roundupIcon}>🎬</Text>
            <Text style={styles.roundupCardTitle}>Link-in-Bio Portfolios</Text>
            <Text style={styles.roundupCardText}>Verified filmography & reel for your social bio.</Text>
          </div>
        </Column>
      </Row>
    </div>
  );
}

const styles = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: '#F3F4F6',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  container: {
    maxWidth: '680px',
    margin: '24px auto',
    backgroundColor: '#FFFFFF',
    borderRadius: '18px',
    overflow: 'hidden',
  },
  header: {
    padding: '28px 36px 14px',
  },
  logo: {
    display: 'block',
    border: 0,
  },
  viewInBrowser: {
    color: MUTED,
    fontSize: '12px',
    textDecoration: 'none',
  },
  hero: {
    padding: '16px 36px 28px',
  },
  badgeWrapper: {
    marginBottom: '10px',
  },
  categoryBadge: {
    display: 'inline-block',
    margin: 0,
    backgroundColor: '#FFF2EB',
    color: ORANGE,
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    padding: '5px 12px',
    borderRadius: '999px',
    textTransform: 'uppercase' as const,
  },
  eyebrow: {
    margin: '0 0 10px',
    color: MUTED,
    fontSize: '13px',
    lineHeight: '18px',
    letterSpacing: '2px',
    fontWeight: 700,
  },
  heading: {
    margin: 0,
    color: TEXT,
    fontSize: '34px',
    lineHeight: '42px',
    fontWeight: 800,
  },
  intro: {
    margin: '18px 0 12px',
    color: MUTED,
    fontSize: '16px',
    lineHeight: '26px',
  },
  button: {
    backgroundColor: ORANGE,
    borderRadius: '999px',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: 700,
    padding: '14px 26px',
    textDecoration: 'none',
    display: 'inline-block',
    marginRight: '12px',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: '999px',
    color: TEXT,
    fontSize: '14px',
    fontWeight: 700,
    padding: '14px 22px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  mockupWrapper: {
    padding: '0 36px 24px',
  },
  mockupContainer: {
    backgroundColor: '#0F1216',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #23272E',
  },
  mockupHeader: {
    marginBottom: '14px',
    borderBottom: '1px solid #1F242C',
    paddingBottom: '10px',
  },
  whatsappIconCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '999px',
    backgroundColor: '#1E2B23',
    textAlign: 'center' as const,
  },
  mockupSender: {
    margin: 0,
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 700,
  },
  mockupSubtext: {
    margin: 0,
    color: '#9CA3AF',
    fontSize: '11px',
  },
  whatsappBubble: {
    backgroundColor: '#192229',
    borderRadius: '12px',
    padding: '14px',
    border: '1px solid #2A3B32',
  },
  whatsappBubbleTag: {
    margin: '0 0 4px',
    color: GREEN,
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.8px',
  },
  whatsappBubbleTitle: {
    margin: '0 0 6px',
    color: '#F9FAFB',
    fontSize: '14px',
    lineHeight: '20px',
  },
  whatsappBubbleSnippet: {
    margin: '0 0 10px',
    color: '#9CA3AF',
    fontSize: '12px',
    lineHeight: '18px',
  },
  whatsappActionPill: {
    backgroundColor: '#202D36',
    borderRadius: '6px',
    padding: '6px 10px',
    display: 'inline-block',
    border: '1px solid #304443',
  },
  whatsappActionText: {
    margin: 0,
    color: '#34D399',
    fontSize: '12px',
    fontWeight: 700,
  },
  portfolioCardInner: {
    backgroundColor: '#0A0C0E',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #1E232B',
  },
  portfolioHeroRow: {
    marginBottom: '16px',
    borderBottom: '1px solid #1F242D',
    paddingBottom: '14px',
  },
  portfolioName: {
    margin: 0,
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: 700,
  },
  portfolioHandle: {
    margin: '2px 0',
    color: ORANGE,
    fontSize: '13px',
    fontWeight: 700,
  },
  portfolioBio: {
    margin: 0,
    color: '#9CA3AF',
    fontSize: '12px',
  },
  portfolioLinkButton: {
    backgroundColor: '#161A20',
    borderRadius: '8px',
    padding: '10px 14px',
    marginBottom: '8px',
    border: '1px solid #272E38',
  },
  portfolioLinkText: {
    margin: 0,
    color: '#F3F4F6',
    fontSize: '13px',
    fontWeight: 600,
    textAlign: 'center' as const,
  },
  roundupHalfCard: {
    backgroundColor: '#161A20',
    borderRadius: '12px',
    padding: '16px 14px',
    border: '1px solid #272E38',
    textAlign: 'center' as const,
  },
  roundupIcon: {
    fontSize: '28px',
    margin: '0 0 6px',
  },
  roundupCardTitle: {
    margin: '0 0 6px',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 700,
  },
  roundupCardText: {
    margin: 0,
    color: '#9CA3AF',
    fontSize: '12px',
    lineHeight: '17px',
  },
  highlightsSection: {
    padding: '24px 36px 30px',
    backgroundColor: LIGHT_BG,
    borderTop: `1px solid ${BORDER_COLOR}`,
    borderBottom: `1px solid ${BORDER_COLOR}`,
  },
  sectionEyebrow: {
    margin: '0 0 6px',
    color: ORANGE,
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '2px',
  },
  sectionTitle: {
    margin: '0 0 20px',
    color: TEXT,
    fontSize: '20px',
    lineHeight: '26px',
    fontWeight: 800,
  },
  highlightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '14px 18px',
    marginBottom: '10px',
    border: `1px solid ${BORDER_COLOR}`,
  },
  highlightTitle: {
    margin: 0,
    color: TEXT,
    fontSize: '15px',
    lineHeight: '20px',
    fontWeight: 700,
  },
  highlightDescription: {
    margin: '4px 0 0',
    color: MUTED,
    fontSize: '13px',
    lineHeight: '20px',
  },
  stepsSection: {
    padding: '28px 36px 32px',
    backgroundColor: '#FFFFFF',
  },
  stepCol: {
    width: '33.33%',
    padding: '0 6px',
    verticalAlign: 'top',
  },
  stepCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: '12px',
    padding: '16px 14px',
    border: `1px solid ${BORDER_COLOR}`,
    minHeight: '140px',
  },
  stepNumberBadge: {
    display: 'inline-block',
    backgroundColor: '#FFF2EB',
    color: ORANGE,
    fontSize: '12px',
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: '6px',
    marginBottom: '8px',
  },
  stepTitle: {
    margin: '0 0 4px',
    color: TEXT,
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: '18px',
  },
  stepDescription: {
    margin: 0,
    color: MUTED,
    fontSize: '12px',
    lineHeight: '17px',
  },
  callout: {
    margin: '24px 36px',
    padding: '20px 22px',
    backgroundColor: '#FFF9F5',
    borderRadius: '14px',
    border: '1px solid #FFD9C4',
  },
  calloutBadge: {
    display: 'inline-block',
    margin: '0 0 6px',
    color: ORANGE,
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1px',
  },
  calloutHeading: {
    margin: '0 0 6px',
    color: TEXT,
    fontSize: '16px',
    lineHeight: '22px',
    fontWeight: 700,
  },
  calloutBody: {
    margin: 0,
    color: '#4B5563',
    fontSize: '14px',
    lineHeight: '22px',
  },
  bottomCtaSection: {
    padding: '16px 36px 28px',
    textAlign: 'center' as const,
  },
  bottomCtaHeading: {
    margin: '0 0 16px',
    color: TEXT,
    fontSize: '20px',
    lineHeight: '26px',
    fontWeight: 700,
  },
  signoff: {
    padding: '10px 36px 24px',
    textAlign: 'center' as const,
  },
  signoffTitle: {
    margin: '0 0 4px',
    color: TEXT,
    fontSize: '14px',
    fontWeight: 700,
  },
  signoffText: {
    margin: 0,
    color: MUTED,
    fontSize: '13px',
  },
  divider: {
    borderColor: '#E5E7EB',
    margin: 0,
  },
  footer: {
    padding: '24px 36px 36px',
    backgroundColor: '#FAFAFA',
    textAlign: 'center' as const,
  },
  footerLabel: {
    color: TEXT,
    fontSize: '13px',
    fontWeight: 700,
    margin: '0 0 10px',
  },
  socialLinks: {
    margin: '0 0 16px',
    fontSize: '13px',
    color: MUTED,
  },
  footerLink: {
    color: TEXT,
    textDecoration: 'none',
    fontWeight: 600,
  },
  legal: {
    color: '#9CA3AF',
    fontSize: '11px',
    lineHeight: '18px',
    margin: 0,
  },
  legalLink: {
    color: MUTED,
    textDecoration: 'underline',
  },
};
