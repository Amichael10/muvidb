/**
 * A poster that cannot take the whole render down with it.
 *
 * Remotion's <Img> delays the frame until the image loads, which is what we
 * want, but an unreachable URL throws and kills the render. Across 782 actors
 * that is a near certainty: 729 films still hold a newline inside poster_url,
 * and third-party hosts (nollymeter.com among them) come and go. A dead poster
 * degrades to a branded tile and the actor still gets a video.
 */
import React, { useCallback, useState } from 'react';
import { Img } from 'remotion';
import { REWIND } from '../../../../src/lib/rewind';
import { DISPLAY } from '../lib/fonts';

const FALLBACK_TONES: [string, string][] = [
  [REWIND.orange, REWIND.ink],
  [REWIND.cream, REWIND.ink],
  [REWIND.deepBrown, REWIND.cream],
  ['#C24100', REWIND.cream],
];

export const SafePoster: React.FC<{
  src: string;
  index: number;
  style?: React.CSSProperties;
}> = ({ src, index, style }) => {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);

  if (failed || !src) {
    const [bg, fg] = FALLBACK_TONES[index % FALLBACK_TONES.length];
    return (
      <div
        style={{
          ...style,
          background: bg,
          color: fg,
          display: 'flex',
          alignItems: 'flex-end',
          padding: 36,
          fontFamily: DISPLAY,
          fontSize: 220,
          lineHeight: 0.9,
        }}
      >
        {index + 1 < 10 ? `0${index + 1}` : String(index + 1)}
      </div>
    );
  }

  return <Img src={src} style={style} onError={onError} />;
};
