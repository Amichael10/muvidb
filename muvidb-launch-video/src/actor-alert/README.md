# MuviDB — "Follow your favourite actor" demo film

A 42-second product demo of MuviDB's WhatsApp actor-alert feature, built in
Remotion so every frame is deterministic and the source stays editable.

The film shows one story: find an actor → follow them → give WhatsApp a number
→ receive the alert when they turn up in something watchable → tap through to
where it is legally streaming.

---

## Rendering

From `muvidb-launch-video/`:

```bash
npm install
```

```bash
npx remotion studio
```

Compositions:

| id | output | size |
|---|---|---|
| `ActorAlertVertical` | `muvidb-actor-alert-vertical.mp4` | 1080×1920 |
| `ActorAlertLandscape` | `muvidb-actor-alert-landscape.mp4` | 1920×1080 |
| `ActorAlertSquare` | `muvidb-actor-alert-square.mp4` | 1080×1080 |
| `ActorAlertVerticalMuted` | `muvidb-actor-alert-muted.mp4` | 1080×1920, no audio |
| `ActorAlertVerticalClean` | `muvidb-actor-alert-vertical-clean.mp4` | 1080×1920, no burned-in copy |
| `ActorAlertCover` | `muvidb-actor-alert-cover.png` | 1080×1920 still |

```bash
npx remotion render ActorAlertVertical out/muvidb-actor-alert-vertical.mp4 --codec=h264
```

Every video renders the **same** `<ActorAlertFilm/>`, differing only by
`layout`, `muted` and `captions` props. They are adaptations, not crops: the landscape cut moves the
phone off-centre and gives the copy its own column. Retiming a beat in
`compositions/ActorAlertFilm.tsx` changes every cut at once.

---

## Swapping the content

Everything the film asserts about a real person, a real film and a real place
to watch it lives in **`data/demoContent.ts`**. Change it there and no
animation needs touching.

```ts
export const actor: DemoActor = { name: "Femi Adebayo", ... };
export const film: DemoFilm  = { title: "House of Ga'a", ... };
export const destination: DemoDestination = { platform: "Netflix", ... };
```

### Before you swap, verify — do not skip this

The video makes factual claims on MuviDB's behalf. Each one has to hold up.

1. **The actor is really in the film.** Check the credits table, not the
   film's own marketing:

   ```bash
   npm run db -- credits --where "person_id=eq.<PERSON_ID>" --select "role,character_name,films(title,slug)"
   ```

2. **The watch URL resolves, and in the right region.**

   ```bash
   curl -sL -o /dev/null -w "%{http_code} -> %{url_effective}\n" "<WATCH_URL>"
   ```

   A 200 that redirects to `/ng/` confirms it is available in Nigeria.

3. **The "watch" link is the film, not a trailer or a recap.** This one bites.
   An earlier candidate for this video had a perfectly valid-looking
   `youtube_watch_url` that turned out to be a *recap* video on an aggregator
   channel. Check the title before trusting the link:

   ```bash
   curl -s "https://www.youtube.com/oembed?url=<URL>&format=json"
   ```

4. **The poster is a real portrait poster.** Many YouTube-sourced rows carry
   an `i.ytimg.com/.../hqdefault.jpg` thumbnail, which is a 480×360 landscape
   video still, not key art. It will look wrong as the message's anchor.

5. **Replace the film-page capture.** Scene 6 uses a real screenshot of the
   MuviDB film page:

   ```bash
   node scripts/capture-film-page-full.cjs
   ```

   Point the slug in that script at the new film, then re-measure
   `WATCH_BUTTON` in `components/StreamingDestination.tsx` so the tap lands on
   the new page's watch button.

---

## What is real, and what is staged

This matters for sign-off, so it is spelled out rather than implied.

**Real, and verified against production:**

- The MuviDB profile and film screens reproduce the live mobile UI. Scene 6
  is an actual screenshot of `muvidb.com/film/house-of-gaa-3`.
- The Follow interaction, and the WhatsApp opt-in sheet that follows it, are
  the shipped flow (`src/pages/PersonDetailV2.jsx` →
  `src/components/person/WhatsAppOptInModal.jsx`). Following alone does *not*
  switch WhatsApp alerts on; the user also has to save a number. The film
  shows that step rather than skipping it.
