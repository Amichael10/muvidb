import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BrandLogo } from "../components/Brand";
import { DesktopFrame, MobileFrame, SearchUi } from "../components/DeviceFrames";
import { SceneShell, colors } from "../components/SceneShell";
import { clamp, easeOut, fadeIn, move } from "../lib/animation";

export const RevealScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell tone="warm">
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          perspective: 1800,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 132,
            opacity: fadeIn(frame, 0, 36),
            transform: `translateY(${move(frame, 0, 42, 28, 0)}px) scale(${interpolate(
              frame,
              [0, 70],
              [0.92, 1],
              { ...clamp, easing: easeOut },
            )})`,
          }}
        >
          <BrandLogo variant="orange" style={{ width: 310 }} />
        </div>
        <div
          style={{
            position: "absolute",
            top: 286,
            fontSize: 76,
            lineHeight: 1,
            fontWeight: 950,
            textAlign: "center",
            opacity: fadeIn(frame, 18, 54),
          }}
        >
          The home for African cinema.
        </div>
        <div
          style={{
            position: "absolute",
            width: 1120,
            height: 720,
            top: 410,
            left: 320,
            transform: `rotateX(8deg) rotateY(${interpolate(frame, [0, 180], [-17, -6], {
              ...clamp,
              easing: easeOut,
            })}deg) translateY(${move(frame, 24, 92, 90, 0)}px) scale(0.86)`,
            opacity: fadeIn(frame, 30, 84),
          }}
        >
          <DesktopFrame>
            <SearchUi query="African cinema" />
          </DesktopFrame>
        </div>
        <div
          style={{
            position: "absolute",
            right: 326,
            bottom: 94,
            transform: `rotateY(-18deg) translateY(${move(frame, 52, 102, 120, 0)}px)`,
            opacity: fadeIn(frame, 58, 108),
          }}
        >
          <MobileFrame>
            <SearchUi query="MuviDB" compact />
          </MobileFrame>
        </div>
        <div
          style={{
            position: "absolute",
            left: 150,
            bottom: 122,
            color: colors.muted,
            fontSize: 24,
            fontWeight: 800,
            opacity: fadeIn(frame, 118, 150),
          }}
        >
          Until now.
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
