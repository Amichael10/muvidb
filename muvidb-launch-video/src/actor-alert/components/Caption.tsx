import type { CSSProperties } from "react";
import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import { captionOpacity, progress } from "../lib/ease";

/**
 * On-screen copy.
 *
 * These carry the whole story when the video is watched muted, which is most
 * of the time on social, so they are large, high-contrast, and always inside
 * the platform safe area. The scrim behind them is what keeps them readable
 * over a bright poster.
 */
export const Caption: React.FC<{
  frame: number;
  text: string;
  /** Frame the line enters. */
  from: number;
  /** Frames at full opacity before it leaves. */
  hold: number;
  /** Vertical placement within the frame. */
  top?: number | string;
  bottom?: number | string;
  align?: "center" | "left";
  size?: number;
  color?: string;
  /** Use the condensed display face instead of body text. */
  display?: boolean;
  style?: CSSProperties;
  maxWidth?: number;
  /** Carve out a column instead of spanning the full frame. */
  left?: number;
  right?: number;
}> = ({
  frame,
  text,
  from,
  hold,
  top,
  bottom,
  align = "center",
  size = 58,
  color = brand.white,
  display = false,
  style,
  maxWidth = 860,
  left,
  right,
}) => {
  const opacity = captionOpacity(frame, from, hold);
  if (opacity <= 0.001) return null;

  const p = progress(frame, { from, duration: 18 });

  return (
    <div
      style={{
        position: "absolute",
        left: left ?? 0,
        right: right ?? 0,
        top,
        bottom,
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
        padding: left === undefined ? "0 72px" : 0,
        opacity,
        transform: `translateY(${(1 - p) * 22}px)`,
        pointerEvents: "none",
        ...style,
      }}
    >
      <div
        style={{
          maxWidth,
          textAlign: align,
          fontFamily: display ? fontFamilies.title : fontFamilies.body,
          fontSize: size,
          fontWeight: display ? 400 : 600,
          letterSpacing: display ? 1.2 : -0.5,
          lineHeight: display ? 1.0 : 1.22,
          color,
          textShadow: "0 3px 30px rgba(0,0,0,0.9), 0 1px 5px rgba(0,0,0,0.7)",
        }}
      >
        {text}
      </div>
    </div>
  );
};

/**
 * The finger. A soft ring that contracts onto the target and releases, so the
 * viewer reads a deliberate press rather than a cursor jump.
 */
export const TouchIndicator: React.FC<{
  frame: number;
  /** Frame the press lands. */
  at: number;
  x: number;
  y: number;
  size?: number;
}> = ({ frame, at, x, y, size = 68 }) => {
  // Approach, press, release.
  const approach = progress(frame, { from: at - 16, duration: 16 });
  const press = progress(frame, { from: at, duration: 6 });
  const release = progress(frame, { from: at + 6, duration: 14 });

  const opacity = approach * (1 - release);
  if (opacity <= 0.001) return null;

  const scale = 1.25 - approach * 0.25 - press * 0.16 + release * 0.1;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        border: "2.5px solid rgba(255,255,255,0.92)",
        background: "rgba(255,255,255,0.22)",
        boxShadow: "0 0 24px rgba(0,0,0,0.5)",
        opacity,
        transform: `scale(${scale})`,
        pointerEvents: "none",
        zIndex: 120,
      }}
    />
  );
};

/**
 * Small pill that marks a moment as a product preview rather than shipped
 * behaviour. Unused when everything on screen is live, which is the case for
 * this cut -- kept so a future edit that does simulate something has an
 * honest way to say so.
 */
export const PreviewBadge: React.FC<{ frame: number; from: number; hold: number }> = ({
  frame,
  from,
  hold,
}) => {
  const opacity = captionOpacity(frame, from, hold);
  if (opacity <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 200,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "9px 20px",
        borderRadius: 999,
        border: `1px solid ${brand.hairline}`,
        background: "rgba(0,0,0,0.6)",
        fontFamily: fontFamilies.label,
        fontSize: 22,
        letterSpacing: 1.4,
        color: brand.textMuted,
        opacity,
        zIndex: 120,
      }}
    >
      FEATURE PREVIEW
    </div>
  );
};
