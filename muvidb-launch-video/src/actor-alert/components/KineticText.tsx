import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import { sp, curve, staggerStart, t01, ease } from "../lib/motion";

/**
 * Typography that performs instead of fading.
 *
 * Each word gets its own spring, started on a stagger, and arrives with a
 * mask-reveal plus a blur that resolves. The exit is a fast upward wipe rather
 * than a dissolve, so the cut between lines has a direction.
 *
 * Words, not characters, are the unit: per-character staggers look like a
 * kinetic-type showreel and are hard to read at a glance, which is the wrong
 * trade for a product demo people watch once in a feed.
 */

export type KineticStyle = "rise" | "mask" | "scale" | "slice";

export const KineticText: React.FC<{
  frame: number;
  text: string;
  /** Frame the first word begins. */
  from: number;
  /** Frames at rest before the exit starts. */
  hold: number;
  size?: number;
  color?: string;
  display?: boolean;
  /** How the words arrive. */
  variant?: KineticStyle;
  align?: "center" | "left";
  maxWidth?: number;
  top?: number | string;
  bottom?: number | string;
  left?: number;
  right?: number;
  /** Total frames the stagger is spread across. */
  spread?: number;
  lineHeight?: number;
}> = ({
  frame,
  text,
  from,
  hold,
  size = 58,
  color = brand.white,
  display = false,
  variant = "rise",
  align = "center",
  maxWidth = 880,
  top,
  bottom,
  left,
  right,
  spread = 10,
  lineHeight,
}) => {
  const { fps } = useVideoConfig();
  const words = useMemo(() => text.split(" "), [text]);

  const exitFrom = from + spread + hold;
  const exitDuration = 14;
  // Exit is a single fast wipe for the whole block; staggering the exit too
  // makes the screen feel like it is leaking rather than cutting.
  const exit = curve(frame, exitFrom, exitDuration, "circInOut");

  if (frame < from - 2 || exit >= 1) return null;

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
        pointerEvents: "none",
        // The whole block lifts and compresses slightly as it leaves.
        transform: `translateY(${-exit * 44}px)`,
        opacity: 1 - exit,
      }}
    >
      <div
        style={{
          maxWidth,
          display: "flex",
          flexWrap: "wrap",
          gap: `${size * 0.1}px ${size * 0.26}px`,
          justifyContent: align === "center" ? "center" : "flex-start",
        }}
      >
        {words.map((word, i) => {
          const start = staggerStart(i, words.length, from, spread);
          return (
            <Word
              key={`${word}-${i}`}
              word={word}
              frame={frame}
              fps={fps}
              start={start}
              size={size}
              color={color}
              display={display}
              variant={variant}
              lineHeight={lineHeight}
            />
          );
        })}
      </div>
    </div>
  );
};

const Word: React.FC<{
  word: string;
  frame: number;
  fps: number;
  start: number;
  size: number;
  color: string;
  display: boolean;
  variant: KineticStyle;
  lineHeight?: number;
}> = ({ word, frame, fps, start, size, color, display, variant, lineHeight }) => {
  const s = sp(frame, fps, start, variant === "scale" ? "pop" : "snappy");
  const clamped = Math.min(1, Math.max(0, s));
  const lh = lineHeight ?? (display ? 0.98 : 1.18);

  const base: React.CSSProperties = {
    fontFamily: display ? fontFamilies.title : fontFamilies.body,
    fontSize: size,
    fontWeight: display ? 400 : 600,
    letterSpacing: display ? 1.2 : -0.5,
    lineHeight: lh,
    color,
    display: "inline-block",
    textShadow: "0 3px 28px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.6)",
    whiteSpace: "pre",
  };

  if (variant === "mask" || variant === "slice") {
    // The word slides up out of a clipping box, so it is revealed by the box
    // edge rather than by opacity. Much crisper than a fade.
    const shift = (1 - s) * size * (variant === "slice" ? 1.15 : 0.95);
    return (
      <span
        style={{
          display: "inline-block",
          overflow: "hidden",
          // Extra room so descenders and the blur are not clipped.
          padding: `${size * 0.14}px 0`,
          margin: `${-size * 0.14}px 0`,
        }}
      >
        <span
          style={{
            ...base,
            transform: `translateY(${shift}px) ${
              variant === "slice" ? `skewY(${(1 - clamped) * 5}deg)` : ""
            }`,
            filter: `blur(${(1 - clamped) * 6}px)`,
          }}
        >
          {word}
        </span>
      </span>
    );
  }

  if (variant === "scale") {
    return (
      <span
        style={{
          ...base,
          opacity: Math.min(1, clamped * 2.4),
          transform: `scale(${0.62 + s * 0.38})`,
          filter: `blur(${(1 - clamped) * 10}px)`,
          transformOrigin: "center bottom",
        }}
      >
        {word}
      </span>
    );
  }

  // "rise"
  return (
    <span
      style={{
        ...base,
        opacity: Math.min(1, clamped * 2.2),
        transform: `translateY(${(1 - s) * size * 0.55}px)`,
        filter: `blur(${(1 - clamped) * 8}px)`,
      }}
    >
      {word}
    </span>
  );
};

/**
 * The closing headline, which earns a heavier treatment than the running
 * captions: each word wipes in behind a travelling orange edge.
 */
export const WipeHeadline: React.FC<{
  frame: number;
  text: string;
  from: number;
  size: number;
  color: string;
  accent?: string;
}> = ({ frame, text, from, size, color, accent = brand.orange }) => {
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: `0 ${size * 0.24}px`,
      }}
    >
      {words.map((word, i) => {
        const start = staggerStart(i, words.length, from, 9);
        const s = sp(frame, fps, start, "snappy");
        const reveal = Math.min(1, Math.max(0, s));
        // A bright edge rides the reveal and fades once the word has landed.
        const edge = t01(frame, start, 16);
        const edgeAlpha = edge < 1 ? Math.sin(edge * Math.PI) : 0;

        return (
          <span
            key={`${word}-${i}`}
            style={{
              position: "relative",
              display: "inline-block",
              overflow: "hidden",
              padding: `${size * 0.1}px 0`,
              margin: `${-size * 0.1}px 0`,
            }}
          >
            <span
              style={{
                fontFamily: fontFamilies.title,
                fontSize: size,
                lineHeight: 0.98,
                letterSpacing: 1.5,
                color,
                display: "inline-block",
                transform: `translateY(${(1 - s) * size * 0.9}px)`,
                filter: `blur(${(1 - reveal) * 5}px)`,
              }}
            >
              {word}
            </span>
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: `${size * 0.1}px`,
                height: Math.max(2, size * 0.05),
                background: accent,
                opacity: edgeAlpha,
                transform: `scaleX(${ease.expoOut(edge)})`,
                transformOrigin: "left center",
              }}
            />
          </span>
        );
      })}
    </div>
  );
};
