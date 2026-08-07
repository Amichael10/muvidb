import { Composition, Folder } from "remotion";
import {
  FPS,
  MuviDbLaunchFilm,
  TOTAL_FRAMES,
  launchScenes,
} from "./LaunchFilm";

export const MyComposition = () => {
  return (
    <>
      <Folder name="MuviDB-Premium-Launch-Scenes">
        {launchScenes.map((scene) => {
          const Scene = scene.component;

          return (
            <Composition
              key={scene.id}
              id={scene.id}
              component={Scene}
              durationInFrames={scene.durationInFrames}
              fps={FPS}
              width={1920}
              height={1080}
            />
          );
        })}
      </Folder>
      <Composition
        id="MuviDBLaunchFilm"
        component={MuviDbLaunchFilm}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
