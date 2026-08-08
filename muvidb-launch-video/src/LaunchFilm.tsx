import type { FC } from "react";
import { Fragment } from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  CatalogScene,
  EcosystemScene,
  FilmRecordScene,
  HomeExperienceScene,
  ProblemTypographyScene,
  RevealProductScene,
  StatsOutroScene,
} from "./scenes/PremiumLaunchScenes";

export const FPS = 30;
export const TRANSITION = 30;

type LaunchScene = {
  id: string;
  name: string;
  durationInFrames: number;
  component: FC;
};

export const launchScenes: LaunchScene[] = [
  {
    id: "ProblemTypographyScene",
    name: "The missing archive",
    durationInFrames: 150,
    component: ProblemTypographyScene,
  },
  {
    id: "RevealProductScene",
    name: "Product reveal",
    durationInFrames: 210,
    component: RevealProductScene,
  },
  {
    id: "HomeExperienceScene",
    name: "Homepage and mobile",
    durationInFrames: 240,
    component: HomeExperienceScene,
  },
  {
    id: "FilmRecordScene",
    name: "Film record",
    durationInFrames: 240,
    component: FilmRecordScene,
  },
  {
    id: "CatalogScene",
    name: "Catalog discovery",
    durationInFrames: 210,
    component: CatalogScene,
  },
  {
    id: "EcosystemScene",
    name: "People and cinemas",
    durationInFrames: 240,
    component: EcosystemScene,
  },
  {
    id: "StatsOutroScene",
    name: "Stats and CTA",
    durationInFrames: 270,
    component: StatsOutroScene,
  },
];

export const TOTAL_FRAMES =
  launchScenes.reduce((total, scene) => total + scene.durationInFrames, 0) -
  TRANSITION * (launchScenes.length - 1);

export const MuviDbLaunchFilm: React.FC = () => {
  return (
    <TransitionSeries>
      {launchScenes.map((scene, index) => {
        const Scene = scene.component;

        return (
          <Fragment key={scene.id}>
            <TransitionSeries.Sequence
              durationInFrames={scene.durationInFrames}
              name={scene.name}
            >
              <Scene />
            </TransitionSeries.Sequence>
            {index < launchScenes.length - 1 ? (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: TRANSITION })}
              />
            ) : null}
          </Fragment>
        );
      })}
    </TransitionSeries>
  );
};
