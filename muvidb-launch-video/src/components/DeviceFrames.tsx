import type { CSSProperties, ReactNode } from "react";
import { colors } from "./SceneShell";

export const DesktopFrame: React.FC<{
  children: ReactNode;
  title?: string;
  style?: CSSProperties;
}> = ({ children, title = "muvidb.com", style }) => {
  return (
    <div
      style={{
        width: 1040,
        height: 650,
        borderRadius: 28,
        background: "#FFFFFF",
        boxShadow:
          "0 36px 110px rgba(17,17,17,0.24), 0 0 0 1px rgba(17,17,17,0.08)",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          height: 54,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 22px",
          background: "#F7F4EF",
          borderBottom: "1px solid #E7E2DA",
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: 99, background: "#FF5F57" }} />
        <div style={{ width: 12, height: 12, borderRadius: 99, background: "#FFBD2E" }} />
        <div style={{ width: 12, height: 12, borderRadius: 99, background: "#28C840" }} />
        <div
          style={{
            marginLeft: 18,
            height: 30,
            width: 320,
            borderRadius: 999,
            background: "#FFFFFF",
            color: "#8A8178",
            display: "flex",
            alignItems: "center",
            paddingLeft: 18,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ width: "100%", height: 596 }}>{children}</div>
    </div>
  );
};

export const MobileFrame: React.FC<{
  children: ReactNode;
  style?: CSSProperties;
}> = ({ children, style }) => {
  return (
    <div
      style={{
        width: 310,
        height: 640,
        borderRadius: 42,
        padding: 12,
        background: "#171717",
        boxShadow:
          "0 32px 90px rgba(17,17,17,0.34), inset 0 0 0 1px rgba(255,255,255,0.12)",
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 32,
          background: "#FFFFFF",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            translate: "-50% 0",
            width: 86,
            height: 20,
            borderRadius: 999,
            background: "#171717",
            zIndex: 10,
          }}
        />
        {children}
      </div>
    </div>
  );
};

