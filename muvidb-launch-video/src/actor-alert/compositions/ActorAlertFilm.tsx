import { AbsoluteFill, useCurrentFrame, Img, Audio, staticFile } from "remotion";
import { brand } from "../styles/brand";
import { script, film } from "../data/demoContent";
import { PhoneMockup } from "../components/PhoneMockup";
import { ActorProfile } from "../components/ActorProfile";
import { WhatsAppOptIn } from "../components/WhatsAppOptIn";
import { LockScreen } from "../components/LockScreen";
import { WhatsAppMovieAlert } from "../components/WhatsAppMovieAlert";
import {
  FilmPage,
  NetflixDestination,
  WATCH_BUTTON,
  FILM_PAGE_SCROLL,
} from "../components/StreamingDestination";
import { BrandReveal } from "../components/BrandReveal";
import { Caption, TouchIndicator } from "../components/Caption";
import { progress, animate } from "../lib/ease";
import { LAYOUTS, type LayoutName } from "./layout";

/**
 * The master timeline. Every other aspect ratio renders this same component
 * with a different `layout`, so the story and the beat timings can never
 * diverge between the vertical, landscape and square cuts.
 *
 * All timings are absolute frame numbers at 30fps, collected here so the edit
 * can be retimed in one place. Nothing animates off a wall-clock timer, which
 * is what makes the render frame-accurate.
 */
export const FPS = 30;

export const T = {
  // Scene 1 - the hook
  s1: 0,
  hook1In: 8,
  hook2In: 64,
  // Scene 2 - discover an actor
  s2: 120,
  discoverCaption: 132,
  followTap: 212,
  // Scene 3 - following confirmed, and the real opt-in step
  s3: 270,
  follow1Caption: 276,
  follow2Caption: 330,
  optInAppear: 292,
  optInType: 312,
  optInSubmit: 356,
  // Scene 4 - the notification arrives
  s4: 390,
  notifyCaption: 402,
  notifyArrive: 468,
  notifyTap: 546,
  // Scene 5 - the WhatsApp alert
  s5: 570,
  bubbleLand: 586,
  alertCaption: 606,
  alertScrollStart: 596,
  alertLinkTap: 838,
  // Scene 6 - the handoff to the streaming destination
  s6: 870,
  filmPageArrive: 874,
  watchCaption: 886,
  filmPageScroll: 908,
  netflixTap: 990,
  netflixArrive: 1004,
  // Scene 7 - brand reveal
  s7: 1056,
  end: 1260,
} as const;

export const DURATION_IN_FRAMES = T.end;

/** Which screen the device is showing, and how opaque it is. */
const useScreenStack = (frame: number) => {
  // Crossfades between screens. Each returns 0..1.
  const profile =
    progress(frame, { from: T.s1, duration: 1 }) *
    (1 - progress(frame, { from: T.s4 - 26, duration: 20 }));
  const lock =
    progress(frame, { from: T.s4 - 20, duration: 20 }) *
    (1 - progress(frame, { from: T.s5 - 14, duration: 14 }));
  const chat =
    progress(frame, { from: T.s5 - 12, duration: 16 }) *
    (1 - progress(frame, { from: T.s6 - 10, duration: 12 }));
  const filmPage =
    progress(frame, { from: T.s6 - 8, duration: 14 }) *
    (1 - progress(frame, { from: T.netflixArrive - 6, duration: 12 }));
  const netflix = progress(frame, { from: T.netflixArrive - 4, duration: 14 });

  return { profile, lock, chat, filmPage, netflix };
};

/**
 * Camera moves. The phone is pushed, never spun: scale and a little vertical
 * drift only, with one small tilt during the hook so the opening has depth.
 */
const useCamera = (frame: number, layout: (typeof LAYOUTS)[LayoutName]) => {
  // Scene 1 pushes in from a wider, tilted framing.
  const hookPush = progress(frame, { from: T.s1, duration: T.s2 - T.s1 });
  // Scene 4 leans closer to the notification.
  const notifyPush = progress(frame, { from: T.notifyArrive, duration: 70 });
  // Scene 5 settles back out so the whole message is readable.
  const alertPull = progress(frame, { from: T.s5, duration: 40 });

  const base = layout.phoneScale;
  const scale =
    base *
    (0.86 + hookPush * 0.14) * // 0.86 -> 1.00
    (1 + notifyPush * 0.1 - alertPull * 0.1);

  const tiltY = (1 - hookPush) * 7;
  const tiltX = (1 - hookPush) * 2.5;

  const translateY =
    layout.phoneY +
    (1 - hookPush) * 26 +
    notifyPush * 40 -
    alertPull * 40;

  return { scale, tiltY, tiltX, translateY, translateX: layout.phoneX };
};

