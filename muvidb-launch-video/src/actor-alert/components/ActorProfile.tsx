import { Img } from "remotion";
import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import { actor } from "../data/demoContent";
import { TopBar, BottomNav } from "./MuviDBChrome";
import { FollowButton, ShareButton, VerifiedBadge } from "./FollowButton";
import { StatusBar, HomeIndicator, Island } from "./PhoneMockup";
import { progress } from "../lib/ease";

/**
 * The MuviDB person page, reproduced from the live mobile layout
 * (public/captures/alert/actor-profile-top.png).
 *
 * The follower count is the one number that animates: it ticks 0 -> 1 after
 * the Follow press, because that is the product's own feedback for the action
 * and it makes the tap feel consequential without inventing any new UI.
 */
export const ActorProfile: React.FC<{
  frame: number;
  tapAt: number;
  /** Vertical scroll offset in px, driven by the scene. */
  scrollY?: number;
}> = ({ frame, tapAt, scrollY = 0 }) => {
  const followed = frame >= tapAt + 6;
  const countPop = progress(frame, { from: tapAt + 6, duration: 14 });

  return (
    <div style={{ position: "absolute", inset: 0, background: brand.black }}>
      <StatusBar />
      <Island />
      <TopBar />

      <div
        style={{
          position: "absolute",
          top: 126,
          left: 0,
          right: 0,
          transform: `translateY(${-scrollY}px)`,
        }}
      >
        {/* Identity block */}
        <div style={{ display: "flex", gap: 16, padding: "22px 16px 0" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              style={{
                width: 118,
                height: 118,
                borderRadius: 18,
                overflow: "hidden",
                background: "#fff",
                border: `1px solid ${brand.hairline}`,
              }}
            >
              <Img
                src={actor.photo}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div style={{ position: "absolute", right: -7, bottom: -7 }}>
              <VerifiedBadge size={30} />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: fontFamilies.body,
                fontSize: 27,
                fontWeight: 700,
                color: brand.white,
                letterSpacing: -0.5,
                lineHeight: 1.1,
              }}
            >
              {actor.name}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 7,
                marginTop: 10,
              }}
            >
              {actor.roles.map((role) => (
                <span
                  key={role}
                  style={{
                    fontFamily: fontFamilies.label,
                    fontSize: 13.5,
                    fontWeight: 600,
                    letterSpacing: 0.7,
                    color: brand.orange,
                    border: "1px solid rgba(255,90,31,0.45)",
                    borderRadius: 8,
                    padding: "5px 10px",
                  }}
                >
                  {role}
                </span>
              ))}
            </div>
            {actor.availableForBookings ? (
              <div
                style={{
                  marginTop: 9,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  border: "1px solid rgba(16,185,129,0.4)",
                  borderRadius: 999,
                  padding: "5px 12px",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#10B981",
                  }}
                />
                <span
                  style={{
                    fontFamily: fontFamilies.label,
                    fontSize: 12.5,
                    fontWeight: 700,
                    letterSpacing: 0.7,
                    color: "#10B981",
                  }}
                >
                  AVAILABLE FOR BOOKINGS
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Stats strip */}
        <div
          style={{
            margin: "18px 16px 0",
            border: `1px solid ${brand.hairline}`,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            height: 74,
          }}
        >
          <Stat value={actor.stats.theatricalGross} label="THEATRICAL GROSS" accent />
          <Divider />
          <Stat value={actor.stats.screenCredits} label="SCREEN CREDITS" />
          <Divider />
          <Stat
            value={followed ? "1" : "0"}
            label="FOLLOWERS"
            /* A small lift as the number changes, so the eye catches it. */
            scale={1 + countPop * (1 - countPop) * 1.6}
            highlight={followed}
          />
        </div>

        {/* Primary actions */}
        <div style={{ display: "flex", gap: 10, padding: "16px 16px 0" }}>
          <FollowButton frame={frame} tapAt={tapAt} width={296} />
          <ShareButton />
        </div>

        {/* Awards */}
        <div
          style={{
            margin: "14px 16px 0",
            border: "1px solid rgba(234,179,8,0.38)",
            borderRadius: 14,
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "0 14px",
          }}
        >
          <span style={{ fontSize: 19 }}>🏆</span>
          <span
            style={{
              fontFamily: fontFamilies.body,
              fontSize: 16,
              fontWeight: 700,
              color: "#FACC15",
            }}
          >
            {actor.awardsSummary}
          </span>
        </div>

        {/* Biography */}
        <div
          style={{
            padding: "18px 16px 0",
            fontFamily: fontFamilies.body,
            fontSize: 15.5,
            lineHeight: 1.62,
            color: "rgba(255,255,255,0.86)",
          }}
        >
          Femi Adebayo Salami is a renowned actor, director, producer, lawyer,
          and politician. As the son of veteran actor Adebayo Salami (Oga
          Bello), Femi has made significant contributions to Nollywood…
        </div>
        <div
          style={{
            padding: "12px 16px 0",
            fontFamily: fontFamilies.label,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 1.1,
            color: brand.orange,
          }}
        >
          READ FULL BIOGRAPHY ↓
        </div>
      </div>

      <BottomNav active="MORE" />
      <HomeIndicator />
    </div>
  );
};

const Divider = () => (
  <div style={{ width: 1, height: 40, background: brand.hairline }} />
);

const Stat: React.FC<{
  value: string;
  label: string;
  accent?: boolean;
  scale?: number;
  highlight?: boolean;
}> = ({ value, label, accent, scale = 1, highlight }) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
    }}
  >
    <span
      style={{
        fontFamily: fontFamilies.body,
        fontSize: 21,
        fontWeight: 700,
        color: accent || highlight ? brand.orange : brand.white,
        transform: `scale(${scale})`,
      }}
    >
      {value}
    </span>
    <span
      style={{
        fontFamily: fontFamilies.label,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: 0.8,
        color: brand.textDim,
      }}
    >
      {label}
    </span>
  </div>
);
