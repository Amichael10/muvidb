import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadBarlowCondensed } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadHostGrotesk } from "@remotion/google-fonts/HostGrotesk";

/**
 * Fonts are loaded at module scope so every frame renders with the real
 * typefaces. Remotion blocks the first frame until these resolve, which is
 * what keeps text from reflowing partway through a render.
 */
const bebas = loadBebas();
const barlow = loadBarlowCondensed();
const host = loadHostGrotesk();

export const fontFamilies = {
  title: bebas.fontFamily,
  label: barlow.fontFamily,
  body: host.fontFamily,
};

export const waitForFonts = () =>
  Promise.all([bebas.waitUntilDone(), barlow.waitUntilDone(), host.waitUntilDone()]);
