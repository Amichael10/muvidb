import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { BrandLogo } from "../components/Brand";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const sharperEase = Easing.bezier(0.22, 1, 0.36, 1);
const fontStack =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const orange = "#ff5a1f";
const black = "#060606";
const white = "#f7f4ee";

const Stage: React.FC<{
  mode: "dark" | "light";
  children: ReactNode;
}> = ({ mode, children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: mode === "dark" ? black : white,
      color: mode === "dark" ? white : black,
      fontFamily: fontStack,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: mode === "dark" ? 0.11 : 0.16,
        backgroundImage:
          "linear-gradient(90deg, currentColor 1px, transparent 1px)",
        backgroundSize: "240px 100%",
      }}
    />
    {children}
  </AbsoluteFill>
);

const Header: React.FC<{
  mode: "dark" | "light";
  label: string;
}> = ({ mode, label }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: 88,
        right: 88,
        height: 46,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: interpolate(frame, [0, 22], [0, 1], {
          ...clamp,
          easing: ease,
        }),
      }}
    >
      <BrandLogo
        variant={mode === "dark" ? "white" : "orange"}
        style={{ width: 190 }}
      />
      <div
        style={{
          fontSize: 15,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0,
          color: mode === "dark" ? "rgba(247,244,238,0.58)" : "#5a5149",
        }}
      >
        {label}
      </div>
    </div>
  );
};

