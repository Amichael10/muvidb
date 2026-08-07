import { Easing, interpolate } from "remotion";

export const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export const fadeIn = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    ...clamp,
    easing: easeOut,
  });

export const fadeOut = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [1, 0], {
    ...clamp,
    easing: easeInOut,
  });

export const move = (
  frame: number,
  start: number,
  end: number,
  from: number,
  to: number,
) =>
  interpolate(frame, [start, end], [from, to], {
    ...clamp,
    easing: easeOut,
  });

export const countUp = (
  frame: number,
  start: number,
  end: number,
  value: number,
) =>
  Math.round(
    interpolate(frame, [start, end], [0, value], {
      ...clamp,
      easing: easeOut,
    }),
  );
