import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill } from "remotion";

export const colors = {
  orange: "#F97316",
  black: "#111111",
  ink: "#1C1917",
  offWhite: "#F8F7F4",
  warmGray: "#E7E2DA",
  muted: "#8A8178",
};

export const SceneShell: React.FC<{
  children: ReactNode;
  tone?: "dark" | "light" | "warm";
  style?: CSSProperties;
}> = ({ children, tone = "light", style }) => {
  const background =
    tone === "dark"
      ? "#090909"
      : tone === "warm"
        ? "#F8F4ED"
        : "#FFFFFF";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: background,
        color: tone === "dark" ? "#FFFFFF" : colors.black,
        overflow: "hidden",
        fontFamily:
          '"Outfit", "Inter", "Aptos", "Segoe UI", Arial, sans-serif',
        ...style,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            tone === "dark"
              ? "radial-gradient(circle at 70% 20%, rgba(249,115,22,0.24), transparent 28%), radial-gradient(circle at 20% 85%, rgba(255,255,255,0.10), transparent 30%)"
              : "radial-gradient(circle at 84% 20%, rgba(249,115,22,0.12), transparent 22%), radial-gradient(circle at 8% 88%, rgba(17,17,17,0.06), transparent 24%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: tone === "dark" ? 0.12 : 0.08,
          backgroundImage:
            "linear-gradient(90deg, rgba(120,120,120,0.18) 1px, transparent 1px), linear-gradient(0deg, rgba(120,120,120,0.18) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          maskImage:
            "radial-gradient(circle at center, black 0%, transparent 76%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: tone === "dark" ? 0.11 : 0.05,
          backgroundImage:
            "repeating-radial-gradient(circle at 12% 18%, rgba(255,255,255,0.9) 0 1px, transparent 1px 5px)",
          mixBlendMode: tone === "dark" ? "screen" : "multiply",
          pointerEvents: "none",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};
