import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DesktopFrame, MobileFrame, SearchUi } from "../components/DeviceFrames";
import { SceneShell, colors } from "../components/SceneShell";
import { clamp, easeOut, fadeIn, move } from "../lib/animation";

export const SearchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const typed = "Lateef Adedimeji".slice(
    0,
    Math.round(interpolate(frame, [24, 92], [0, 16], clamp)),
  );

  return (
    <SceneShell>
      <AbsoluteFill style={{ perspective: 1700 }}>
        <div
          style={{
            position: "absolute",
            left: 142,
            top: 122,
            maxWidth: 620,
            zIndex: 5,
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
            Search
          </div>
          <div
            style={{
              fontSize: 88,
              lineHeight: 0.96,
              fontWeight: 950,
              marginTop: 16,
              opacity: fadeIn(frame, 8, 36),
              transform: `translateY(${move(frame, 8, 36, 40, 0)}px)`,
            }}
          >
            Find the name behind the story.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 172,
            top: 222,
            transform: `rotateX(6deg) rotateY(${interpolate(frame, [0, 260], [-12, -3], {
              ...clamp,
              easing: easeOut,
            })}deg) translateY(${move(frame, 12, 62, 80, 0)}px)`,
            opacity: fadeIn(frame, 12, 58),
          }}
        >
          <DesktopFrame>
            <SearchUi query={typed} />
          </DesktopFrame>
        </div>
        <div
          style={{
            position: "absolute",
            left: 1242,
            top: 412,
            transform: `rotateY(-16deg) translateY(${move(frame, 70, 128, 92, 0)}px)`,
            opacity: fadeIn(frame, 72, 124),
          }}
        >
          <MobileFrame>
            <SearchUi query={typed} compact />
          </MobileFrame>
        </div>
        <div
          style={{
            position: "absolute",
            left: 146,
            bottom: 136,
            display: "flex",
            gap: 18,
          }}
        >
          {["Any actor", "Any director", "Any movie"].map((label, index) => (
            <div
              key={label}
              style={{
                padding: "18px 24px",
                borderRadius: 999,
                background: index === 1 ? "#111111" : "#F8F4ED",
                color: index === 1 ? "#FFFFFF" : "#111111",
                border: "1px solid #E7E2DA",
                fontWeight: 900,
                fontSize: 24,
                opacity: fadeIn(frame, 126 + index * 12, 158 + index * 12),
                transform: `translateY(${move(frame, 126 + index * 12, 158 + index * 12, 28, 0)}px)`,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
