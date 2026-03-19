import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12 } });
  const textOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const linkOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [240, 300], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a1008 0%, #2a1a0a 50%, #1a1008 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity: fadeOut,
      }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          border: "3px solid #D4A030",
          transform: `scale(${scale})`,
        }}
      />
      <div
        style={{
          opacity: textOpacity,
          fontFamily: "system-ui, sans-serif",
          fontSize: 48,
          fontWeight: 800,
          color: "#FCFF52",
          letterSpacing: -1,
        }}
      >
        ONE
      </div>
      <div
        style={{
          opacity: textOpacity,
          fontFamily: "system-ui, sans-serif",
          fontSize: 22,
          color: "#35D07F",
          fontWeight: 600,
        }}
      >
        Personal DeFi Agent on Celo
      </div>
      <div
        style={{
          opacity: linkOpacity,
          fontFamily: "monospace",
          fontSize: 18,
          color: "#D4A030",
          background: "rgba(212,160,48,0.1)",
          padding: "10px 24px",
          borderRadius: 10,
          border: "1px solid rgba(212,160,48,0.25)",
          marginTop: 12,
        }}
      >
        github.com/Magicianhax/ONE
      </div>
      <div
        style={{
          opacity: linkOpacity,
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
          color: "#a08860",
          marginTop: 8,
        }}
      >
        Open Source &middot; MIT License &middot; ERC-8004 Registered
      </div>
    </AbsoluteFill>
  );
};
