import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { fadeIn, fadeOut, move, clamp, easeOut } from "../lib/animation";
import { FilmArtifacts, FilmStrip } from "../components/CinematicBits";
import { SceneShell, colors } from "../components/SceneShell";

const lines = [
  "African cinema is growing.",
  "But its memory is scattered.",
  "Films disappear.",
  "Credits are forgotten.",
  "Stories become impossible to find.",
];

export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell tone="dark">
      <FilmArtifacts />
      <FilmStrip opacity={0.18} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: "0 160px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1320,
          }}
        >
          {lines.map((line, index) => {
            const start = index * 30;
            return (
              <div
                key={line}
                style={{
                  fontSize: index === 0 ? 88 : 72,
                  lineHeight: 1.04,
                  fontWeight: index === 0 ? 950 : 850,
                  color: index === 0 ? "#FFFFFF" : "#D6D3D1",
                  marginBottom: 20,
                  opacity:
                    fadeIn(frame, start, start + 24) *
                    fadeOut(frame, 178, 204),
                  transform: `translateY(${move(frame, start, start + 24, 34, 0)}px)`,
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 160,
          bottom: 112,
          width: interpolate(frame, [132, 190], [0, 760], {
            ...clamp,
            easing: easeOut,
          }),
          height: 3,
          borderRadius: 99,
          background: colors.orange,
          opacity: fadeIn(frame, 128, 158),
        }}
      />
    </SceneShell>
  );
};