- The WhatsApp message is the shipped `movie_release_alert` template: an
  image header plus exactly four body parameters — actor, title, platform,
  film link — and one URL button
  (`api/_lib/whatsapp_movie_alerts.ts`).
- Femi Adebayo is credited as **Olukuoye** in *House of Ga'a*. The Netflix
  URL resolves 200 and redirects to the Nigerian catalogue.
- The alert pipeline is live, driven by
  `.github/workflows/whatsapp_alerts.yml`.

**Staged, and deliberately so:**

- The phone, the lock screen and the taps are a dramatisation. No real
  device was recorded.
- The phone number typed into the opt-in sheet is the app's own placeholder,
  `+234 801 234 5678`. No real number appears.
- The Netflix title page is drawn, not captured. Netflix pages are
  personalised and sign-in gated, so a screenshot would show one account's
  view and would not be ours to publish.

**Two things the storyboard asked for that the product does not do**, and
which were therefore changed rather than faked:

1. The WhatsApp button opens `muvidb.com/film/<slug>` — it does **not**
   deep-link into Netflix. Scene 6 shows the real two-step handoff: WhatsApp →
   MuviDB film page → Netflix.
2. The template has **no synopsis parameter**, so the bubble does not contain
   one. The synopsis reaches the viewer on the film page instead, where it
   genuinely lives.

If a future cut does simulate something unshipped, mark it: there is a
`<PreviewBadge/>` in `components/Caption.tsx` for exactly that.

---

## Motion

The film is **one continuous take**. There are no transitions in it at all —
no dissolves, no wipes, not even liquid ones. A wipe still reads as "screen A
is replaced by screen B", which is the thing that makes a product demo feel
like a slideshow.

Instead every join is a **scale-through match cut**
(`effects/ScaleThrough.tsx`): the camera pushes *into* one element until it
fills the frame, and pulls back out of a matching element in the next scene.
Because the same shape and colour fill the frame on both sides of the join,
there is nothing to perceive as a cut.

| Join | Flies into | Comes out of | Match |
|---|---|---|---|
| Opt-in → lock screen | The sheet | The waking screen | Black — the phone sleeping, time passing |
| Notification → WhatsApp | The banner | The thread body | Same dark chat tone |
| Message → film page | **The poster** | **The same poster** | Literally the same image file |
| Watch button → Netflix | The red button | Netflix | Netflix red |

The poster join is the one to protect if you edit anything: the matched
element is the identical asset on both sides, so the camera appears to fly
straight through it.

### Working on a join

Each join is a `from`/`to` pair of focus points in phone CSS px plus a zoom.
Two things bite:

- **Do not combine `transform-origin` with a compensating translate.** The
  origin already pins the focus point, so an offset applies it twice and the
  camera flies into empty space. `focusTransform()` keeps the origin at `0 0`
  and solves the translation directly.
- **Measure focus points, do not guess them.** The film-page poster sits at
  `(76, 346)` with a ~6x zoom; an earlier guess of `(92, 156)` pulled the
  camera out of blank chrome. Measure off
  `public/captures/alert/film-page-scroll.png`, remembering it is a 3x
  capture so divide by three.

Aim joins away from the status bar and dynamic island. Pulling out of the
chat *header* at 7x put a giant black pill on screen; aiming at the thread
body instead fixed it.

### Flying into the screen

`PhoneMockup` takes a `bezel` prop. Dropping it fades the device frame,
shadow and highlight while leaving the screen untouched, so the camera can
enter the display and the UI becomes the whole frame. The phone returns for
the opening and the brand reveal, which is what keeps it reading as a product
demo rather than an abstract animation.

### Physics

`lib/motion.ts` holds the vocabulary. Nothing eases on a plain bezier:

- `SPRINGS` — `snappy`, `pop`, `rubber`, `heavy`, `firm`, consumed through
  `sp()`. The notification banner uses `rubber` plus `squashStretch()`, so it
  falls, overshoots, compresses on impact and wobbles out.
- `momentumScroll()` — scrolls overshoot and rubber-band back, like a thumb.
- `KineticText` — words arrive on a stagger with per-word springs and a blur
  that resolves, revealed by a clipping edge rather than opacity.
