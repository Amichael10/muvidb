/**
 * The two share stills.
 *
 * RewindStory (1080x1920) is the final card frame — what scene 5 settles into,
 * with the drop animation already finished.
 * RewindFeed (1080x1350) is the same card recomposed for 4:5: the stat list is
 * trimmed to three rows and the card's internal spacing tightens, because at
 * 1350 tall the story layout would overflow rather than letterbox.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BILLING_LINE, CLAIM_LINE, FOOTER_URL, REWIND, type RewindRow } from '../../../src/lib/rewind';
import { ActorCard } from './components/ActorCard';
import { FontGate } from './components/FontGate';
import { BODY, DISPLAY } from './lib/fonts';
import './lib/fonts';

const INNER = 1080 - 56 * 2;

const TopBar: React.FC<{ right: string }> = ({ right }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: 6,
      textTransform: 'uppercase',
    }}
  >
    <div style={{ color: REWIND.orange }}>MuviDB Rewind 2026</div>
    <div style={{ color: REWIND.mutedOnDark }}>{right}</div>
  </div>
);

export const RewindStory: React.FC<{ row: RewindRow }> = ({ row }) => (
  <AbsoluteFill
    style={{
      background: REWIND.ink,
      color: REWIND.cream,
      fontFamily: BODY,
      padding: '72px 56px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 40,
    }}
  >
    <FontGate>
    <TopBar right="Actor card" />
    <ActorCard row={row} width={INNER} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontSize: 30, fontWeight: 500, color: REWIND.mutedOnDark }}>{CLAIM_LINE}</div>
      <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1 }}>{FOOTER_URL}</div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 22,
          letterSpacing: 5,
          textTransform: 'uppercase',
          lineHeight: 1.5,
          color: REWIND.mutedOnDark,
        }}
      >
        {BILLING_LINE}
      </div>
    </div>
    </FontGate>
  </AbsoluteFill>
);

export const RewindFeed: React.FC<{ row: RewindRow }> = ({ row }) => (
  <AbsoluteFill
    style={{
      background: REWIND.ink,
      color: REWIND.cream,
      fontFamily: BODY,
      padding: '44px 56px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 24,
    }}
  >
    <FontGate>
    <TopBar right="Actor card" />
    <ActorCard row={row} width={INNER} scale="feed" />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24 }}>
      <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{FOOTER_URL}</div>
      <div style={{ fontSize: 24, fontWeight: 500, color: REWIND.mutedOnDark, textAlign: 'right' }}>
        {CLAIM_LINE}
      </div>
    </div>
    </FontGate>
  </AbsoluteFill>
);
