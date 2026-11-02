import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import { actor } from "../data/demoContent";
import { progress, tap } from "../lib/ease";

/**
 * MuviDB's real WhatsApp opt-in sheet, reproduced from
 * src/components/person/WhatsAppOptInModal.jsx in the main app.
 *
 * This screen is the reason the video can honestly cut from Follow to a
 * WhatsApp message: following alone does not enable alerts, the user also has
 * to hand over a number. Copy, button labels and the green accent are the
 * product's own. The number typed here is the app's own placeholder, so no
 * real phone number appears on screen.
 */

const DEMO_NUMBER = "+234 801 234 5678";

export const WhatsAppOptIn: React.FC<{
  frame: number;
  /** Frame the sheet starts animating in. */
  appearAt: number;
  /** Frame the number starts typing. */
  typeAt: number;
  /** Frame the confirm button is pressed. */
  submitAt: number;
}> = ({ frame, appearAt, typeAt, submitAt }) => {
  const rise = progress(frame, { from: appearAt, duration: 20 });

  // Reveal the number one character at a time, like a real entry.
  const typed = Math.floor(
    progress(frame, { from: typeAt, duration: 34 }) * DEMO_NUMBER.length,
  );
  const value = DEMO_NUMBER.slice(0, typed);
  const caretOn = Math.floor(frame / 8) % 2 === 0 && frame < submitAt;

  const press = tap(frame, submitAt);
  const enabling = frame >= submitAt + 6;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80 }}>
      {/* Scrim over the profile behind. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(3px)",
          opacity: rise,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: 232,
          background: brand.surface,
          border: `1px solid ${brand.hairline}`,
          borderRadius: 22,
          padding: 20,
          opacity: rise,
          transform: `translateY(${(1 - rise) * 26}px) scale(${0.96 + rise * 0.04})`,
          boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              background: "rgba(37,211,102,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <WhatsAppGlyph size={26} />
          </div>
          <div>
            <div
              style={{
                fontFamily: fontFamilies.body,
                fontSize: 18,
                fontWeight: 700,
                color: brand.white,
              }}
            >
              Get WhatsApp Alerts
            </div>
            <div
              style={{
                fontFamily: fontFamilies.body,
                fontSize: 12.5,
                color: brand.textMuted,
                marginTop: 2,
              }}
            >
              Never miss a new release or trailer
            </div>
          </div>
        </div>

        {/* Explainer */}
        <div
          style={{
            marginTop: 16,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${brand.hairline}`,
            borderRadius: 13,
            padding: 13,
            fontFamily: fontFamilies.body,
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          Be the first to know when{" "}
          <strong style={{ color: brand.white }}>{actor.name}</strong> stars in
          a new film, trailer, or cinema release.
          <div
            style={{
              marginTop: 9,
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: brand.whatsapp.green,
              fontSize: 11.5,
            }}
          >
            <ShieldGlyph />
            <span>Zero spam. 1 message per movie. Reply STOP anytime.</span>
          </div>
        </div>

        {/* Number field */}
        <div style={{ marginTop: 17 }}>
          <div
            style={{
              fontFamily: fontFamilies.body,
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.72)",
              marginBottom: 7,
            }}
          >
            WhatsApp Phone Number
          </div>
          <div
            style={{
              background: brand.black,
              border: `1px solid ${
                typed > 0 ? brand.whatsapp.green : brand.hairline
              }`,
              boxShadow:
                typed > 0 ? `0 0 0 1px ${brand.whatsapp.green}` : "none",
              borderRadius: 13,
              padding: "13px 15px",
              fontFamily: fontFamilies.body,
              fontSize: 14.5,
              color: typed > 0 ? brand.white : brand.textDim,
              display: "flex",
              alignItems: "center",
              minHeight: 22,
            }}
          >
            {typed > 0 ? value : DEMO_NUMBER}
            {caretOn && typed > 0 ? (
              <span
                style={{
                  display: "inline-block",
                  width: 1.5,
                  height: 17,
                  background: brand.whatsapp.green,
                  marginLeft: 2,
                }}
              />
            ) : null}
          </div>
          <div
            style={{
              fontFamily: fontFamilies.body,
              fontSize: 11,
              color: brand.textDim,
              marginTop: 7,
            }}
          >
            Include country code (e.g. +234 for Nigeria, +1 for US/Canada)
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 18,
          }}
        >
          <span
            style={{
              fontFamily: fontFamilies.body,
              fontSize: 12,
              fontWeight: 600,
              color: brand.textMuted,
              padding: "10px 12px",
              whiteSpace: "nowrap",
            }}
          >
            Just follow on site
          </span>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 15px",
              borderRadius: 13,
              background: brand.whatsapp.green,
              whiteSpace: "nowrap",
              transform: `scale(${press.scale})`,
              boxShadow: "0 10px 26px rgba(37,211,102,0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 120,
                height: 120,
                marginLeft: -60,
                marginTop: -60,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.45)",
                opacity: press.rippleOpacity,
                transform: `scale(${press.rippleScale})`,
              }}
            />
            <BellGlyph />
            <span
              style={{
                fontFamily: fontFamilies.body,
                fontSize: 12.5,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {enabling ? "Enabling…" : "Enable WhatsApp Alerts"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/** WhatsApp's own mark, used only where the product uses it. */
export const WhatsAppGlyph: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z"
      fill={brand.whatsapp.green}
    />
    <path
      d="M9.2 7.3c-.2-.45-.4-.46-.6-.47h-.5c-.17 0-.46.07-.7.33-.24.26-.92.9-.92 2.2s.94 2.55 1.07 2.73c.13.17 1.82 2.91 4.5 3.97 2.22.88 2.67.7 3.16.66.48-.04 1.56-.64 1.78-1.25.22-.62.22-1.14.15-1.25-.06-.11-.24-.18-.5-.31-.26-.13-1.56-.77-1.8-.86-.24-.09-.42-.13-.6.13-.17.26-.68.86-.83 1.04-.15.17-.3.2-.57.07-.26-.13-1.11-.41-2.12-1.31-.78-.7-1.31-1.56-1.47-1.82-.15-.26-.01-.4.12-.53.12-.12.26-.3.39-.46.13-.15.17-.26.26-.44.09-.17.04-.33-.02-.46-.07-.13-.58-1.44-.8-1.97Z"
      fill="#fff"
    />
  </svg>
);

const ShieldGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path
      d="M12 2.8 19.2 5.6v5.6c0 4.4-3 8.1-7.2 9.4-4.2-1.3-7.2-5-7.2-9.4V5.6L12 2.8Z"
      stroke={brand.whatsapp.green}
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path
      d="m8.8 11.8 2.2 2.2 4.2-4.4"
      stroke={brand.whatsapp.green}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BellGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path
      d="M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4 1.4 5.4 1.4 5.4H5s1.4-1.4 1.4-5.4Z"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M10.2 18.4a2 2 0 0 0 3.6 0" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
