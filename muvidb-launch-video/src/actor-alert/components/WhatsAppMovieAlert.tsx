import { Img } from "remotion";
import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import {
  actor,
  film,
  whatsappTemplate,
  filmPageUrl,
} from "../data/demoContent";
import { StatusBar, HomeIndicator, Island } from "./PhoneMockup";
import { progress, tap } from "../lib/ease";
import { TouchIndicator } from "./Caption";

/**
 * The WhatsApp thread carrying the alert.
 *
 * This renders the SHIPPED `movie_release_alert` template, not an idealised
 * one: an image header (the poster), four body parameters and a single URL
 * button. See api/_lib/whatsapp_movie_alerts.ts in the main repo.
 *
 * Two rules hold throughout:
 *  - WhatsApp keeps its own interface. No MuviDB orange is applied to the
 *    chrome, the bubbles or the button; the brand appears only inside the
 *    message content, where it genuinely would.
 *  - Nothing is added to the bubble that the template cannot send. The
 *    synopsis in particular is absent here on purpose -- it arrives on the
 *    film page in the next scene.
 */
/** Incoming-bubble width, and where its URL button centres from the bottom. */
const BUBBLE_WIDTH = 318;
const BUTTON_CENTRE_FROM_BOTTOM = 20;

export const WhatsAppMovieAlert: React.FC<{
  frame: number;
  /** Frame the bubble lands in the thread. */
  bubbleAt: number;
  /** Scroll offset applied to the thread, in px. */
  scrollY?: number;
  /** Frame the link button is pressed. */
  tapAt?: number | null;
}> = ({ frame, bubbleAt, scrollY = 0, tapAt = null }) => {
  const land = progress(frame, { from: bubbleAt, duration: 22 });
  const press = tapAt === null ? null : tap(frame, tapAt);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: brand.whatsapp.chatBg,
        overflow: "hidden",
      }}
    >
      {/* WhatsApp's doodle wallpaper, approximated as a faint tiled texture. */}
      <ChatWallpaper />

      <StatusBar />
      <Island />
      <ChatHeader />

      {/* Thread */}
      <div
        style={{
          position: "absolute",
          top: 162,
          left: 0,
          right: 0,
          padding: "0 9px",
          transform: `translateY(${-scrollY}px)`,
        }}
      >
        <DayDivider />
        <SystemNotice />

        <div
          style={{
            marginTop: 10,
            opacity: land,
            transform: `translateY(${(1 - land) * 22}px) scale(${0.97 + land * 0.03})`,
            transformOrigin: "left bottom",
          }}
        >
          {/*
            The ring is placed off the bubble's own box rather than a measured
            scene coordinate: the URL button is always the last element, so
            BUTTON_CENTRE_FROM_BOTTOM stays correct however tall the message
            content grows. It sits outside the bubble so the bubble's
            overflow clipping cannot cut the ring in half.
          */}
          <div style={{ position: "relative", width: BUBBLE_WIDTH }}>
            <AlertBubble
              rippleOpacity={press ? press.rippleOpacity : 0}
              buttonScale={press ? press.scale : 1}
            />
            {tapAt === null ? null : (
              <div
                style={{
                  position: "absolute",
                  left: BUBBLE_WIDTH / 2,
                  bottom: BUTTON_CENTRE_FROM_BOTTOM,
                  width: 0,
                  height: 0,
                }}
              >
                <TouchIndicator frame={frame} at={tapAt} x={0} y={0} size={58} />
              </div>
            )}
          </div>
        </div>
      </div>

      <Composer />
      <HomeIndicator />
    </div>
  );
};

const ChatWallpaper = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity: 0.045,
      backgroundImage:
        "radial-gradient(circle at 20% 30%, #fff 1.4px, transparent 1.6px), radial-gradient(circle at 70% 70%, #fff 1.4px, transparent 1.6px), radial-gradient(circle at 45% 85%, #fff 1.2px, transparent 1.4px)",
      backgroundSize: "64px 64px, 88px 88px, 52px 52px",
    }}
  />
);

