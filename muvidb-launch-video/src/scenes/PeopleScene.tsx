import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DesktopFrame, MobileFrame, PeopleUi } from "../components/DeviceFrames";
import { SceneShell, colors } from "../components/SceneShell";
import { clamp, easeOut, fadeIn, move } from "../lib/animation";

export const PeopleScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell>
      <AbsoluteFill style={{ perspective: 1600 }}>
        <div
          style={{
            position: "absolute",
            left: 126,
            top: 132,
            zIndex: 4,
            width: 560,
          }}
        >
          <div
            style={{
              color: colors.orange,
              fontSize: 24,
              fontWeight: 950,
              textTransform: "uppercase",
              opacity: fadeIn(frame, 0, 22),
            }}
          >
            People
          </div>
          <div
            style={{
              fontSize: 86,
              lineHeight: 0.95,
              fontWeight: 950,
              marginTop: 18,
              opacity: fadeIn(frame, 10, 42),
              transform: `translateY(${move(frame, 10, 42, 36, 0)}px)`,
            }}
          >
            Preserve every credit.
          </div>
          <div
            style={{
              marginTop: 28,
              color: "#6B625C",
              fontSize: 30,
              lineHeight: 1.3,
              fontWeight: 700,
              opacity: fadeIn(frame, 44, 82),
            }}
          >
            Filmographies, awards, galleries and collaborators, connected.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 250,
            top: 210,
            opacity: fadeIn(frame, 24, 70),
            transform: `rotateX(8deg) rotateY(${interpolate(frame, [0, 210], [-10, 4], {
              ...clamp,
              easing: easeOut,
            })}deg) translateY(${move(frame, 24, 70, 80, 0)}px)`,
          }}
        >
          <DesktopFrame title="muvidb.com/person">
            <PeopleUi />
          </DesktopFrame>
        </div>
        <div
          style={{
            position: "absolute",
            right: 112,
            top: 372,
            opacity: fadeIn(frame, 80, 126),
            transform: `rotateY(-14deg) translateY(${move(frame, 80, 126, 70, 0)}px) scale(0.92)`,
          }}
        >
          <MobileFrame>
            <PeopleUi />
          </MobileFrame>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
