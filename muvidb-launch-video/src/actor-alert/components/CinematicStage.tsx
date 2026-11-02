import React from "react";
import { AbsoluteFill } from "remotion";
import { t01, ease } from "../lib/motion";

/**
 * The room the phone is in.
 *
 * The first dark version of this film failed for a specific reason: it was
 * flat black with a blurred poster behind it. Nothing was lit, so nothing
 * looked like it occupied space. "Dark cinematic" is not a background colour,
 * it is a set of lighting behaviours:
 *
 *  - a bright screen in a dark room SPILLS light onto its surroundings
 *  - shadows are never neutral black; they carry a cool cast
 *  - highlights are warm, and the contrast between the two is the whole look
 *  - air is visible: haze, a light shaft, drifting dust
 *  - the lens is physical: vignette, bloom, grain
 *
 * All of it is drawn in CSS/SVG, so there is nothing to license and every
 * frame stays deterministic.
 */

const GRADE = {
  /** Shadows carry blue, never pure black -- this is most of the "filmic". */
  shadow: "#070A10",
  shadowLift: "#0E1620",
  /** Warm key, the brand orange pushed to a light source. */
  key: "rgba(255,138,74,0.26)",
  keySoft: "rgba(255,106,42,0.12)",
} as const;

export const CinematicStage: React.FC<{
  frame: number;
  /** 0..1 how bright the phone screen currently is; drives the light spill. */
  screenGlow?: number;
  /** Vertical offset of the device, so the spill and reflection track it. */
  deviceY?: number;
  deviceScale?: number;
  fade?: number;
}> = ({ frame, screenGlow = 1, deviceY = 0, deviceScale = 1, fade = 1 }) => {
  const settle = ease.power2Out(t01(frame, 0, 60));

  return (
    <AbsoluteFill style={{ opacity: fade, overflow: "hidden", background: GRADE.shadow }}>
      {/* Cool ambient falloff. Keeps the frame from going dead black. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 110% 80% at 50% 38%, ${GRADE.shadowLift} 0%, ${GRADE.shadow} 62%, #04060A 100%)`,
        }}
      />

      {/* Warm key light pooling behind the device. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 44% at 50% ${40 + deviceY * 0.02}%, ${GRADE.key} 0%, ${GRADE.keySoft} 40%, transparent 70%)`,
          opacity: 0.6 + settle * 0.4,
        }}
      />

      <LightShaft frame={frame} />
      <ScreenSpill glow={screenGlow} deviceY={deviceY} deviceScale={deviceScale} />
      <SurfaceReflection glow={screenGlow} deviceY={deviceY} deviceScale={deviceScale} />
      <DustMotes frame={frame} />
      <Vignette />
      <FilmGrain frame={frame} />
    </AbsoluteFill>
  );
};

/**
 * The light the phone itself throws into the room.
 *
 * This is the single detail that makes a lit screen in a dark room believable.
 * It sits behind the device and brightens with it, so when the camera dives
 * into the screen the whole frame lifts rather than the phone getting brighter
 * against a static background.
 */
const ScreenSpill: React.FC<{ glow: number; deviceY: number; deviceScale: number }> = ({
  glow,
  deviceY,
  deviceScale,
}) => (
  <AbsoluteFill style={{ mixBlendMode: "screen" }}>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 1500 * deviceScale,
        height: 1700 * deviceScale,
        marginLeft: -(1500 * deviceScale) / 2,
        marginTop: -(1700 * deviceScale) / 2 + deviceY,
        background:
          "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,146,86,0.30) 0%, rgba(255,110,48,0.14) 32%, rgba(120,60,30,0.05) 58%, transparent 76%)",
        opacity: 0.55 + glow * 0.45,
        filter: "blur(28px)",
      }}
    />
  </AbsoluteFill>
);

/**
 * Soft pool of reflected light under the device, as if it is standing on a
 * dark glossy surface. Cheaper and more controllable than mirroring the
 * screen, and at this blur a true reflection would be indistinguishable.
 */
const SurfaceReflection: React.FC<{ glow: number; deviceY: number; deviceScale: number }> = ({
  glow,
  deviceY,
  deviceScale,
}) => (
  <AbsoluteFill style={{ mixBlendMode: "screen" }}>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 620 * deviceScale,
        height: 420 * deviceScale,
        marginLeft: -(620 * deviceScale) / 2,
        marginTop: deviceY + 430 * deviceScale,
        borderRadius: "50%",
        background:
          "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,150,92,0.26) 0%, rgba(255,110,48,0.10) 46%, transparent 72%)",
        filter: "blur(36px)",
        opacity: 0.4 + glow * 0.5,
        transform: "scaleY(0.5)",
      }}
    />
  </AbsoluteFill>
);

