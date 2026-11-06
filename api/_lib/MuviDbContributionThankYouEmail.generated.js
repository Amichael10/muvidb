// api/_lib/MuviDbContributionThankYouEmail.tsx
import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text
} from "@react-email/components";
import { jsx, jsxs } from "react/jsx-runtime";
var ORANGE = "#FF5A1F";
var DARK_BG = "#0B0B0E";
var CARD_BG = "#141418";
var BORDER = "#26262E";
var TEXT_PRIMARY = "#FFFFFF";
var TEXT_MUTED = "#9E9EA8";
var EMERALD = "#10B981";
var KIND_LABELS = {
  poster: { label: "Poster & Key Art Update", icon: "\u{1F3A8}" },
  credits: { label: "Cast & Crew Credit Addition", icon: "\u{1F3AC}" },
  synopsis: { label: "Plot Synopsis & Tagline", icon: "\u{1F4DD}" },
  release_date: { label: "Release Date & Theatrical Status", icon: "\u{1F4C5}" },
  trailer: { label: "Official Showreel / Trailer Link", icon: "\u25B6\uFE0F" },
  general: { label: "Catalogue Record Improvement", icon: "\u26A1" }
};
function MuviDbContributionThankYouEmail({
  contributorName = "Film Friend",
  items,
  contributionType = "poster",
  itemTitle = "The Beacon Man (2026)",
  itemUrl = "https://muvidb.com",
  detailsSummary = "High-resolution official theatrical poster updated and published.",
  logoUrl = "https://muvidb.com/brand/wordmark-dark.png",
  dashboardUrl = "https://muvidb.com/dashboard",
  browseUrl = "https://muvidb.com/browse",
  social = {
    instagram: "https://instagram.com/muvidb",
    x: "https://x.com/muvidb",
    whatsapp: "https://chat.whatsapp.com/muvidb",
    youtube: "https://youtube.com/@muvidb"
  }
}) {
  const firstName = contributorName.trim().split(/\s+/)[0] || "there";
  const normalizedItems = items && items.length > 0 ? items : [
    {
      itemTitle,
      itemUrl,
      contributionType,
      detailsSummary
    }
  ];
  const isMultiple = normalizedItems.length > 1;
  const primaryTitle = normalizedItems[0]?.itemTitle || "Your submission";
  const previewText = isMultiple ? `${normalizedItems.length} contributions verified and now live on MuviDB!` : `Your contribution to ${primaryTitle} has been verified and is now live on MuviDB!`;
  const primaryActionUrl = isMultiple ? dashboardUrl || "https://muvidb.com/dashboard" : normalizedItems[0]?.itemUrl || "https://muvidb.com";
  const primaryActionText = isMultiple ? "View Your Contributions on MuviDB \u2192" : "View Updated Title on MuviDB \u2192";
  return /* @__PURE__ */ jsxs(Html, { lang: "en", children: [
    /* @__PURE__ */ jsxs(Head, { children: [
      /* @__PURE__ */ jsx("title", { children: "Thank you for contributing to MuviDB" }),
      /* @__PURE__ */ jsx("meta", { name: "color-scheme", content: "dark" }),
      /* @__PURE__ */ jsx("meta", { name: "supported-color-schemes", content: "dark" })
    ] }),
    /* @__PURE__ */ jsx(Preview, { children: previewText }),
    /* @__PURE__ */ jsx(
      Body,
      {
        style: {
          backgroundColor: DARK_BG,
          color: TEXT_PRIMARY,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: "24px 12px"
        },
        children: /* @__PURE__ */ jsxs(
          Container,
          {
            style: {
              maxWidth: "560px",
              margin: "0 auto",
              backgroundColor: DARK_BG
            },
            children: [
              /* @__PURE__ */ jsx(Section, { style: { padding: "24px 0 20px", textAlign: "center" }, children: /* @__PURE__ */ jsx(Link, { href: "https://muvidb.com", target: "_blank", style: { textDecoration: "none", display: "inline-block" }, children: /* @__PURE__ */ jsx(
                Img,
                {
                  src: logoUrl,
                  width: "160",
                  height: "49",
                  alt: "MuviDB",
                  style: {
                    display: "block",
                    margin: "0 auto",
                    border: "0",
                    outline: "none",
                    textDecoration: "none"
                  }
                }
              ) }) }),
              /* @__PURE__ */ jsxs(
                Section,
                {
                  style: {
                    backgroundColor: CARD_BG,
                    borderRadius: "20px",
                    border: `1px solid ${BORDER}`,
                    padding: "36px 28px",
                    textAlign: "left",
                    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)"
                  },
                  children: [
                    /* @__PURE__ */ jsx("div", { style: { marginBottom: "20px" }, children: /* @__PURE__ */ jsx(
                      "span",
                      {
                        style: {
                          display: "inline-block",
                          backgroundColor: "rgba(16, 185, 129, 0.12)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          color: EMERALD,
                          fontSize: "11px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          padding: "4px 12px",
                          borderRadius: "100px"
                        },
                        children: "\u25CF Verified & Live in Database"
                      }
                    ) }),
                    /* @__PURE__ */ jsx(
                      Heading,
                      {
                        as: "h1",
                        style: {
                          fontSize: "24px",
                          fontWeight: 900,
                          color: TEXT_PRIMARY,
                          letterSpacing: "-0.5px",
                          lineHeight: "1.25",
                          margin: "0 0 16px"
                        },
                        children: isMultiple ? `Thank you for your contributions, ${firstName}!` : `Thank you for contributing, ${firstName}!`
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      Text,
                      {
                        style: {
                          fontSize: "14px",
                          lineHeight: "1.6",
                          color: TEXT_MUTED,
                          margin: "0 0 24px"
                        },
                        children: isMultiple ? `Our editorial team reviewed and verified your ${normalizedItems.length} recent submissions. Everything has been officially published to Africa\u2019s living film and theatre record.` : "Your submission has been reviewed by our editorial team, verified, and officially published to Africa\u2019s living film and theatre record."
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      Section,
                      {
                        style: {
                          backgroundColor: "#1A1A22",
                          borderRadius: "14px",
                          border: `1px solid ${BORDER}`,
                          padding: "20px",
                          marginBottom: "28px"
                        },
                        children: /* @__PURE__ */ jsx("table", { width: "100%", cellPadding: 0, cellSpacing: 0, border: 0, children: /* @__PURE__ */ jsx("tbody", { children: normalizedItems.map((item, index) => {
                          const kindKey = item.contributionType || "general";
                          const kind = KIND_LABELS[kindKey] || {
                            label: String(kindKey).replace(/_/g, " "),
                            icon: "\u2728"
                          };
                          const isLast = index === normalizedItems.length - 1;
                          return /* @__PURE__ */ jsxs(React.Fragment, { children: [
                            /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsxs("td", { style: { paddingBottom: "12px", paddingTop: index > 0 ? "16px" : "0" }, children: [
                              /* @__PURE__ */ jsx(
                                Text,
                                {
                                  style: {
                                    fontSize: "10px",
                                    fontWeight: 800,
                                    color: ORANGE,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    margin: "0 0 4px"
                                  },
                                  children: isMultiple ? `Contribution #${index + 1} \u2014 Target Record` : "Target Production / Record"
                                }
                              ),
                              /* @__PURE__ */ jsx(
                                Text,
                                {
                                  style: {
                                    fontSize: "16px",
                                    fontWeight: 800,
                                    color: TEXT_PRIMARY,
                                    margin: 0
                                  },
                                  children: item.itemUrl ? /* @__PURE__ */ jsx(
                                    Link,
                                    {
                                      href: item.itemUrl,
                                      target: "_blank",
                                      style: { color: TEXT_PRIMARY, textDecoration: "none" },
                                      children: item.itemTitle
                                    }
                                  ) : item.itemTitle
                                }
                              )
                            ] }) }),
                            /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsxs(
                              "td",
                              {
                                style: {
                                  paddingTop: "10px",
                                  paddingBottom: isLast ? "0" : "16px",
                                  borderBottom: isLast ? "none" : "1px solid rgba(255, 255, 255, 0.08)"
                                },
                                children: [
                                  /* @__PURE__ */ jsx(
                                    Text,
                                    {
                                      style: {
                                        fontSize: "10px",
                                        fontWeight: 800,
                                        color: TEXT_MUTED,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.1em",
                                        margin: "0 0 4px"
                                      },
                                      children: "Verified Change"
                                    }
                                  ),
                                  /* @__PURE__ */ jsxs(
                                    Text,
                                    {
                                      style: {
                                        fontSize: "13px",
                                        fontWeight: 700,
                                        color: "#E4E4E7",
                                        margin: "0 0 6px"
                                      },
                                      children: [
                                        kind.icon,
                                        " ",
                                        kind.label
                                      ]
                                    }
                                  ),
                                  item.detailsSummary ? /* @__PURE__ */ jsx(
                                    Text,
                                    {
                                      style: {
                                        fontSize: "12px",
                                        lineHeight: "1.5",
                                        color: TEXT_MUTED,
                                        margin: 0
                                      },
                                      children: item.detailsSummary
                                    }
                                  ) : null
                                ]
                              }
                            ) })
                          ] }, index);
                        }) }) })
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      Section,
                      {
                        style: {
                          backgroundColor: "rgba(255, 90, 31, 0.05)",
                          borderLeft: `3px solid ${ORANGE}`,
                          padding: "12px 16px",
                          borderRadius: "4px",
                          marginBottom: "28px"
                        },
                        children: /* @__PURE__ */ jsxs(
                          Text,
                          {
                            style: {
                              fontSize: "12px",
                              lineHeight: "1.55",
                              color: "#D4D4D8",
                              margin: 0
                            },
                            children: [
                              /* @__PURE__ */ jsx("strong", { children: "Why this matters:" }),
                              " Accurate posters, verified credits, and proper theatrical documentation ensure Nollywood history is recorded correctly for audiences, festival programmers, and future generations."
                            ]
                          }
                        )
                      }
                    ),
                    /* @__PURE__ */ jsx(Section, { style: { textAlign: "center", marginBottom: "24px" }, children: /* @__PURE__ */ jsx(
                      Button,
                      {
                        href: primaryActionUrl,
                        style: {
                          backgroundColor: ORANGE,
                          color: "#FFFFFF",
                          fontSize: "13px",
                          fontWeight: 800,
                          textDecoration: "none",
                          padding: "14px 28px",
                          borderRadius: "10px",
                          display: "inline-block",
                          letterSpacing: "0.02em",
                          boxShadow: "0 4px 14px rgba(255, 90, 31, 0.35)"
                        },
                        children: primaryActionText
                      }
                    ) }),
                    /* @__PURE__ */ jsxs(
                      Text,
                      {
                        style: {
                          fontSize: "12px",
                          textAlign: "center",
                          color: TEXT_MUTED,
                          margin: 0
                        },
                        children: [
                          "Want to contribute more?",
                          " ",
                          /* @__PURE__ */ jsx(
                            Link,
                            {
                              href: browseUrl,
                              style: {
                                color: TEXT_PRIMARY,
                                fontWeight: 700,
                                textDecoration: "underline"
                              },
                              children: "Explore other titles needing enrichment"
                            }
                          )
                        ]
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(Section, { style: { padding: "28px 12px 12px", textAlign: "center" }, children: [
                /* @__PURE__ */ jsx(
                  Text,
                  {
                    style: {
                      fontSize: "11px",
                      fontWeight: 700,
                      color: TEXT_MUTED,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      margin: "0 0 10px"
                    },
                    children: "MuviDB Community Contributor Program"
                  }
                ),
                /* @__PURE__ */ jsx(
                  Text,
                  {
                    style: {
                      fontSize: "11px",
                      lineHeight: "1.5",
                      color: "#52525B",
                      maxWidth: "420px",
                      margin: "0 auto 16px"
                    },
                    children: "The living record of African film & theatre."
                  }
                ),
                /* @__PURE__ */ jsxs(Text, { style: { fontSize: "11px", color: "#71717A", margin: 0 }, children: [
                  /* @__PURE__ */ jsx(
                    Link,
                    {
                      href: social.instagram,
                      style: { color: "#A1A1AA", textDecoration: "none", margin: "0 8px" },
                      children: "Instagram"
                    }
                  ),
                  "\xB7",
                  /* @__PURE__ */ jsx(
                    Link,
                    {
                      href: social.x,
                      style: { color: "#A1A1AA", textDecoration: "none", margin: "0 8px" },
                      children: "X (Twitter)"
                    }
                  ),
                  "\xB7",
                  /* @__PURE__ */ jsx(
                    Link,
                    {
                      href: "https://muvidb.com",
                      style: { color: "#A1A1AA", textDecoration: "none", margin: "0 8px" },
                      children: "muvidb.com"
                    }
                  )
                ] })
              ] })
            ]
          }
        )
      }
    )
  ] });
}
export {
  MuviDbContributionThankYouEmail as default
};
