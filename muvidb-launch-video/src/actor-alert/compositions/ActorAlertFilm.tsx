import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
} from "remotion";
import { brand } from "../styles/brand";
import { script } from "../data/demoContent";
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
import { TouchIndicator } from "../components/Caption";
import { KineticText } from "../components/KineticText";
import { TapShockwave } from "../components/effects/TapShockwave";
import { CinematicStage, LensFringe } from "../components/CinematicStage";
import { ScaleThrough } from "../components/effects/ScaleThrough";
import { LightSweep } from "../components/effects/LightSweep";
import { sp, curve, momentumScroll, pulse } from "../lib/motion";
import { LAYOUTS, type LayoutName } from "./layout";

/**
 * The master timeline.
 *
 * MOTION RULE: a screen change is never a cross-dissolve. Every cut is caused
 * by something the user did, so each transition is anchored to that action --
 * a tap grows a liquid blob that the next screen is revealed inside, a link
 * pushes the next view in over the old one, a phone being set down ripples
 * into the lock screen. There is never a frame where two screens are both
 * half-transparent, which is what made the first pass read as a slideshow.
 *
 * Everything is a pure function of the frame. GSAP contributes easing curves
 * only (see lib/motion.ts) -- no GSAP timeline ever runs, because an
 * rAF-driven timeline would render differently on every pass.
 */
export const FPS = 30;

export const T = {
  // Scene 1 - the hook
  s1: 0,
  hook1In: 6,
  hook2In: 62,
  // Scene 2 - discover an actor
  s2: 120,
  discoverCaption: 130,
  followTap: 212,
  // Scene 3 - following confirmed, and the real opt-in step
  s3: 270,
  follow1Caption: 276,
  follow2Caption: 328,
  optInAppear: 292,
  optInType: 312,
  optInSubmit: 356,
  // Scene 4 - the notification arrives
  s4: 390,
  joinA: 372,
  notifyCaption: 402,
  notifyArrive: 468,
  notifyTap: 546,
  // Scene 5 - the WhatsApp alert
  s5: 570,
  joinB: 552,
  bubbleLand: 586,
  alertCaption: 606,
  alertScrollStart: 596,
  alertLinkTap: 838,
  // Scene 6 - the handoff to the streaming destination
  s6: 870,
  joinC: 844,
  watchCaption: 886,
  filmPageScroll: 908,
  netflixTap: 990,
  joinD: 995,
  // Scene 7 - brand reveal
  s7: 1056,
  end: 1260,
} as const;

