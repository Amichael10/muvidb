/**
 * The five Rewind scenes, ported from docs/rewind/rewind-sample-template.html.
 *
 * Every timing window, easing curve and pixel value below is the reference's.
 * What differs is only what real data forces:
 *   - names, numbers and the archetype are measured and shrunk to fit;
 *   - the poster burst adapts its ramp to however many posters exist;
 *   - anything absent is omitted rather than rendered blank;
 *   - the "Sample data, for layout only" labels are replaced by the footer URL.
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CLAIM_LINE,
  FPS,
  formatViews,
  posterBurstRamp,
  REWIND,
  SCENE,
  type RewindRow,
} from '../../../src/lib/rewind';
import { Billing, FooterUrl, Grow, Scene, TopBar, mutedFor } from './components/chrome';
import { ActorCard } from './components/ActorCard';
import { SafePoster } from './components/SafePoster';
import { DISPLAY } from './lib/fonts';
import { fitDisplayLine, fitDisplayLines } from './lib/fit';
import { back, clamp, inn, lerp, out, p } from './lib/anim';

/** Scene box is 1080 wide with 56px padding either side. */
const INNER = 1080 - 56 * 2;

const fadeUp = (x: number, dist = 40): React.CSSProperties => ({
  opacity: x,
  transform: `translateY(${((1 - x) * dist).toFixed(2)}px)`,
});

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Seconds elapsed inside the whole 14s sequence. */
export const useSeconds = (): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / (fps || FPS);
};

// ---------------------------------------------------------------------------
// 1. HOOK  0.0-2.4s
// ---------------------------------------------------------------------------
export const Hook: React.FC<{ row: RewindRow }> = ({ row }) => {
  const l = useSeconds() - SCENE.hook;
  // 250px is the reference size; a 38-character name comes back far smaller.
  const { fontSize, lines } = fitDisplayLines(row.display_name, INNER, 250, 2);

  return (
    <Scene background={REWIND.ink}>
      <TopBar right="Your year" tone="dark" opacity={out(p(l, 0, 0.3))} />
      <Grow
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}
      >
        <div style={{ fontSize: 60, fontWeight: 700, color: REWIND.orange, ...fadeUp(out(p(l, 0.15, 0.6))) }}>
          Your 2026 in Nollywood
        </div>
        {lines.map((line, i) => (
          <div key={`${line}-${i}`} style={{ overflow: 'hidden' }}>
            <div
              style={{
                fontFamily: DISPLAY,
                textTransform: 'uppercase',
                fontSize,
                lineHeight: 1.04,
                transform: `translateY(${(1 - out(p(l, 0.35 + i * 0.15, 0.95 + i * 0.15))) * 105}%)`,
              }}
            >
              {line}
            </div>
          </div>
        ))}
        <div
          style={{
            height: 14,
            background: REWIND.orange,
            transformOrigin: 'left center',
            transform: `scaleX(${out(p(l, 0.9, 1.6))})`,
          }}
        />
      </Grow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Billing tone="dark" opacity={out(p(l, 1.1, 1.6))} />
        <FooterUrl tone="dark" opacity={out(p(l, 1.1, 1.6))} />
      </div>
    </Scene>
  );
};

