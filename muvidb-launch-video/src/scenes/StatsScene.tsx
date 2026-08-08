import { AbsoluteFill, useCurrentFrame } from "remotion";
import { StatsNumber } from "../components/StatsNumber";
import { SceneShell, colors } from "../components/SceneShell";
import { fadeIn, move } from "../lib/animation";

export const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell tone="dark">
      <AbsoluteFill
        style={{
          padding: "118px 136px",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: colors.orange,
            fontWeight: 950,
            fontSize: 24,
            textTransform: "uppercase",
            opacity: fadeIn(frame, 0, 24),
          }}
        >
          The scale
        </div>
        <div
          style={{
            fontSize: 90,
            lineHeight: 0.98,
            fontWeight: 950,
            width: 980,
            marginTop: 18,
            marginBottom: 78,
            opacity: fadeIn(frame, 8, 42),
            transform: `translateY(${move(frame, 8, 42, 40, 0)}px)`,
          }}
        >
          A living index for African film culture.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 54,
          }}
        >
          <StatsNumber label="Movies" value={41000} delay={54} />
          <StatsNumber label="People" value={31000} delay={76} />
          <StatsNumber label="Credits" value={75000} delay={98} />
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
