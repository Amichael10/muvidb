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

export type PersonaType = 'fan' | 'professional' | 'company';

export interface MuviDbWelcomeEmailProps {
  firstName?: string;
  logoUrl: string;
  persona?: PersonaType;
  roleBadge?: string;
  exploreUrl?: string;
  helpUrl?: string;
  unsubscribeUrl?: string;
  /** Override preview line (inbox snippet). */
  preview?: string;
  /** Override hero eyebrow, e.g. CONFIRM YOUR EMAIL */
  eyebrow?: string;
  /** Override main heading (plain text; orange accent on brand name still applied in welcome mode). */
  headline?: string;
  /** Override intro paragraph under the heading. */
  intro?: string;
  /** Primary CTA — defaults to Explore MuviDB */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Hide feature grid + mission on shorter auth emails */
  compact?: boolean;
  features?: Array<{ title: string; text: string }>;
  collage: {
    featuredPerson: string;
    actor: string;
    filmmaker: string;
    moviePoster: string;
    productionStill: string;
  };
  social?: {
    instagram?: string;
    x?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
    linkedin?: string;
  };
}

const ORANGE = '#FF5A1F';
const TEXT = '#15171A';
const MUTED = '#5F6368';
const CREAM = '#FFF9F5';

const PERSONA_CONFIG: Record<
  PersonaType,
  {
    badge: string;
    headline: React.ReactNode;
    intro: (name: string) => string;
    ctaLabel: string;
    ctaUrl: string;
    preview: string;
    featuresEyebrow: string;
    features: Array<{ title: string; text: string }>;
  }
> = {
  fan: {
    badge: 'Account Type: Film Fan',
    headline: (
      <>
        Welcome to the home of African cinema<span style={{ color: ORANGE }}>!</span>
      </>
    ),
    intro: (name) =>
      `Hi ${name}, thanks for joining MuviDB! Whether you’re looking for what to watch tonight or exploring the creators behind your favorite African stories, you’re in the right place.`,
    ctaLabel: 'Explore African Cinema →',
    ctaUrl: 'https://muvidb.com',
    preview: 'Welcome to MuviDB — Your front row seat to African cinema',
    featuresEyebrow: 'EVERYTHING YOU CAN DO ON MUVIDB',
    features: [
      {
        title: 'Where to watch',
        text: 'Instantly find where films are streaming or currently showing in cinemas.',
      },
      {
        title: 'Rate & watchlist',
        text: 'Keep track of films you’ve watched and build your personalized watchlist.',
      },
      {
        title: 'Follow talent',
        text: 'Follow your favorite actors, directors, and get notified on new releases.',
      },
      {
        title: 'Community pulse',
        text: 'Read real viewer reactions, critical reviews, and join the debate.',
      },
    ],
  },
  professional: {
    badge: 'Account Type: Industry Professional',
    headline: (
      <>
        Welcome to your professional screen hub<span style={{ color: ORANGE }}>!</span>
      </>
    ),
    intro: (name) =>
      `Hi ${name}, welcome to MuviDB Pro! As a creator shaping African screen culture, your craft deserves accurate, dispute-free documentation and worldwide visibility.`,
    ctaLabel: 'Claim & Verify Your Profile →',
    ctaUrl: 'https://muvidb.com/pro-dashboard',
    preview: 'Welcome to MuviDB — Claim and verify your official industry profile',
    featuresEyebrow: 'HOW TO ELEVATE YOUR SCREEN CAREER ON MUVIDB',
    features: [
      {
        title: 'Claim your profile',
        text: 'Take ownership of your verified public filmography, biography, and photos.',
      },
      {
        title: 'Verified credits',
        text: 'Document every film, series, and department credit with zero duplicate entries.',
      },
      {
        title: 'Global showcase',
        text: 'Showcase your portfolio, reel, and achievements to producers worldwide.',
      },
      {
        title: 'Industry network',
        text: 'Connect with fellow filmmakers, crew, and discover collaborative opportunities.',
      },
    ],
  },
  company: {
    badge: 'Account Type: Studio & Production Company',
    headline: (
      <>
        Welcome to the African cinema directory<span style={{ color: ORANGE }}>!</span>
      </>
    ),
    intro: (name) =>
      `Hi ${name}, welcome to MuviDB! We help production companies, distributors, and studios document their film catalogs, reach engaged audiences, and discover top-tier talent.`,
    ctaLabel: 'Access Studio Portal →',
    ctaUrl: 'https://muvidb.com/dashboard',
    preview: 'Welcome to MuviDB — Your film catalog and industry talent network',
    featuresEyebrow: 'WHAT YOUR STUDIO CAN ACHIEVE ON MUVIDB',
    features: [
      {
        title: 'Catalog management',
        text: 'Submit and manage official movie listings, festival selections, and trailers.',
      },
      {
        title: 'Cast & crew credits',
        text: 'Officially credit cast, HODs, and crew teams to build verified, dispute-free credits.',
      },
      {
        title: 'Audience reach',
        text: 'Track viewer sentiment, ratings, and market presence across your releases.',
      },
      {
        title: 'Talent discovery',
        text: 'Find vetted actors, directors, cinematographers, and crew across Africa.',
      },
    ],
  },
};

