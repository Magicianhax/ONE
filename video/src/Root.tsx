import { Composition } from "remotion";
import { DemoVideo } from "./Video";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="OneDemo"
      component={DemoVideo}
      durationInFrames={30 * 90} // 90 seconds at 30fps
      fps={30}
      width={1440}
      height={900}
    />
  );
};