export const ActorAlertFilm: React.FC<{
  layout?: LayoutName;
  /**
   * Silences the track for the sound-off cut. The visuals are unchanged, so
   * the muted export tells the same story through its captions alone.
   */
  muted?: boolean;
  /**
   * Drops the burned-in copy, leaving a clean plate for platforms that add
   * their own captions from the sidecar SRT, or for re-versioning into
   * another language. Defaults on, because the burned-in copy is what makes
   * the sound-off cut work.
   */
  captions?: boolean;
}> = ({ layout = "vertical", muted = false, captions = true }) => {
  const frame = useCurrentFrame();
  const L = LAYOUTS[layout];
  const screens = useScreenStack(frame);
  const cam = useCamera(frame, L);

  // Scene 1 keeps the device dim until the story proper starts.
  const hookDim = 0.55 * (1 - progress(frame, { from: T.s2 - 30, duration: 34 }));
  // Scene 3 darkens the room as the phone hands over to the lock screen.
  const handoffDim =
    0.5 *
    progress(frame, { from: T.s4 - 16, duration: 18 }) *
    (1 - progress(frame, { from: T.s4, duration: 22 }));

  // The brand card replaces the device entirely.
  const brandIn = progress(frame, { from: T.s7, duration: 20 });

  // Scrolls
  const profileScroll = animate(frame, {
    from: T.s2 + 20,
    duration: 46,
    to: [0, 18],
  });
  const chatScroll = animate(frame, {
    from: T.alertScrollStart,
    duration: 120,
    to: [0, 150],
  });
  const filmScroll = animate(frame, {
    from: T.filmPageScroll,
    duration: 74,
    to: [0, FILM_PAGE_SCROLL],
  });

  return (
    <AbsoluteFill style={{ background: brand.black, overflow: "hidden" }}>
      {/*
        One pre-mixed track rather than per-cue <Audio> tags: the cues are
        already positioned at the exact frames in scripts/build-audio.py, so
        the mix cannot drift out of sync with the edit.
      */}
      {muted ? null : <Audio src={staticFile("assets/audio/mix-full.wav")} />}

      <Backdrop frame={frame} />

      {/* Device stage */}
      <AbsoluteFill
        style={{
          opacity: 1 - brandIn,
          perspective: 2200,
        }}
      >
        <PhoneMockup
          scale={cam.scale}
          tiltY={cam.tiltY}
          tiltX={cam.tiltX}
          translateY={cam.translateY}
          translateX={cam.translateX}
          dim={Math.max(hookDim, handoffDim)}
        >
          {/* Scene 2-3: the MuviDB profile and the opt-in sheet */}
          {screens.profile > 0.001 ? (
            <div style={{ position: "absolute", inset: 0, opacity: screens.profile }}>
              <ActorProfile
                frame={frame}
                tapAt={T.followTap}
                scrollY={profileScroll}
              />
              {frame >= T.optInAppear - 2 && frame < T.s4 - 10 ? (
                <WhatsAppOptIn
                  frame={frame}
                  appearAt={T.optInAppear}
                  typeAt={T.optInType}
                  submitAt={T.optInSubmit}
                />
              ) : null}

              {/* Taps live inside the device so they scale with it. */}
              <TouchIndicator
                frame={frame}
                at={T.followTap}
                x={164}
                y={385 - profileScroll}
              />
              <TouchIndicator
                frame={frame}
                at={T.optInSubmit}
                x={261}
                y={585}
                size={58}
              />
            </div>
          ) : null}

          {/* Scene 4: lock screen */}
          {screens.lock > 0.001 ? (
            <div style={{ position: "absolute", inset: 0, opacity: screens.lock }}>
              <LockScreen
                frame={frame}
                notifyAt={T.notifyArrive}
                tapAt={T.notifyTap}
              />
              <TouchIndicator frame={frame} at={T.notifyTap} x={195} y={318} />
            </div>
          ) : null}

          {/* Scene 5: the WhatsApp thread */}
          {screens.chat > 0.001 ? (
            <div style={{ position: "absolute", inset: 0, opacity: screens.chat }}>
              <WhatsAppMovieAlert
                frame={frame}
                bubbleAt={T.bubbleLand}
                scrollY={chatScroll}
                tapAt={T.alertLinkTap}
              />
            </div>
          ) : null}

          {/* Scene 6a: the MuviDB film page */}
          {screens.filmPage > 0.001 ? (
            <div style={{ position: "absolute", inset: 0, opacity: screens.filmPage }}>
              <FilmPage
                frame={frame}
                arriveAt={T.filmPageArrive}
                tapAt={T.netflixTap}
                scrollY={filmScroll}
              />
              <TouchIndicator
                frame={frame}
                at={T.netflixTap}
                x={WATCH_BUTTON.centerX}
                y={WATCH_BUTTON.top + WATCH_BUTTON.height / 2 - filmScroll}
                size={58}
              />
            </div>
          ) : null}

          {/* Scene 6b: Netflix */}
          {screens.netflix > 0.001 ? (
            <div style={{ position: "absolute", inset: 0, opacity: screens.netflix }}>
              <NetflixDestination frame={frame} arriveAt={T.netflixArrive} />
            </div>
          ) : null}
        </PhoneMockup>
      </AbsoluteFill>

      {/* Captions */}
      {captions ? <Captions frame={frame} layout={layout} /> : null}

      {/* Scene 7 */}
      {brandIn > 0.001 ? (
        <AbsoluteFill style={{ opacity: brandIn }}>
          <BrandReveal frame={frame} startAt={T.s7} scale={L.brandScale} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Ambient background. A very dark, slowly drifting wash of the film's own key
 * art, so the frame around the phone is cinematic rather than flat.
 */
const Backdrop: React.FC<{ frame: number }> = ({ frame }) => {
  const drift = (frame / T.end) * 40;
  const fade = 1 - progress(frame, { from: T.s7 - 4, duration: 20 });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Img
        src={film.poster}
        style={{
          position: "absolute",
          inset: -120,
          width: "calc(100% + 240px)",
          height: "calc(100% + 240px)",
          objectFit: "cover",
          filter: "blur(64px) saturate(0.7) brightness(0.3)",
          transform: `scale(1.08) translateY(${-drift}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.78) 58%, rgba(0,0,0,0.95) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ frame: number; layout: LayoutName }> = ({
  frame,
  layout,
}) => {
  const L = LAYOUTS[layout];
  const c = L.caption;

  return (
    <>
      {/* Scene 1 - the hook. Big display type, centred over the dim phone. */}
      <Caption
        frame={frame}
        text={script.hook1}
        from={T.hook1In}
        hold={34}
        display
        size={c.hookSize}
        top={c.hookTop}
        maxWidth={c.width}
      />
      <Caption
        frame={frame}
        text={script.hook2}
        from={T.hook2In}
        hold={30}
        display
        size={c.hookSize}
        color={brand.orange}
        top={c.hookTop}
        maxWidth={c.width}
      />

      <Caption
        frame={frame}
        text={script.discover}
        from={T.discoverCaption}
        hold={52}
        size={c.bodySize}
        {...c.slot}
        maxWidth={c.width}
      />

      <Caption
        frame={frame}
        text={script.follow1}
        from={T.follow1Caption}
        hold={24}
        size={c.bodySize}
        {...c.slot}
        maxWidth={c.width}
      />
      <Caption
        frame={frame}
        text={script.follow2}
        from={T.follow2Caption}
        hold={28}
        size={c.bodySize}
        {...c.slot}
        maxWidth={c.width}
      />

      <Caption
        frame={frame}
        text={script.notify}
        from={T.notifyCaption}
        hold={40}
        size={c.bodySize}
        {...c.slot}
        maxWidth={c.width}
      />

      <Caption
        frame={frame}
        text={script.alert}
        from={T.alertCaption}
        hold={56}
        size={c.bodySize}
        {...c.slot}
        maxWidth={c.width}
      />

      <Caption
        frame={frame}
        text={script.watch}
        from={T.watchCaption}
        hold={62}
        size={c.bodySize}
        {...c.slot}
        maxWidth={c.width}
      />
    </>
  );
};