const Title: React.FC<{
  children: ReactNode;
  top: number;
  left?: number;
  width?: number;
  size?: number;
  mode?: "dark" | "light";
  delay?: number;
  style?: CSSProperties;
}> = ({
  children,
  top,
  left = 88,
  width = 1100,
  size = 112,
  mode = "light",
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width,
        fontSize: size,
        lineHeight: 0.92,
        fontWeight: 950,
        letterSpacing: 0,
        color: mode === "dark" ? white : black,
        opacity: interpolate(frame, [delay + 8, delay + 30], [0, 1], {
          ...clamp,
          easing: ease,
        }),
        translate: `0 ${interpolate(frame, [delay + 8, delay + 44], [42, 0], {
          ...clamp,
          easing: ease,
        })}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Subtitle: React.FC<{
  children: ReactNode;
  top: number;
  left?: number;
  width?: number;
  mode?: "dark" | "light";
  delay?: number;
}> = ({ children, top, left = 88, width = 620, mode = "light", delay = 16 }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width,
        fontSize: 30,
        lineHeight: 1.28,
        fontWeight: 600,
        letterSpacing: 0,
        color:
          mode === "dark" ? "rgba(247,244,238,0.68)" : "rgba(6,6,6,0.62)",
        opacity: interpolate(frame, [delay, delay + 28], [0, 1], {
          ...clamp,
          easing: ease,
        }),
        translate: `0 ${interpolate(frame, [delay, delay + 42], [28, 0], {
          ...clamp,
          easing: ease,
        })}px`,
      }}
    >
      {children}
    </div>
  );
};

const Rule: React.FC<{
  mode: "dark" | "light";
  top: number;
  left?: number;
  width?: number;
  delay?: number;
}> = ({ mode, top, left = 88, width = 360, delay = 0 }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: interpolate(frame, [delay + 10, delay + 46], [0, width], {
          ...clamp,
          easing: sharperEase,
        }),
        height: 4,
        backgroundColor: orange,
        opacity: mode === "dark" ? 1 : 0.92,
      }}
    />
  );
};

const ProductWindow: React.FC<{
  src: string;
  style: CSSProperties;
  imageStyle?: CSSProperties;
  mode?: "dark" | "light";
  delay?: number;
  chrome?: boolean;
}> = ({ src, style, imageStyle, mode = "light", delay = 20, chrome = true }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        borderRadius: 28,
        padding: chrome ? "52px 10px 10px" : 10,
        background:
          mode === "dark"
            ? "linear-gradient(180deg, #242424, #080808)"
            : "linear-gradient(180deg, #ffffff, #ddd6cc)",
        border:
          mode === "dark"
            ? "1px solid rgba(247,244,238,0.17)"
            : "1px solid rgba(6,6,6,0.14)",
        boxShadow:
          mode === "dark"
            ? "0 52px 118px rgba(0,0,0,0.62)"
            : "0 44px 96px rgba(61,48,31,0.22)",
        overflow: "hidden",
        opacity: interpolate(frame, [delay, delay + 34], [0, 1], {
          ...clamp,
          easing: ease,
        }),
        scale: interpolate(frame, [delay, delay + 70], [0.965, 1], {
          ...clamp,
          easing: ease,
        }),
        translate: `0 ${interpolate(frame, [delay, delay + 70], [48, 0], {
          ...clamp,
          easing: ease,
        })}px`,
        ...style,
      }}
    >
      {chrome ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 52,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 22px",
          }}
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              style={{
                width: 11,
                height: 11,
                borderRadius: 99,
                backgroundColor:
                  dot === 0 ? orange : mode === "dark" ? "#555" : "#bbb2a5",
              }}
            />
          ))}
          <div
            style={{
              marginLeft: 10,
              height: 28,
              flex: 1,
              borderRadius: 99,
              backgroundColor:
                mode === "dark"
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(6,6,6,0.05)",
              border:
                mode === "dark"
                  ? "1px solid rgba(255,255,255,0.1)"
                  : "1px solid rgba(6,6,6,0.1)",
            }}
          />
        </div>
      ) : null}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: "#050505",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            ...imageStyle,
          }}
        />
      </div>
    </div>
  );
};

const Pill: React.FC<{
  children: ReactNode;
  left: number;
  top: number;
  delay: number;
  mode?: "dark" | "light";
}> = ({ children, left, top, delay, mode = "dark" }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        height: 54,
        padding: "0 24px",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        fontSize: 19,
        fontWeight: 900,
        letterSpacing: 0,
        color: mode === "dark" ? white : black,
        backgroundColor:
          mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(6,6,6,0.06)",
        border:
          mode === "dark"
            ? "1px solid rgba(255,255,255,0.15)"
            : "1px solid rgba(6,6,6,0.14)",
        opacity: interpolate(frame, [delay, delay + 24], [0, 1], {
          ...clamp,
          easing: ease,
        }),
        translate: `${interpolate(frame, [delay, delay + 42], [-18, 0], {
          ...clamp,
          easing: ease,
        })}px 0`,
      }}
    >
      {children}
    </div>
  );
};

const Count: React.FC<{
  value: number;
  label: string;
  left: number;
  delay: number;
}> = ({ value, label, left, delay }) => {
  const frame = useCurrentFrame();
  const current = Math.round(
    interpolate(frame, [delay, delay + 76], [0, value], {
      ...clamp,
      easing: ease,
    }),
  );

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: 438,
        width: 420,
        opacity: interpolate(frame, [delay - 10, delay + 18], [0, 1], {
          ...clamp,
          easing: ease,
        }),
      }}
    >
      <div
        style={{
          width: "100%",
          height: 4,
          backgroundColor: orange,
          marginBottom: 34,
        }}
      />
      <div
        style={{
          fontSize: 86,
          lineHeight: 0.9,
          fontWeight: 950,
          letterSpacing: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {current.toLocaleString()}+
      </div>
      <div
        style={{
          marginTop: 18,
          color: "rgba(6,6,6,0.55)",
          fontSize: 22,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0,
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const CleanIntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Stage mode="light">
      <Header mode="light" label="Product launch" />
      <Rule mode="light" top={238} width={420} />
      <Title top={294} width={1320} size={126}>
        MuviDB makes African cinema searchable.
      </Title>
      <Subtitle top={670} width={720}>
        A clean home for films, people, credits, cinemas, and where to watch.
      </Subtitle>
      <div
        style={{
          position: "absolute",
          right: 88,
          bottom: 76,
          color: "rgba(6,6,6,0.36)",
          fontSize: 17,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0,
          opacity: interpolate(frame, [66, 96], [0, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        Every film. Every credit.
      </div>
    </Stage>
  );
};

export const CleanHomeScene: React.FC = () => (
  <Stage mode="dark">
    <Header mode="dark" label="The product" />
    <Title top={222} width={580} size={92} mode="dark">
      Start with the screen people actually use.
    </Title>
    <Subtitle top={572} width={500} mode="dark">
      The homepage puts the archive, discovery paths, and featured cinema in one
      sharp surface.
    </Subtitle>
    <Rule mode="dark" top={780} left={88} width={300} delay={40} />
    <ProductWindow
      src="captures/home-desktop.png"
      mode="dark"
      delay={24}
      style={{
        left: 660,
        top: 164,
        width: 1120,
        height: 760,
      }}
    />
  </Stage>
);

export const CleanFilmScene: React.FC = () => (
  <Stage mode="light">
    <Header mode="light" label="Film records" />
    <Title top={178} width={620} size={94}>
      Every title gets a proper record.
    </Title>
    <Subtitle top={520} width={520}>
      Posters, metadata, ratings, awards, and watch actions live together
      without turning into noise.
    </Subtitle>
    <Pill left={88} top={740} delay={74} mode="light">
      Cast
    </Pill>
    <Pill left={188} top={740} delay={86} mode="light">
      Credits
    </Pill>
    <Pill left={322} top={740} delay={98} mode="light">
      Where to watch
    </Pill>
    <ProductWindow
      src="captures/detail-desktop.png"
      delay={20}
      style={{
        left: 704,
        top: 150,
        width: 1028,
        height: 790,
      }}
    />
  </Stage>
);

export const CleanDiscoveryScene: React.FC = () => (
  <Stage mode="dark">
    <Header mode="dark" label="Discovery" />
    <Title top={164} width={900} size={96} mode="dark">
      Browse the ecosystem, not just a list.
    </Title>
    <Subtitle top={408} width={620} mode="dark">
      Movies, talent, and exhibition hubs sit in the same product language.
    </Subtitle>
    <ProductWindow
      src="captures/browse-desktop.png"
      mode="dark"
      delay={24}
      chrome={false}
      style={{
        left: 88,
        top: 610,
        width: 520,
        height: 342,
      }}
    />
    <ProductWindow
      src="captures/people-desktop.png"
      mode="dark"
      delay={42}
      chrome={false}
      style={{
        left: 704,
        top: 512,
        width: 520,
        height: 440,
      }}
    />
    <ProductWindow
      src="captures/cinemas-desktop.png"
      mode="dark"
      delay={60}
      chrome={false}
      style={{
        left: 1318,
        top: 412,
        width: 520,
        height: 540,
      }}
    />
  </Stage>
);

export const CleanScaleScene: React.FC = () => (
  <Stage mode="light">
    <Header mode="light" label="Scale" />
    <Title top={178} width={1100} size={104}>
      Built for a living archive.
    </Title>
    <Subtitle top={322} width={680}>
      The platform can grow with the industry as more titles, people, and
      credits come online.
    </Subtitle>
    <Count value={41000} label="Movies" left={88} delay={50} />
    <Count value={31000} label="People" left={590} delay={68} />
    <Count value={75000} label="Credits" left={1092} delay={86} />
  </Stage>
);

export const CleanFinalScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Stage mode="dark">
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: black,
        }}
      />
      <BrandLogo
        variant="white"
        style={{
          position: "absolute",
          left: "50%",
          top: 286,
          width: 330,
          translate: "-50% 0",
          opacity: interpolate(frame, [8, 34, 180, 210], [0, 1, 1, 0], {
            ...clamp,
            easing: ease,
          }),
          scale: interpolate(frame, [8, 70], [0.96, 1], {
            ...clamp,
            easing: ease,
          }),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 482,
          width: 950,
          translate: "-50% 0",
          textAlign: "center",
          fontSize: 74,
          lineHeight: 0.98,
          fontWeight: 950,
          letterSpacing: 0,
          color: white,
          opacity: interpolate(frame, [40, 76, 180, 210], [0, 1, 1, 0], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        The database for African film.
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 688,
          translate: "-50% 0",
          color: orange,
          fontSize: 30,
          fontWeight: 900,
          letterSpacing: 0,
          opacity: interpolate(frame, [70, 106, 180, 210], [0, 1, 1, 0], {
            ...clamp,
            easing: ease,
          }),
        }}
      >
        muvidb.com
      </div>
    </Stage>
  );
};
