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
function MuviDbWelcomeEmail({
  firstName = "there",
  logoUrl,
  exploreUrl = "https://muvidb.com",
  helpUrl = "https://muvidb.com/about",
  unsubscribeUrl = "https://muvidb.com",
  preview = "Welcome to MuviDB, the home of African cinema.",
  eyebrow = "WELCOME TO",
  headline,
  intro,
  ctaLabel = "Explore MuviDB \u2192",
  ctaUrl,
  compact = false,
  collage,
  social = {}
}) {
  const actionUrl = ctaUrl || exploreUrl;
  const heroIntro = intro ?? `Hi ${firstName}, thanks for joining MuviDB \u2014 the home of African films, television, and the people who bring those stories to life.`;
  return /* @__PURE__ */ jsxs(Html, { lang: "en", children: [
    /* @__PURE__ */ jsx(Head, {}),
    /* @__PURE__ */ jsx(Preview, { children: preview }),
    /* @__PURE__ */ jsx(Body, { style: styles.body, children: /* @__PURE__ */ jsxs(Container, { style: styles.container, children: [
      /* @__PURE__ */ jsx(Section, { style: styles.header, children: /* @__PURE__ */ jsxs(Row, { children: [
        /* @__PURE__ */ jsx(Column, { children: /* @__PURE__ */ jsx(Img, { src: logoUrl, width: "160", alt: "MuviDB", style: styles.logo }) }),
        /* @__PURE__ */ jsx(Column, { align: "right", children: /* @__PURE__ */ jsx(Link, { href: exploreUrl, style: styles.viewInBrowser, children: "View in browser" }) })
      ] }) }),
      /* @__PURE__ */ jsx(Section, { style: styles.hero, children: /* @__PURE__ */ jsxs(Row, { children: [
        /* @__PURE__ */ jsxs(Column, { style: styles.heroCopy, children: [
          /* @__PURE__ */ jsx(Text, { style: styles.eyebrow, children: eyebrow }),
          headline ? /* @__PURE__ */ jsx(Heading, { style: styles.heading, children: headline }) : /* @__PURE__ */ jsxs(Heading, { style: styles.heading, children: [
            "Muvi",
            /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: "DB" }),
            /* @__PURE__ */ jsx("br", {}),
            "You're in",
            /* @__PURE__ */ jsx("span", { style: { color: ORANGE }, children: "!" })
          ] }),
          /* @__PURE__ */ jsx(Text, { style: styles.intro, children: heroIntro }),
          !compact && /* @__PURE__ */ jsx(Text, { style: styles.boldText, children: "We're excited to have you with us." }),
          /* @__PURE__ */ jsx(Button, { href: actionUrl, style: styles.button, children: ctaLabel })
        ] }),
        /* @__PURE__ */ jsx(Column, { style: styles.heroArt, children: /* @__PURE__ */ jsx(CinemaCollage, { images: collage }) })
      ] }) }),
      !compact && /* @__PURE__ */ jsxs(Section, { style: styles.featuresSection, children: [
        /* @__PURE__ */ jsx(Text, { style: styles.sectionEyebrow, children: "EVERYTHING YOU CAN DO ON MUVIDB" }),
        /* @__PURE__ */ jsx(Hr, { style: styles.sectionRule }),
        /* @__PURE__ */ jsxs(Row, { children: [
          /* @__PURE__ */ jsx(
            Feature,
            {
              title: "Explore",
              text: "Browse films, television, short films, and more from across Africa."
            }
          ),
          /* @__PURE__ */ jsx(
            Feature,
            {
              title: "Discover people",
              text: "Explore actors, directors, producers, writers, crew, and their credits."
            }
          ),
          /* @__PURE__ */ jsx(
            Feature,
            {
              title: "Where to watch",
              text: "See where films are streaming or currently showing in cinemas."
            }
          ),
          /* @__PURE__ */ jsx(
            Feature,
            {
              title: "Stay updated",
              text: "Follow releases, reviews, trailers, and highlights from African cinema."
            }
          )
        ] })
      ] }),
      !compact && /* @__PURE__ */ jsx(Section, { style: styles.missionWrapper, children: /* @__PURE__ */ jsxs(Row, { style: styles.mission, children: [
        /* @__PURE__ */ jsxs(Column, { style: styles.missionCopy, children: [
          /* @__PURE__ */ jsx(Heading, { as: "h2", style: styles.missionTitle, children: "Our Mission" }),
          /* @__PURE__ */ jsxs(Text, { style: styles.missionText, children: [
            "MuviDB exists to document, connect, and amplify African stories and the people behind them. We believe",
            " ",
            /* @__PURE__ */ jsx("span", { style: { color: ORANGE, fontWeight: 700 }, children: "every credit counts." })
          ] })
        ] }),
        /* @__PURE__ */ jsx(Column, { style: styles.missionStatementColumn, children: /* @__PURE__ */ jsxs(Text, { style: styles.missionStatement, children: [
          "Discover.",
          /* @__PURE__ */ jsx("br", {}),
          "Connect.",
          /* @__PURE__ */ jsx("br", {}),
          "Celebrate."
        ] }) })
      ] }) }),
      /* @__PURE__ */ jsxs(Section, { style: styles.signoff, children: [
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
      /* @__PURE__ */ jsxs(Section, { style: styles.footer, children: [
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
  return /* @__PURE__ */ jsxs(Column, { style: styles.feature, children: [
    /* @__PURE__ */ jsx(Text, { style: styles.featureTitle, children: title }),
    /* @__PURE__ */ jsx(Text, { style: styles.featureText, children: text })
  ] });
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
