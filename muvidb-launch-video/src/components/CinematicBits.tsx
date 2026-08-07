import { interpolate, useCurrentFrame } from "remotion";
import { clamp, easeOut } from "../lib/animation";
import { colors } from "./SceneShell";

export const FilmArtifacts: React.FC = () => {
  const frame = useCurrentFrame();
  const labels = [
    "Credits",
    "Posters",
    "Cast",
    "Scripts",
    "Trailers",
    "Awards",
    "Showtimes",
    "Reviews",
  ];

  return (
    <>
      {labels.map((label, index) => {
        const angle = -24 + index * 7;
        const distance = 80 + index * 34;
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: 760 + Math.cos(index) * distance,
              top: 420 + Math.sin(index * 1.4) * distance,
              width: index % 3 === 0 ? 210 : 168,
              height: index % 3 === 0 ? 130 : 104,
              borderRadius: 18,
              background:
                index % 2 === 0
                  ? "rgba(255,255,255,0.10)"
                  : "rgba(249,115,22,0.16)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 900,
              opacity: interpolate(frame, [10 + index * 4, 54 + index * 4], [0, 1], {
                ...clamp,
                easing: easeOut,
              }),
              transform: `rotate(${angle}deg) translate3d(${interpolate(
                frame,
                [0, 150],
                [index % 2 === 0 ? -220 : 220, index % 2 === 0 ? -40 : 40],
                { ...clamp, easing: easeOut },
              )}px, ${interpolate(frame, [0, 150], [index % 2 === 0 ? 160 : -160, 0], {
                ...clamp,
                easing: easeOut,
              })}px, 0)`,
              backdropFilter: "blur(18px)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.32)",
            }}
          >
            {label}
          </div>
        );
      })}
    </>
  );
};

export const CountryConstellation: React.FC = () => {
  const frame = useCurrentFrame();
  const countries = [
    ["Nigeria", 900, 420],
    ["Ghana", 730, 505],
    ["Kenya", 1110, 560],
    ["South Africa", 980, 760],
    ["Uganda", 1040, 510],
    ["Cameroon", 850, 520],
  ] as const;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 710,
          top: 230,
          width: 460,
          height: 610,
          borderRadius: "48% 44% 54% 40%",
          border: `4px solid ${colors.orange}`,
          background:
            "radial-gradient(circle at 56% 42%, rgba(249,115,22,0.30), transparent 38%)",
          filter: "drop-shadow(0 32px 80px rgba(249,115,22,0.30))",
          opacity: interpolate(frame, [8, 48], [0, 1], {
            ...clamp,
            easing: easeOut,
          }),
          transform: `rotate(-12deg) scale(${interpolate(frame, [0, 90], [0.84, 1], {
            ...clamp,
            easing: easeOut,
          })})`,
        }}
      />
      {countries.map(([country, x, y], index) => (
        <div
          key={country}
          style={{
            position: "absolute",
            left: x,
            top: y,
            opacity: interpolate(frame, [30 + index * 8, 70 + index * 8], [0, 1], {
              ...clamp,
              easing: easeOut,
            }),
            transform: `translateY(${interpolate(frame, [30 + index * 8, 70 + index * 8], [24, 0], {
              ...clamp,
              easing: easeOut,
            })}px)`,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 99,
              background: colors.orange,
              boxShadow: "0 0 0 12px rgba(249,115,22,0.14)",
            }}
          />
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 999,
              background: "#111111",
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: 18,
            }}
          >
            {country}
          </div>
        </div>
      ))}
    </div>
  );
};

export const FilmStrip: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  return (
    <div
      style={{
        position: "absolute",
        width: 2200,
        height: 180,
        left: -120,
        top: 820,
        opacity,
        rotate: "-8deg",
        background:
          "repeating-linear-gradient(90deg, #111111 0 64px, transparent 64px 88px), linear-gradient(#111111, #111111)",
        maskImage:
          "linear-gradient(90deg, transparent, black 16%, black 84%, transparent)",
      }}
    />
  );
};