export default function MuviDbWelcomeEmail({
  firstName = 'there',
  logoUrl,
  persona,
  roleBadge,
  exploreUrl = 'https://muvidb.com',
  helpUrl = 'https://muvidb.com/about',
  unsubscribeUrl = 'https://muvidb.com',
  preview,
  eyebrow = 'WELCOME TO',
  headline,
  intro,
  ctaLabel,
  ctaUrl,
  compact = false,
  features,
  collage,
  social = {},
}: MuviDbWelcomeEmailProps) {
  const personaConfig = persona ? PERSONA_CONFIG[persona] : null;

  const resolvedPreview = preview || personaConfig?.preview || 'Welcome to MuviDB, the home of African cinema.';
  const resolvedRoleBadge = roleBadge || personaConfig?.badge;
  const resolvedIntro = intro || (personaConfig ? personaConfig.intro(firstName) : `Hi ${firstName}, thanks for joining MuviDB — the home of African films, television, and the people who bring those stories to life.`);
  const resolvedCtaLabel = ctaLabel || personaConfig?.ctaLabel || 'Explore MuviDB →';
  const resolvedCtaUrl = ctaUrl || personaConfig?.ctaUrl || exploreUrl;
  const resolvedFeatures = features || personaConfig?.features || [
    { title: 'Explore', text: 'Browse films, television, short films, and more from across Africa.' },
    { title: 'Discover people', text: 'Explore actors, directors, producers, writers, crew, and their credits.' },
    { title: 'Where to watch', text: 'See where films are streaming or currently showing in cinemas.' },
    { title: 'Stay updated', text: 'Follow releases, reviews, trailers, and highlights from African cinema.' },
  ];
  const featuresEyebrow = personaConfig?.featuresEyebrow || 'EVERYTHING YOU CAN DO ON MUVIDB';

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
            .mobile-hero-copy {
              display: block !important;
              width: 100% !important;
              padding-right: 0 !important;
              margin-bottom: 24px !important;
            }
            .mobile-hero-art {
              display: block !important;
              width: 100% !important;
              max-width: 320px !important;
              margin: 0 auto !important;
            }
            .mobile-heading {
              font-size: 26px !important;
              line-height: 32px !important;
            }
            .mobile-intro {
              font-size: 15px !important;
              line-height: 23px !important;
              margin: 14px 0 16px !important;
            }
            .mobile-btn {
              display: block !important;
              width: 100% !important;
              text-align: center !important;
              padding: 14px 20px !important;
              box-sizing: border-box !important;
            }
            .mobile-features-section {
              padding: 24px 16px 28px !important;
            }
            .mobile-feature-col {
              display: block !important;
              width: 100% !important;
              padding: 0 0 10px 0 !important;
              box-sizing: border-box !important;
            }
            .mobile-feature-card {
              background-color: #FFFFFF !important;
              border-radius: 12px !important;
              padding: 14px 16px !important;
              border: 1px solid #EFEAE5 !important;
              text-align: left !important;
            }
            .mobile-feature-title {
              font-size: 15px !important;
              line-height: 20px !important;
              font-weight: 700 !important;
              text-align: left !important;
              margin: 0 !important;
            }
            .mobile-feature-text {
              font-size: 13px !important;
              line-height: 19px !important;
              text-align: left !important;
              margin: 4px 0 0 !important;
            }
            .mobile-mission-wrapper {
              padding: 16px !important;
            }
            .mobile-mission-copy {
              display: block !important;
              width: 100% !important;
              padding: 22px 18px 14px !important;
              box-sizing: border-box !important;
            }
            .mobile-mission-statement-col {
              display: block !important;
              width: 100% !important;
              border-left: 0 !important;
              border-top: 1px solid #35383C !important;
              padding: 16px 18px 22px !important;
              text-align: center !important;
              box-sizing: border-box !important;
            }
            .mobile-mission-statement {
              font-size: 20px !important;
              line-height: 28px !important;
            }
            .mobile-signoff {
              padding: 20px 18px 24px !important;
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
          <Section style={styles.header} className="mobile-header">
            <Row>
              <Column>
                <Img src={logoUrl} width="160" alt="MuviDB" style={styles.logo} />
              </Column>
              <Column align="right">
                <Link href={exploreUrl} style={styles.viewInBrowser}>
                  View in browser
                </Link>
              </Column>
            </Row>
          </Section>

          <Section style={styles.hero} className="mobile-hero">
            <Row>
              <Column style={styles.heroCopy} className="mobile-hero-copy">
                {resolvedRoleBadge && (
                  <Section style={{ margin: '0 0 10px' }}>
                    <Text style={styles.roleBadge}>{resolvedRoleBadge}</Text>
                  </Section>
                )}
                <Text style={styles.eyebrow}>{eyebrow}</Text>
                {headline ? (
                  <Heading style={styles.heading} className="mobile-heading">{headline}</Heading>
                ) : personaConfig ? (
                  <Heading style={styles.heading} className="mobile-heading">{personaConfig.headline}</Heading>
                ) : (
                  <Heading style={styles.heading} className="mobile-heading">
                    Muvi<span style={{ color: ORANGE }}>DB</span>
                    <br />
                    You&apos;re in
                    <span style={{ color: ORANGE }}>!</span>
                  </Heading>
                )}
                <Text style={styles.intro} className="mobile-intro">{resolvedIntro}</Text>
                {!compact && (
                  <Text style={styles.boldText}>We&apos;re excited to have you with us.</Text>
                )}
                <Button href={resolvedCtaUrl} style={styles.button} className="mobile-btn">
                  {resolvedCtaLabel}
                </Button>
              </Column>
              <Column style={styles.heroArt} className="mobile-hero-art">
                <CinemaCollage images={collage} />
              </Column>
            </Row>
          </Section>

          {!compact && (
          <Section style={styles.featuresSection} className="mobile-features-section">
            <Text style={styles.sectionEyebrow}>{featuresEyebrow}</Text>
            <Hr style={styles.sectionRule} />
            <Row>
              {resolvedFeatures.map((f, i) => (
                <Feature key={i} title={f.title} text={f.text} />
              ))}
            </Row>
          </Section>
          )}

          {!compact && (
          <Section style={styles.missionWrapper} className="mobile-mission-wrapper">
            <Row style={styles.mission}>
              <Column style={styles.missionCopy} className="mobile-mission-copy">
                <Heading as="h2" style={styles.missionTitle}>
                  Our Mission
                </Heading>
                <Text style={styles.missionText}>
                  MuviDB exists to document, connect, and amplify African stories and
                  the people behind them. We believe{' '}
                  <span style={{ color: ORANGE, fontWeight: 700 }}>
                    every credit counts.
                  </span>
                </Text>
              </Column>
              <Column style={styles.missionStatementColumn} className="mobile-mission-statement-col">
                <Text style={styles.missionStatement} className="mobile-mission-statement">
                  Discover.
                  <br />
                  Connect.
                  <br />
                  Celebrate.
                </Text>
              </Column>
            </Row>
          </Section>
          )}

          <Section style={styles.signoff} className="mobile-signoff">
            <Text style={styles.signoffTitle}>
              Thanks for being part of this journey.
            </Text>
            <Text style={styles.signoffText}>
              The best of African cinema starts with you.
            </Text>
            <Text style={styles.signoffText}>
              — The{' '}
              <span style={{ color: ORANGE, fontWeight: 700 }}>MuviDB</span> Team
            </Text>
          </Section>

          <Hr style={styles.divider} />

          <Section style={styles.footer} className="mobile-footer">
            <Text style={styles.footerLabel}>Follow us for more updates</Text>
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
                    X
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
              Need help? Reply to this email or{' '}
              <Link href={helpUrl} style={styles.legalLink}>
                visit About MuviDB
              </Link>
              .
              <br />© {new Date().getFullYear()} MuviDB. All rights reserved.
              <br />
              <Link href={unsubscribeUrl} style={styles.legalLink}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function CinemaCollage({
  images,
}: {
  images: MuviDbWelcomeEmailProps['collage'];
}) {
  return (
    <Section style={styles.collageOuter}>
      <Row>
        <Column style={styles.collageLeft}>
          <Img
            src={images.actor}
            width="126"
            height="144"
            alt="African actor"
            style={{ ...styles.collageImage, marginBottom: '8px' }}
          />
          <Img
            src={images.productionStill}
            width="126"
            height="100"
            alt="African film production"
            style={styles.collageImage}
          />
        </Column>
        <Column style={styles.collageRight}>
          <Img
            src={images.featuredPerson}
            width="142"
            height="178"
            alt="Featured African film professional"
            style={{ ...styles.collageImage, marginBottom: '8px' }}
          />
          <Row>
            <Column style={{ paddingRight: '4px' }}>
              <Img
                src={images.moviePoster}
                width="67"
                height="94"
                alt="African movie poster"
                style={styles.collageMiniImage}
              />
            </Column>
            <Column style={{ paddingLeft: '4px' }}>
              <Img
                src={images.filmmaker}
                width="67"
                height="94"
                alt="African filmmaker"
                style={styles.collageMiniImage}
              />
            </Column>
          </Row>
        </Column>
      </Row>
    </Section>
  );
}

function Feature({ title, text }: { key?: React.Key; title: string; text: string }) {
  return (
    <Column style={styles.feature} className="mobile-feature-col">
      <div className="mobile-feature-card">
        <Text style={styles.featureTitle} className="mobile-feature-title">{title}</Text>
        <Text style={styles.featureText} className="mobile-feature-text">{text}</Text>
      </div>
    </Column>
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
    padding: '28px 36px 10px',
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
    padding: '24px 36px 38px',
  },
  heroCopy: {
    width: '51%',
    paddingRight: '20px',
    verticalAlign: 'middle',
  },
  heroArt: {
    width: '49%',
    verticalAlign: 'middle',
  },
  roleBadge: {
    display: 'inline-block',
    margin: 0,
    backgroundColor: '#FFF0EA',
    border: `1px solid ${ORANGE}`,
    color: ORANGE,
    fontSize: '10px',
    lineHeight: '14px',
    fontWeight: 800,
    letterSpacing: '1.2px',
    padding: '4px 10px',
    borderRadius: '999px',
    textTransform: 'uppercase' as const,
  },
  eyebrow: {
    margin: '0 0 10px',
    color: ORANGE,
    fontSize: '13px',
    lineHeight: '18px',
    letterSpacing: '2.6px',
    fontWeight: 700,
  },
  heading: {
    margin: 0,
    color: TEXT,
    fontSize: '40px',
    lineHeight: '46px',
    fontWeight: 800,
  },
  intro: {
    margin: '18px 0 10px',
    color: MUTED,
    fontSize: '16px',
    lineHeight: '25px',
  },
  boldText: {
    margin: '0 0 22px',
    color: TEXT,
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 700,
  },
  button: {
    backgroundColor: ORANGE,
    borderRadius: '999px',
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: 700,
    padding: '14px 24px',
    textDecoration: 'none',
  },
  collageOuter: {
    padding: '8px',
    backgroundColor: '#FFF8F4',
    borderRadius: '28px',
  },
  collageLeft: {
    width: '48%',
    paddingRight: '5px',
    verticalAlign: 'bottom',
  },
  collageRight: {
    width: '52%',
    paddingLeft: '5px',
    verticalAlign: 'top',
  },
  collageImage: {
    display: 'block',
    width: '100%',
    objectFit: 'cover',
    borderRadius: '18px',
    border: '3px solid #FFFFFF',
  },
  collageMiniImage: {
    display: 'block',
    width: '100%',
    objectFit: 'cover',
    borderRadius: '14px',
    border: '3px solid #FFFFFF',
  },
  featuresSection: {
    backgroundColor: CREAM,
    padding: '30px 24px 36px',
  },
  sectionEyebrow: {
    margin: '0 0 8px',
    textAlign: 'center',
    color: ORANGE,
    fontSize: '12px',
    lineHeight: '18px',
    letterSpacing: '2.6px',
    fontWeight: 700,
  },
  sectionRule: {
    borderColor: ORANGE,
    borderWidth: '2px',
    width: '48px',
    margin: '0 auto 18px',
  },
  feature: {
    width: '25%',
    padding: '8px',
    textAlign: 'center',
    verticalAlign: 'top',
  },
  featureTitle: {
    margin: '0',
    color: TEXT,
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 700,
  },
  featureText: {
    margin: '7px 0 0',
    color: MUTED,
    fontSize: '12px',
    lineHeight: '19px',
  },
  missionWrapper: {
    padding: '28px',
  },
  mission: {
    backgroundColor: '#111316',
    borderRadius: '16px',
  },
  missionCopy: {
    width: '57%',
    padding: '27px 28px',
    verticalAlign: 'middle',
  },
  missionStatementColumn: {
    width: '43%',
    padding: '27px 22px',
    verticalAlign: 'middle',
    borderLeft: '1px solid #35383C',
  },
  missionTitle: {
    margin: '0 0 12px',
    color: '#FFFFFF',
    fontSize: '23px',
    lineHeight: '29px',
  },
  missionText: {
    margin: 0,
    color: '#E4E6E8',
    fontSize: '14px',
    lineHeight: '23px',
  },
  missionStatement: {
    margin: 0,
    color: ORANGE,
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontStyle: 'italic',
    fontSize: '24px',
    lineHeight: '34px',
  },
  signoff: {
    padding: '4px 36px 28px',
  },
  signoffTitle: {
    margin: 0,
    color: TEXT,
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 700,
  },
  signoffText: {
    margin: '6px 0 0',
    color: MUTED,
    fontSize: '15px',
    lineHeight: '23px',
  },
  divider: {
    borderColor: '#ECEDEF',
    margin: '0 28px',
  },
  footer: {
    padding: '24px 28px 30px',
    textAlign: 'center',
  },
  footerLabel: {
    margin: 0,
    color: MUTED,
    fontSize: '13px',
  },
  socialLinks: {
    margin: '10px 0 0',
    fontSize: '13px',
  },
  footerLink: {
    color: TEXT,
    textDecoration: 'none',
  },
  legal: {
    margin: '18px 0 0',
    color: '#92969B',
    fontSize: '12px',
    lineHeight: '19px',
  },
  legalLink: {
    color: '#92969B',
    textDecoration: 'underline',
  },
};
