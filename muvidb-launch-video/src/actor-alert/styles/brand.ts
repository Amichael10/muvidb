/**
 * MuviDB brand tokens.
 *
 * `orange` is lifted from the app's own `--color-brand` (src/index.css in the
 * main repo), not eyeballed from a screenshot, so the video and the product
 * stay in sync if the brand colour ever moves.
 */
export const brand = {
  orange: "#FF5A1F",
  orangeDeep: "#E2440D",
  orangeSoft: "rgba(255, 90, 31, 0.14)",

  /** Page backgrounds, sampled from the captured product UI. */
  black: "#08080A",
  charcoal: "#0C0C0F",
  surface: "#131317",
  surfaceRaised: "#1A1A20",
  hairline: "rgba(255, 255, 255, 0.08)",

  white: "#FFFFFF",
  text: "#F4F4F5",
  textMuted: "#A1A1AA",
  textDim: "#71717A",

  /** WhatsApp's own palette - never restyled to MuviDB orange. */
  whatsapp: {
    green: "#25D366",
    headerDark: "#1F2C34",
    chatBg: "#0B141A",
    bubbleIn: "#1F2C34",
    bubbleOut: "#005C4B",
    tick: "#53BDEB",
    link: "#53BDEB",
    divider: "rgba(255,255,255,0.08)",
  },

  netflixRed: "#E50914",
} as const;

export const fonts = {
  /** Display / headlines. */
  title: '"Bebas Neue", Impact, sans-serif',
  /** Body copy and UI text. */
  body: '"Host Grotesk", "Inter", system-ui, sans-serif',
  /** Small caps labels and metadata. */
  label: '"Barlow Condensed", "Barlow", sans-serif',
} as const;

/**
 * Safe areas for social export. Vertical video gets eaten by platform chrome:
 * TikTok's right rail and caption block, Instagram's bottom bar. Nothing
 * essential is allowed inside these margins.
 */
export const safeArea = {
  vertical: { top: 190, bottom: 420, left: 72, right: 190 },
  landscape: { top: 70, bottom: 80, left: 90, right: 90 },
  square: { top: 90, bottom: 120, left: 80, right: 80 },
} as const;
