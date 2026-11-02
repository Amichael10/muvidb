import type { CSSProperties, ReactNode } from "react";
import { brand } from "../styles/brand";

/**
 * The phone is the one object that persists across the whole film, so it is
 * deliberately understated: a dark bezel, one hairline highlight and a soft
 * contact shadow. It never spins. Scenes move the camera by scaling and
 * nudging this container, never by rotating it far enough to make the UI hard
 * to read.
 */

/** Logical viewport the inner screens are authored against. */
export const PHONE_VIEWPORT = { width: 390, height: 844 };

const BEZEL = 13;
const RADIUS = 58;

export const PhoneMockup: React.FC<{
  children: ReactNode;
  /** Multiplier on the 390x844 viewport. */
  scale?: number;
  /** Degrees of Y-axis tilt. Kept small so text stays legible. */
  tiltY?: number;
  tiltX?: number;
  translateY?: number;
  translateX?: number;
  style?: CSSProperties;
  /** Dim the whole device, used when a scene pushes it into the background. */
  dim?: number;
  shadow?: boolean;
  /**
   * Opacity of the physical device around the screen. Dropping this lets the
   * camera fly "into" the display: the bezel, shadow and highlight dissolve
   * and the UI becomes the whole frame, while the screen itself is untouched.
   */
  bezel?: number;
}> = ({
  children,
  scale = 1,
  tiltY = 0,
  tiltX = 0,
  translateY = 0,
  translateX = 0,
  style,
  dim = 0,
  shadow = true,
  bezel = 1,
}) => {
  const outerWidth = PHONE_VIEWPORT.width + BEZEL * 2;
  const outerHeight = PHONE_VIEWPORT.height + BEZEL * 2;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: outerWidth,
        height: outerHeight,
        marginLeft: -outerWidth / 2,
        marginTop: -outerHeight / 2,
        transform: [
          `translate3d(${translateX}px, ${translateY}px, 0)`,
          `scale(${scale})`,
          `rotateY(${tiltY}deg)`,
          `rotateX(${tiltX}deg)`,
        ].join(" "),
        transformStyle: "preserve-3d",
        ...style,
      }}
    >
      {/* Contact shadow. Sits behind the device and scales with it. */}
      {shadow && bezel > 0.02 ? (
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: RADIUS + 10,
            boxShadow:
              "0 60px 120px rgba(0,0,0,0.72), 0 18px 48px rgba(0,0,0,0.5)",
            opacity: bezel,
          }}
        />
      ) : null}

      {/* Bezel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: RADIUS,
          padding: BEZEL,
          boxSizing: "border-box",
        }}
      >
        {/*
          The frame's colour lives on its own layer behind the screen.
          Putting the opacity on the padding wrapper instead fades the screen
          with it, because the screen is its child -- which turned the whole
          device translucent and let the background show through the UI. Only
          this layer may fade.
        */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: RADIUS,
            background:
              "linear-gradient(160deg, #2A2A30 0%, #0B0B0D 38%, #141418 100%)",
            opacity: bezel,
          }}
        />

        {/* Screen */}
        <div
          style={{
            position: "relative",
            width: PHONE_VIEWPORT.width,
            height: PHONE_VIEWPORT.height,
            borderRadius: RADIUS - BEZEL,
            overflow: "hidden",
            background: brand.black,
            isolation: "isolate",
            zIndex: 1,
          }}
        >
          {children}
          {dim > 0 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `rgba(0,0,0,${dim})`,
                pointerEvents: "none",
              }}
            />
          ) : null}
        </div>
      </div>

      {/* Specular edge highlight, keeps the bezel from looking flat. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: RADIUS,
          border: "1px solid rgba(255,255,255,0.10)",
          pointerEvents: "none",
          opacity: bezel,
        }}
      />
    </div>
  );
};

/** Status bar matching the host OS, so the screens read as a real device. */
export const StatusBar: React.FC<{ dark?: boolean; time?: string }> = ({
  dark = false,
  time = "21:04",
}) => {
  const color = dark ? "#0B0B0D" : brand.white;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 30px",
        fontFamily: '"Host Grotesk", system-ui, sans-serif',
        fontSize: 15,
        fontWeight: 600,
        color,
        zIndex: 40,
      }}
    >
      <span style={{ letterSpacing: 0.2 }}>{time}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Signal */}
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={i * 4.6}
              y={9 - i * 3}
              width="3"
              height={3 + i * 3}
              rx="1"
              fill={color}
            />
          ))}
        </svg>
        {/* Wifi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path
            d="M8 10.2 10.2 7.6a3.4 3.4 0 0 0-4.4 0L8 10.2Z"
            fill={color}
          />
          <path
            d="M3.6 5.4a6.8 6.8 0 0 1 8.8 0"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M1.3 3a10 10 0 0 1 13.4 0"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {/* Battery */}
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect
            x="0.6"
            y="0.6"
            width="21"
            height="10.8"
            rx="3"
            stroke={color}
            strokeOpacity="0.5"
            strokeWidth="1.1"
          />
          <rect x="2.2" y="2.2" width="16.5" height="7.6" rx="1.8" fill={color} />
          <path d="M23 4.2v3.6a2 2 0 0 0 0-3.6Z" fill={color} fillOpacity="0.5" />
        </svg>
      </div>
    </div>
  );
};

/** Home indicator bar. */
export const HomeIndicator: React.FC<{ color?: string }> = ({
  color = "rgba(255,255,255,0.85)",
}) => (
  <div
    style={{
      position: "absolute",
      bottom: 8,
      left: "50%",
      marginLeft: -67,
      width: 134,
      height: 5,
      borderRadius: 3,
      background: color,
      zIndex: 45,
    }}
  />
);

/** Dynamic-island style cutout. */
export const Island: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 11,
      left: "50%",
      marginLeft: -60,
      width: 120,
      height: 34,
      borderRadius: 20,
      background: "#000",
      zIndex: 50,
    }}
  />
);
