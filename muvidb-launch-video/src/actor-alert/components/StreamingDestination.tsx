import { Img, staticFile } from "remotion";
import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import { film } from "../data/demoContent";
import { StatusBar, HomeIndicator, Island } from "./PhoneMockup";
import { progress, tap } from "../lib/ease";

/**
 * Scene 6 is a two-step handoff, because that is what the product does.
 *
 * The WhatsApp button opens the MuviDB film page -- it does not deep-link into
 * Netflix. The film page is where the synopsis, the cast and the verified
 * "WATCH ON Netflix" button live, and tapping that button is what sends the
 * viewer to Netflix. Collapsing these two steps into one would overstate the
 * feature, so the video keeps both.
 *
 * The film page itself is the real captured screen rather than a rebuild, so
 * what the viewer sees is literally the shipped page.
 */
/**
 * Where the "WATCH ON Netflix" button sits in the captured page, in CSS px.
 * The scene uses this both to aim the touch indicator and to decide how far
 * to scroll, so the two can never drift apart.
 */
export const WATCH_BUTTON = { top: 1328, height: 41, centerX: 195 } as const;

/** Scroll offset that puts the synopsis, cast and watch button on screen. */
export const FILM_PAGE_SCROLL = 700;

export const FilmPage: React.FC<{
  frame: number;
  /** Frame the page settles after the WhatsApp handoff. */
  arriveAt: number;
  /** Frame the Netflix button is pressed. */
  tapAt?: number | null;
  /** Scroll offset in px. The capture is one tall image. */
  scrollY?: number;
}> = ({ frame, arriveAt, tapAt = null, scrollY = 0 }) => {
  const arrive = progress(frame, { from: arriveAt, duration: 20 });
  const press = tapAt === null ? null : tap(frame, tapAt);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: brand.black,
        overflow: "hidden",
        opacity: arrive,
      }}
    >
      {/*
        The captured page is 1170x2532 at 3x. Rendered at 390 wide it maps 1:1
        to the phone viewport, so scrollY is in the same units as every other
        scroll in the film.
      */}
      <Img
        src={staticFile("captures/alert/film-page-scroll.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 390,
          transform: `translateY(${-scrollY}px)`,
        }}
      />

      {/*
        Press feedback over the real "WATCH ON Netflix" control. These numbers
        are measured off the capture (button spans y 1328-1369, x 30-360 in
        CSS px), so the highlight lands on the actual button rather than near
        it. Re-measure if the page layout changes.
      */}
      {press && press.rippleOpacity > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 30,
            width: 330,
            top: WATCH_BUTTON.top - scrollY,
            height: WATCH_BUTTON.height,
            borderRadius: 10,
            background: "rgba(255,255,255,0.26)",
            opacity: press.rippleOpacity * 2,
          }}
        />
      ) : null}

      <HomeIndicator />
    </div>
  );
};

/**
 * The Netflix title page the viewer lands on.
 *
 * Deliberately restrained: it is enough to show the handoff completed and the
 * right title playing. It is drawn rather than captured because Netflix pages
 * are personalised and sign-in gated, and shipping a screenshot of someone's
 * logged-in Netflix would be both inaccurate and not ours to publish.
 */
export const NetflixDestination: React.FC<{
  frame: number;
  arriveAt: number;
}> = ({ frame, arriveAt }) => {
  const arrive = progress(frame, { from: arriveAt, duration: 22 });
  const playGrow = progress(frame, { from: arriveAt + 10, duration: 26 });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        overflow: "hidden",
        opacity: arrive,
      }}
    >
      {/* Key art */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 560,
          overflow: "hidden",
        }}
      >
        <Img
          src={film.poster}
          style={{
            position: "absolute",
            top: 0,
            left: "-40%",
            width: "180%",
            transform: `scale(${1.02 + arrive * 0.03})`,
            transformOrigin: "center top",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 560,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.9) 92%, #000 100%)",
        }}
      />

      <StatusBar />
      <Island />

      {/* Netflix wordmark */}
      <div style={{ position: "absolute", top: 68, left: 18 }}>
        <NetflixWordmark height={26} />
      </div>

      <div style={{ position: "absolute", top: 470, left: 0, right: 0, padding: "0 18px" }}>
        <div
          style={{
            fontFamily: fontFamilies.body,
            fontSize: 30,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -0.6,
            lineHeight: 1.1,
          }}
        >
          {film.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginTop: 9,
            fontFamily: fontFamilies.body,
            fontSize: 13.5,
            color: "rgba(255,255,255,0.72)",
          }}
        >
          <span>{film.year}</span>
          <Dot />
          <span
            style={{
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 3,
              padding: "1px 5px",
              fontSize: 11.5,
            }}
          >
            16+
          </span>
          <Dot />
          <span>{film.runtimeLabel}</span>
        </div>

        {/* Play */}
        <div
          style={{
            marginTop: 16,
            height: 46,
            borderRadius: 5,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            transform: `scale(${0.97 + playGrow * 0.03})`,
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M7 4.5v15l13-7.5-13-7.5Z" fill="#000" />
          </svg>
          <span
            style={{
              fontFamily: fontFamilies.body,
              fontSize: 16,
              fontWeight: 700,
              color: "#000",
            }}
          >
            Play
          </span>
        </div>

        <div
          style={{
            marginTop: 15,
            fontFamily: fontFamilies.body,
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.82)",
          }}
        >
          {film.synopsis.slice(0, 118)}…
        </div>

        <div
          style={{
            marginTop: 11,
            fontFamily: fontFamilies.body,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.56)",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.42)" }}>Cast: </span>
          {film.stars.slice(0, 3).join(", ")}…
        </div>
      </div>

      <HomeIndicator />
    </div>
  );
};

const Dot = () => (
  <span
    style={{
      width: 3,
      height: 3,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.45)",
    }}
  />
);

/** Netflix's wordmark, drawn so no third-party asset is bundled. */
export const NetflixWordmark: React.FC<{ height?: number }> = ({ height = 24 }) => (
  <svg
    height={height}
    viewBox="0 0 111 30"
    fill="none"
    style={{ display: "block" }}
  >
    <text
      x="0"
      y="24"
      fill={brand.netflixRed}
      style={{
        fontFamily: '"Bebas Neue", Impact, sans-serif',
        fontSize: 30,
        letterSpacing: 1.5,
        fontWeight: 400,
      }}
    >
      NETFLIX
    </text>
  </svg>
);
