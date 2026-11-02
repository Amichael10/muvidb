import { brand } from "../styles/brand";
import { fontFamilies } from "../lib/fonts";

/**
 * Shared chrome for the MuviDB screens: the top bar and the bottom tab bar,
 * rebuilt to match the live mobile app (see public/captures/alert/*.png).
 * These are reproductions of the shipped UI, not a redesign -- spacing,
 * weights and colours are taken from the captures.
 */

export const MuviDBLogo: React.FC<{ height?: number; withTagline?: boolean }> = ({
  height = 26,
  withTagline = true,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    {/* The mark: two interlocking film-loop chevrons. */}
    <svg
      width={height * 1.12}
      height={height}
      viewBox="0 0 32 28"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M7.4 2.2 16 7.1l-4.6 2.6L2.8 4.8l4.6-2.6Z"
        fill={brand.white}
      />
      <path
        d="M2.2 6.4 10.8 11.3v5.3L2.2 11.7V6.4Z"
        fill={brand.white}
        fillOpacity="0.82"
      />
      <path
        d="M24.6 25.8 16 20.9l4.6-2.6 8.6 4.9-4.6 2.6Z"
        fill={brand.white}
      />
      <path
        d="M29.8 21.6 21.2 16.7v-5.3l8.6 4.9v5.3Z"
        fill={brand.white}
        fillOpacity="0.82"
      />
    </svg>
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
      <span
        style={{
          fontFamily: fontFamilies.body,
          fontWeight: 700,
          fontSize: height * 0.82,
          color: brand.white,
          letterSpacing: -0.4,
        }}
      >
        MuviDB
      </span>
      {withTagline ? (
        <span
          style={{
            fontFamily: fontFamilies.label,
            fontSize: height * 0.26,
            color: "rgba(255,255,255,0.62)",
            letterSpacing: 1.1,
            marginTop: 2,
          }}
        >
          EVERY FILM. EVERY CREDIT
        </span>
      ) : null}
    </div>
  </div>
);

export const TopBar: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 54,
      left: 0,
      right: 0,
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      zIndex: 30,
      background: brand.black,
    }}
  >
    <MuviDBLogo height={24} />
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7.2" stroke={brand.white} strokeWidth="1.9" />
        <path d="m16.5 16.5 4 4" stroke={brand.white} strokeWidth="1.9" strokeLinecap="round" />
      </svg>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4.2" stroke={brand.white} strokeWidth="1.9" />
        {Array.from({ length: 8 }).map((_, i) => (
          <path
            key={i}
            d="M12 2.2v2.4"
            stroke={brand.white}
            strokeWidth="1.9"
            strokeLinecap="round"
            transform={`rotate(${i * 45} 12 12)`}
          />
        ))}
      </svg>
      <div
        style={{
          padding: "7px 17px",
          borderRadius: 999,
          border: `1.5px solid ${brand.orange}`,
          color: brand.orange,
          fontFamily: fontFamilies.body,
          fontWeight: 600,
          fontSize: 14.5,
        }}
      >
        Sign In
      </div>
    </div>
  </div>
);

const TAB_ICONS: Record<string, React.ReactNode> = {
  HOME: (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path d="M3.6 10.4 12 3.8l8.4 6.6v9a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4v-9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="13.4" r="1.1" fill="currentColor" />
    </svg>
  ),
  MOVIES: (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <rect x="3.2" y="4.4" width="17.6" height="15.2" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.6 9.2v6l5.2-3-5.2-3Z" fill="currentColor" />
    </svg>
  ),
  SEARCH: (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16.4 16.4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  MORE: (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      {[7, 12, 17].map((y) => (
        <path key={y} d={`M4.5 ${y}h15`} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ))}
    </svg>
  ),
  PROFILE: (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.6" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.2 20c.9-3.5 3.6-5.4 6.8-5.4s5.9 1.9 6.8 5.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
};

export const BottomNav: React.FC<{ active?: string }> = ({ active = "MORE" }) => (
  <div
    style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 76,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-around",
      paddingTop: 10,
      background: "rgba(10,10,12,0.96)",
      borderTop: `1px solid ${brand.hairline}`,
      backdropFilter: "blur(18px)",
      zIndex: 35,
    }}
  >
    {Object.keys(TAB_ICONS).map((key) => {
      const isActive = key === active;
      return (
        <div
          key={key}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            color: isActive ? brand.orange : "rgba(255,255,255,0.72)",
          }}
        >
          {TAB_ICONS[key]}
          <span
            style={{
              fontFamily: fontFamilies.label,
              fontSize: 12.5,
              letterSpacing: 0.6,
              fontWeight: 600,
            }}
          >
            {key}
          </span>
        </div>
      );
    })}
  </div>
);