// ---------------------------------------------------------------------------
// 2. POSTER BURST  2.4-5.4s
// ---------------------------------------------------------------------------
export const PosterBurst: React.FC<{ row: RewindRow }> = ({ row }) => {
  const l = useSeconds() - SCENE.posters;
  const posters = row.poster_urls.slice(0, 14);
  const n = Math.max(1, posters.length);

  // A 3-poster deck dealt over the reference's full 2.2s crawls; the ramp
  // shortens with the deck and the count then holds with a pulse.
  const ramp = posterBurstRamp(n);
  const x = p(l, 0.35, 0.35 + ramp);
  const prog = Math.pow(x, 0.85) * n;
  const cur = Math.min(n - 1, Math.floor(prog));
  const shown = l < 0.35 ? 1 : cur + 1;

  // Pulse once the deck is complete, so a short burst reads as a punchline.
  const settle = p(l, 0.35 + ramp, 0.35 + ramp + 0.3);
  const pulse = 1 + 0.06 * Math.sin(settle * Math.PI);

  return (
    <Scene background={REWIND.card}>
      <TopBar right="Your films" tone="dark" />
      <Grow style={{ position: 'relative' }}>
        {posters.map((src, i) => {
          const visible = l >= 0.35 && i <= cur;
          const born = i === cur ? clamp(prog - cur) : 1;
          const k = out(clamp(born * 2.2));
          const rot = (i % 2 ? 1 : -1) * (2 + (i % 3) * 1.5);
          return (
            <div
              key={`${src}-${i}`}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 700,
                height: 1000,
                margin: '-500px 0 0 -350px',
                borderRadius: 24,
                overflow: 'hidden',
                border: `3px solid ${REWIND.hairline}`,
                opacity: visible ? 1 : 0,
                transform: `rotate(${rot}deg) scale(${lerp(1.12, 1, k).toFixed(4)})`,
              }}
            >
              <SafePoster
                src={src}
                index={i}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          );
        })}
      </Grow>
      {/* lineHeight 0.9 lets the numerals overhang their box, so the footer
          needs explicit clearance or the two collide at 300px. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, marginBottom: 28 }}>
        <div
          style={{
            fontFamily: DISPLAY,
            textTransform: 'uppercase',
            fontSize: 300,
            lineHeight: 0.9,
            color: REWIND.orange,
            minWidth: 270,
            transformOrigin: 'left bottom',
            transform: `scale(${pulse.toFixed(4)})`,
          }}
        >
          {pad2(shown)}
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, paddingBottom: 14 }}>
          {row.films_count === 1 ? 'film released' : 'films released'}
          <br />
          this year
        </div>
      </div>
      <FooterUrl tone="dark" opacity={out(p(l, 0.6, 1.1))} />
    </Scene>
  );
};

// ---------------------------------------------------------------------------
// 3. HERO NUMBER  5.4-8.4s
// ---------------------------------------------------------------------------
export const HeroNumber: React.FC<{ row: RewindRow }> = ({ row }) => {
  const l = useSeconds() - SCENE.hero;
  const c = out(p(l, 0.5, 2.0));
  const counted = formatViews(Math.round(row.total_views * c)) ?? '0';
  const final = formatViews(row.total_views) ?? '0';
  // Size against the FINAL string so the number does not resize as it counts.
  const size = fitDisplayLine(final, INNER, 350);
  const pulse = p(l, 2.0, 2.3);
  const topFilmViews = formatViews(row.top_film_views);

  return (
    <Scene background={REWIND.orange} color={REWIND.ink}>
      {/* On full orange the accent would vanish, so the mark goes ink. */}
      <TopBar right="Your audience" tone="cream" accent={REWIND.ink} />
      <Grow style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
        <div style={{ fontSize: 64, fontWeight: 700, ...fadeUp(out(p(l, 0.3, 0.7))) }}>
          Your films were watched
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            textTransform: 'uppercase',
            fontSize: size,
            lineHeight: 0.95,
            transformOrigin: 'left center',
            transform: `scale(${(1 + 0.05 * Math.sin(pulse * Math.PI)).toFixed(4)})`,
          }}
        >
          {counted}
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, ...fadeUp(out(p(l, 0.6, 1.0))) }}>
          times in 2026
        </div>
        {topFilmViews && row.top_film_title ? (
          <div
            style={{
              marginTop: 40,
              alignSelf: 'flex-start',
              maxWidth: INNER,
              padding: '22px 34px',
              background: REWIND.ink,
              color: REWIND.cream,
              borderRadius: 999,
              fontSize: 38,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              ...fadeUp(out(p(l, 2.1, 2.5))),
            }}
          >
            <span style={{ color: REWIND.orange }}>{topFilmViews}</span> on {row.top_film_title}
          </div>
        ) : null}
      </Grow>
      <FooterUrl tone="cream" opacity={out(p(l, 0.3, 0.8))} />
    </Scene>
  );
};

