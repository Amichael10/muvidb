import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BrandLogo } from "../components/Brand";
import { DesktopFrame, MobileFrame, SearchUi } from "../components/DeviceFrames";
import { SceneShell, colors } from "../components/SceneShell";
import { clamp, easeOut, fadeIn, move } from "../lib/animation";

export const HeroOutroScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell tone="dark">
      <AbsoluteFill style={{ perspective: 1900 }}>
        <div
          style={{
            position: "absolute",
            left: 310,
            top: 158,
            transform: `rotateX(8deg) rotateY(${interpolate(frame, [0, 240], [14, -3], {
              ...clamp,
              easing: easeOut,
            })}deg) translateY(${move(frame, 0, 64, 90, 0)}px) scale(0.86)`,
            opacity: fadeIn(frame, 0, 54),
          }}
        >
          <DesktopFrame>
            <SearchUi query="African stories" />
          </DesktopFrame>
        </div>
        <div
          style={{
            position: "absolute",
            right: 322,
            top: 308,
            opacity: fadeIn(frame, 42, 88),
            transform: `rotateY(-16deg) translateY(${move(frame, 42, 88, 74, 0)}px)`,
          }}
        >
          <MobileFrame>
            <SearchUi query="MuviDB" compact />
          </MobileFrame>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 420,
            background:
              "linear-gradient(180deg, transparent, rgba(9,9,9,0.84) 38%, #090909 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 136,
            bottom: 130,
            opacity: fadeIn(frame, 116, 154),
            transform: `translateY(${move(frame, 116, 154, 44, 0)}px)`,
          }}
        >
          <BrandLogo variant="white" style={{ width: 300, marginBottom: 32 }} />
          <div
            style={{
              fontSize: 88,
              lineHeight: 0.96,
              fontWeight: 950,
              width: 920,
            }}
          >
            Discover African Cinema.
          </div>
          <div
            style={{
              marginTop: 30,
              display: "flex",
              gap: 18,
              color: "#D6D3D1",
              fontSize: 30,
              fontWeight: 850,
            }}
          >
            <span>Movies.</span>
            <span>People.</span>
            <span>Stories.</span>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 136,
            bottom: 134,
            color: colors.orange,
            fontSize: 48,
            fontWeight: 950,
            opacity: fadeIn(frame, 150, 188),
          }}
        >
          muvidb.com
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