const ChatHeader = () => (
  <div
    style={{
      position: "absolute",
      top: 54,
      left: 0,
      right: 0,
      height: 62,
      background: brand.whatsapp.headerDark,
      display: "flex",
      alignItems: "center",
      gap: 11,
      padding: "0 12px",
      zIndex: 30,
    }}
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 5.5 8.5 12l6.5 6.5"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    {/* Sender avatar: the MuviDB mark on brand orange. */}
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: brand.orange,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="21" height="19" viewBox="0 0 32 28" fill="none">
        <path d="M7.4 2.2 16 7.1l-4.6 2.6L2.8 4.8l4.6-2.6Z" fill="#fff" />
        <path d="M2.2 6.4 10.8 11.3v5.3L2.2 11.7V6.4Z" fill="#fff" fillOpacity="0.85" />
        <path d="M24.6 25.8 16 20.9l4.6-2.6 8.6 4.9-4.6 2.6Z" fill="#fff" />
        <path d="M29.8 21.6 21.2 16.7v-5.3l8.6 4.9v5.3Z" fill="#fff" fillOpacity="0.85" />
      </svg>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: fontFamilies.body,
          fontSize: 16,
          fontWeight: 600,
          color: "#fff",
          lineHeight: 1.2,
        }}
      >
        {whatsappTemplate.senderName}
      </div>
      <div
        style={{
          fontFamily: fontFamilies.body,
          fontSize: 11.5,
          color: "rgba(255,255,255,0.55)",
          marginTop: 1,
        }}
      >
        {whatsappTemplate.businessLabel}
      </div>
    </div>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 7.5h12.5v9H4z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m16.5 11 4-2.5v7l-4-2.5Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 6 }}>
      <path
        d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

const DayDivider = () => (
  <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
    <span
      style={{
        background: "rgba(31,44,52,0.9)",
        borderRadius: 8,
        padding: "5px 11px",
        fontFamily: fontFamilies.body,
        fontSize: 11.5,
        fontWeight: 500,
        color: "rgba(255,255,255,0.6)",
        letterSpacing: 0.3,
      }}
    >
      TODAY
    </span>
  </div>
);

/** WhatsApp's own business-messaging notice. */
const SystemNotice = () => (
  <div style={{ display: "flex", justifyContent: "center" }}>
    <span
      style={{
        background: "rgba(31,44,52,0.78)",
        borderRadius: 8,
        padding: "7px 12px",
        fontFamily: fontFamilies.body,
        fontSize: 10.8,
        lineHeight: 1.45,
        color: "rgba(255,255,255,0.52)",
        textAlign: "center",
        maxWidth: 300,
      }}
    >
      This business uses a secure service from WhatsApp to manage messages.
    </span>
  </div>
);

