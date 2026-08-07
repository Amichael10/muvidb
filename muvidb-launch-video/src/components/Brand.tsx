import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";

type LogoVariant = "orange" | "white" | "black";

const logoSource: Record<LogoVariant, string> = {
  orange: "brand/orange-logo.svg",
  white: "brand/white-logo.svg",
  black: "brand/black-logo.svg",
};

export const BrandLogo: React.FC<{
  variant?: LogoVariant;
  style?: CSSProperties;
}> = ({ variant = "orange", style }) => {
  return (
    <Img
      src={staticFile(logoSource[variant])}
      style={{
        width: 260,
        height: "auto",
        objectFit: "contain",
        ...style,
      }}
    />
  );
};

export const WordMark: React.FC<{
  color?: string;
  style?: CSSProperties;
}> = ({ color = "#111111", style }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        color,
        ...style,
      }}
    >
      <Img
        src={staticFile("brand/icon.svg")}
        style={{
          width: 64,
          height: 64,
          objectFit: "contain",
        }}
      />
      <div
        style={{
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: 0,
          lineHeight: 1,
        }}
      >
        MuviDB
      </div>
    </div>
  );
};
