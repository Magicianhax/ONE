import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
} from "remotion";

interface Props {
  clip: string;
  title: string;
  caption: string;
  speedMultiplier?: number;
}

export const ScreenRecording: React.FC<Props> = ({
  clip,
  title,
  caption,
  speedMultiplier = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Fade in/out
  const opacity = interpolate(
    frame,
    [0, 15, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // Title badge animation
  const badgeScale = spring({ frame, fps, config: { damping: 15 } });
  const badgeOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  // Caption slide up
  const captionY = interpolate(frame, [10, 30], [30, 0], { extrapolateRight: "clamp" });
  const captionOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#1a1008" }}>
      {/* Video clip */}
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(clip)}
          playbackRate={speedMultiplier}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </AbsoluteFill>

      {/* Dark overlay for readability */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 15%, transparent 75%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      {/* Title badge — top left */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 30,
          opacity: badgeOpacity,
          transform: `scale(${badgeScale})`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "2px solid #D4A030",
          }}
        />
        <div
          style={{
            background: "rgba(26,16,8,0.85)",
            backdropFilter: "blur(8px)",
            padding: "8px 18px",
            borderRadius: 12,
            border: "1px solid rgba(212,160,48,0.3)",
          }}
        >
          <span
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#FCFF52",
            }}
          >
            {title}
          </span>
        </div>
      </div>

      {/* Caption bar — bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 40,
          right: 40,
          opacity: captionOpacity,
          transform: `translateY(${captionY}px)`,
          background: "rgba(26,16,8,0.85)",
          backdropFilter: "blur(8px)",
          padding: "14px 24px",
          borderRadius: 16,
          border: "1px solid rgba(212,160,48,0.2)",
        }}
      >
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 18,
            fontWeight: 600,
            color: "#e8dcc8",
            lineHeight: 1.5,
          }}
        >
          {caption}
        </span>
      </div>
    </AbsoluteFill>
  );
};
