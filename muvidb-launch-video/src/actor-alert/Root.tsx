import { Composition, Still } from "remotion";
import {
  ActorAlertFilm,
  DURATION_IN_FRAMES,
  FPS,
} from "./compositions/ActorAlertFilm";
import { CoverThumbnail } from "./compositions/CoverThumbnail";
import { LAYOUTS } from "./compositions/layout";

/**
 * One master timeline, three framings, one still.
 *
 * Every video composition renders the same <ActorAlertFilm/> and differs only
 * by `layout`, so a change to a beat lands in all three cuts at once.
 */
export const ActorAlertCompositions: React.FC = () => (
  <>
    <Composition
      id="ActorAlertVertical"
      component={ActorAlertFilm}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={LAYOUTS.vertical.width}
      height={LAYOUTS.vertical.height}
      defaultProps={{ layout: "vertical" as const }}
    />
    <Composition
      id="ActorAlertLandscape"
      component={ActorAlertFilm}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={LAYOUTS.landscape.width}
      height={LAYOUTS.landscape.height}
      defaultProps={{ layout: "landscape" as const }}
    />
    <Composition
      id="ActorAlertSquare"
      component={ActorAlertFilm}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={LAYOUTS.square.width}
      height={LAYOUTS.square.height}
      defaultProps={{ layout: "square" as const }}
    />
    <Composition
      id="ActorAlertVerticalMuted"
      component={ActorAlertFilm}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={LAYOUTS.vertical.width}
      height={LAYOUTS.vertical.height}
      defaultProps={{ layout: "vertical" as const, muted: true }}
    />
    <Still
      id="ActorAlertCover"
      component={CoverThumbnail}
      width={1080}
      height={1920}
    />
  </>
);
