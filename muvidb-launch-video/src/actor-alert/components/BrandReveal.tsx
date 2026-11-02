import { Img, staticFile } from "remotion";
import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import { script } from "../data/demoContent";
import { progress, riseIn } from "../lib/ease";

/**
 * Closing frame.
 *
 * The logo is the shipped asset (public/brand/orange-logo.svg) used as-is --
 * no tagline is added beneath it and no alternate lockup is invented. The
 * orange underline grows under the URL to park the eye there for the hold.
 */
export const BrandReveal: React.FC<{
  frame: number;
  /** Frame the sequence starts. All timings are relative to this. */
  startAt?: number;
  /** Scale factor for non-vertical layouts. */
  scale?: number;
}> = ({ frame, startAt = 0, scale = 1 }) => {
  const f = frame - startAt;

  const logo = progress(f, { from: 0, duration: 26 });
  const underline = progress(f, { from: 86, duration: 30 });

  // A slow push-in across the whole hold keeps the final card from feeling
  // frozen while the viewer reads the URL.
  const push = 1 + progress(f, { from: 0, duration: 200 }) * 0.035;

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
      }}
    >
      {/* A soft orange bloom so the card is not flat black. */}
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,90,31,0.14) 0%, rgba(255,90,31,0.04) 42%, transparent 68%)",
          opacity: logo,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${scale * push})`,
        }}
      >
        <Img
          src={staticFile("brand/orange-logo.svg")}
          style={{
            width: 460,
            height: "auto",
            opacity: logo,
            transform: `translateY(${(1 - logo) * 18}px) scale(${0.96 + logo * 0.04})`,
          }}
        />

        <div
          style={{
            fontFamily: fontFamilies.title,
            fontSize: 96,
            lineHeight: 0.98,
            color: brand.white,
            letterSpacing: 1.5,
            marginTop: 54,
            textAlign: "center",
            ...riseIn(f, 28, 22, 30),
          }}
        >
          {script.brand1}
        </div>
        <div
          style={{
            fontFamily: fontFamilies.title,
            fontSize: 96,
            lineHeight: 0.98,
            color: brand.orange,
            letterSpacing: 1.5,
            textAlign: "center",
            ...riseIn(f, 44, 22, 30),
          }}
        >
          {script.brand2}
        </div>

        <div
          style={{
            fontFamily: fontFamilies.body,
            fontSize: 31,
            fontWeight: 500,
            color: brand.textMuted,
            marginTop: 40,
            textAlign: "center",
            ...riseIn(f, 66, 20, 22),
          }}
        >
          Follow your favourite actors on MuviDB.
        </div>

        {/* Call to action */}
        <div
          style={{
            position: "relative",
            marginTop: 44,
            ...riseIn(f, 84, 20, 20),
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