const AlertBubble: React.FC<{
  rippleOpacity: number;
  buttonScale: number;
}> = ({ rippleOpacity, buttonScale }) => (
  <div
    style={{
      width: BUBBLE_WIDTH,
      background: brand.whatsapp.bubbleIn,
      borderRadius: 12,
      borderTopLeftRadius: 2,
      overflow: "hidden",
      boxShadow: "0 1px 1px rgba(0,0,0,0.3)",
    }}
  >
    {/* Header: the film poster, as an image-header template sends it. */}
    <div style={{ padding: 4 }}>
      <div
        style={{
          borderRadius: 9,
          overflow: "hidden",
          background: "#000",
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/*
          Contained, not cropped. A portrait poster in a wider header gets
          letterboxed by WhatsApp too, and cropping it would cut off the film's
          own title treatment -- the one piece of the asset that must survive.
        */}
        <Img
          src={film.poster}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    </div>

    {/* Body */}
    <div style={{ padding: "4px 11px 7px" }}>
      <div
        style={{
          fontFamily: fontFamilies.body,
          fontSize: 14.5,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: 0.2,
        }}
      >
        🎬 NEW MOVIE ALERT!
      </div>

      <div
        style={{
          fontFamily: fontFamilies.body,
          fontSize: 14,
          lineHeight: 1.47,
          color: "rgba(255,255,255,0.94)",
          marginTop: 7,
        }}
      >
        One of your favourite actors,{" "}
        <strong style={{ fontWeight: 700 }}>{actor.name}</strong>, appears in a
        movie that&apos;s now available to watch.
      </div>

      <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 4 }}>
        <Field icon="🎥" label="Movie" value={film.title} />
        <Field icon="📺" label="Now streaming" value={whatsappTemplate.params.platform} />
      </div>

      {/* The link preview WhatsApp renders for {{4}}. */}
      <div
        style={{
          marginTop: 8,
          fontFamily: fontFamilies.body,
          fontSize: 13.5,
          color: brand.whatsapp.link,
          textDecoration: "underline",
          wordBreak: "break-all",
        }}
      >
        {filmPageUrl}
      </div>

      <div
        style={{
          fontFamily: fontFamilies.body,
          fontSize: 11.5,
          lineHeight: 1.4,
          color: "rgba(255,255,255,0.45)",
          marginTop: 9,
        }}
      >
        {whatsappTemplate.footer}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 4,
          marginTop: 3,
        }}
      >
        <span
          style={{
            fontFamily: fontFamilies.body,
            fontSize: 10.5,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          21:04
        </span>
      </div>
    </div>

    {/* URL button. WhatsApp renders template buttons as a divided footer. */}
    <div
      style={{
        borderTop: `1px solid ${brand.whatsapp.divider}`,
        position: "relative",
        transform: `scale(${buttonScale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,255,255,0.12)",
          opacity: rippleOpacity * 2,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          padding: "11px 0",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="M10.5 5.5H6a1.8 1.8 0 0 0-1.8 1.8V18a1.8 1.8 0 0 0 1.8 1.8h10.7A1.8 1.8 0 0 0 18.5 18v-4.5"
            stroke={brand.whatsapp.link}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M14 4.5h5.5V10M19.5 4.5 11 13" stroke={brand.whatsapp.link} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          style={{
            fontFamily: fontFamilies.body,
            fontSize: 14,
            fontWeight: 500,
            color: brand.whatsapp.link,
          }}
        >
          {whatsappTemplate.buttonLabel}
        </span>
      </div>
    </div>
  </div>
);

const Field: React.FC<{ icon: string; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div
    style={{
      fontFamily: fontFamilies.body,
      fontSize: 14,
      lineHeight: 1.45,
      color: "rgba(255,255,255,0.94)",
    }}
  >
    <span>{icon} </span>
    <span style={{ fontWeight: 700 }}>{label}:</span>{" "}
    <span>{value}</span>
  </div>
);

const Composer = () => (
  <div
    style={{
      position: "absolute",
      bottom: 22,
      left: 0,
      right: 0,
      height: 52,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 10px",
      zIndex: 30,
    }}
  >
    <div
      style={{
        flex: 1,
        height: 44,
        borderRadius: 22,
        background: brand.whatsapp.headerDark,
        display: "flex",
        alignItems: "center",
        padding: "0 15px",
        gap: 10,
      }}
    >
      <span
        style={{
          fontFamily: fontFamilies.body,
          fontSize: 15,
          color: "rgba(255,255,255,0.42)",
        }}
      >
        Message
      </span>
    </div>
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: brand.whatsapp.green,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 16.5a3.2 3.2 0 0 0 3.2-3.2V6.7a3.2 3.2 0 1 0-6.4 0v6.6A3.2 3.2 0 0 0 12 16.5Z"
          fill="#0B141A"
        />
        <path
          d="M6 12.4a6 6 0 0 0 12 0M12 18.4v2.4"
          stroke="#0B141A"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    </div>
  </div>
);
