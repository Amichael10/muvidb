/**
 * The furniture every Rewind scene shares: the padded scene box, the top bar,
 * the billing line and the footer URL.
 *
 * The reference template carried a "Sample data, for layout only" label in the
 * bottom-right of scenes 3, 4 and 5. Those are gone; the brief asks for
 * muvidb.com/rewind on every scene instead, so FooterUrl takes that slot.
 */
import React from 'react';
import { BILLING_LINE, FOOTER_URL, REWIND } from '../../../../src/lib/rewind';
import { BODY, DISPLAY } from '../lib/fonts';

export type Tone = 'dark' | 'cream';

/** Muted text colour for the surface the scene sits on. */
export const mutedFor = (tone: Tone): string =>
  tone === 'cream' ? REWIND.mutedOnCream : REWIND.mutedOnDark;

export const Scene: React.FC<{
  background: string;
  color?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ background, color = REWIND.cream, children, style }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      padding: '72px 56px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: BODY,
      background,
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

export const TopBar: React.FC<{
  right: string;
  tone: Tone;
  /** Scene 3 is full orange, where the accent would vanish into the ground. */
  accent?: string;
  opacity?: number;
}> = ({ right, tone, accent = REWIND.orange, opacity = 1 }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: 6,
      textTransform: 'uppercase',
      opacity,
    }}
  >
    <div style={{ color: accent }}>MuviDB Rewind 2026</div>
    <div style={{ color: mutedFor(tone) }}>{right}</div>
  </div>
);

export const Billing: React.FC<{ tone: Tone; opacity?: number }> = ({ tone, opacity = 1 }) => (
  <div
    style={{
      fontFamily: DISPLAY,
      fontSize: 22,
      letterSpacing: 5,
      textTransform: 'uppercase',
      lineHeight: 1.5,
      color: mutedFor(tone),
      opacity,
    }}
  >
    {BILLING_LINE}
  </div>
);

/** On every scene, per the brief. */
export const FooterUrl: React.FC<{ tone: Tone; opacity?: number; align?: 'left' | 'right' }> = ({
  tone,
  opacity = 1,
  align = 'left',
}) => (
  <div
    style={{
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: 2,
      color: mutedFor(tone),
      textAlign: align,
      opacity,
    }}
  >
    {FOOTER_URL}
  </div>
);

export const Grow: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => <div style={{ flexGrow: 1, minHeight: 0, ...style }}>{children}</div>;
