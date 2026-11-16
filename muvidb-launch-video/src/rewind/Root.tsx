/**
 * Rewind compositions, registered into the existing Remotion project.
 *
 * The brief asked for `packages/rewind` as its own Remotion project. This repo
 * has no `packages/` directory, already carries one Remotion project with
 * exactly the version we need, and the machine has under 2 GB free — a second
 * node_modules would not fit and a render needs scratch space on top. So this
 * follows the project's own precedent: src/actor-alert/ is a separate
 * deliverable living inside the same project, registered the same way.
 */
import React from 'react';
import { Composition, Still } from 'remotion';
import { FEED_HEIGHT, FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from '../../../src/lib/rewind';
import { RewindVideo } from './RewindVideo';
import { RewindFeed, RewindStory } from './stills';
import { sampleFull } from './sample';

export const RewindCompositions: React.FC = () => (
  <>
    <Composition
      id="RewindVideo"
      component={RewindVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ row: sampleFull }}
    />
    <Still
      id="RewindStory"
      component={RewindStory}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ row: sampleFull }}
    />
    <Still
      id="RewindFeed"
      component={RewindFeed}
      width={WIDTH}
      height={FEED_HEIGHT}
      defaultProps={{ row: sampleFull }}
    />
  </>
);
