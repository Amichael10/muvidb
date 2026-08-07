import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CountryConstellation } from "../components/CinematicBits";
import { DesktopFrame, MovieUi } from "../components/DeviceFrames";
import { SceneShell, colors } from "../components/SceneShell";
import { fadeIn, move } from "../lib/animation";

export const DiscoveryScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell tone="warm">
      <CountryConstellation />
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: 130,
            top: 126,
            width: 640,
          }}
        >
          <div
            style={{
              color: colors.orange,
              fontSize: 24,
              fontWeight: 950,
              textTransform: "uppercase",
              opacity: fadeIn(frame, 0, 24),
            }}
          >
            Discovery
          </div>
          <div
            style={{
              fontSize: 88,
              lineHeight: 0.96,
              fontWeight: 950,
              marginTop: 18,
              opacity: fadeIn(frame, 8, 42),
            }}
          >
            Country by country. Story by story.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 130,
            bottom: 124,
            display: "grid",
            gridTemplateColumns: "repeat(3, 210px)",
            gap: 16,
          }}
        >
          {["Where to watch", "In cinemas", "Community reviews"].map(
            (label, index) => (
              <div
                key={label}
                style={{
                  height: 132,
                  borderRadius: 28,
                  background: index === 0 ? "#111111" : "#FFFFFF",
                  color: index === 0 ? "#FFFFFF" : "#111111",
                  border: "1px solid #E7E2DA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: 20,
                  fontWeight: 950,
                  fontSize: 24,
                  boxShadow: "0 22px 60px rgba(17,17,17,0.10)",
                  opacity: fadeIn(frame, 92 + index * 12, 126 + index * 12),
                  transform: `translateY(${move(frame, 92 + index * 12, 126 + index * 12, 36, 0)}px)`,
                }}
              >
                {label}
              </div>
            ),
          )}
        </div>
        <div
          style={{
            position: "absolute",
            right: 90,
            bottom: 88,
            opacity: fadeIn(frame, 116, 160),
            transform: `translateY(${move(frame, 116, 160, 84, 0)}px) scale(0.72) rotateY(-8deg)`,
          }}
        >
          <DesktopFrame title="muvidb.com/discover">
            <MovieUi />
          </DesktopFrame>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
