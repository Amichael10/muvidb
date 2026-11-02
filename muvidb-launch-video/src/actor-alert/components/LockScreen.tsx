import { Img } from "remotion";
import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import { film, whatsappTemplate } from "../data/demoContent";
import { StatusBar, HomeIndicator, Island } from "./PhoneMockup";
import { progress, tap } from "../lib/ease";

/**
 * A quiet lock screen that receives one notification.
 *
 * The wallpaper is the film's own poster, heavily blurred and darkened. That
 * is a deliberate storytelling choice rather than a claim about the user's
 * phone: it keeps the film present while the screen is nominally idle, and it
 * gives the banner something to sit against that is not flat black.
 */
export const LockScreen: React.FC<{
  frame: number;
  /** Frame the notification slides in. */
  notifyAt: number;
  /** Frame the banner is tapped. Pass null to never tap. */
  tapAt?: number | null;
  time?: string;
  dateLabel?: string;
}> = ({
  frame,
  notifyAt,
  tapAt = null,
  time = "21:04",
  dateLabel = "Friday, 26 July",
}) => {
  const arrive = progress(frame, { from: notifyAt, duration: 26 });
  const press = tapAt === null ? null : tap(frame, tapAt);

  // The clock lifts slightly to make room, the way iOS does.
  const clockShift = arrive * 10;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Wallpaper */}
      <Img
        src={film.poster}
        style={{
          position: "absolute",
          inset: -40,
          width: "calc(100% + 80px)",
          height: "calc(100% + 80px)",
          objectFit: "cover",
          filter: "blur(26px) saturate(0.9) brightness(0.52)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      <StatusBar />
      <Island />

      {/* Clock */}
      <div
        style={{
          position: "absolute",
          top: 96,
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `translateY(${-clockShift}px)`,
        }}
      >
        <div
          style={{
            fontFamily: fontFamilies.body,
            fontSize: 15,
            fontWeight: 500,
            color: "rgba(255,255,255,0.88)",
            letterSpacing: 0.2,
          }}
        >
          {dateLabel}
        </div>
        <div
          style={{
            fontFamily: fontFamilies.body,
            fontSize: 78,
            fontWeight: 300,
            color: "#fff",
            lineHeight: 1.08,
            letterSpacing: -2,
            marginTop: 2,
          }}
        >
          {time}
        </div>
      </div>

      {/* Notification */}
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          top: 266,
          opacity: arrive,
          transform: [
            `translateY(${(1 - arrive) * -34}px)`,
            `scale(${(0.93 + arrive * 0.07) * (press ? press.scale : 1)})`,
          ].join(" "),
        }}
      >
        <NotificationBanner rippleOpacity={press ? press.rippleOpacity : 0} />
      </div>

      <HomeIndicator />
    </div>
  );
};

/**
 * The banner itself, built to iOS conventions: frosted panel, app icon and
 * name on the first line, title, then a two-line clamped body.
 */
export const NotificationBanner: React.FC<{ rippleOpacity?: number }> = ({
  rippleOpacity = 0,
}) => (
  <div
    style={{
      position: "relative",
      background: "rgba(42,42,46,0.74)",
      backdropFilter: "blur(28px)",
      WebkitBackdropFilter: "blur(28px)",
      borderRadius: 22,
      padding: "13px 15px",
      border: "1px solid rgba(255,255,255,0.1)",
      overflow: "hidden",
    }}
  >
    {rippleOpacity > 0 ? (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,255,255,0.14)",
          opacity: rippleOpacity * 2,
        }}
      />
    ) : null}

    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div
        style={{
          width: 21,
          height: 21,
          borderRadius: 5,
          background: brand.whatsapp.green,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91a9.85 9.85 0 0 0-9.93-9.93Zm5.8 14.02c-.24.68-1.42 1.3-1.95 1.34-.52.05-1.01.24-3.4-.71-2.86-1.13-4.68-4.05-4.82-4.24-.14-.19-1.16-1.54-1.16-2.94s.73-2.09.99-2.37c.26-.29.57-.36.76-.36h.55c.18 0 .42-.07.65.5.24.57.81 1.98.88 2.12.07.14.12.31.02.5-.1.19-.15.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.28.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.29 1.41.28.14.45.12.62-.07.17-.19.71-.83.9-1.12.19-.28.38-.24.64-.14.26.09 1.67.79 1.95.93.28.14.47.21.54.33.07.12.07.69-.17 1.37Z"
            fill="#fff"
          />
        </svg>
      </div>
      <span
        style={{
          fontFamily: fontFamilies.body,
          fontSize: 12.5,
          fontWeight: 500,
          color: "rgba(255,255,255,0.72)",
          letterSpacing: 0.1,
        }}
      >
        {whatsappTemplate.notification.app.toUpperCase()}
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontFamily: fontFamilies.body,
          fontSize: 12.5,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        now
      </span>
    </div>

    <div
      style={{
        fontFamily: fontFamilies.body,
        fontSize: 15.5,
        fontWeight: 700,
        color: "#fff",
        marginTop: 7,
      }}
    >
      {whatsappTemplate.notification.title}
    </div>
    <div
      style={{
        fontFamily: fontFamilies.body,
        fontSize: 14.5,
        lineHeight: 1.38,
        color: "rgba(255,255,255,0.92)",
        marginTop: 2,
      }}
    >
      {whatsappTemplate.notification.body}
    </div>
  </div>
);