/**
 * A single angled shaft of light with visible haze. Drifts very slowly so the
 * air in the room feels alive without pulling focus.
 */
const LightShaft: React.FC<{ frame: number }> = ({ frame }) => {
  const sway = Math.sin(frame / 420) * 2.4;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.5 }}>
      <div
        style={{
          position: "absolute",
          top: "-30%",
          left: "-16%",
          width: "72%",
          height: "150%",
          transform: `rotate(${17 + sway}deg)`,
          background:
            "linear-gradient(100deg, transparent 0%, rgba(255,186,138,0.07) 36%, rgba(255,205,166,0.12) 50%, rgba(255,186,138,0.06) 64%, transparent 100%)",
          filter: "blur(22px)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Slow drifting dust, lit by the shaft. Gives the air physical scale. */
const DustMotes: React.FC<{ frame: number }> = ({ frame }) => {
  // Deterministic placement: a fixed pseudo-random sequence, so every render
  // of a given frame is identical.
  const motes = React.useMemo(() => {
    let seed = 20260102;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: 34 }, () => ({
      x: rnd() * 100,
      y: rnd() * 100,
      r: 1.1 + rnd() * 2.4,
      speed: 0.12 + rnd() * 0.3,
      phase: rnd() * Math.PI * 2,
      alpha: 0.12 + rnd() * 0.3,
    }));
  }, []);

  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
      {motes.map((m, i) => {
        const y = (m.y - frame * m.speed * 0.06) % 100;
        const drift = Math.sin(frame / 90 + m.phase) * 1.1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${m.x + drift}%`,
              top: `${y < 0 ? y + 100 : y}%`,
              width: m.r,
              height: m.r,
              borderRadius: "50%",
              background: "rgba(255,214,180,0.9)",
              opacity: m.alpha,
              filter: "blur(0.6px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 74% 62% at 50% 46%, transparent 0%, transparent 44%, rgba(0,0,0,0.42) 76%, rgba(0,0,0,0.78) 100%)",
    }}
  />
);

/**
 * Animated film grain.
 *
 * The seed is advanced per frame so the grain crawls the way real stock does;
 * a static noise layer reads as a dirty lens instead.
 */
const FilmGrain: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ opacity: 0.09, mixBlendMode: "overlay", pointerEvents: "none" }}>
    <svg width="100%" height="100%">
      <filter id={`grain-${frame % 8}`}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="3"
          seed={frame % 8}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain-${frame % 8})`} />
    </svg>
  </AbsoluteFill>
);

/**
 * Chromatic fringing at the edges of the frame, where a real lens loses it.
 * Very subtle -- at this strength it is felt rather than seen.
 */
export const LensFringe: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: 0.16 }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 70% 60% at 50% 48%, transparent 0%, transparent 62%, rgba(255,80,40,0.30) 88%, rgba(255,60,20,0.42) 100%)",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 68% 58% at 50% 48%, transparent 0%, transparent 64%, rgba(40,120,255,0.26) 90%, rgba(20,90,255,0.36) 100%)",
        transform: "scale(1.012)",
      }}
    />
  </AbsoluteFill>
);