// ---------------------------------------------------------------------------
// 4. TYPE REVEAL  8.4-11.0s
// ---------------------------------------------------------------------------
export const TypeReveal: React.FC<{ row: RewindRow }> = ({ row }) => {
  const l = useSeconds() - SCENE.type;
  // "The Scene Stealer" -> "The" on its own line, "Scene Stealer" on the bar.
  const word = row.archetype.replace(/^The\s+/i, '');
  const wordSize = fitDisplayLine(word, INNER - 52, 198);
  const s = inn(p(l, 0.85, 1.15));

  return (
    <Scene background={REWIND.cream} color={REWIND.ink}>
      <TopBar right="Actor type" tone="cream" accent={REWIND.ink} />
      <Grow style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
        <div style={{ fontSize: 44, fontWeight: 700, ...fadeUp(out(p(l, 0.3, 0.65))) }}>
          This year you were
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            textTransform: 'uppercase',
            fontSize: 150,
            lineHeight: 1,
            ...fadeUp(out(p(l, 0.5, 0.85))),
          }}
        >
          The
        </div>
        <div style={{ position: 'relative', alignSelf: 'flex-start', padding: '10px 26px 14px 26px', marginLeft: -26 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: REWIND.orange,
              transformOrigin: 'left center',
              transform: `scaleX(${out(p(l, 0.8, 1.15))})`,
            }}
          />
          <div
            style={{
              position: 'relative',
              fontFamily: DISPLAY,
              textTransform: 'uppercase',
              fontSize: wordSize,
              lineHeight: 1,
              transformOrigin: 'left center',
              opacity: clamp(s * 3),
              transform: `scale(${lerp(1.9, 1, s).toFixed(4)})`,
            }}
          >
            {word}
          </div>
        </div>
        <div
          style={{
            fontSize: 46,
            fontWeight: 500,
            lineHeight: 1.3,
            maxWidth: 860,
            marginTop: 20,
            ...fadeUp(out(p(l, 1.45, 1.9))),
          }}
        >
          {row.archetype_line}
        </div>
      </Grow>
      <FooterUrl tone="cream" opacity={out(p(l, 1.5, 2.0))} />
    </Scene>
  );
};

// ---------------------------------------------------------------------------
// 5. FINAL CARD  11.0-14.0s  (settles by 12.0s, holds 2.0s)
// ---------------------------------------------------------------------------
export const FinalCard: React.FC<{ row: RewindRow }> = ({ row }) => {
  const l = useSeconds() - SCENE.card;
  const k = back(p(l, 0.25, 1.0));
  const footer = out(p(l, 1.2, 1.6));

  return (
    <Scene background={REWIND.ink} style={{ justifyContent: 'space-between', gap: 40 }}>
      <TopBar right="Actor card" tone="dark" />
      <div
        style={{
          opacity: clamp(p(l, 0.25, 0.5)),
          transform: `translateY(${((1 - k) * 220).toFixed(2)}px) rotate(${((1 - k) * -5).toFixed(3)}deg)`,
        }}
      >
        <ActorCard
          row={row}
          width={INNER}
          rowOpacity={(i) => out(p(l, 0.8 + i * 0.08, 1.1 + i * 0.08))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, ...fadeUp(footer, 30) }}>
        <div style={{ fontSize: 30, fontWeight: 500, color: mutedFor('dark') }}>{CLAIM_LINE}</div>
        <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1 }}>muvidb.com/rewind</div>
        <Billing tone="dark" />
      </div>
    </Scene>
  );
};
