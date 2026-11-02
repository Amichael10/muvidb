import React from "react";
import { t01, ease } from "../../lib/motion";
import { PHONE_VIEWPORT } from "../PhoneMockup";

/**
 * The invisible cut.
 *
 * A wipe -- even a liquid one -- still reads as "screen A is replaced by
 * screen B", which is why it still felt like a slideshow. This does something
 * different: the camera pushes *into* a specific element until that element
 * fills the entire frame, and on the other side it pulls back out of a
 * matching element in the next scene. Because the frame is filled by the same
 * shape and colour across the join, there is no perceptible cut at all. The
 * film plays as one continuous move.
 *
 * The strongest join in this edit is the film poster inside the WhatsApp
 * message pushing through into the identical poster on the MuviDB film page:
 * the matched element is literally the same image, so the camera appears to
 * simply fly through it.
 */
export interface FocusPoint {
  /** Centre of the element to push into, in phone CSS px. */
  x: number;
  y: number;
  /** How much the element has to grow to fill the frame. */
  zoom: number;
}

/**
 * Maps the point (fx, fy) to the centre of the viewport at the given scale.
 *
 * Doing this with `transform-origin` plus a translate is a trap: the origin
 * already pins the focus point in place, so an additional offset moves it
 * twice and the camera ends up looking at empty space. Keeping the origin at
 * 0 0 and solving for the translation directly is unambiguous.
 */
const focusTransform = (
  fx: number,
  fy: number,
  scale: number,
  width: number,
  height: number,
): string =>
  `translate(${width / 2 - fx * scale}px, ${height / 2 - fy * scale}px) scale(${scale})`;

export const ScaleThrough: React.FC<{
  frame: number;
  /** The frame at which the two halves meet. */
  at: number;
  /** Frames spent pushing in, and pulling back out. */
  inFrames?: number;
  outFrames?: number;
  /** Colour that fills the frame across the join, hiding the swap. */
  color: string;
  outgoing: React.ReactNode;
  incoming: React.ReactNode;
  /** Element in the outgoing scene the camera flies into. */
  from: FocusPoint;
  /** Matching element in the incoming scene the camera flies out of. */
  to: FocusPoint;
}> = ({
  frame,
  at,
  inFrames = 20,
  outFrames = 22,
  color,
  outgoing,
  incoming,
  from,
  to,
}) => {
  const { width, height } = PHONE_VIEWPORT;
  const beforeJoin = frame < at;

  if (beforeJoin) {
    const t = ease.power2InOut(t01(frame, at - inFrames, inFrames));
    const scale = 1 + (from.zoom - 1) * t;

    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: focusTransform(from.x, from.y, scale, width, height),
            transformOrigin: "0 0",
          }}
        >
          {outgoing}
        </div>
        {/*
          The last few frames bleed to the match colour. Without this the
          join can flicker, because no real element is a perfectly flat
          colour at the pixel level.
        */}
        <ColorBleed t={t} color={color} />
      </div>
    );
  }

  const t = ease.power2Out(t01(frame, at, outFrames));
  const scale = to.zoom + (1 - to.zoom) * t;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: focusTransform(to.x, to.y, scale, width, height),
          transformOrigin: "0 0",
        }}
      >
        {incoming}
      </div>
      <ColorBleed t={1 - t} color={color} />
    </div>
  );
};

/**
 * Flat colour that only appears in the last ~18% of the push. It is what
 * actually conceals the swap, so it has to reach full opacity exactly at the
 * join and be gone again quickly.
 */
const ColorBleed: React.FC<{ t: number; color: string }> = ({ t, color }) => {
  const a = t01(t, 0.82, 0.18);
  if (a <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: color,
        opacity: ease.power2InOut(a),
        pointerEvents: "none",
      }}
    />
  );
};
