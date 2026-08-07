import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DesktopFrame, MobileFrame, MovieUi } from "../components/DeviceFrames";
import { SceneShell, colors } from "../components/SceneShell";
import { clamp, easeOut, fadeIn, move } from "../lib/animation";

export const FilmScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell tone="warm">
      <AbsoluteFill style={{ perspective: 1900 }}>
        <div
          style={{
            position: "absolute",
            left: 134,
            top: 116,
            width: 540,
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
            Film records
          </div>
          <div
            style={{
              fontSize: 80,
              lineHeight: 0.94,
              fontWeight: 950,
              marginTop: 14,
              opacity: fadeIn(frame, 8, 40),
            }}
          >
            Every film, beautifully organized.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 718,
            top: 264,
            transform: `rotateX(8deg) rotateY(${interpolate(frame, [0, 260], [12, 2], {
              ...clamp,
              easing: easeOut,
            })}deg) translateY(${move(frame, 8, 64, 70, 0)}px) scale(0.92)`,
            opacity: fadeIn(frame, 8, 58),
          }}
        >
          <DesktopFrame title="muvidb.com/movie">
            <MovieUi />
          </DesktopFrame>
        </div>
        <div
          style={{
            position: "absolute",
            right: 72,
            top: 360,
            opacity: fadeIn(frame, 86, 132),
            transform: `rotateY(-13deg) translateY(${move(frame, 84, 132, 80, 0)}px)`,
          }}
        >
          <MobileFrame>
            <MovieUi compact />
          </MobileFrame>
        </div>
        {["Cast", "Crew", "Trailers", "Where to watch"].map((label, index) => (
          <div
            key={label}
            style={{
              position: "absolute",
              left: 190 + index * 124,
              bottom: 128 + (index % 2) * 54,
              width: 178,
              height: 110,
              borderRadius: 26,
              background: index === 3 ? "#111111" : "#FFFFFF",
              color: index === 3 ? "#FFFFFF" : "#111111",
              border: "1px solid #E7E2DA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 950,
              boxShadow: "0 20px 56px rgba(17,17,17,0.12)",
              opacity: fadeIn(frame, 104 + index * 10, 140 + index * 10),
              transform: `translateY(${move(frame, 104 + index * 10, 140 + index * 10, 46, 0)}px) rotate(${index % 2 === 0 ? -3 : 3}deg)`,
            }}
          >
            {label}
          </div>
        ))}
      </AbsoluteFill>
    </SceneShell>
  );
};
