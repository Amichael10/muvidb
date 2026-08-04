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

export interface MuviDbWelcomeEmailProps {
  firstName?: string;
  logoUrl: string;
  exploreUrl?: string;
  helpUrl?: string;
  unsubscribeUrl?: string;
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

export default function MuviDbWelcomeEmail({
  firstName = 'there',
  logoUrl,
  exploreUrl = 'https://muvidb.com',
  helpUrl = 'https://muvidb.com/about',
  unsubscribeUrl = 'https://muvidb.com',
  collage,
  social = {},
}: MuviDbWelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to MuviDB, the home of African cinema.</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
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

          <Section style={styles.hero}>
            <Row>
              <Column style={styles.heroCopy}>
                <Text style={styles.eyebrow}>WELCOME TO</Text>
                <Heading style={styles.heading}>
                  Muvi<span style={{ color: ORANGE }}>DB</span>
                  <br />
                  You&apos;re in
                  <span style={{ color: ORANGE }}>!</span>
                </Heading>
                <Text style={styles.intro}>
                  Hi {firstName}, thanks for joining MuviDB — the home of African
                  films, television, and the people who bring those stories to life.
                </Text>
                <Text style={styles.boldText}>We&apos;re excited to have you with us.</Text>
                <Button href={exploreUrl} style={styles.button}>
                  Explore MuviDB →
                </Button>
              </Column>
              <Column style={styles.heroArt}>
                <CinemaCollage images={collage} />
              </Column>
            </Row>
          </Section>

          <Section style={styles.featuresSection}>
            <Text style={styles.sectionEyebrow}>EVERYTHING YOU CAN DO ON MUVIDB</Text>
            <Hr style={styles.sectionRule} />
            <Row>
              <Feature
                title="Explore"
                text="Browse films, television, short films, and more from across Africa."
              />
              <Feature
                title="Discover people"
                text="Explore actors, directors, producers, writers, crew, and their credits."
              />
              <Feature
                title="Where to watch"
                text="See where films are streaming or currently showing in cinemas."
              />
              <Feature
                title="Stay updated"
                text="Follow releases, reviews, trailers, and highlights from African cinema."
              />
            </Row>
          </Section>

          <Section style={styles.missionWrapper}>
            <Row style={styles.mission}>
              <Column style={styles.missionCopy}>
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
              <Column style={styles.missionStatementColumn}>
                <Text style={styles.missionStatement}>
                  Discover.
                  <br />
                  Connect.
                  <br />
                  Celebrate.
                </Text>
              </Column>
            </Row>
          </Section>

          <Section style={styles.signoff}>
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

          <Section style={styles.footer}>
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

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <Column style={styles.feature}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </Column>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