export const DURATION_IN_FRAMES = T.end;

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
   * another language.
   */
  captions?: boolean;
}> = ({ layout = "vertical", muted = false, captions = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = LAYOUTS[layout];

  // ---------------------------------------------------------------- camera
  // Scene framing is spring-driven, so the device arrives with weight rather
  // than gliding on a bezier.
  const intro = sp(frame, fps, T.s1 + 2, "heavy", 118);
  const toProfile = sp(frame, fps, T.s2 - 14, "snappy", 40);
  const toLock = sp(frame, fps, T.joinA - 6, "heavy", 44);
  const toChat = sp(frame, fps, T.joinB, "snappy", 38);
  const intoNotify = sp(frame, fps, T.notifyArrive - 4, "pop", 46);
  const toFilm = sp(frame, fps, T.joinC, "snappy", 34);

  const scale =
    L.phoneScale *
    (0.74 + intro * 0.26) * // settles in from wide
    (1 + toProfile * 0.06) *
    (1 + intoNotify * 0.09 - toChat * 0.09) *
    (1 - toFilm * 0.02);

  // One deliberate tilt on the hook, levelling out as the story starts.
  const tiltY = (1 - intro) * 13 - toLock * 1.5;
  const tiltX = (1 - intro) * 5;

  const translateY =
    L.phoneY +
    (1 - intro) * 70 +
    intoNotify * 34 -
    toChat * 34;
  const translateX = L.phoneX + (1 - intro) * -26;

  // A slow continuous drift stops the device ever sitting perfectly still.
  const breathe = Math.sin(frame / 95) * 4;

  // -------------------------------------------------------------- scrolling
  const profileScroll = momentumScroll(frame, fps, T.s2 + 22, 18, 44);
  const chatScroll = momentumScroll(frame, fps, T.alertScrollStart, 150, 86);
  const filmScroll = momentumScroll(
    frame,
    fps,
    T.filmPageScroll,
    FILM_PAGE_SCROLL,
    70,
  );

  // ------------------------------------------------------- immersion
  // During the two hero beats the camera flies into the display: the device
  // scales up past the frame and the bezel dissolves, so the UI becomes the
  // world rather than something being held at arm's length. It comes back
  // for the top and tail, which is what keeps it reading as a product demo.
  const immerse = Math.max(
    pulse(frame, T.joinB + 10, 290, 0.22),
    pulse(frame, T.joinD + 6, 150, 0.3),
  );
  const bezelFade = 1 - immerse * 0.22;

  // How much light the screen is throwing into the room. It lifts when the
  // camera dives into the display and when the alert lands, so the whole
  // frame breathes with the story instead of the phone brightening alone.
  const screenGlow = Math.min(
    1,
    0.55 + immerse * 0.35 + pulse(frame, T.notifyArrive, 90, 0.3),
  );

  // The brand card replaces the device entirely.
  const brandIn = curve(frame, T.s7, 22, "expoInOut");

  // The device sits back in shadow under the hook and comes up as the story
  // starts, so the opening copy owns the frame.
  const hookDim = 0.62 * (1 - curve(frame, T.s2 - 34, 40, "power2Out"));

  // Glass catches the light when something lands on screen.
  const sweep = Math.max(
    pulse(frame, T.followTap + 2, 30),
    pulse(frame, T.notifyArrive, 34),
    pulse(frame, T.bubbleLand + 2, 32),
  );

  // ----------------------------------------------------------------- joins
  // Each join is a match cut: the camera pushes into one element until it
  // fills the frame, then pulls back out of a matching element in the next
  // scene. No screen is ever "replaced" -- the move is continuous.
  const chatPosterY = 254 + (150 - chatScroll);
  const watchBtnY = WATCH_BUTTON.top + WATCH_BUTTON.height / 2 - filmScroll;

  const profileScene = (
    <>
      <ActorProfile frame={frame} tapAt={T.followTap} scrollY={profileScroll} />
      {frame >= T.optInAppear - 2 ? (
        <WhatsAppOptIn
          frame={frame}
          appearAt={T.optInAppear}
          typeAt={T.optInType}
          submitAt={T.optInSubmit}
        />
      ) : null}
      <TouchIndicator
        frame={frame}
        at={T.followTap}
        x={164}
        y={385 - profileScroll}
      />
      <TapShockwave
        frame={frame}
        at={T.followTap}
        x={164}
        y={385 - profileScroll}
        color={brand.orange}
        maxRadius={300}
      />
      <TouchIndicator frame={frame} at={T.optInSubmit} x={261} y={585} size={58} />
      <TapShockwave
        frame={frame}
        at={T.optInSubmit}
        x={261}
        y={585}
        color={brand.whatsapp.green}
        maxRadius={220}
      />
    </>
  );

  const lockScene = (
    <>
      <LockScreen frame={frame} notifyAt={T.notifyArrive} tapAt={T.notifyTap} />
      <TouchIndicator frame={frame} at={T.notifyTap} x={195} y={318} />
      <TapShockwave
        frame={frame}
        at={T.notifyTap}
        x={195}
        y={318}
        color="rgba(255,255,255,0.9)"
        maxRadius={300}
      />
    </>
  );

  const chatScene = (
    <WhatsAppMovieAlert
      frame={frame}
      bubbleAt={T.bubbleLand}
      scrollY={chatScroll}
      tapAt={T.alertLinkTap}
    />
  );

  const filmScene = (
    <>
      <FilmPage
        frame={frame}
        arriveAt={T.joinC}
        tapAt={T.netflixTap}
        scrollY={filmScroll}
      />
      <TouchIndicator
        frame={frame}
        at={T.netflixTap}
        x={WATCH_BUTTON.centerX}
        y={watchBtnY}
        size={58}
      />
      <TapShockwave
        frame={frame}
        at={T.netflixTap}
        x={WATCH_BUTTON.centerX}
        y={watchBtnY}
        color={brand.netflixRed}
        maxRadius={320}
      />
    </>
  );

  const netflixScene = <NetflixDestination frame={frame} arriveAt={T.joinD} />;

  /** The join the camera is currently flying through, if any. */
  const screen = (() => {
    // A: profile + opt-in -> through darkness -> lock screen.
    // The screen sleeping and waking is the story beat here, so the join
    // bleeds through black rather than a colour.
    if (frame < T.joinA + 24) {
      if (frame >= T.joinA - 20) {
        return (
          <ScaleThrough
            frame={frame}
            at={T.joinA}
            inFrames={20}
            outFrames={24}
            color="#000000"
            outgoing={profileScene}
            incoming={lockScene}
            from={{ x: 195, y: 430, zoom: 5.5 }}
            to={{ x: 195, y: 420, zoom: 1.7 }}
          />
        );
      }
      return profileScene;
    }

    // B: the notification banner -> the WhatsApp thread it opens.
    if (frame < T.joinB + 24) {
      if (frame >= T.joinB - 20) {
        return (
          <ScaleThrough
            frame={frame}
            at={T.joinB}
            inFrames={20}
            outFrames={24}
            color={brand.whatsapp.headerDark}
            outgoing={lockScene}
            incoming={chatScene}
            from={{ x: 195, y: 318, zoom: 5.5 }}
            to={{ x: 195, y: 400, zoom: 4 }}
          />
        );
      }
      return lockScene;
    }

    // C: the poster inside the message -> the same poster on the film page.
    // The matched element is literally the same image, so the camera appears
    // to fly straight through it.
    if (frame < T.joinC + 26) {
      if (frame >= T.joinC - 22) {
        return (
          <ScaleThrough
            frame={frame}
            at={T.joinC}
            inFrames={22}
            outFrames={26}
            color="#2A1008"
            outgoing={chatScene}
            incoming={filmScene}
            from={{ x: 168, y: chatPosterY, zoom: 6.5 }}
            to={{ x: 76, y: 346, zoom: 6 }}
          />
        );
      }
      return chatScene;
    }

    // D: through the red watch button into Netflix.
    if (frame < T.joinD + 26) {
      if (frame >= T.joinD - 20) {
        return (
          <ScaleThrough
            frame={frame}
            at={T.joinD}
            inFrames={20}
            outFrames={26}
            color={brand.netflixRed}
            outgoing={filmScene}
            incoming={netflixScene}
            from={{ x: WATCH_BUTTON.centerX, y: watchBtnY, zoom: 11 }}
            to={{ x: 195, y: 300, zoom: 4.5 }}
          />
        );
      }
      return filmScene;
    }

    return netflixScene;
  })();

  return (
    <AbsoluteFill style={{ background: "#04060A", overflow: "hidden" }}>
      {muted ? null : <Audio src={staticFile("assets/audio/mix-full.wav")} />}

      <CinematicStage
        frame={frame}
        fade={1 - brandIn}
        screenGlow={screenGlow}
        deviceY={translateY + breathe}
        deviceScale={scale}
      />

      <AbsoluteFill style={{ opacity: 1 - brandIn, perspective: 1900 }}>
        <PhoneMockup
          scale={scale}
          tiltY={tiltY}
          tiltX={tiltX}
          translateY={translateY + breathe}
          translateX={translateX}
          dim={hookDim}
          bezel={bezelFade}
        >
          {screen}
          <LightSweep progress={sweep} intensity={0.42} />
        </PhoneMockup>
      </AbsoluteFill>

      {brandIn < 0.5 ? <LensFringe /> : null}

      {captions ? <Captions frame={frame} layout={layout} /> : null}

      {brandIn > 0.001 ? (
        <AbsoluteFill style={{ opacity: brandIn }}>
          <BrandReveal frame={frame} startAt={T.s7} scale={L.brandScale} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ frame: number; layout: LayoutName }> = ({
  frame,
  layout,
}) => {
  const c = LAYOUTS[layout].caption;
  const slot = { ...c.slot };

  return (
    <>
      {/* The hook gets the heaviest treatment in the film. */}
      <KineticText
        frame={frame}
        text={script.hook1}
        from={T.hook1In}
        hold={30}
        display
        variant="slice"
        size={c.hookSize}
        top={c.hookTop}
        maxWidth={c.width}
        spread={14}
      />
      <KineticText
        frame={frame}
        text={script.hook2}
        from={T.hook2In}
        hold={26}
        display
        variant="mask"
        size={c.hookSize}
        color={brand.orange}
        top={c.hookTop}
        maxWidth={c.width}
        spread={12}
      />

      <KineticText
        frame={frame}
        text={script.discover}
        from={T.discoverCaption}
        hold={46}
        variant="rise"
        size={c.bodySize}
        maxWidth={c.width}
        {...slot}
      />

      <KineticText
        frame={frame}
        text={script.follow1}
        from={T.follow1Caption}
        hold={18}
        variant="scale"
        size={c.bodySize}
        maxWidth={c.width}
        {...slot}
      />
      <KineticText
        frame={frame}
        text={script.follow2}
        from={T.follow2Caption}
        hold={22}
        variant="rise"
        size={c.bodySize}
        maxWidth={c.width}
        {...slot}
      />

      <KineticText
        frame={frame}
        text={script.notify}
        from={T.notifyCaption}
        hold={34}
        variant="mask"
        size={c.bodySize}
        maxWidth={c.width}
        {...slot}
      />

      <KineticText
        frame={frame}
        text={script.alert}
        from={T.alertCaption}
        hold={50}
        variant="rise"
        size={c.bodySize}
        maxWidth={c.width}
        {...slot}
      />

      <KineticText
        frame={frame}
        text={script.watch}
        from={T.watchCaption}
        hold={56}
        variant="slice"
        size={c.bodySize}
        maxWidth={c.width}
        {...slot}
      />
    </>
  );
};