- `TapShockwave` — a ring fires out of each press, so cause and effect are
  visibly linked.

### GSAP

GSAP is installed and used for **easing curves only**, via `gsap.parseEase()`,
which returns a pure `(t) => number`.

**Never put a `gsap.timeline()` in a composition.** GSAP timelines are driven
by `requestAnimationFrame`; Remotion renders frames out of order and in
parallel, so an rAF-driven timeline produces different output on every pass
and the render stops being reproducible. The same applies to `anime.js` and
any other wall-clock animation library.

---

## Audio

`scripts/build-audio.py` synthesises the whole track from scratch — UI taps, a
follow confirmation, the notification bell, and an ambient bed — and writes a
single pre-mixed `public/assets/audio/mix-full.wav`. The composition plays that
one file, so cues can never drift out of sync with the edit. The individual
cues and the bare bed are not written to disk; they are intermediates and
re-running the script regenerates them in a second.

```bash
python scripts/build-audio.py
```

The cue list at the bottom of that script mirrors the frame numbers in
`ActorAlertFilm.tsx`. Retime a beat there, re-run this, re-render.

Nothing in it imitates a real app's alert tone. WhatsApp's actual notification
sound is copyrighted and must not be used.

Cue levels are not guesswork: `BED_LEVEL` in that script sits the bed under
the interaction sounds, and the balance was checked by measuring RMS in a
0.18s window after each cue against the 0.3s before it. Every cue now lands
between 1.2x and 4.9x the surrounding bed, with the notification and the
closing chord the two loudest moments. An earlier mix had the taps at ~1.0x,
i.e. completely masked. If you retune anything here, re-measure rather than
trusting your ears on laptop speakers.

**The music bed is a stand-in, not a scored track.** It is a competent ambient
pad and it is mixed low, but a brand launch film deserves a real cue.

To swap it, drop a licensed instrumental at:

```
public/assets/audio/music-bed-licensed.wav
```

then re-run `python scripts/build-audio.py`. It is picked up automatically and
mixed under the UI cues. Any sample rate, mono or stereo, 8/16/32-bit PCM — it
is resampled and trimmed to the film's length, and warns if it is too short.

That filename is deliberately **not** one the script ever writes, so a re-run
can never overwrite your licensed track.

The brief for a generated track, if you want to commission or generate one:

> Modern cinematic technology product-demo underscore, fully instrumental.
> Starts sparse and curious: soft filtered analog synth pad, a single warm
> plucked motif, gentle sub-bass pulse, lots of space. A quiet muted kick and
> soft rim-click enter around 12s. At ~20s the energy lifts with a bright
> arpeggiated synth figure and light airy bells — hopeful, confident, still
> restrained. Final 8s resolve warmly to a soft sustained major chord with a
> slow tail. No drop, no riser, no orchestral hits. ~100 BPM, A major, clean
> and premium. Leave midrange headroom for voiceover.

### Voiceover

Generated locally with **YarnGPT2** — a Nigerian-accented English TTS model
(Apache-2.0, so commercially usable). That accent is the point: this is a
Nigerian film platform, and a neutral American voice would undercut it. The
hosted voice tools on the connected Freepik/Magnific account are also capped
on the free plan, which local generation sidesteps entirely.

```bash
python scripts/build-voiceover.py   # writes public/assets/audio/vo/line-NN.wav
python scripts/build-audio.py       # mixes them in and ducks the bed
```

Each line is generated separately and placed at the exact frame its caption
appears on, so the narration is locked to the UI rather than drifting. The
frame list in `build-voiceover.py` mirrors `NARRATION` in
`build-subtitles.py`, which mirrors `T` in `ActorAlertFilm.tsx` — change a
beat and all three need the same edit. The script prints a warning if a line
runs longer than the gap before the next one.

`build-audio.py` ducks the bed and the UI cues by 55% under speech, with a
120ms attack and 350ms release. Without that the pad sits in the same
midrange as the voice and the narration stops being intelligible on a phone
speaker.

#### Setting up the models

One-time, ~2.4 GB:

