import React from "react";

/**
 * Specular sweep across glass. A soft diagonal band of light that crosses the
 * device when something lands, so the screen reads as a physical surface.
 */
export const LightSweep: React.FC<{
  /** 0..1 across the element; outside that range nothing renders. */
  progress: number;
  intensity?: number;
  width?: number;
}> = ({ progress, intensity = 0.5, width = 38 }) => {
  if (progress <= 0 || progress >= 1) return null;
  const pos = -30 + progress * 160;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        mixBlendMode: "screen",
        zIndex: 60,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-60%",
          bottom: "-60%",
          left: `${pos}%`,
          width: `${width}%`,
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,${
            intensity * 0.5
          }) 45%, rgba(255,255,255,${intensity}) 50%, rgba(255,255,255,${
            intensity * 0.5
          }) 55%, transparent 100%)`,
          transform: "rotate(18deg)",
          filter: "blur(14px)",
        }}
      />
    </div>
  );
};
