/**
 * Holds the frame until Anton and DM Sans are actually usable.
 *
 * @fontsource ships @font-face rules, and a browser does not fetch a webfont
 * until something is laid out in it. Our layout depends on measuring the font
 * first, so without this gate the very first measureText() runs against the
 * fallback and every headline comes out mis-sized. @remotion/layout-utils
 * catches it (`validateFontIsLoaded`), which is how this was found, but the
 * fix is to load them up front rather than to stop checking.
 */
import React, { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { BODY, DISPLAY } from '../lib/fonts';

/** Every family/weight pair the compositions measure or render. */
const FACES = [
  `400 100px "${DISPLAY}"`,
  `400 100px "${BODY}"`,
  `500 100px "${BODY}"`,
  `700 100px "${BODY}"`,
];

export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading Rewind fonts'));

  useEffect(() => {
    let live = true;
    Promise.all(FACES.map((face) => document.fonts.load(face)))
      .then(() => document.fonts.ready)
      .then(() => {
        if (!live) return;
        setReady(true);
        continueRender(handle);
      })
      .catch(() => {
        // Never hang the render on a font failure; Remotion will surface the
        // mis-measurement instead, which is louder than a silent timeout.
        if (live) continueRender(handle);
      });
    return () => {
      live = false;
    };
  }, [handle]);

  if (!ready) return null;
  return <>{children}</>;
};
