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

export type ContributionKind =
  | 'poster'
  | 'credits'
  | 'synopsis'
  | 'release_date'
  | 'trailer'
  | 'general';

export interface ApprovedContributionItem {
  id?: string;
  itemTitle: string;
  itemUrl?: string;
  contributionType?: ContributionKind | string;
  detailsSummary?: string;
}

export interface MuviDbContributionThankYouEmailProps {
  contributorName?: string;
  items?: ApprovedContributionItem[];
  // Backwards compatibility for single item:
  contributionType?: ContributionKind | string;
  itemTitle?: string;
  itemUrl?: string;
  detailsSummary?: string;
  logoUrl?: string;
  dashboardUrl?: string;
  browseUrl?: string;
  social?: {
    instagram?: string;
    x?: string;
    whatsapp?: string;
    youtube?: string;
  };
}

const ORANGE = '#FF5A1F';
const DARK_BG = '#0B0B0E';
const CARD_BG = '#141418';
const BORDER = '#26262E';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_MUTED = '#9E9EA8';
const EMERALD = '#10B981';

const KIND_LABELS: Record<string, { label: string; icon: string }> = {
  poster: { label: 'Poster & Key Art Update', icon: '🎨' },
  credits: { label: 'Cast & Crew Credit Addition', icon: '🎬' },
  synopsis: { label: 'Plot Synopsis & Tagline', icon: '📝' },
  release_date: { label: 'Release Date & Theatrical Status', icon: '📅' },
  trailer: { label: 'Official Showreel / Trailer Link', icon: '▶️' },
  general: { label: 'Catalogue Record Improvement', icon: '⚡' },
};

