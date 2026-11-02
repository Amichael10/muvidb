import { Img, staticFile, useVideoConfig, random } from "remotion";
import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import { script } from "../data/demoContent";
import { sp, curve, t01, ease, pulse } from "../lib/motion";
import { WipeHeadline } from "./KineticText";

/**
 * Closing frame.
 *
 * The logo is the shipped asset (public/brand/orange-logo.svg) used as-is --
 * no tagline is added beneath it and no alternate lockup is invented. What is
 * added is motion: the logo lands with a spring and a brief chromatic split,
 * a ring of light expands out of it, and the headlines wipe in word by word
 * behind a travelling orange edge rather than fading up as a block.
 */
export const BrandReveal: React.FC<{
  frame: number;
  /** Frame the sequence starts. All timings are relative to this. */
  startAt?: number;
  /** Scale factor for non-vertical layouts. */
  scale?: number;
}> = ({ frame, startAt = 0, scale = 1 }) => {
  const { fps } = useVideoConfig();
  const f = frame - startAt;

  const logo = sp(f, fps, 0, "pop", 30);
  const logoClamped = Math.min(1, Math.max(0, logo));

  // A soft orange flare behind the mark as it lands. Deliberately NOT a
  // chromatic split on the logo itself: the brand guidance forbids alternate
  // logo treatments, and an RGB fringe is exactly that. The energy comes from
  // behind the mark instead of being applied to it.
  const flare = pulse(f, 0, 26, 0.3);

  // Light ring firing out of the mark.
  const ringT = t01(f, 6, 40);
  const ringR = ease.expoOut(ringT) * 760;

  const underline = curve(f, 88, 30, "expoOut");
  const cta = sp(f, fps, 84, "snappy", 26);

  // A slow push across the hold so the card is never frozen.
  const push = 1 + curve(f, 0, 200, "power2InOut") * 0.04;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: brand.black,
        overflow: "hidden",
      }}
    >
      {/* Bloom behind the mark. */}
      <div
        style={{
          position: "absolute",
          width: 1500,
          height: 1500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,90,31,0.16) 0%, rgba(255,90,31,0.05) 42%, transparent 68%)",
          opacity: logoClamped,
          transform: `scale(${0.7 + logoClamped * 0.3})`,
        }}
      />

      {/* Expanding light ring. */}
      {ringT > 0 && ringT < 1 ? (
        <div
          style={{
            position: "absolute",
            width: ringR * 2,
            height: ringR * 2,
            marginTop: -220,
            borderRadius: "50%",
            border: `${Math.max(1, 5 * (1 - ringT))}px solid ${brand.orange}`,
            opacity: (1 - ringT) ** 1.8 * 0.5,
          }}
        />
      ) : null}

      {/* Drifting embers, so the black is never dead. */}
      {Array.from({ length: 14 }).map((_, i) => {
        const x = random(`ex-${i}`) * 100;
        const speed = 0.3 + random(`es-${i}`) * 0.7;
        const y = 100 - ((f * speed * 0.35 + random(`ey-${i}`) * 100) % 130);
        const size = 1.5 + random(`ez-${i}`) * 3;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: brand.orange,
              opacity: logoClamped * 0.28 * (1 - Math.abs(y - 50) / 70),
              filter: "blur(1px)",
            }}
          />
        );
      })}

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${scale * push})`,
        }}
      >
        <div style={{ position: "relative" }}>
          {flare > 0.01 ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 560,
                height: 560,
                marginLeft: -280,
                marginTop: -280,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(255,90,31,0.55) 0%, transparent 62%)",
                opacity: flare * 0.9,
                filter: "blur(22px)",
              }}
            />
          ) : null}
          <Img
            src={staticFile("brand/orange-logo.svg")}
            style={{
              width: 460,
              height: "auto",
              opacity: logoClamped,
              transform: `translateY(${(1 - logo) * 34}px) scale(${
                0.86 + logo * 0.14
              })`,
            }}
          />
        </div>

        <div style={{ marginTop: 54 }}>
          <WipeHeadline
            frame={frame}
            text={script.brand1}
            from={startAt + 26}
            size={96}
            color={brand.white}
          />
        </div>
        <WipeHeadline
          frame={frame}
          text={script.brand2}
          from={startAt + 44}
          size={96}
          color={brand.orange}
        />

        <div
          style={{
            fontFamily: fontFamilies.body,
            fontSize: 31,
            fontWeight: 500,
            color: brand.textMuted,
            marginTop: 40,
            textAlign: "center",
            opacity: curve(f, 68, 20, "power2Out"),
            transform: `translateY(${(1 - curve(f, 68, 20, "expoOut")) * 20}px)`,
          }}
        >
          Follow your favourite actors on MuviDB.
        </div>

        {/* Call to action */}
        <div
          style={{
            position: "relative",
            marginTop: 44,
            opacity: Math.min(1, Math.max(0, cta) * 2),
            transform: `translateY(${(1 - cta) * 26}px) scale(${
              0.95 + Math.min(1, Math.max(0, cta)) * 0.05
            })`,
          }}
        >
          <div
            style={{
              fontFamily: fontFamilies.body,
              fontSize: 42,
              fontWeight: 700,
              color: brand.white,
              letterSpacing: -0.4,
              textAlign: "center",
            }}
          >
            Start following at{" "}
            <span style={{ color: brand.orange }}>muvidb.com</span>
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -14,
              height: 5,
              borderRadius: 3,
              background: brand.orange,
              width: `${underline * 100}%`,
              maxWidth: 520,
              transform: `translateX(-${underline * 50}%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
