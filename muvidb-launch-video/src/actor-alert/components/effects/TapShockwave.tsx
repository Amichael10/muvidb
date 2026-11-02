import React from "react";
import { t01, ease } from "../../lib/motion";

/**
 * Ring that fires out of a press. Separate from the touch indicator: this is
 * the energy of the tap propagating into the UI, so cause and effect are
 * visibly linked when the camera starts moving a few frames later.
 */
export const TapShockwave: React.FC<{
  frame: number;
  at: number;
  x: number;
  y: number;
  color?: string;
  maxRadius?: number;
}> = ({ frame, at, x, y, color = "rgba(255,255,255,0.9)", maxRadius = 260 }) => {
  const t = t01(frame, at, 26);
  if (t <= 0 || t >= 1) return null;
  const r = ease.expoOut(t) * maxRadius;
  const alpha = (1 - t) ** 1.6;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        pointerEvents: "none",
        zIndex: 110,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -r,
          top: -r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          border: `${Math.max(1, 3 * (1 - t))}px solid ${color}`,
          opacity: alpha * 0.8,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -r * 0.6,
          top: -r * 0.6,
          width: r * 1.2,
          height: r * 1.2,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          opacity: alpha * 0.22,
        }}
      />
    </div>
  );
};
