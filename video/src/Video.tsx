import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
  Audio,
} from "remotion";
import { Intro } from "./scenes/Intro";
import { ScreenRecording } from "./scenes/ScreenRecording";
import { Outro } from "./scenes/Outro";

// Scene timings (in frames at 30fps)
const FPS = 30;
const s = (sec: number) => sec * FPS;

export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1008" }}>
      {/* Background music — uncomment when music.mp3 is added */}
      {/* <Audio src={staticFile("music.mp3")} volume={0.15} /> */}

      {/* Scene 1: Intro title */}
      <Sequence from={0} durationInFrames={s(5)}>
        <Intro />
      </Sequence>

      {/* Scene 2: Balance check */}
      <Sequence from={s(5)} durationInFrames={s(12)}>
        <ScreenRecording
          clip="clips/02-balance.webm"
          title="Check Balance"
          caption="Ask your balance — agent walks to the computer and pulls up your wallet"
          speedMultiplier={2}
        />
      </Sequence>

      {/* Scene 3: Swap with approval */}
      <Sequence from={s(17)} durationInFrames={s(25)}>
        <ScreenRecording
          clip="clips/03-swap.webm"
          title="Swap Tokens"
          caption="Best-price routing across Uniswap V3 and Mento — approve right on the 3D monitor"
          speedMultiplier={1.5}
        />
      </Sequence>

      {/* Scene 4: Savings goal */}
      <Sequence from={s(42)} durationInFrames={s(15)}>
        <ScreenRecording
          clip="clips/04-savings.webm"
          title="Savings Goals"
          caption="Set a goal, deposit to AAVE for yield, track progress on the piggy bank"
          speedMultiplier={2}
        />
      </Sequence>

      {/* Scene 5: AAVE lending */}
      <Sequence from={s(57)} durationInFrames={s(13)}>
        <ScreenRecording
          clip="clips/05-aave.webm"
          title="AAVE V3 Lending"
          caption="Supply tokens, earn yield — vault opens for on-chain transactions"
          speedMultiplier={2}
        />
      </Sequence>

      {/* Scene 6: Night mode */}
      <Sequence from={s(70)} durationInFrames={s(10)}>
        <ScreenRecording
          clip="clips/06-night.webm"
          title="Night Mode"
          caption="Agent sleeps — but the background monitor keeps watching 24/7"
          speedMultiplier={1}
        />
      </Sequence>

      {/* Scene 7: Outro */}
      <Sequence from={s(80)} durationInFrames={s(10)}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