export default function MuviDbContributionThankYouEmail({
  contributorName = 'Film Friend',
  items,
  contributionType = 'poster',
  itemTitle = 'The Beacon Man (2026)',
  itemUrl = 'https://muvidb.com',
  detailsSummary = 'High-resolution official theatrical poster updated and published.',
  logoUrl = 'https://muvidb.com/brand/wordmark-dark.png',
  dashboardUrl = 'https://muvidb.com/dashboard',
  browseUrl = 'https://muvidb.com/browse',
  social = {
    instagram: 'https://instagram.com/muvidb',
    x: 'https://x.com/muvidb',
    whatsapp: 'https://chat.whatsapp.com/muvidb',
    youtube: 'https://youtube.com/@muvidb',
  },
}: MuviDbContributionThankYouEmailProps) {
  const firstName = contributorName.trim().split(/\s+/)[0] || 'there';

  // Normalize single or multiple items
  const normalizedItems: ApprovedContributionItem[] =
    items && items.length > 0
      ? items
      : [
          {
            itemTitle,
            itemUrl,
            contributionType,
            detailsSummary,
          },
        ];

  const isMultiple = normalizedItems.length > 1;
  const primaryTitle = normalizedItems[0]?.itemTitle || 'Your submission';
  const previewText = isMultiple
    ? `${normalizedItems.length} contributions verified and now live on MuviDB!`
    : `Your contribution to ${primaryTitle} has been verified and is now live on MuviDB!`;

  const primaryActionUrl = isMultiple
    ? (dashboardUrl || 'https://muvidb.com/dashboard')
    : (normalizedItems[0]?.itemUrl || 'https://muvidb.com');

  const primaryActionText = isMultiple
    ? 'View Your Contributions on MuviDB →'
    : 'View Updated Title on MuviDB →';

  return (
    <Html lang="en">
      <Head>
        <title>Thank you for contributing to MuviDB</title>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>
      <Preview>{previewText}</Preview>

      <Body
        style={{
          backgroundColor: DARK_BG,
          color: TEXT_PRIMARY,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: '24px 12px',
        }}
      >
        <Container
          style={{
            maxWidth: '560px',
            margin: '0 auto',
            backgroundColor: DARK_BG,
          }}
        >
          {/* Official Brand Logo Header from /brand */}
          <Section style={{ padding: '24px 0 20px', textAlign: 'center' }}>
            <Link href="https://muvidb.com" target="_blank" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <Img
                src={logoUrl}
                width="160"
                height="49"
                alt="MuviDB"
                style={{
                  display: 'block',
                  margin: '0 auto',
                  border: '0',
                  outline: 'none',
                  textDecoration: 'none',
                }}
              />
            </Link>
          </Section>

          {/* Main Content Card */}
          <Section
            style={{
              backgroundColor: CARD_BG,
              borderRadius: '20px',
              border: `1px solid ${BORDER}`,
              padding: '36px 28px',
              textAlign: 'left',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Verification Status Pill */}
            <div style={{ marginBottom: '20px' }}>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: EMERALD,
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '4px 12px',
                  borderRadius: '100px',
                }}
              >
                ● Verified &amp; Live in Database
              </span>
            </div>

            {/* Main Greeting & Headline */}
            <Heading
              as="h1"
              style={{
                fontSize: '24px',
                fontWeight: 900,
                color: TEXT_PRIMARY,
                letterSpacing: '-0.5px',
                lineHeight: '1.25',
                margin: '0 0 16px',
              }}
            >
              {isMultiple
                ? `Thank you for your contributions, ${firstName}!`
                : `Thank you for contributing, ${firstName}!`}
            </Heading>

            <Text
              style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: TEXT_MUTED,
                margin: '0 0 24px',
              }}
            >
              {isMultiple
                ? `Our editorial team reviewed and verified your ${normalizedItems.length} recent submissions. Everything has been officially published to Africa’s living film and theatre record.`
                : 'Your submission has been reviewed by our editorial team, verified, and officially published to Africa’s living film and theatre record.'}
            </Text>

            {/* Contribution Details Box */}
            <Section
              style={{
                backgroundColor: '#1A1A22',
                borderRadius: '14px',
                border: `1px solid ${BORDER}`,
                padding: '20px',
                marginBottom: '28px',
              }}
            >
              <table width="100%" cellPadding={0} cellSpacing={0} border={0}>
                <tbody>
                  {normalizedItems.map((item, index) => {
                    const kindKey = item.contributionType || 'general';
                    const kind = KIND_LABELS[kindKey] || {
                      label: String(kindKey).replace(/_/g, ' '),
                      icon: '✨',
                    };

                    const isLast = index === normalizedItems.length - 1;

                    return (
                      <React.Fragment key={index}>
                        <tr>
                          <td style={{ paddingBottom: '12px', paddingTop: index > 0 ? '16px' : '0' }}>
                            <Text
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                color: ORANGE,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                margin: '0 0 4px',
                              }}
                            >
                              {isMultiple ? `Contribution #${index + 1} — Target Record` : 'Target Production / Record'}
                            </Text>
                            <Text
                              style={{
                                fontSize: '16px',
                                fontWeight: 800,
                                color: TEXT_PRIMARY,
                                margin: 0,
                              }}
                            >
                              {item.itemUrl ? (
                                <Link
                                  href={item.itemUrl}
                                  target="_blank"
                                  style={{ color: TEXT_PRIMARY, textDecoration: 'none' }}
                                >
                                  {item.itemTitle}
                                </Link>
                              ) : (
                                item.itemTitle
                              )}
                            </Text>
                          </td>
                        </tr>

                        <tr>
                          <td
                            style={{
                              paddingTop: '10px',
                              paddingBottom: isLast ? '0' : '16px',
                              borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                color: TEXT_MUTED,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                margin: '0 0 4px',
                              }}
                            >
                              Verified Change
                            </Text>
                            <Text
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#E4E4E7',
                                margin: '0 0 6px',
                              }}
                            >
                              {kind.icon} {kind.label}
                            </Text>
                            {item.detailsSummary ? (
                              <Text
                                style={{
                                  fontSize: '12px',
                                  lineHeight: '1.5',
                                  color: TEXT_MUTED,
                                  margin: 0,
                                }}
                              >
                                {item.detailsSummary}
                              </Text>
                            ) : null}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </Section>

            {/* Impact Statement */}
            <Section
              style={{
                backgroundColor: 'rgba(255, 90, 31, 0.05)',
                borderLeft: `3px solid ${ORANGE}`,
                padding: '12px 16px',
                borderRadius: '4px',
                marginBottom: '28px',
              }}
            >
              <Text
                style={{
                  fontSize: '12px',
                  lineHeight: '1.55',
                  color: '#D4D4D8',
                  margin: 0,
                }}
              >
                <strong>Why this matters:</strong> Accurate posters, verified credits, and proper theatrical documentation ensure Nollywood history is recorded correctly for audiences, festival programmers, and future generations.
              </Text>
            </Section>

            {/* Primary Action Button (Clean Solid Orange - No Gradient) */}
            <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Button
                href={primaryActionUrl}
                style={{
                  backgroundColor: ORANGE,
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  padding: '14px 28px',
                  borderRadius: '10px',
                  display: 'inline-block',
                  letterSpacing: '0.02em',
                  boxShadow: '0 4px 14px rgba(255, 90, 31, 0.35)',
                }}
              >
                {primaryActionText}
              </Button>
            </Section>

            {/* Secondary Action Link */}
            <Text
              style={{
                fontSize: '12px',
                textAlign: 'center',
                color: TEXT_MUTED,
                margin: 0,
              }}
            >
              Want to contribute more?{' '}
              <Link
                href={browseUrl}
                style={{
                  color: TEXT_PRIMARY,
                  fontWeight: 700,
                  textDecoration: 'underline',
                }}
              >
                Explore other titles needing enrichment
              </Link>
            </Text>
          </Section>

          {/* Footer Accreditation */}
          <Section style={{ padding: '28px 12px 12px', textAlign: 'center' }}>
            <Text
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: TEXT_MUTED,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                margin: '0 0 10px',
              }}
            >
              MuviDB Community Contributor Program
            </Text>

            <Text
              style={{
                fontSize: '11px',
                lineHeight: '1.5',
                color: '#52525B',
                maxWidth: '420px',
                margin: '0 auto 16px',
              }}
            >
              The living record of African film &amp; theatre.
            </Text>

            {/* Social Links */}
            <Text style={{ fontSize: '11px', color: '#71717A', margin: 0 }}>
              <Link
                href={social.instagram}
                style={{ color: '#A1A1AA', textDecoration: 'none', margin: '0 8px' }}
              >
                Instagram
              </Link>
              ·
              <Link
                href={social.x}
                style={{ color: '#A1A1AA', textDecoration: 'none', margin: '0 8px' }}
              >
                X (Twitter)
              </Link>
              ·
              <Link
                href="https://muvidb.com"
                style={{ color: '#A1A1AA', textDecoration: 'none', margin: '0 8px' }}
              >
                muvidb.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
