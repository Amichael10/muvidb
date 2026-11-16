/**
 * RewindVideo — 1080x1920, 30fps, 420 frames (14.0s exactly). No audio.
 *
 * Scenes are stacked absolutely in order and each one wipes upward over the
 * one before it, exactly as the reference does with clip-path. That is why
 * this is not a <Series>: scene N stays mounted and visible underneath scene
 * N+1 while the 0.4s wipe plays over it.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { REWIND, SCENE, WIPE, type RewindRow } from '../../../src/lib/rewind';
import { FinalCard, Hook, HeroNumber, PosterBurst, TypeReveal, useSeconds } from './scenes';
import { out, p } from './lib/anim';
import { FontGate } from './components/FontGate';
import './lib/fonts';

/** Upward reveal: the incoming scene uncovers from the bottom edge. */
const Wipe: React.FC<{ start: number; children: React.ReactNode }> = ({ start, children }) => {
  const t = useSeconds();
  if (start === 0) return <>{children}</>;
  const w = out(p(t, start, start + WIPE));
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        visibility: t >= start ? 'visible' : 'hidden',
        clipPath: `inset(${((1 - w) * 100).toFixed(3)}% 0 0 0)`,
      }}
    >
      {children}
    </div>
  );
};

export const RewindVideo: React.FC<{ row: RewindRow }> = ({ row }) => (
  <AbsoluteFill style={{ background: REWIND.ink }}>
    <FontGate>
    <Wipe start={SCENE.hook}>
      <Hook row={row} />
    </Wipe>
    <Wipe start={SCENE.posters}>
      <PosterBurst row={row} />
    </Wipe>
    <Wipe start={SCENE.hero}>
      <HeroNumber row={row} />
    </Wipe>
    <Wipe start={SCENE.type}>
      <TypeReveal row={row} />
    </Wipe>
    <Wipe start={SCENE.card}>
      <FinalCard row={row} />
    </Wipe>
    </FontGate>
  </AbsoluteFill>
);
