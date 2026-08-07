import { useCurrentFrame } from "remotion";
import { countUp } from "../lib/animation";
import { colors } from "./SceneShell";

export const StatsNumber: React.FC<{
  label: string;
  value: number;
  suffix?: string;
  delay: number;
}> = ({ label, value, suffix = "+", delay }) => {
  const frame = useCurrentFrame();
  const shown = countUp(frame, delay, delay + 68, value).toLocaleString("en-US");

  return (
    <div
      style={{
        borderTop: "1px solid rgba(255,255,255,0.18)",
        paddingTop: 28,
      }}
    >
      <div
        style={{
          fontSize: 104,
          lineHeight: 0.9,
          fontWeight: 950,
          color: "#FFFFFF",
        }}
      >
        {shown}
        <span style={{ color: colors.orange }}>{suffix}</span>
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 28,
          color: "#D6D3D1",
          fontWeight: 800,
        }}
      >
        {label}
      </div>
    </div>
  );
};
