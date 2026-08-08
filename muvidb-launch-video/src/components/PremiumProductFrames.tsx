import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

type StageTone = "dark" | "light";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const fontStack =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const PremiumStage: React.FC<{
  children: ReactNode;
  tone?: StageTone;
  backgroundImage?: string;
}> = ({ children, tone = "dark", backgroundImage }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: tone === "dark" ? "#050505" : "#f3f0e8",
        color: tone === "dark" ? "#ffffff" : "#111111",
        fontFamily: fontStack,
        overflow: "hidden",
      }}
    >
      {backgroundImage ? (
        <Img
          src={staticFile(backgroundImage)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: tone === "dark" ? "blur(24px)" : "blur(30px)",
            scale: 1.08,
            opacity: tone === "dark" ? 0.19 : 0.12,
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background:
            tone === "dark"
              ? "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.34) 38%, rgba(0,0,0,0.88))"
              : "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(243,240,232,0.94))",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: tone === "dark" ? 0.08 : 0.16,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.22) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 72,
          bottom: 72,
          width: 1,
          background:
            tone === "dark"
              ? "linear-gradient(#ffffff00, #ffffff2b, #ffffff00)"
              : "linear-gradient(#11111100, #11111122, #11111100)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 96,
          height: 1,
          background:
            tone === "dark"
              ? "linear-gradient(90deg, #ffffff00, #ffffff26, #ffffff00)"
              : "linear-gradient(90deg, #11111100, #11111118, #11111100)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const CopyBlock: React.FC<{
  kicker?: string;
  title: string;
  body?: string;
  tone?: StageTone;
  style?: CSSProperties;
  maxWidth?: number;
}> = ({ kicker, title, body, tone = "dark", style, maxWidth = 620 }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        maxWidth,
        opacity: interpolate(frame, [8, 32], [0, 1], {
          ...clamp,
          easing: ease,
        }),
        translate: `0 ${interpolate(frame, [8, 40], [22, 0], {
          ...clamp,
          easing: ease,
        })}px`,
        ...style,
      }}
    >
      {kicker ? (
        <div
          style={{
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 18,
            color: "#ff5a1f",
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 0,
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 54,
              height: 3,
              backgroundColor: "#ff5a1f",
              display: "block",
            }}
          />
          {kicker}
        </div>
      ) : null}
      <div
        style={{
          fontSize: 78,
          lineHeight: 0.96,
          letterSpacing: 0,
          fontWeight: 900,
          color: tone === "dark" ? "#ffffff" : "#111111",
        }}
      >
        {title}
      </div>
      {body ? (
        <div
          style={{
            marginTop: 28,
            color:
              tone === "dark"
                ? "rgba(255,255,255,0.68)"
                : "rgba(17,17,17,0.62)",
            fontSize: 27,
            lineHeight: 1.35,
            fontWeight: 500,
          }}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
};

export const DesktopFrame: React.FC<{
  src: string;
  label?: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
  imageStyle?: CSSProperties;
  tone?: StageTone;
}> = ({
  src,
  label = "muvidb.com",
  width = 1180,
  height = 790,
  style,
  imageStyle,
  tone = "dark",
}) => {
  const chromeHeight = 54;
  const screenHeight = height - chromeHeight - 20;

  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: 30,
        padding: 10,
        background:
          tone === "dark"
            ? "linear-gradient(145deg, #2f2f2f, #090909 38%, #191919)"
            : "linear-gradient(145deg, #ffffff, #d9d4ca 44%, #ffffff)",
        border:
          tone === "dark"
            ? "1px solid rgba(255,255,255,0.18)"
            : "1px solid rgba(17,17,17,0.16)",
        boxShadow:
          tone === "dark"
            ? "0 48px 110px rgba(0,0,0,0.68), 0 0 0 1px rgba(255,255,255,0.04) inset"
            : "0 44px 96px rgba(60,48,35,0.26), 0 0 0 1px rgba(255,255,255,0.82) inset",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          height: chromeHeight,
          borderRadius: 22,
          background:
            tone === "dark"
              ? "linear-gradient(180deg, #242424, #121212)"
              : "linear-gradient(180deg, #f9f9f7, #e5e0d7)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 22px",
          color: tone === "dark" ? "#ffffff" : "#111111",
        }}
      >
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              backgroundColor:
                dot === 0 ? "#ff5a1f" : tone === "dark" ? "#555" : "#bdb6aa",
            }}
          />
        ))}
        <div
          style={{
            marginLeft: 12,
            height: 30,
            borderRadius: 999,
            flex: 1,
            border:
              tone === "dark"
                ? "1px solid rgba(255,255,255,0.1)"
                : "1px solid rgba(17,17,17,0.11)",
            color:
              tone === "dark"
                ? "rgba(255,255,255,0.5)"
                : "rgba(17,17,17,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 0,
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          position: "relative",
          marginTop: 10,
          width: width - 20,
          height: screenHeight,
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: "#050505",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            ...imageStyle,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

export const PhoneFrame: React.FC<{
  src: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
  imageStyle?: CSSProperties;
}> = ({ src, width = 360, height = 780, style, imageStyle }) => {
  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: 54,
        padding: 14,
        background:
          "linear-gradient(145deg, #3a3a3a, #050505 36%, #191919 66%, #565656)",
        border: "1px solid rgba(255,255,255,0.22)",
        boxShadow:
          "0 42px 96px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.05) inset",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          width: width - 28,
          height: height - 28,
          borderRadius: 42,
          overflow: "hidden",
          backgroundColor: "#050505",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            ...imageStyle,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            translate: "-50% 0",
            width: 112,
            height: 30,
            borderRadius: 999,
            backgroundColor: "#050505",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.08) inset, 0 18px 44px rgba(255,255,255,0.06) inset",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

export const FloatingTag: React.FC<{
  children: ReactNode;
  tone?: StageTone;
  style?: CSSProperties;
}> = ({ children, tone = "dark", style }) => {
  return (
    <div
      style={{
        position: "absolute",
        height: 52,
        padding: "0 24px",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor:
          tone === "dark" ? "rgba(255,255,255,0.08)" : "rgba(17,17,17,0.06)",
        border:
          tone === "dark"
            ? "1px solid rgba(255,255,255,0.16)"
            : "1px solid rgba(17,17,17,0.14)",
        color: tone === "dark" ? "#ffffff" : "#111111",
        fontSize: 17,
        fontWeight: 850,
        letterSpacing: 0,
        boxShadow:
          tone === "dark"
            ? "0 20px 50px rgba(0,0,0,0.32)"
            : "0 18px 44px rgba(60,48,35,0.14)",
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const StatTile: React.FC<{
  value: number;
  suffix?: string;
  label: string;
  delay?: number;
}> = ({ value, suffix = "+", label, delay = 0 }) => {
  const frame = useCurrentFrame();
  const current = Math.round(
    interpolate(frame, [delay, delay + 70], [0, value], {
      ...clamp,
      easing: ease,
    }),
  );

  return (
    <div
      style={{
        width: 360,
        height: 190,
        borderTop: "2px solid #ff5a1f",
        paddingTop: 26,
      }}
    >
      <div
        style={{
          fontSize: 74,
          lineHeight: 0.9,
          color: "#111111",
          fontWeight: 950,
          letterSpacing: 0,
        }}
      >
        {current.toLocaleString()}
        {suffix}
      </div>
      <div
        style={{
          marginTop: 18,
          color: "rgba(17,17,17,0.55)",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 0,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
};
