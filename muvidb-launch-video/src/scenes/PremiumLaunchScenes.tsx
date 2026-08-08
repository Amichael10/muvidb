import {
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { BrandLogo } from "../components/Brand";
import {
  CopyBlock,
  DesktopFrame,
  FloatingTag,
  PhoneFrame,
  PremiumStage,
  StatTile,
} from "../components/PremiumProductFrames";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const fontStack =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const ProblemTypographyScene: React.FC = () => {
  const frame = useCurrentFrame();

  const lines = [
    { text: "African cinema is growing.", top: 330, start: 10 },
    { text: "But its history is scattered.", top: 450, start: 42 },
    { text: "Films disappear. Credits are forgotten.", top: 570, start: 74 },
  ];

  return (
    <PremiumStage tone="dark">
      <BrandLogo
        variant="white"
        style={{
          position: "absolute",
          left: 116,
          top: 78,
          width: 196,
          opacity: interpolate(frame, [0, 24], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 116,
          top: 280,
          color: "#ff5a1f",
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: 0,
          textTransform: "uppercase",
          opacity: interpolate(frame, [0, 24], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        The missing archive
      </div>
      {lines.map((line) => (
        <div
          key={line.text}
          style={{
            position: "absolute",
            left: 116,
            top: line.top,
            width: 1360,
            fontFamily: fontStack,
            fontSize: line.text.length > 34 ? 82 : 94,
            lineHeight: 0.98,
            fontWeight: 900,
            letterSpacing: 0,
            color: "#ffffff",
            opacity: interpolate(
              frame,
              [line.start, line.start + 20, 128, 148],
              [0, 1, 1, 0],
              {
                ...clamp,
                easing: ease,
              },
            ),
            translate: `0 ${interpolate(frame, [line.start, line.start + 26], [28, 0], {
              ...clamp,
              easing: ease,
            })}px`,
          }}
        >
          {line.text}
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          right: 118,
          bottom: 92,
          width: 440,
          color: "rgba(255,255,255,0.48)",
          fontSize: 24,
          lineHeight: 1.4,
          fontWeight: 500,
          textAlign: "right",
          opacity: interpolate(frame, [86, 120, 130, 148], [0, 1, 1, 0], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        Thousands of stories. No single home.
      </div>
    </PremiumStage>
  );
};

export const RevealProductScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <PremiumStage tone="dark" backgroundImage="captures/home-desktop.png">
      <BrandLogo
        variant="white"
        style={{
          position: "absolute",
          left: 116,
          top: 94,
          width: 250,
          opacity: interpolate(frame, [0, 24], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      />
      <CopyBlock
        kicker="Until now"
        title="African cinema finally has a home."
        body="MuviDB brings films, people, credits, cinemas, and where-to-watch data into one cinematic product."
        style={{ left: 116, top: 244 }}
        maxWidth={560}
      />
      <DesktopFrame
        src="captures/home-desktop.png"
        width={1080}
        height={720}
        style={{
          left: 710,
          top: 210,
          opacity: interpolate(frame, [22, 58], [0, 1], {
            ...clamp,
            easing: ease,
          }),
          scale: interpolate(frame, [22, 88], [0.94, 1], {
            ...clamp,
            easing: ease,
          }),
          translate: `0 ${interpolate(frame, [22, 88], [42, 0], {
            ...clamp,
            easing: ease,
          })}px`,
        }}
      />
      <FloatingTag
        style={{
          left: 1335,
          top: 150,
          opacity: interpolate(frame, [76, 106], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        Every film. Every credit.
      </FloatingTag>
    </PremiumStage>
  );
};

export const HomeExperienceScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <PremiumStage tone="light">
      <CopyBlock
        kicker="Product"
        title="Real MuviDB UI."
        tone="light"
        style={{ left: 116, top: 112 }}
        maxWidth={760}
      />
      <DesktopFrame
        src="captures/home-desktop.png"
        tone="light"
        width={1170}
        height={780}
        style={{
          left: 112,
          top: 278,
          opacity: interpolate(frame, [20, 52], [0, 1], {
            ...clamp,
            easing: ease,
          }),
          scale: interpolate(frame, [20, 90], [0.96, 1], {
            ...clamp,
            easing: ease,
          }),
          translate: `${interpolate(frame, [20, 90], [-48, 0], {
            ...clamp,
            easing: ease,
          })}px 0`,
        }}
      />
      <PhoneFrame
        src="captures/home-mobile.png"
        width={364}
        height={790}
        style={{
          left: 1308,
          top: 190,
          opacity: interpolate(frame, [54, 86], [0, 1], {
            ...clamp,
            easing: ease,
          }),
          scale: interpolate(frame, [54, 118], [0.92, 1], {
            ...clamp,
            easing: ease,
          }),
          translate: `0 ${interpolate(frame, [54, 118], [58, 0], {
            ...clamp,
            easing: ease,
          })}px`,
        }}
      />
    </PremiumStage>
  );
};

export const FilmRecordScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <PremiumStage tone="dark" backgroundImage="captures/detail-desktop.png">
      <CopyBlock
        kicker="Film pages"
        title="Credits, context, and action in one record."
        body="A film page can carry the poster, synopsis, awards, studio, ratings, and watch actions without feeling like a spreadsheet."
        style={{ left: 116, top: 150 }}
        maxWidth={520}
      />
      <DesktopFrame
        src="captures/detail-desktop.png"
        width={1120}
        height={748}
        style={{
          left: 600,
          top: 190,
          opacity: interpolate(frame, [16, 48], [0, 1], {
            ...clamp,
            easing: ease,
          }),
          scale: interpolate(frame, [16, 92], [0.95, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      />
      <PhoneFrame
        src="captures/detail-mobile.png"
        width={344}
        height={748}
        style={{
          left: 1358,
          top: 238,
          opacity: interpolate(frame, [58, 92], [0, 1], {
            ...clamp,
            easing: ease,
          }),
          scale: interpolate(frame, [58, 120], [0.92, 1], {
            ...clamp,
            easing: ease,
          }),
          translate: `0 ${interpolate(frame, [58, 120], [48, 0], {
            ...clamp,
            easing: ease,
          })}px`,
        }}
      />
      <FloatingTag
        style={{
          left: 660,
          top: 838,
          opacity: interpolate(frame, [106, 136], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        Where to watch, right on the film.
      </FloatingTag>
    </PremiumStage>
  );
};

export const CatalogScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <PremiumStage tone="light">
      <CopyBlock
        kicker="Discovery"
        title="Browse the library."
        tone="light"
        style={{ left: 116, top: 112 }}
        maxWidth={820}
      />
      <div
        style={{
          position: "absolute",
          right: 116,
          top: 132,
          width: 470,
          color: "rgba(17,17,17,0.54)",
          fontSize: 25,
          lineHeight: 1.36,
          fontWeight: 600,
          opacity: interpolate(frame, [56, 86], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        Built for a library that keeps expanding across regions, releases, and
        audience behavior.
      </div>
      <DesktopFrame
        src="captures/browse-desktop.png"
        tone="light"
        width={1360}
        height={775}
        imageStyle={{ objectPosition: "center top" }}
        style={{
          left: 280,
          top: 286,
          opacity: interpolate(frame, [20, 52], [0, 1], {
            ...clamp,
            easing: ease,
          }),
          scale: interpolate(frame, [20, 100], [0.94, 1], {
            ...clamp,
            easing: ease,
          }),
          translate: `0 ${interpolate(frame, [20, 100], [42, 0], {
            ...clamp,
            easing: ease,
          })}px`,
        }}
      />
    </PremiumStage>
  );
};

export const EcosystemScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <PremiumStage tone="dark" backgroundImage="captures/cinemas-desktop.png">
      <CopyBlock
        kicker="Ecosystem"
        title="Talent and cinemas live beside the films."
        body="MuviDB can connect the archive to the people who made it and the places audiences experience it."
        style={{ left: 116, top: 150 }}
        maxWidth={540}
      />
      <DesktopFrame
        src="captures/people-desktop.png"
        width={820}
        height={548}
        style={{
          left: 720,
          top: 132,
          opacity: interpolate(frame, [12, 44], [0, 1], {
            ...clamp,
            easing: ease,
          }),
          scale: interpolate(frame, [12, 80], [0.95, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      />
      <DesktopFrame
        src="captures/cinemas-desktop.png"
        width={880}
        height={588}
        style={{
          left: 604,
          top: 432,
          opacity: interpolate(frame, [44, 76], [0, 1], {
            ...clamp,
            easing: ease,
          }),
          scale: interpolate(frame, [44, 110], [0.95, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      />
      <PhoneFrame
        src="captures/cinemas-mobile.png"
        width={312}
        height={684}
        style={{
          left: 1438,
          top: 300,
          opacity: interpolate(frame, [84, 116], [0, 1], {
            ...clamp,
            easing: ease,
          }),
          scale: interpolate(frame, [84, 142], [0.92, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      />
      <FloatingTag
        style={{
          left: 676,
          top: 874,
          opacity: interpolate(frame, [128, 158], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        One system for the whole cinema journey.
      </FloatingTag>
    </PremiumStage>
  );
};

export const StatsOutroScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <PremiumStage tone="light">
      <Img
        src={staticFile("captures/home-desktop.png")}
        style={{
          position: "absolute",
          right: -180,
          top: 132,
          width: 1180,
          height: 780,
          objectFit: "cover",
          borderRadius: 42,
          opacity: interpolate(frame, [0, 42], [0, 0.16], {
            ...clamp,
            easing: ease,
          }),
          filter: "grayscale(1)",
          boxShadow: "0 45px 110px rgba(60,48,35,0.18)",
        }}
      />
      <BrandLogo
        variant="orange"
        style={{
          position: "absolute",
          left: 116,
          top: 78,
          width: 218,
          opacity: interpolate(frame, [0, 28], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      />
      <CopyBlock
        kicker="Launch"
        title="Discover African Cinema."
        body="Movies. People. Stories."
        tone="light"
        style={{ left: 116, top: 276 }}
        maxWidth={720}
      />
      <div
        style={{
          position: "absolute",
          left: 116,
          top: 612,
          display: "flex",
          gap: 58,
          opacity: interpolate(frame, [42, 72], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        <StatTile value={41000} label="Movies" delay={52} />
        <StatTile value={31000} label="People" delay={68} />
        <StatTile value={75000} label="Credits" delay={84} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 116,
          bottom: 90,
          color: "#111111",
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: 0,
          opacity: interpolate(frame, [138, 170], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        muvidb.com
      </div>
      <div
        style={{
          position: "absolute",
          right: 116,
          bottom: 92,
          width: 360,
          height: 3,
          backgroundColor: "#ff5a1f",
          opacity: interpolate(frame, [154, 186], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      />
    </PremiumStage>
  );
};
