import { AbsoluteFill, Img, staticFile } from "remotion";
import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import { film, actor } from "../data/demoContent";
import { PhoneMockup } from "../components/PhoneMockup";
import { WhatsAppMovieAlert } from "../components/WhatsAppMovieAlert";

/**
 * Reels / TikTok cover.
 *
 * Built from the same components as the film so the cover cannot drift from
 * what the video actually shows. The headline is set large enough to survive
 * being rendered at thumbnail size in a feed, and the orange is kept to the
 * underline and the logo rather than washing the whole frame.
 */
export const CoverThumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: brand.black, overflow: "hidden" }}>
    {/* Key art wash */}
    <Img
      src={film.poster}
      style={{
        position: "absolute",
        inset: -100,
        width: "calc(100% + 200px)",
        height: "calc(100% + 200px)",
        objectFit: "cover",
        filter: "blur(54px) saturate(0.75) brightness(0.3)",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0.96) 100%)",
      }}
    />

    {/* The phone, showing the alert itself. */}
    <AbsoluteFill style={{ perspective: 2000 }}>
      <PhoneMockup scale={1.02} translateY={150} tiltY={-5} tiltX={2}>
        <WhatsAppMovieAlert frame={400} bubbleAt={0} scrollY={24} />
      </PhoneMockup>
    </AbsoluteFill>

    {/* Headline */}
    <div
      style={{
        position: "absolute",
        top: 168,
        left: 0,
        right: 0,
        textAlign: "center",
        padding: "0 70px",
      }}
    >
      <div
        style={{
          fontFamily: fontFamilies.label,
          fontSize: 34,
          letterSpacing: 4.4,
          fontWeight: 600,
          color: brand.orange,
          marginBottom: 18,
        }}
      >
        WHATSAPP MOVIE ALERTS
      </div>
      <div
        style={{
          fontFamily: fontFamilies.title,
          fontSize: 164,
          lineHeight: 0.88,
          letterSpacing: 2,
          color: brand.white,
          textShadow: "0 6px 40px rgba(0,0,0,0.8)",
        }}
      >
        NEVER MISS
        <br />A MOVIE
      </div>
      <div
        style={{
          width: 230,
          height: 7,
          borderRadius: 4,
          background: brand.orange,
          margin: "30px auto 0",
        }}
      />
      <div
        style={{
          fontFamily: fontFamilies.body,
          fontSize: 33,
          fontWeight: 500,
          color: "rgba(255,255,255,0.8)",
          marginTop: 26,
        }}
      >
        Follow {actor.name}. Get the alert.
      </div>
    </div>

    {/* Logo */}
    <div
      style={{
        position: "absolute",
        bottom: 96,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Img
        src={staticFile("brand/white-logo.svg")}
        style={{ width: 300, height: "auto" }}
      />
    </div>
  </AbsoluteFill>
);
