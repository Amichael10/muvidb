/**
 * The actor card from scene 5 of the reference, factored out because the two
 * stills reuse it: RewindStory is the final card frame at 1080x1920 and
 * RewindFeed is the same card recomposed for 4:5.
 *
 * Everything that can be absent in real data is conditional here rather than
 * rendered blank: the portrait, the lead/supporting pills, every stat row, the
 * archetype band and the Top-N badge.
 */
import React from 'react';
import { Img } from 'remotion';
import {
  buildRolePills,
  buildStatRows,
  formatViews,
  REWIND,
  topPercentLabel,
  type RewindRow,
} from '../../../../src/lib/rewind';
import { BODY, DISPLAY } from '../lib/fonts';
import { fitDisplayLine } from '../lib/fit';

/** 4:5 has roughly two thirds the height to play with, so the card tightens. */
export type CardScale = 'story' | 'feed';

const StatRowView: React.FC<{ label: string; value: string; opacity: number; scale: CardScale }> = ({
  label,
  value,
  opacity,
  scale,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 24,
      padding: scale === 'feed' ? '12px 0' : '20px 0',
      borderBottom: `2px dotted ${REWIND.hairline}`,
      fontSize: scale === 'feed' ? 26 : 32,
      opacity,
    }}
  >
    <div style={{ color: REWIND.mutedOnDark, flexShrink: 0 }}>{label}</div>
    <div
      style={{
        fontWeight: 700,
        textAlign: 'right',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}
    >
      {value}
    </div>
  </div>
);

export const ActorCard: React.FC<{
  row: RewindRow;
  /** 0..1 per row, for the staggered reveal in scene 5. Stills pass 1. */
  rowOpacity?: (index: number) => number;
  scale?: CardScale;
  width: number;
}> = ({ row, rowOpacity = () => 1, scale = 'story', width }) => {
  const stats = buildStatRows(row, scale === 'feed' ? 3 : 5);
  const pills = buildRolePills(row);
  const badge = topPercentLabel(row.percentile);
  const views = formatViews(row.total_views);

  const padX = scale === 'feed' ? 38 : 48;
  const innerWidth = width - padX * 2;

  // The name shares the header with the film count, so it gets the left ~62%.
  const nameSize = fitDisplayLine(
    row.display_name,
    innerWidth * 0.62,
    scale === 'feed' ? 52 : 64
  );
  // The hero views figure is the single biggest thing on the card.
  const portraitW = scale === 'feed' ? 230 : 300;
  const viewsSize = views
    ? fitDisplayLine(views, innerWidth - portraitW - 40, scale === 'feed' ? 150 : 190)
    : 0;
  const archetypeSize = fitDisplayLine(row.archetype, innerWidth, scale === 'feed' ? 64 : 84);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: REWIND.card,
        border: `3px solid ${REWIND.orange}`,
        borderRadius: 36,
        overflow: 'hidden',
        fontFamily: BODY,
        color: REWIND.cream,
      }}
    >
      {/* header: name + film count */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 24,
          padding: `${scale === 'feed' ? 32 : 44}px ${padX}px 0 ${padX}px`,
        }}
      >
        <div style={{ fontFamily: DISPLAY, textTransform: 'uppercase', fontSize: nameSize, lineHeight: 1 }}>
          {row.display_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, color: REWIND.orange, flexShrink: 0 }}>
          <span style={{ fontFamily: DISPLAY, fontSize: scale === 'feed' ? 52 : 64, lineHeight: 1 }}>
            {row.films_count}
          </span>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase' }}>
            {row.films_count === 1 ? 'film' : 'films'}
          </span>
        </div>
      </div>

      {/* portrait + hero number */}
      <div
        style={{
          display: 'flex',
          gap: scale === 'feed' ? 30 : 40,
          padding: `${scale === 'feed' ? 26 : 36}px ${padX}px ${scale === 'feed' ? 32 : 48}px ${padX}px`,
        }}
      >
        {row.portrait_url ? (
          <Img
            src={row.portrait_url}
            style={{
              width: portraitW,
              height: scale === 'feed' ? 307 : 400,
              flexShrink: 0,
              borderRadius: 20,
              objectFit: 'cover',
              background: REWIND.deepBrown,
            }}
          />
        ) : null}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: scale === 'feed' ? 14 : 18,
            minWidth: 0,
          }}
        >
          {views ? (
            <>
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontSize: viewsSize,
                  lineHeight: 0.95,
                  color: REWIND.orange,
                }}
              >
                {views}
              </div>
              <div style={{ fontSize: scale === 'feed' ? 28 : 34, fontWeight: 500, lineHeight: 1.2 }}>
                views across your 2026 films
              </div>
            </>
          ) : (
            <div style={{ fontSize: scale === 'feed' ? 30 : 36, fontWeight: 500, lineHeight: 1.25 }}>
              {row.films_count} films released in 2026
            </div>
          )}
          {pills.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
              {pills.map((pill, i) => (
                <div
                  key={pill}
                  style={{
                    padding: '10px 22px',
                    border: `2px solid ${i === 0 ? REWIND.orange : REWIND.hairline}`,
                    borderRadius: 999,
                    fontSize: scale === 'feed' ? 22 : 26,
                    fontWeight: 700,
                  }}
                >
                  {pill}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* archetype band */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: `${scale === 'feed' ? 28 : 36}px ${padX}px ${scale === 'feed' ? 30 : 40}px ${padX}px`,
          background: REWIND.orange,
          color: REWIND.ink,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase' }}>
          Actor type
        </div>
        <div style={{ fontFamily: DISPLAY, textTransform: 'uppercase', fontSize: archetypeSize, lineHeight: 1 }}>
          {row.archetype}
        </div>
        <div style={{ fontSize: scale === 'feed' ? 25 : 30, fontWeight: 500, lineHeight: 1.3 }}>
          {row.archetype_line}
        </div>
      </div>

      {/* stat rows */}
      {stats.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', padding: `16px ${padX}px 0 ${padX}px` }}>
          {stats.map((s, i) => (
            <StatRowView
              key={s.label}
              label={s.label}
              value={s.value}
              opacity={rowOpacity(i)}
              scale={scale}
            />
          ))}
        </div>
      ) : null}

      {/* percentile badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: `${scale === 'feed' ? 22 : 28}px ${padX}px ${scale === 'feed' ? 32 : 44}px ${padX}px`,
        }}
      >
        {badge ? (
          <>
            <div
              style={{
                fontFamily: DISPLAY,
                textTransform: 'uppercase',
                fontSize: scale === 'feed' ? 60 : 76,
                lineHeight: 1,
                color: REWIND.orange,
              }}
            >
              {badge}
            </div>
            <div
              style={{
                fontSize: scale === 'feed' ? 22 : 26,
                fontWeight: 500,
                lineHeight: 1.25,
                color: REWIND.mutedOnDark,
              }}
            >
              most-credited actors
              <br />
              of 2026
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
