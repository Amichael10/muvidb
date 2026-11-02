import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";
import { tap, progress } from "../lib/ease";

/**
 * The profile's primary action, in both of its real states.
 *
 * Filled orange "Follow" -> outlined "Following" is exactly what the product
 * does; the only licence taken is the ripple, which stands in for a finger and
 * would not exist on a real tap. The orange glow on success is additive only,
 * so the button's own styling is never altered.
 */
export const FollowButton: React.FC<{
  frame: number;
  /** Frame at which the press lands. */
  tapAt: number;
  width?: number;
}> = ({ frame, tapAt, width = 296 }) => {
  const press = tap(frame, tapAt);
  const followed = press.done;

  // Label crossfade, so the text swap is not an instant pop.
  const swap = progress(frame, { from: tapAt + 4, duration: 10 });
  const glow =
    frame < tapAt ? 0 : 1 - progress(frame, { from: tapAt + 6, duration: 34 });

  return (
    <div
      style={{
        position: "relative",
        width,
        height: 54,
        transform: `scale(${press.scale})`,
      }}
    >
      {/* Success glow. Additive, fades out, never recolours the control. */}
      <div
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: 20,
          boxShadow: `0 0 ${26 + glow * 26}px ${brand.orange}`,
          opacity: glow * 0.55,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          overflow: "hidden",
          background: followed ? "transparent" : brand.orange,
          border: followed ? `1.6px solid ${brand.orange}` : "1.6px solid transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
        }}
      >
        {/* Touch ripple */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 120,
            height: 120,
            marginLeft: -60,
            marginTop: -60,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.4)",
            opacity: press.rippleOpacity,
            transform: `scale(${press.rippleScale})`,
          }}
        />

        {/* Follow state */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            alignItems: "center",
            gap: 9,
            opacity: 1 - swap,
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="10" cy="8.4" r="3.6" stroke={brand.white} strokeWidth="1.9" />
            <path d="M3.6 19.4c.8-3.1 3.3-4.8 6.4-4.8" stroke={brand.white} strokeWidth="1.9" strokeLinecap="round" />
            <path d="M17.4 13.6v5.6M20.2 16.4h-5.6" stroke={brand.white} strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          <span
            style={{
              fontFamily: fontFamilies.body,
              fontSize: 19,
              fontWeight: 600,
              color: brand.white,
            }}
          >
            Follow
          </span>
        </div>

        {/* Following state */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            alignItems: "center",
            gap: 9,
            opacity: swap,
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path
              d="m4.8 12.4 4.6 4.6 9.8-9.8"
              stroke={brand.orange}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="22"
              strokeDashoffset={22 * (1 - swap)}
            />
          </svg>
          <span
            style={{
              fontFamily: fontFamilies.body,
              fontSize: 19,
              fontWeight: 600,
              color: brand.orange,
            }}
          >
            Following
          </span>
        </div>
      </div>
    </div>
  );
};

/** Share control that sits beside Follow on the real profile. */
export const ShareButton: React.FC = () => (
  <div
    style={{
      width: 54,
      height: 54,
      borderRadius: 16,
      border: `1px solid ${brand.hairline}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="17.5" cy="5.8" r="2.8" stroke="rgba(255,255,255,0.8)" strokeWidth="1.7" />
      <circle cx="6.5" cy="12" r="2.8" stroke="rgba(255,255,255,0.8)" strokeWidth="1.7" />
      <circle cx="17.5" cy="18.2" r="2.8" stroke="rgba(255,255,255,0.8)" strokeWidth="1.7" />
      <path d="m9 10.6 6-3.4M9 13.4l6 3.4" stroke="rgba(255,255,255,0.8)" strokeWidth="1.7" />
    </svg>
  </div>
);

/** Verified tick that overlaps the avatar on the live profile. */
export const VerifiedBadge: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: brand.orange,
      border: "2.5px solid #0A0A0C",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
      <path d="m5.5 12.4 4.3 4.3 8.7-8.7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);
