// api/_lib/MuviDbWelcomeEmail.tsx
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
var TEXT = "#15171A";
var MUTED = "#5F6368";
var CREAM = "#FFF9F5";
var PERSONA_CONFIG = {
  fan: {
    badge: "Account Type: Film Fan",
    headline: /* @__PURE__ */ jsxs(Fragment, { children: [
      "Welcome to the home of African cinema",
      /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: "!" })
    ] }),
    intro: (name) => `Hi ${name}, thanks for joining MuviDB! Whether you\u2019re looking for what to watch tonight or exploring the creators behind your favorite African stories, you\u2019re in the right place.`,
    ctaLabel: "Explore African Cinema \u2192",
    ctaUrl: "https://muvidb.com",
    preview: "Welcome to MuviDB \u2014 Your front row seat to African cinema",
    featuresEyebrow: "EVERYTHING YOU CAN DO ON MUVIDB",
    features: [
      {
        title: "Where to watch",
        text: "Instantly find where films are streaming or currently showing in cinemas."
      },
      {
        title: "Rate & watchlist",
        text: "Keep track of films you\u2019ve watched and build your personalized watchlist."
      },
      {
        title: "Follow talent",
        text: "Follow your favorite actors, directors, and get notified on new releases."
      },
      {
        title: "Community pulse",
        text: "Read real viewer reactions, critical reviews, and join the debate."
      }
    ]
  },
  professional: {
    badge: "Account Type: Industry Professional",
    headline: /* @__PURE__ */ jsxs(Fragment, { children: [
      "Welcome to your professional screen hub",
      /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: "!" })
    ] }),
    intro: (name) => `Hi ${name}, welcome to MuviDB Pro! As a creator shaping African screen culture, your craft deserves accurate, dispute-free documentation and worldwide visibility.`,
    ctaLabel: "Claim & Verify Your Profile \u2192",
    ctaUrl: "https://muvidb.com/pro-dashboard",
    preview: "Welcome to MuviDB \u2014 Claim and verify your official industry profile",
    featuresEyebrow: "HOW TO ELEVATE YOUR SCREEN CAREER ON MUVIDB",
    features: [
      {
        title: "Claim your profile",
        text: "Take ownership of your verified public filmography, biography, and photos."
      },
      {
        title: "Verified credits",
        text: "Document every film, series, and department credit with zero duplicate entries."
      },
      {
        title: "Global showcase",
        text: "Showcase your portfolio, reel, and achievements to producers worldwide."
      },
      {
        title: "Industry network",
        text: "Connect with fellow filmmakers, crew, and discover collaborative opportunities."
      }
    ]
  },
  company: {
    badge: "Account Type: Studio & Production Company",
    headline: /* @__PURE__ */ jsxs(Fragment, { children: [
      "Welcome to the African cinema directory",
      /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: "!" })
    ] }),
    intro: (name) => `Hi ${name}, welcome to MuviDB! We help production companies, distributors, and studios document their film catalogs, reach engaged audiences, and discover top-tier talent.`,
    ctaLabel: "Access Studio Portal \u2192",
    ctaUrl: "https://muvidb.com/dashboard",
    preview: "Welcome to MuviDB \u2014 Your film catalog and industry talent network",
    featuresEyebrow: "WHAT YOUR STUDIO CAN ACHIEVE ON MUVIDB",
    features: [
      {
        title: "Catalog management",
        text: "Submit and manage official movie listings, festival selections, and trailers."
      },
      {
        title: "Cast & crew credits",
        text: "Officially credit cast, HODs, and crew teams to build verified, dispute-free credits."
      },
      {
        title: "Audience reach",
        text: "Track viewer sentiment, ratings, and market presence across your releases."
      },
      {
        title: "Talent discovery",
        text: "Find vetted actors, directors, cinematographers, and crew across Africa."
      }
    ]
  }
};
function MuviDbWelcomeEmail({
  firstName = "there",
  logoUrl,
  persona,
  roleBadge,
  exploreUrl = "https://muvidb.com",
  helpUrl = "https://muvidb.com/about",
  unsubscribeUrl = "https://muvidb.com",
  preview,
  eyebrow = "WELCOME TO",
  headline,
  intro,
  ctaLabel,
  ctaUrl,
  compact = false,
  features,
  collage,
  social = {}
}) {
  const personaConfig = persona ? PERSONA_CONFIG[persona] : null;
  const resolvedPreview = preview || personaConfig?.preview || "Welcome to MuviDB, the home of African cinema.";
  const resolvedRoleBadge = roleBadge || personaConfig?.badge;
  const resolvedIntro = intro || (personaConfig ? personaConfig.intro(firstName) : `Hi ${firstName}, thanks for joining MuviDB \u2014 the home of African films, television, and the people who bring those stories to life.`);
  const resolvedCtaLabel = ctaLabel || personaConfig?.ctaLabel || "Explore MuviDB \u2192";
  const resolvedCtaUrl = ctaUrl || personaConfig?.ctaUrl || exploreUrl;
  const resolvedFeatures = features || personaConfig?.features || [
    { title: "Explore", text: "Browse films, television, short films, and more from across Africa." },
    { title: "Discover people", text: "Explore actors, directors, producers, writers, crew, and their credits." },
    { title: "Where to watch", text: "See where films are streaming or currently showing in cinemas." },
    { title: "Stay updated", text: "Follow releases, reviews, trailers, and highlights from African cinema." }
  ];
  const featuresEyebrow = personaConfig?.featuresEyebrow || "EVERYTHING YOU CAN DO ON MUVIDB";
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
        ` }) }),
    /* @__PURE__ */ jsx(Preview, { children: resolvedPreview }),
    /* @__PURE__ */ jsx(Body, { style: styles.body, children: /* @__PURE__ */ jsxs(Container, { style: styles.container, className: "mobile-container", children: [
      /* @__PURE__ */ jsx(Section, { style: styles.header, className: "mobile-header", children: /* @__PURE__ */ jsxs(Row, { children: [
        /* @__PURE__ */ jsx(Column, { children: /* @__PURE__ */ jsx(Img, { src: logoUrl, width: "160", alt: "MuviDB", style: styles.logo }) }),
        /* @__PURE__ */ jsx(Column, { align: "right", children: /* @__PURE__ */ jsx(Link, { href: exploreUrl, style: styles.viewInBrowser, children: "View in browser" }) })
      ] }) }),
      /* @__PURE__ */ jsx(Section, { style: styles.hero, className: "mobile-hero", children: /* @__PURE__ */ jsxs(Row, { children: [
        /* @__PURE__ */ jsxs(Column, { style: styles.heroCopy, className: "mobile-hero-copy", children: [
          resolvedRoleBadge && /* @__PURE__ */ jsx(Section, { style: { margin: "0 0 10px" }, children: /* @__PURE__ */ jsx(Text, { style: styles.roleBadge, children: resolvedRoleBadge }) }),
          /* @__PURE__ */ jsx(Text, { style: styles.eyebrow, children: eyebrow }),
          headline ? /* @__PURE__ */ jsx(Heading, { style: styles.heading, className: "mobile-heading", children: headline }) : personaConfig ? /* @__PURE__ */ jsx(Heading, { style: styles.heading, className: "mobile-heading", children: personaConfig.headline }) : /* @__PURE__ */ jsxs(Heading, { style: styles.heading, className: "mobile-heading", children: [
            "Muvi",
            /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: "DB" }),
            /* @__PURE__ */ jsx("br", {}),
            "You're in",
            /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: "!" })
          ] }),
          /* @__PURE__ */ jsx(Text, { style: styles.intro, className: "mobile-intro", children: resolvedIntro }),
          !compact && /* @__PURE__ */ jsx(Text, { style: styles.boldText, children: "We're excited to have you with us." }),
          /* @__PURE__ */ jsx(Button, { href: resolvedCtaUrl, style: styles.button, className: "mobile-btn", children: resolvedCtaLabel })
        ] }),
        /* @__PURE__ */ jsx(Column, { style: styles.heroArt, className: "mobile-hero-art", children: /* @__PURE__ */ jsx(CinemaCollage, { images: collage }) })
      ] }) }),
      !compact && /* @__PURE__ */ jsxs(Section, { style: styles.featuresSection, className: "mobile-features-section", children: [
        /* @__PURE__ */ jsx(Text, { style: styles.sectionEyebrow, children: featuresEyebrow }),
        /* @__PURE__ */ jsx(Hr, { style: styles.sectionRule }),
        /* @__PURE__ */ jsx(Row, { children: resolvedFeatures.map((f, i) => /* @__PURE__ */ jsx(Feature, { title: f.title, text: f.text }, i)) })
      ] }),
      !compact && /* @__PURE__ */ jsx(Section, { style: styles.missionWrapper, className: "mobile-mission-wrapper", children: /* @__PURE__ */ jsxs(Row, { style: styles.mission, children: [
        /* @__PURE__ */ jsxs(Column, { style: styles.missionCopy, className: "mobile-mission-copy", children: [
          /* @__PURE__ */ jsx(Heading, { as: "h2", style: styles.missionTitle, children: "Our Mission" }),
          /* @__PURE__ */ jsxs(Text, { style: styles.missionText, children: [
            "MuviDB exists to document, connect, and amplify African stories and the people behind them. We believe",
            " ",
            /* @__PURE__ */ jsx("span", { style: { color: ORANGE, fontWeight: 700 }, children: "every credit counts." })
          ] })
        ] }),
        /* @__PURE__ */ jsx(Column, { style: styles.missionStatementColumn, className: "mobile-mission-statement-col", children: /* @__PURE__ */ jsxs(Text, { style: styles.missionStatement, className: "mobile-mission-statement", children: [
          "Discover.",
          /* @__PURE__ */ jsx("br", {}),
          "Connect.",
          /* @__PURE__ */ jsx("br", {}),
          "Celebrate."
        ] }) })
      ] }) }),
      /* @__PURE__ */ jsxs(Section, { style: styles.signoff, className: "mobile-signoff", children: [
        /* @__PURE__ */ jsx(Text, { style: styles.signoffTitle, children: "Thanks for being part of this journey." }),
        /* @__PURE__ */ jsx(Text, { style: styles.signoffText, children: "The best of African cinema starts with you." }),
        /* @__PURE__ */ jsxs(Text, { style: styles.signoffText, children: [
          "\u2014 The",
          " ",
          /* @__PURE__ */ jsx("span", { style: { color: ORANGE, fontWeight: 700 }, children: "MuviDB" }),
          " Team"
        ] })
      ] }),
      /* @__PURE__ */ jsx(Hr, { style: styles.divider }),
      /* @__PURE__ */ jsxs(Section, { style: styles.footer, className: "mobile-footer", children: [
        /* @__PURE__ */ jsx(Text, { style: styles.footerLabel, children: "Follow us for more updates" }),
        /* @__PURE__ */ jsxs(Text, { style: styles.socialLinks, children: [
          social.instagram && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Link, { href: social.instagram, style: styles.footerLink, children: "Instagram" }),
            " \xB7 "
          ] }),
          social.x && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Link, { href: social.x, style: styles.footerLink, children: "X" }),
            " \xB7 "
          ] }),
          social.tiktok && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Link, { href: social.tiktok, style: styles.footerLink, children: "TikTok" }),
            " \xB7 "
          ] }),
          social.linkedin && /* @__PURE__ */ jsx(Link, { href: social.linkedin, style: styles.footerLink, children: "LinkedIn" })
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.legal, children: [
          "Need help? Reply to this email or",
          " ",
          /* @__PURE__ */ jsx(Link, { href: helpUrl, style: styles.legalLink, children: "visit About MuviDB" }),
          ".",
          /* @__PURE__ */ jsx("br", {}),
          "\xA9 ",
          (/* @__PURE__ */ new Date()).getFullYear(),
          " MuviDB. All rights reserved.",
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx(Link, { href: unsubscribeUrl, style: styles.legalLink, children: "Unsubscribe" })
        ] })
      ] })
    ] }) })
  ] });
}
function CinemaCollage({
  images
}) {
  return /* @__PURE__ */ jsx(Section, { style: styles.collageOuter, children: /* @__PURE__ */ jsxs(Row, { children: [
    /* @__PURE__ */ jsxs(Column, { style: styles.collageLeft, children: [
      /* @__PURE__ */ jsx(
        Img,
        {
          src: images.actor,
          width: "126",
          height: "144",
          alt: "African actor",
          style: { ...styles.collageImage, marginBottom: "8px" }
        }
      ),
      /* @__PURE__ */ jsx(
        Img,
        {
          src: images.productionStill,
          width: "126",
          height: "100",
          alt: "African film production",
          style: styles.collageImage
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(Column, { style: styles.collageRight, children: [
      /* @__PURE__ */ jsx(
        Img,
        {
          src: images.featuredPerson,
          width: "142",
          height: "178",
          alt: "Featured African film professional",
          style: { ...styles.collageImage, marginBottom: "8px" }
        }
      ),
      /* @__PURE__ */ jsxs(Row, { children: [
        /* @__PURE__ */ jsx(Column, { style: { paddingRight: "4px" }, children: /* @__PURE__ */ jsx(
          Img,
          {
            src: images.moviePoster,
            width: "67",
            height: "94",
            alt: "African movie poster",
            style: styles.collageMiniImage
          }
        ) }),
        /* @__PURE__ */ jsx(Column, { style: { paddingLeft: "4px" }, children: /* @__PURE__ */ jsx(
          Img,
          {
            src: images.filmmaker,
            width: "67",
            height: "94",
            alt: "African filmmaker",
            style: styles.collageMiniImage
          }
        ) })
      ] })
    ] })
  ] }) });
}
function Feature({ title, text }) {
  return /* @__PURE__ */ jsx(Column, { style: styles.feature, className: "mobile-feature-col", children: /* @__PURE__ */ jsxs("div", { className: "mobile-feature-card", children: [
    /* @__PURE__ */ jsx(Text, { style: styles.featureTitle, className: "mobile-feature-title", children: title }),
    /* @__PURE__ */ jsx(Text, { style: styles.featureText, className: "mobile-feature-text", children: text })
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
    padding: "28px 36px 10px"
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
    padding: "24px 36px 38px"
  },
  heroCopy: {
    width: "51%",
    paddingRight: "20px",
    verticalAlign: "middle"
  },
  heroArt: {
    width: "49%",
    verticalAlign: "middle"
  },
  roleBadge: {
    display: "inline-block",
    margin: 0,
    backgroundColor: "#FFF0EA",
    border: `1px solid ${ORANGE}`,
    color: ORANGE,
    fontSize: "10px",
    lineHeight: "14px",
    fontWeight: 800,
    letterSpacing: "1.2px",
    padding: "4px 10px",
    borderRadius: "999px",
    textTransform: "uppercase"
  },
  eyebrow: {
    margin: "0 0 10px",
    color: ORANGE,
    fontSize: "13px",
    lineHeight: "18px",
    letterSpacing: "2.6px",
    fontWeight: 700
  },
  heading: {
    margin: 0,
    color: TEXT,
    fontSize: "40px",
    lineHeight: "46px",
    fontWeight: 800
  },
  intro: {
    margin: "18px 0 10px",
    color: MUTED,
    fontSize: "16px",
    lineHeight: "25px"
  },
  boldText: {
    margin: "0 0 22px",
    color: TEXT,
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: 700
  },
  button: {
    backgroundColor: ORANGE,
    borderRadius: "999px",
    color: "#FFFFFF",
    fontSize: "16px",
    fontWeight: 700,
    padding: "14px 24px",
    textDecoration: "none"
  },
  collageOuter: {
    padding: "8px",
    backgroundColor: "#FFF8F4",
    borderRadius: "28px"
  },
  collageLeft: {
    width: "48%",
    paddingRight: "5px",
    verticalAlign: "bottom"
  },
  collageRight: {
    width: "52%",
    paddingLeft: "5px",
    verticalAlign: "top"
  },
  collageImage: {
    display: "block",
    width: "100%",
    objectFit: "cover",
    borderRadius: "18px",
    border: "3px solid #FFFFFF"
  },
  collageMiniImage: {
    display: "block",
    width: "100%",
    objectFit: "cover",
    borderRadius: "14px",
    border: "3px solid #FFFFFF"
  },
  featuresSection: {
    backgroundColor: CREAM,
    padding: "30px 24px 36px"
  },
  sectionEyebrow: {
    margin: "0 0 8px",
    textAlign: "center",
    color: ORANGE,
    fontSize: "12px",
    lineHeight: "18px",
    letterSpacing: "2.6px",
    fontWeight: 700
  },
  sectionRule: {
    borderColor: ORANGE,
    borderWidth: "2px",
    width: "48px",
    margin: "0 auto 18px"
  },
  feature: {
    width: "25%",
    padding: "8px",
    textAlign: "center",
    verticalAlign: "top"
  },
  featureTitle: {
    margin: "0",
    color: TEXT,
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 700
  },
  featureText: {
    margin: "7px 0 0",
    color: MUTED,
    fontSize: "12px",
    lineHeight: "19px"
  },
  missionWrapper: {
    padding: "28px"
  },
  mission: {
    backgroundColor: "#111316",
    borderRadius: "16px"
  },
  missionCopy: {
    width: "57%",
    padding: "27px 28px",
    verticalAlign: "middle"
  },
  missionStatementColumn: {
    width: "43%",
    padding: "27px 22px",
    verticalAlign: "middle",
    borderLeft: "1px solid #35383C"
  },
  missionTitle: {
    margin: "0 0 12px",
    color: "#FFFFFF",
    fontSize: "23px",
    lineHeight: "29px"
  },
  missionText: {
    margin: 0,
    color: "#E4E6E8",
    fontSize: "14px",
    lineHeight: "23px"
  },
  missionStatement: {
    margin: 0,
    color: ORANGE,
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontStyle: "italic",
    fontSize: "24px",
    lineHeight: "34px"
  },
  signoff: {
    padding: "4px 36px 28px"
  },
  signoffTitle: {
    margin: 0,
    color: TEXT,
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: 700
  },
  signoffText: {
    margin: "6px 0 0",
    color: MUTED,
    fontSize: "15px",
    lineHeight: "23px"
  },
  divider: {
    borderColor: "#ECEDEF",
    margin: "0 28px"
  },
  footer: {
    padding: "24px 28px 30px",
    textAlign: "center"
  },
  footerLabel: {
    margin: 0,
    color: MUTED,
    fontSize: "13px"
  },
  socialLinks: {
    margin: "10px 0 0",
    fontSize: "13px"
  },
  footerLink: {
    color: TEXT,
    textDecoration: "none"
  },
  legal: {
    margin: "18px 0 0",
    color: "#92969B",
    fontSize: "12px",
    lineHeight: "19px"
  },
  legalLink: {
    color: "#92969B",
    textDecoration: "underline"
  }
};
export {
  MuviDbWelcomeEmail as default
};
