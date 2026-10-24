// api/_lib/MuviDbFeatureAnnouncementEmail.tsx
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
  Text
} from "@react-email/components";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var ORANGE = "#FF5A1F";
var TEXT = "#111315";
var MUTED = "#4B5563";
var LIGHT_BG = "#F9FAFB";
var BORDER_COLOR = "#E5E7EB";
var GREEN = "#25D366";
var FEATURE_PRESETS = {
  whatsapp: {
    categoryBadge: "\u2728 NEW FEATURE",
    eyebrow: "INSTANT WHATSAPP ALERTS",
    headline: /* @__PURE__ */ jsxs(Fragment, { children: [
      "Never miss a premiere from your favourite actors & directors",
      /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: "." })
    ] }),
    preview: "Get instant WhatsApp alerts when African filmmakers drop new movies & trailers \u{1F37F}",
    intro: "You no longer need to hunt across scattered social media feeds to find out when new Nollywood and African cinema projects drop. With MuviDB WhatsApp Movie Alerts, you get trailer drops, premiere dates, and where-to-watch links delivered straight to your WhatsApp \u2014 the moment they go live.",
    ctaLabel: "Turn On WhatsApp Alerts \u2192",
    ctaUrl: "https://muvidb.com/dashboard",
    secondaryCtaLabel: "Explore African Cinema",
    secondaryCtaUrl: "https://muvidb.com",
    calloutTitle: "Zero-Spam Guarantee",
    calloutText: "Following 4 actors who star in the same new movie? Our intelligent deduplicator ensures you get exactly one beautiful alert with the official poster and streaming links \u2014 never spam.",
    highlights: [
      {
        title: "Instant Premiere & Trailer Drops",
        description: "Be the first to see trailers, teaser drops, and theatrical release dates for the African stars and creators you follow."
      },
      {
        title: "Where to Watch Included",
        description: "Get direct links to cinema showtimes and official streaming platforms (Netflix, Prime Video, Showmax, YouTube) with every alert."
      },
      {
        title: "1-Click Follow Across MuviDB",
        description: 'Simply tap "Follow" on any filmmaker, actor, or crew profile on MuviDB and alerts begin automatically.'
      }
    ],
    steps: [
      {
        step: "01",
        title: "Add your WhatsApp number",
        description: "Save your phone number in your MuviDB profile settings in 10 seconds."
      },
      {
        step: "02",
        title: "Follow your favourite talent",
        description: "Browse actors, directors, writers, and producers across the continent."
      },
      {
        step: "03",
        title: "Receive movie alerts",
        description: "Get verified release alerts, trailers, and showtimes directly on WhatsApp."
      }
    ]
  },
  linkinbio: {
    categoryBadge: "\u2728 NEW FOR CREATORS",
    eyebrow: "MUVIDB LINK IN BIO",
    headline: /* @__PURE__ */ jsxs(Fragment, { children: [
      "One verified link for your entire African cinema career",
      /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: "." })
    ] }),
    preview: "Introducing MuviDB Portfolios \u2014 The ultimate Link-in-Bio for African film talent \u{1F3AC}",
    intro: "Say goodbye to cluttered generic link trees and outdated PDF resumes. MuviDB Link-in-Bio gives actors, directors, writers, cinematographers, and crew a cinematic personal portfolio page powered by verified industry credits.",
    ctaLabel: "Claim Your Link-in-Bio Handle \u2192",
    ctaUrl: "https://muvidb.com/claim",
    secondaryCtaLabel: "View Portfolio Showcase",
    secondaryCtaUrl: "https://muvidb.com/portfolio/tomiwa",
    calloutTitle: "Your Clean Personal @handle",
    calloutText: "Claim your direct handle (like muvidb.com/@yourname) to place directly into your Instagram, TikTok, and X bios. Show casting directors, producers, and fans exactly who you are.",
    highlights: [
      {
        title: "Auto-Synced Verified Filmography",
        description: "Every movie and television credit you hold on MuviDB is automatically showcased with posters, roles, and streaming badges."
      },
      {
        title: "Embed Video Reel & Custom Links",
        description: "Feature your showreel or latest scene at the top of your page alongside custom links for press features, festival tickets, and socials."
      },
      {
        title: "Direct Booking & EPK Download",
        description: "Let casting directors and producers contact your reps via email/WhatsApp or download your Electronic Press Kit with 1 tap."
      }
    ],
    steps: [
      {
        step: "01",
        title: "Claim your profile",
        description: "Search for your name on MuviDB and claim your official industry profile."
      },
      {
        step: "02",
        title: "Customize your portfolio",
        description: "Pick your theme (Midnight, Gold, Neon, or Minimal), add your reel, and choose your @handle."
      },
      {
        step: "03",
        title: "Share your link",
        description: "Add muvidb.com/@yourhandle to your Instagram, TikTok, and Twitter/X bios."
      }
    ]
  },
  roundup: {
    categoryBadge: "\u26A1 PRODUCT UPDATE",
    eyebrow: "WHAT\u2019S NEW ON MUVIDB",
    headline: /* @__PURE__ */ jsxs(Fragment, { children: [
      "Two game-changing updates for African film lovers and creators",
      /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: "." })
    ] }),
    preview: "New on MuviDB: Instant WhatsApp Movie Alerts + Creator Link-in-Bio Portfolios \u{1F680}",
    intro: "We\u2019ve just shipped two major features to make exploring, following, and working in African cinema seamless. Whether you watch African films or create them, here is everything new on MuviDB this month.",
    ctaLabel: "Explore the New Features \u2192",
    ctaUrl: "https://muvidb.com/dashboard",
    secondaryCtaLabel: "Learn More",
    secondaryCtaUrl: "https://muvidb.com/about",
    calloutTitle: "Built for the African Screen Ecosystem",
    calloutText: "Both features are designed specifically to eliminate friction \u2014 keeping fans instantly connected to real releases, while giving professionals the world-class digital presence they deserve.",
    highlights: [
      {
        title: "1. WhatsApp Movie & Premiere Alerts",
        description: "Get instant alerts on WhatsApp when actors and directors you follow release new movies, trailers, and cinema showtimes."
      },
      {
        title: "2. Filmmaker Link-in-Bio Portfolios",
        description: "The verified portfolio for your social bio: auto-synced film credits, video reels, custom links, and direct booking inquiries."
      },
      {
        title: "3. Zero-Duplicate Vetted Credits",
        description: "All credits are verified and synchronized directly with MuviDB\u2019s comprehensive African cinema database."
      }
    ],
    steps: [
      {
        step: "01",
        title: "Sign in to MuviDB",
        description: "Open your dashboard to manage your notifications and public presence."
      },
      {
        step: "02",
        title: "Enable WhatsApp alerts",
        description: "Add your WhatsApp number to get release notifications for talent you follow."
      },
      {
        step: "03",
        title: "Claim your @handle portfolio",
        description: "Launch your verified creator link-in-bio in just a few clicks."
      }
    ]
  }
};
function MuviDbFeatureAnnouncementEmail({
  firstName = "there",
  featureKey = "whatsapp",
  logoUrl = "https://muvidb.com/images/MuviDB%20Brand/Wordmark.png",
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
  exploreUrl = "https://muvidb.com",
  helpUrl = "https://muvidb.com/about",
  unsubscribeUrl = "https://muvidb.com/dashboard",
  social = {
    instagram: "https://www.instagram.com/muvidb_/",
    x: "https://twitter.com/muvidb_",
    tiktok: "https://www.tiktok.com/@muvidb",
    linkedin: "https://www.linkedin.com/company/muvidb/"
  }
}) {
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
  return /* @__PURE__ */ jsxs(Html, { lang: "en", children: [
    /* @__PURE__ */ jsx(Head, { children: /* @__PURE__ */ jsx("style", { children: `
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
        ` }) }),
    /* @__PURE__ */ jsx(Preview, { children: resolvedPreview }),
    /* @__PURE__ */ jsx(Body, { style: styles.body, children: /* @__PURE__ */ jsxs(Container, { style: styles.container, className: "mobile-container", children: [
      /* @__PURE__ */ jsx(Section, { style: styles.header, className: "mobile-header", children: /* @__PURE__ */ jsxs(Row, { children: [
        /* @__PURE__ */ jsx(Column, { children: /* @__PURE__ */ jsx(Img, { src: logoUrl, width: "150", alt: "MuviDB", style: styles.logo }) }),
        /* @__PURE__ */ jsx(Column, { align: "right", children: /* @__PURE__ */ jsx(Link, { href: exploreUrl, style: styles.viewInBrowser, children: "View in browser" }) })
      ] }) }),
      /* @__PURE__ */ jsx(Section, { style: styles.hero, className: "mobile-hero", children: /* @__PURE__ */ jsx(Row, { children: /* @__PURE__ */ jsxs(Column, { children: [
        /* @__PURE__ */ jsx("div", { style: styles.badgeWrapper, children: /* @__PURE__ */ jsx(Text, { style: styles.categoryBadge, children: resolvedBadge }) }),
        /* @__PURE__ */ jsx(Text, { style: styles.eyebrow, children: resolvedEyebrow }),
        /* @__PURE__ */ jsx(Heading, { style: styles.heading, className: "mobile-heading", children: resolvedHeadline }),
        /* @__PURE__ */ jsx(Text, { style: styles.intro, className: "mobile-intro", children: resolvedIntro }),
        /* @__PURE__ */ jsxs(Section, { style: { marginTop: "20px", marginBottom: "8px" }, children: [
          /* @__PURE__ */ jsx(Button, { href: resolvedCtaUrl, style: styles.button, className: "mobile-btn", children: resolvedCtaLabel }),
          resolvedSecondaryCtaLabel && /* @__PURE__ */ jsx(
            Button,
            {
              href: resolvedSecondaryCtaUrl,
              style: styles.secondaryButton,
              className: "mobile-sec-btn",
              children: resolvedSecondaryCtaLabel
            }
          )
        ] })
      ] }) }) }),
      /* @__PURE__ */ jsx(Section, { style: styles.mockupWrapper, className: "mobile-mockup-wrapper", children: featureKey === "whatsapp" ? /* @__PURE__ */ jsx(
        WhatsAppMockupCard,
        {
          filmTitle: mockupDetails?.filmTitle || "Lisabi: The Uprising",
          actorName: mockupDetails?.personName || "Lateef Adedimeji",
          posterUrl: mockupDetails?.posterUrl || "https://muvidb.com/images/film-placeholder.webp"
        }
      ) : featureKey === "linkinbio" ? /* @__PURE__ */ jsx(
        PortfolioMockupCard,
        {
          personName: mockupDetails?.personName || "Tomiwa Johnson",
          handle: mockupDetails?.handle || "tomiwa",
          photoUrl: mockupDetails?.personPhotoUrl || "https://muvidb.com/images/film-placeholder.webp"
        }
      ) : /* @__PURE__ */ jsx(RoundupMockupCard, {}) }),
      /* @__PURE__ */ jsxs(Section, { style: styles.highlightsSection, className: "mobile-highlights-section", children: [
        /* @__PURE__ */ jsx(Text, { style: styles.sectionEyebrow, children: "KEY HIGHLIGHTS" }),
        /* @__PURE__ */ jsx(Heading, { as: "h3", style: styles.sectionTitle, children: "Designed for speed, clarity, and zero hassle" }),
        resolvedHighlights.map((item, idx) => /* @__PURE__ */ jsxs("div", { style: styles.highlightCard, className: "mobile-highlight-card", children: [
          /* @__PURE__ */ jsxs(Text, { style: styles.highlightTitle, children: [
            /* @__PURE__ */ jsx("span", { style: { color: ORANGE, marginRight: "8px" }, children: "\u2726" }),
            item.title
          ] }),
          /* @__PURE__ */ jsx(Text, { style: styles.highlightDescription, children: item.description })
        ] }, idx))
      ] }),
      resolvedSteps && resolvedSteps.length > 0 && /* @__PURE__ */ jsxs(Section, { style: styles.stepsSection, className: "mobile-steps-section", children: [
        /* @__PURE__ */ jsx(Text, { style: styles.sectionEyebrow, children: "GETTING STARTED" }),
        /* @__PURE__ */ jsx(Heading, { as: "h3", style: styles.sectionTitle, children: "How it works in 3 simple steps" }),
        /* @__PURE__ */ jsx(Row, { children: resolvedSteps.map((stepItem, idx) => /* @__PURE__ */ jsx(Column, { style: styles.stepCol, className: "mobile-step-col", children: /* @__PURE__ */ jsxs("div", { style: styles.stepCard, children: [
          /* @__PURE__ */ jsx("div", { style: styles.stepNumberBadge, children: stepItem.step }),
          /* @__PURE__ */ jsx(Text, { style: styles.stepTitle, children: stepItem.title }),
          /* @__PURE__ */ jsx(Text, { style: styles.stepDescription, children: stepItem.description })
        ] }) }, idx)) })
      ] }),
      /* @__PURE__ */ jsxs(Section, { style: styles.callout, className: "mobile-callout", children: [
        /* @__PURE__ */ jsx(Text, { style: styles.calloutBadge, children: "PRO TIP" }),
        /* @__PURE__ */ jsx(Text, { style: styles.calloutHeading, children: resolvedCalloutTitle }),
        /* @__PURE__ */ jsx(Text, { style: styles.calloutBody, children: resolvedCalloutText })
      ] }),
      /* @__PURE__ */ jsxs(Section, { style: styles.bottomCtaSection, children: [
        /* @__PURE__ */ jsx(Heading, { as: "h3", style: styles.bottomCtaHeading, children: "Ready to experience it?" }),
        /* @__PURE__ */ jsx(Button, { href: resolvedCtaUrl, style: styles.button, className: "mobile-btn", children: resolvedCtaLabel })
      ] }),
      /* @__PURE__ */ jsxs(Section, { style: styles.signoff, children: [
        /* @__PURE__ */ jsx(Text, { style: styles.signoffTitle, children: "Documenting & celebrating African cinema." }),
        /* @__PURE__ */ jsxs(Text, { style: styles.signoffText, children: [
          "\u2014 The ",
          /* @__PURE__ */ jsx("span", { style: { color: ORANGE, fontWeight: 700 }, children: "MuviDB" }),
          " Product Team"
        ] })
      ] }),
      /* @__PURE__ */ jsx(Hr, { style: styles.divider }),
      /* @__PURE__ */ jsxs(Section, { style: styles.footer, className: "mobile-footer", children: [
        /* @__PURE__ */ jsx(Text, { style: styles.footerLabel, children: "Stay connected with African screen culture" }),
        /* @__PURE__ */ jsxs(Text, { style: styles.socialLinks, children: [
          social.instagram && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Link, { href: social.instagram, style: styles.footerLink, children: "Instagram" }),
            " \xB7 "
          ] }),
          social.x && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Link, { href: social.x, style: styles.footerLink, children: "X / Twitter" }),
            " \xB7 "
          ] }),
          social.tiktok && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Link, { href: social.tiktok, style: styles.footerLink, children: "TikTok" }),
            " \xB7 "
          ] }),
          social.linkedin && /* @__PURE__ */ jsx(Link, { href: social.linkedin, style: styles.footerLink, children: "LinkedIn" })
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.legal, children: [
          "Have feedback on this feature? Reply directly to this email or",
          " ",
          /* @__PURE__ */ jsx(Link, { href: helpUrl, style: styles.legalLink, children: "visit our About page" }),
          ".",
          /* @__PURE__ */ jsx("br", {}),
          "\xA9 ",
          (/* @__PURE__ */ new Date()).getFullYear(),
          " MuviDB. All rights reserved.",
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx(Link, { href: unsubscribeUrl, style: styles.legalLink, children: "Manage notification preferences" })
        ] })
      ] })
    ] }) })
  ] });
}
function WhatsAppMockupCard({
  actorName,
  filmTitle,
  posterUrl
}) {
  return /* @__PURE__ */ jsxs("div", { style: styles.mockupContainer, className: "mobile-mockup-card", children: [
    /* @__PURE__ */ jsx("div", { style: styles.mockupHeader, children: /* @__PURE__ */ jsxs(Row, { children: [
      /* @__PURE__ */ jsx(Column, { style: { width: "36px" }, children: /* @__PURE__ */ jsx("div", { style: styles.whatsappIconCircle, children: /* @__PURE__ */ jsx("span", { style: { fontSize: "18px", lineHeight: "28px" }, children: "\u{1F4AC}" }) }) }),
      /* @__PURE__ */ jsxs(Column, { style: { paddingLeft: "8px" }, children: [
        /* @__PURE__ */ jsxs(Text, { style: styles.mockupSender, children: [
          "MuviDB Alerts ",
          /* @__PURE__ */ jsx("span", { style: { color: GREEN, fontWeight: 700 }, children: "\u2713 Verified" })
        ] }),
        /* @__PURE__ */ jsx(Text, { style: styles.mockupSubtext, children: "WhatsApp Cloud Delivery" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("div", { style: styles.whatsappBubble, children: /* @__PURE__ */ jsxs(Row, { children: [
      /* @__PURE__ */ jsx(Column, { style: { width: "84px", verticalAlign: "top" }, children: /* @__PURE__ */ jsx(
        Img,
        {
          src: posterUrl,
          width: "80",
          height: "115",
          alt: filmTitle,
          style: { borderRadius: "8px", objectFit: "cover" }
        }
      ) }),
      /* @__PURE__ */ jsxs(Column, { style: { paddingLeft: "12px", verticalAlign: "top" }, children: [
        /* @__PURE__ */ jsx(Text, { style: styles.whatsappBubbleTag, children: "\u{1F37F} NEW RELEASE NOTIFICATION" }),
        /* @__PURE__ */ jsxs(Text, { style: styles.whatsappBubbleTitle, children: [
          /* @__PURE__ */ jsx("strong", { children: actorName }),
          " stars in the new title",
          " ",
          /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: filmTitle }),
          "!"
        ] }),
        /* @__PURE__ */ jsx(Text, { style: styles.whatsappBubbleSnippet, children: "Now showing in cinemas & streaming. Tap below to see official credits and trailers." }),
        /* @__PURE__ */ jsx("div", { style: styles.whatsappActionPill, children: /* @__PURE__ */ jsx(Text, { style: styles.whatsappActionText, children: "\u{1F449} Watch Trailer & Showtimes" }) })
      ] })
    ] }) })
  ] });
}
function PortfolioMockupCard({
  personName,
  handle,
  photoUrl
}) {
  return /* @__PURE__ */ jsx("div", { style: styles.mockupContainer, className: "mobile-mockup-card", children: /* @__PURE__ */ jsxs("div", { style: styles.portfolioCardInner, children: [
    /* @__PURE__ */ jsx("div", { style: styles.portfolioHeroRow, children: /* @__PURE__ */ jsxs(Row, { children: [
      /* @__PURE__ */ jsx(Column, { style: { width: "64px", verticalAlign: "middle" }, children: /* @__PURE__ */ jsx(
        Img,
        {
          src: photoUrl,
          width: "60",
          height: "60",
          alt: personName,
          style: { borderRadius: "999px", objectFit: "cover", border: `2px solid ${ORANGE}` }
        }
      ) }),
      /* @__PURE__ */ jsxs(Column, { style: { paddingLeft: "12px", verticalAlign: "middle" }, children: [
        /* @__PURE__ */ jsxs(Text, { style: styles.portfolioName, children: [
          personName,
          " ",
          /* @__PURE__ */ jsx("span", { style: { color: "#EAB308" }, children: "\u2605 PRO" })
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.portfolioHandle, children: [
          "muvidb.com/@",
          handle
        ] }),
        /* @__PURE__ */ jsx(Text, { style: styles.portfolioBio, children: "Actor & Producer \u2022 32 Verified Screen Credits" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("div", { style: styles.portfolioLinkButton, children: /* @__PURE__ */ jsx(Text, { style: styles.portfolioLinkText, children: "\u{1F3AC} Watch 2026 Showreel" }) }),
    /* @__PURE__ */ jsx("div", { style: styles.portfolioLinkButton, children: /* @__PURE__ */ jsx(Text, { style: styles.portfolioLinkText, children: "\u{1F4FD}\uFE0F Verified Filmography on MuviDB (32 Films)" }) }),
    /* @__PURE__ */ jsx("div", { style: styles.portfolioLinkButton, children: /* @__PURE__ */ jsx(Text, { style: styles.portfolioLinkText, children: "\u{1F4C4} Download Electronic Press Kit (EPK)" }) })
  ] }) });
}
function RoundupMockupCard() {
  return /* @__PURE__ */ jsx("div", { style: styles.mockupContainer, className: "mobile-mockup-card", children: /* @__PURE__ */ jsxs(Row, { children: [
    /* @__PURE__ */ jsx(Column, { style: { width: "50%", paddingRight: "8px" }, children: /* @__PURE__ */ jsxs("div", { style: styles.roundupHalfCard, children: [
      /* @__PURE__ */ jsx(Text, { style: styles.roundupIcon, children: "\u{1F4AC}" }),
      /* @__PURE__ */ jsx(Text, { style: styles.roundupCardTitle, children: "WhatsApp Movie Alerts" }),
      /* @__PURE__ */ jsx(Text, { style: styles.roundupCardText, children: "Instant release drops on your phone." })
    ] }) }),
    /* @__PURE__ */ jsx(Column, { style: { width: "50%", paddingLeft: "8px" }, children: /* @__PURE__ */ jsxs("div", { style: styles.roundupHalfCard, children: [
      /* @__PURE__ */ jsx(Text, { style: styles.roundupIcon, children: "\u{1F3AC}" }),
      /* @__PURE__ */ jsx(Text, { style: styles.roundupCardTitle, children: "Link-in-Bio Portfolios" }),
      /* @__PURE__ */ jsx(Text, { style: styles.roundupCardText, children: "Verified filmography & reel for your social bio." })
    ] }) })
  ] }) });
}
var styles = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: "#F3F4F6",
    fontFamily: "Arial, Helvetica, sans-serif"
  },
  container: {
    maxWidth: "680px",
    margin: "24px auto",
    backgroundColor: "#FFFFFF",
    borderRadius: "18px",
    overflow: "hidden"
  },
  header: {
    padding: "28px 36px 14px"
  },
  logo: {
    display: "block",
    border: 0
  },
  viewInBrowser: {
    color: MUTED,
    fontSize: "12px",
    textDecoration: "none"
  },
  hero: {
    padding: "16px 36px 28px"
  },
  badgeWrapper: {
    marginBottom: "10px"
  },
  categoryBadge: {
    display: "inline-block",
    margin: 0,
    backgroundColor: "#FFF2EB",
    color: ORANGE,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "1px",
    padding: "5px 12px",
    borderRadius: "999px",
    textTransform: "uppercase"
  },
  eyebrow: {
    margin: "0 0 10px",
    color: MUTED,
    fontSize: "13px",
    lineHeight: "18px",
    letterSpacing: "2px",
    fontWeight: 700
  },
  heading: {
    margin: 0,
    color: TEXT,
    fontSize: "34px",
    lineHeight: "42px",
    fontWeight: 800
  },
  intro: {
    margin: "18px 0 12px",
    color: MUTED,
    fontSize: "16px",
    lineHeight: "26px"
  },
  button: {
    backgroundColor: ORANGE,
    borderRadius: "999px",
    color: "#FFFFFF",
    fontSize: "15px",
    fontWeight: 700,
    padding: "14px 26px",
    textDecoration: "none",
    display: "inline-block",
    marginRight: "12px"
  },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
    borderRadius: "999px",
    color: TEXT,
    fontSize: "14px",
    fontWeight: 700,
    padding: "14px 22px",
    textDecoration: "none",
    display: "inline-block"
  },
  mockupWrapper: {
    padding: "0 36px 24px"
  },
  mockupContainer: {
    backgroundColor: "#0F1216",
    borderRadius: "16px",
    padding: "20px",
    border: "1px solid #23272E"
  },
  mockupHeader: {
    marginBottom: "14px",
    borderBottom: "1px solid #1F242C",
    paddingBottom: "10px"
  },
  whatsappIconCircle: {
    width: "32px",
    height: "32px",
    borderRadius: "999px",
    backgroundColor: "#1E2B23",
    textAlign: "center"
  },
  mockupSender: {
    margin: 0,
    color: "#FFFFFF",
    fontSize: "13px",
    fontWeight: 700
  },
  mockupSubtext: {
    margin: 0,
    color: "#9CA3AF",
    fontSize: "11px"
  },
  whatsappBubble: {
    backgroundColor: "#192229",
    borderRadius: "12px",
    padding: "14px",
    border: "1px solid #2A3B32"
  },
  whatsappBubbleTag: {
    margin: "0 0 4px",
    color: GREEN,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.8px"
  },
  whatsappBubbleTitle: {
    margin: "0 0 6px",
    color: "#F9FAFB",
    fontSize: "14px",
    lineHeight: "20px"
  },
  whatsappBubbleSnippet: {
    margin: "0 0 10px",
    color: "#9CA3AF",
    fontSize: "12px",
    lineHeight: "18px"
  },
  whatsappActionPill: {
    backgroundColor: "#202D36",
    borderRadius: "6px",
    padding: "6px 10px",
    display: "inline-block",
    border: "1px solid #304443"
  },
  whatsappActionText: {
    margin: 0,
    color: "#34D399",
    fontSize: "12px",
    fontWeight: 700
  },
  portfolioCardInner: {
    backgroundColor: "#0A0C0E",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid #1E232B"
  },
  portfolioHeroRow: {
    marginBottom: "16px",
    borderBottom: "1px solid #1F242D",
    paddingBottom: "14px"
  },
  portfolioName: {
    margin: 0,
    color: "#FFFFFF",
    fontSize: "16px",
    fontWeight: 700
  },
  portfolioHandle: {
    margin: "2px 0",
    color: ORANGE,
    fontSize: "13px",
    fontWeight: 700
  },
  portfolioBio: {
    margin: 0,
    color: "#9CA3AF",
    fontSize: "12px"
  },
  portfolioLinkButton: {
    backgroundColor: "#161A20",
    borderRadius: "8px",
    padding: "10px 14px",
    marginBottom: "8px",
    border: "1px solid #272E38"
  },
  portfolioLinkText: {
    margin: 0,
    color: "#F3F4F6",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "center"
  },
  roundupHalfCard: {
    backgroundColor: "#161A20",
    borderRadius: "12px",
    padding: "16px 14px",
    border: "1px solid #272E38",
    textAlign: "center"
  },
  roundupIcon: {
    fontSize: "28px",
    margin: "0 0 6px"
  },
  roundupCardTitle: {
    margin: "0 0 6px",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 700
  },
  roundupCardText: {
    margin: 0,
    color: "#9CA3AF",
    fontSize: "12px",
    lineHeight: "17px"
  },
  highlightsSection: {
    padding: "24px 36px 30px",
    backgroundColor: LIGHT_BG,
    borderTop: `1px solid ${BORDER_COLOR}`,
    borderBottom: `1px solid ${BORDER_COLOR}`
  },
  sectionEyebrow: {
    margin: "0 0 6px",
    color: ORANGE,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "2px"
  },
  sectionTitle: {
    margin: "0 0 20px",
    color: TEXT,
    fontSize: "20px",
    lineHeight: "26px",
    fontWeight: 800
  },
  highlightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    padding: "14px 18px",
    marginBottom: "10px",
    border: `1px solid ${BORDER_COLOR}`
  },
  highlightTitle: {
    margin: 0,
    color: TEXT,
    fontSize: "15px",
    lineHeight: "20px",
    fontWeight: 700
  },
  highlightDescription: {
    margin: "4px 0 0",
    color: MUTED,
    fontSize: "13px",
    lineHeight: "20px"
  },
  stepsSection: {
    padding: "28px 36px 32px",
    backgroundColor: "#FFFFFF"
  },
  stepCol: {
    width: "33.33%",
    padding: "0 6px",
    verticalAlign: "top"
  },
  stepCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: "12px",
    padding: "16px 14px",
    border: `1px solid ${BORDER_COLOR}`,
    minHeight: "140px"
  },
  stepNumberBadge: {
    display: "inline-block",
    backgroundColor: "#FFF2EB",
    color: ORANGE,
    fontSize: "12px",
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: "6px",
    marginBottom: "8px"
  },
  stepTitle: {
    margin: "0 0 4px",
    color: TEXT,
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: "18px"
  },
  stepDescription: {
    margin: 0,
    color: MUTED,
    fontSize: "12px",
    lineHeight: "17px"
  },
  callout: {
    margin: "24px 36px",
    padding: "20px 22px",
    backgroundColor: "#FFF9F5",
    borderRadius: "14px",
    border: "1px solid #FFD9C4"
  },
  calloutBadge: {
    display: "inline-block",
    margin: "0 0 6px",
    color: ORANGE,
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1px"
  },
  calloutHeading: {
    margin: "0 0 6px",
    color: TEXT,
    fontSize: "16px",
    lineHeight: "22px",
    fontWeight: 700
  },
  calloutBody: {
    margin: 0,
    color: "#4B5563",
    fontSize: "14px",
    lineHeight: "22px"
  },
  bottomCtaSection: {
    padding: "16px 36px 28px",
    textAlign: "center"
  },
  bottomCtaHeading: {
    margin: "0 0 16px",
    color: TEXT,
    fontSize: "20px",
    lineHeight: "26px",
    fontWeight: 700
  },
  signoff: {
    padding: "10px 36px 24px",
    textAlign: "center"
  },
  signoffTitle: {
    margin: "0 0 4px",
    color: TEXT,
    fontSize: "14px",
    fontWeight: 700
  },
  signoffText: {
    margin: 0,
    color: MUTED,
    fontSize: "13px"
  },
  divider: {
    borderColor: "#E5E7EB",
    margin: 0
  },
  footer: {
    padding: "24px 36px 36px",
    backgroundColor: "#FAFAFA",
    textAlign: "center"
  },
  footerLabel: {
    color: TEXT,
    fontSize: "13px",
    fontWeight: 700,
    margin: "0 0 10px"
  },
  socialLinks: {
    margin: "0 0 16px",
    fontSize: "13px",
    color: MUTED
  },
  footerLink: {
    color: TEXT,
    textDecoration: "none",
    fontWeight: 600
  },
  legal: {
    color: "#9CA3AF",
    fontSize: "11px",
    lineHeight: "18px",
    margin: 0
  },
  legalLink: {
    color: MUTED,
    textDecoration: "underline"
  }
};
export {
  FEATURE_PRESETS,
  MuviDbFeatureAnnouncementEmail as default
};