| What | From | Size |
|---|---|---|
| `models/yarngpt/YarnGPT2` | `saheedniyi/YarnGPT2` on HF | 698 MB |
| `models/yarngpt/wavtokenizer` | `novateur/WavTokenizer-medium-speech-75token` on HF | 1.75 GB |
| `models/yarngpt/yarngpt-src` | `github.com/saheedniyi02/yarngpt` | 5 MB |

The upstream model card fetches the WavTokenizer checkpoint from a Google
Drive file id. It is on Hugging Face instead, which is what the commands above
use — same file, verifiable provenance.

**Prefer a virtualenv.** Installing `outetts` globally drags in
`descript-audiotools`, which pins `protobuf<3.20`; pip will happily downgrade
protobuf system-wide and break any `grpcio`/`google-*` packages needing
>=5.26.1. That pin turns out to be over-restrictive — the WavTokenizer decoder
imports fine on protobuf 5.29, so if it has already been downgraded, just put
it back:

```bash
pip install "protobuf>=5.26.1,<6"
```

pip will warn about `descript-audiotools` and the warning can be ignored.
Isolating it avoids the whole dance:

```bash
python -m venv .venv-tts && .venv-tts/Scripts/activate
pip install torch torchaudio transformers outetts uroman inflect
```

On Windows, `outetts` fails to import because its `__init__` pulls in MeCab
(Japanese tokenisation) whose native DLL is absent. `build-voiceover.py`
installs a stub for it — the WavTokenizer decoder never calls MeCab.

Once the WAVs exist, none of this is needed again; the mix reads the files.

---

## Subtitles

```bash
python scripts/build-subtitles.py
```

- `muvidb-actor-alert-subtitles.srt` — the narration track / transcript.
- `muvidb-actor-alert-captions.srt` — only the on-screen copy, for
  platform-native captions where burned-in text is already present.

The main cuts carry the copy burned in, because that is what makes the film
work with the sound off. `ActorAlertVerticalClean` is the same edit with the
copy removed — use it when a platform renders its own captions from the SRT,
or as a plate for re-versioning into another language.

---

## Layout and safe areas

`compositions/layout.ts` holds the per-ratio spec, and `styles/brand.ts` holds
the safe-area margins. Vertical reserves 190px at the top and 380px at the
bottom so nothing essential sits under TikTok's right rail or Instagram's
bottom bar. If you move a caption, check it against those numbers.

---

## File map

```
src/actor-alert/
  data/demoContent.ts        all swappable facts — start here
  styles/brand.ts            colours, fonts, safe areas
  lib/motion.ts              springs, easing curves, momentum scroll
  lib/fonts.ts               Bebas Neue, Barlow Condensed, Host Grotesk
  components/
    PhoneMockup.tsx          device shell + `bezel` (fly-into-screen)
    MuviDBChrome.tsx         top bar, bottom nav, logo mark
    ActorProfile.tsx         the person page
    FollowButton.tsx         Follow -> Following
    WhatsAppOptIn.tsx        the real opt-in sheet
    LockScreen.tsx           lock screen + notification banner
    WhatsAppMovieAlert.tsx   the thread and the template message
    StreamingDestination.tsx film page (captured) -> Netflix (drawn)
    BrandReveal.tsx          closing card
    Caption.tsx              on-screen copy, touch ring, preview badge
    KineticText.tsx          staggered per-word text
    effects/
      ScaleThrough.tsx       the match cut — the whole transition system
      TapShockwave.tsx       ring fired by a press
      LightSweep.tsx         specular sweep across the glass
  compositions/
    ActorAlertFilm.tsx       the master timeline — beats live in `T`
    layout.ts                per-aspect-ratio adaptation
    CoverThumbnail.tsx       the Reels/TikTok cover
scripts/
  capture-alert-ui.cjs       re-capture the MuviDB screens
  capture-film-page-full.cjs re-capture the scrollable film page
  build-audio.py             synthesise the track
  build-subtitles.py         write the SRTs
public/
  assets/audio/              mix-full.wav (played) + bed and cues
  assets/posters|actors/     the verified poster and actor photo
  captures/alert/            actor-profile-top.png (design reference)
                             film-page-scroll.png (rendered in Scene 6)
```
