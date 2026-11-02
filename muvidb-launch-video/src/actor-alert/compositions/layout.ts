/**
 * Per-aspect-ratio layout.
 *
 * These are adaptations, not crops. The landscape cut moves the phone off
 * centre and gives the copy its own column; the square cut tightens the device
 * and drops the captions into the lower band. In every case the phone, the
 * poster and the call to action stay inside the platform safe area, so nothing
 * essential sits under TikTok's right rail or Instagram's bottom bar.
 */
export type LayoutName = "vertical" | "landscape" | "square";

export interface LayoutSpec {
  width: number;
  height: number;
  /** Multiplier applied to the 390x844 device. */
  phoneScale: number;
  /** Device offset from frame centre. */
  phoneX: number;
  phoneY: number;
  /** Scale for the closing brand card. */
  brandScale: number;
  caption: {
    hookSize: number;
    bodySize: number;
    hookTop: number;
    width: number;
    /**
     * Where the running captions sit. `left`/`right` carve out a column; the
     * landscape cut uses them to keep copy clear of the device.
     */
    slot: {
      top?: number;
      bottom?: number;
      align?: "center" | "left";
      left?: number;
      right?: number;
    };
  };
}

export const LAYOUTS: Record<LayoutName, LayoutSpec> = {
  /**
   * 1080x1920. The master. Device centred and large, copy in the band above
   * it, well clear of the bottom 380px where platform UI lives.
   */
  vertical: {
    width: 1080,
    height: 1920,
    phoneScale: 1.42,
    phoneX: 0,
    phoneY: 56,
    brandScale: 1,
    caption: {
      hookSize: 104,
      bodySize: 54,
      hookTop: 236,
      width: 880,
      slot: { top: 196, align: "center" },
    },
  },

  /**
   * 1920x1080. The phone cannot simply be scaled down here or the UI stops
   * being readable, so the frame becomes two columns: device left, copy right.
   */
  landscape: {
    width: 1920,
    height: 1080,
    phoneScale: 1.08,
    phoneX: -480,
    phoneY: 0,
    brandScale: 0.92,
    caption: {
      hookSize: 86,
      bodySize: 52,
      hookTop: 300,
      width: 700,
      slot: { top: 420, align: "left", left: 1010, right: 90 },
    },
  },

  /**
   * 1080x1080. Tightest of the three: the device shrinks just enough to leave
   * a readable caption band without shrinking the UI into illegibility.
   */
  square: {
    width: 1080,
    height: 1080,
    phoneScale: 0.95,
    phoneX: 0,
    phoneY: -46,
    brandScale: 0.8,
    caption: {
      hookSize: 76,
      bodySize: 44,
      hookTop: 128,
      width: 820,
      slot: { bottom: 70, align: "center" },
    },
  },
};
