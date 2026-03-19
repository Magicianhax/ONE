import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12 } });
  const titleOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(frame, [40, 60], [20, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a1008 0%, #2a1a0a 50%, #1a1008 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{
          width: 140,
          height: 140,
          borderRadius: "50%",
          border: "4px solid #D4A030",
          boxShadow: "0 0 40px rgba(212,160,48,0.3)",
          transform: `scale(${logoScale})`,
        }}
      />
      <div
        style={{
          opacity: titleOpacity,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 72,
          fontWeight: 800,
          color: "#FCFF52",
          letterSpacing: -2,
          textShadow: "0 4px 20px rgba(252,255,82,0.3)",
        }}
      >
        ONE
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          transform: `translateY(${tagY}px)`,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 26,
          fontWeight: 600,
          color: "#35D07F",
          letterSpacing: 1,
        }}
      >
        Personal DeFi Agent on Celo
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          fontFamily: "system-ui, sans-serif",
          fontSize: 16,
          color: "#a08860",
          marginTop: 8,
        }}
      >
        Swap &middot; Lend &middot; Save &middot; Monitor &middot; Any Token
      </div>
    </AbsoluteFill>
  );
};
