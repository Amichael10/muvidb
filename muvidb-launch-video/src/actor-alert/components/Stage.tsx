import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { film } from "../data/demoContent";
import { fontFamilies } from "../lib/fonts";
import { curve, t01, ease } from "../lib/motion";

/**
 * The world the phone sits in.
 *
 * The first cut floated the device in a near-black void, which made the film
 * read as a dark tech demo and left two thirds of the frame doing nothing.
 * This replaces it with a warm paper surface seen from above: the phone is
 * lying on a desk, next to a printed copy of the film's poster and a column
 * of newsprint. The frame now has depth and context instead of emptiness,
 * and the brand orange has somewhere warm to live.
 *
 * Everything here is drawn in CSS/SVG -- no stock photography, nothing that
 * needs licensing.
 */

/** Warm paper tones, sampled to sit either side of the brand orange. */
const PAPER = {
  base: "#FBF1E4",
  warm: "#F6DCC2",
  shade: "#E8BC94",
  ink: "#2A1F17",
} as const;

export const Stage: React.FC<{
  frame: number;
  /** Fades the whole surface out for the brand card. */
  fade?: number;
  /** Subtle parallax so the desk drifts against the device. */
  drift?: number;
}> = ({ frame, fade = 1, drift = 0 }) => {
  // A slow warm pulse: the surface lifts a little as the story progresses, so
  // the frame is never completely static even while the phone is still.
  const warmth = 0.5 + 0.5 * Math.sin((frame / 900) * Math.PI);

  return (
    <AbsoluteFill style={{ opacity: fade, overflow: "hidden" }}>
      {/* Paper base */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(ellipse 120% 90% at 50% 12%, ${PAPER.base} 0%, ${PAPER.warm} 48%, ${PAPER.shade} 100%)
          `,
        }}
      />

      {/* Brand wash. Keeps the paper from reading as plain beige. */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(ellipse 86% 64% at 50% 40%, rgba(255,122,61,${0.30 + warmth * 0.1}) 0%, rgba(255,90,31,0.16) 42%, rgba(255,90,31,0.05) 68%, transparent 84%)
          `,
        }}
      />

      <PaperGrain />
      <NewsColumns drift={drift} />
      <PrintedPoster frame={frame} drift={drift} />

      {/* Vignette, so the edges fall away and the phone stays the subject. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 78% 62% at 50% 46%, transparent 0%, transparent 52%, rgba(90,58,34,0.20) 78%, rgba(60,36,20,0.38) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Fibrous paper grain via turbulence, at very low opacity. */
const PaperGrain: React.FC = () => (
  <AbsoluteFill style={{ opacity: 0.17, mixBlendMode: "multiply" }}>
    <svg width="100%" height="100%">
      <filter id="paper-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves="4"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#paper-grain)" />
    </svg>
  </AbsoluteFill>
);

/**
 * A column of newsprint running down one side. The "text" is ruled lines at
 * low contrast rather than real words: at this scale legible copy would only
 * invite someone to read it, and fake film listings would be a claim we have
 * not verified.
 */
const NewsColumns: React.FC<{ drift: number }> = ({ drift }) => (
  <AbsoluteFill style={{ opacity: 0.85 }}>
    <div
      style={{
        position: "absolute",
        left: "-16%",
        top: `${-14 + drift * 0.3}%`,
        width: "54%",
        height: "92%",
        transform: "rotate(-7deg)",
        background: PAPER.base,
        boxShadow: "0 30px 70px rgba(120,70,36,0.28)",
        border: "1px solid rgba(255,255,255,0.5)",
        padding: "7% 5%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontFamily: fontFamilies.title,
          fontSize: 78,
          letterSpacing: 2,
          color: "rgba(42,31,23,0.42)",
          lineHeight: 0.92,
          marginBottom: 26,
        }}
      >
        NOLLYWOOD
      </div>
      {Array.from({ length: 34 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 7,
            marginBottom: 13,
            width: `${[96, 88, 93, 72, 90, 84][i % 6]}%`,
            background: "rgba(42,31,23,0.16)",
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  </AbsoluteFill>
);

/**
 * The film's poster, lying on the desk as a printed card.
 *
 * It tilts up fractionally as the alert lands, which links the thing on the
 * desk to the thing arriving on the phone without any explicit animation
 * calling attention to itself.
 */
const PrintedPoster: React.FC<{ frame: number; drift: number }> = ({
  frame,
  drift,
}) => {
  const settle = ease.power2Out(t01(frame, 0, 46));
  const nudge = curve(frame, 468, 60, "circInOut");

  return (
    <div
      style={{
        position: "absolute",
        right: "-10%",
        bottom: `${4 - drift * 0.2}%`,
        width: "44%",
        transform: `rotate(${11 - nudge * 3}deg) translateY(${(1 - settle) * 40}px)`,
        opacity: settle,
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow:
            "0 40px 90px rgba(70,42,24,0.34), 0 10px 26px rgba(70,42,24,0.22)",
        }}
      >
        <Img
          src={film.poster}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
        {/* Print knocks back contrast and warms the paper stock. */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(170deg, rgba(243,231,216,0.16) 0%, rgba(140,88,52,0.14) 100%)`,
          }}
        />
      </div>
    </div>
  );
};

/**
 * Contact shadow cast by the device onto the desk. Drawn separately from the
 * phone so it can stay on the surface while the device is scaled by the
 * camera -- a shadow that scales with the phone immediately stops reading as
 * contact with a surface.
 */
export const DeskShadow: React.FC<{ scale: number; translateY: number; opacity?: number }> = ({
  scale,
  translateY,
  opacity = 1,
}) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 520 * scale,
        height: 940 * scale,
        marginLeft: -(520 * scale) / 2,
        marginTop: -(940 * scale) / 2 + translateY,
        borderRadius: 70 * scale,
        background: "rgba(74,44,24,0.30)",
        filter: `blur(${34 * Math.max(scale, 0.6)}px)`,
        transform: `translateY(${26 * scale}px) scaleY(0.98)`,
        opacity: 0.8 * opacity,
      }}
    />
  </AbsoluteFill>
);