export const SearchUi: React.FC<{
  query?: string;
  compact?: boolean;
}> = ({ query = "Lateef Adedimeji", compact = false }) => {
  const people = [
    ["Lateef Adedimeji", "Actor · Producer · 148 credits"],
    ["Adebimpe Oyebade", "Actor · 62 credits"],
    ["Kunle Afolayan", "Director · Actor · Producer"],
  ];

  return (
    <div style={{ padding: compact ? "54px 22px 24px" : "46px 58px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: compact ? 28 : 42,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: compact ? 22 : 30 }}>
          MuviDB
        </div>
        <div
          style={{
            color: colors.orange,
            fontWeight: 800,
            fontSize: compact ? 12 : 16,
          }}
        >
          African Cinema
        </div>
      </div>
      <div
        style={{
          fontSize: compact ? 22 : 44,
          lineHeight: 1.05,
          fontWeight: 900,
          maxWidth: compact ? 220 : 720,
          marginBottom: compact ? 22 : 34,
        }}
      >
        Search movies, people, credits and where to watch.
      </div>
      <div
        style={{
          height: compact ? 48 : 66,
          borderRadius: 999,
          background: "#F8F4ED",
          border: "1px solid #E7E2DA",
          display: "flex",
          alignItems: "center",
          padding: compact ? "0 16px" : "0 26px",
          color: "#111111",
          fontWeight: 800,
          fontSize: compact ? 16 : 24,
          marginBottom: compact ? 20 : 34,
        }}
      >
        <span style={{ color: colors.orange, marginRight: 12 }}>⌕</span>
        {query}
        <span
          style={{
            width: 2,
            height: compact ? 22 : 30,
            background: colors.orange,
            marginLeft: 8,
          }}
        />
      </div>
      <div style={{ display: "grid", gap: compact ? 10 : 16 }}>
        {people.map(([name, meta], index) => (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: compact ? 10 : 16,
              padding: compact ? 12 : 18,
              borderRadius: compact ? 18 : 24,
              background: index === 0 ? "#111111" : "#FFFFFF",
              color: index === 0 ? "#FFFFFF" : "#111111",
              border: "1px solid #E7E2DA",
            }}
          >
            <div
              style={{
                width: compact ? 34 : 50,
                height: compact ? 34 : 50,
                borderRadius: 999,
                background:
                  index === 0
                    ? colors.orange
                    : "linear-gradient(135deg, #E7E2DA, #FFFFFF)",
              }}
            />
            <div>
              <div style={{ fontWeight: 900, fontSize: compact ? 13 : 20 }}>
                {name}
              </div>
              <div
                style={{
                  color: index === 0 ? "#D6D3D1" : "#8A8178",
                  fontWeight: 600,
                  marginTop: 4,
                  fontSize: compact ? 10 : 14,
                }}
              >
                {meta}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const MovieUi: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const cast = ["Cast", "Crew", "Trailers", "Where to watch"];

  return (
    <div
      style={{
        padding: compact ? "52px 18px 22px" : "42px 54px",
        height: "100%",
        background:
          "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 48%, #F8F4ED 100%)",
      }}
    >
      <div style={{ display: "flex", gap: compact ? 14 : 28 }}>
        <div
          style={{
            width: compact ? 82 : 230,
            height: compact ? 122 : 340,
            borderRadius: compact ? 14 : 24,
            background:
              "linear-gradient(155deg, #111111 0%, #2A211B 48%, #F97316 100%)",
            boxShadow: "0 24px 60px rgba(249,115,22,0.24)",
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              color: colors.orange,
              fontSize: compact ? 10 : 16,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Featured film
          </div>
          <div
            style={{
              fontSize: compact ? 28 : 56,
              lineHeight: 0.95,
              fontWeight: 950,
              marginTop: compact ? 7 : 12,
              marginBottom: compact ? 9 : 18,
              maxWidth: compact ? 160 : 520,
            }}
          >
            One story. Every detail.
          </div>
          <div
            style={{
              color: "#6B625C",
              fontSize: compact ? 11 : 18,
              lineHeight: 1.45,
              maxWidth: compact ? 160 : 560,
              fontWeight: 600,
            }}
          >
            Overview, ratings, credits, trailers and availability organized in
            one living record.
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: compact ? "1fr" : "repeat(2, 1fr)",
              gap: compact ? 8 : 14,
              marginTop: compact ? 16 : 28,
            }}
          >
            {cast.map((item, index) => (
              <div
                key={item}
                style={{
                  borderRadius: compact ? 12 : 18,
                  padding: compact ? "9px 10px" : "16px 18px",
                  background: index === 3 ? "#111111" : "#FFFFFF",
                  color: index === 3 ? "#FFFFFF" : "#111111",
                  border: "1px solid #E7E2DA",
                  fontWeight: 900,
                  fontSize: compact ? 11 : 18,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const PeopleUi: React.FC = () => {
  return (
    <div style={{ padding: "44px 54px", height: "100%" }}>
      <div style={{ display: "flex", gap: 28, height: "100%" }}>
        <div
          style={{
            width: 300,
            borderRadius: 30,
            background:
              "linear-gradient(155deg, #F8F4ED, #E7E2DA 52%, #111111)",
            boxShadow: "inset 0 0 0 1px rgba(17,17,17,0.08)",
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ color: colors.orange, fontWeight: 900, fontSize: 18 }}>
            People profile
          </div>
          <div
            style={{
              fontSize: 58,
              fontWeight: 950,
              lineHeight: 0.98,
              marginTop: 10,
              marginBottom: 24,
            }}
          >
            The artists behind the frame.
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {["Filmography", "Awards", "Gallery", "Known credits"].map(
              (label, index) => (
                <div
                  key={label}
                  style={{
                    height: 72,
                    borderRadius: 20,
                    background: index === 0 ? "#111111" : "#FFFFFF",
                    color: index === 0 ? "#FFFFFF" : "#111111",
                    border: "1px solid #E7E2DA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 24px",
                    fontWeight: 900,
                    fontSize: 20,
                  }}
                >
                  {label}
                  <span style={{ color: colors.orange }}>0{index + 1}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
