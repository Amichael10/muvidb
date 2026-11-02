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

## Audio

`scripts/build-audio.py` synthesises the whole track from scratch — UI taps, a
follow confirmation, the notification bell, and an ambient bed — and writes a
pre-mixed `public/assets/audio/mix-full.wav`. The composition plays that one
file, so cues can never drift out of sync with the edit.

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

**The music bed is a scratch bed, not a scored track.** It is a competent
ambient pad and it is mixed low, but a brand launch film deserves a real
cue. To replace it, drop a licensed track at
`public/assets/audio/music-bed.wav` and re-run the mix, or point the `<Audio>`
tag in `ActorAlertFilm.tsx` straight at it.

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

Not recorded. The script is in §7 of the brief and is already timed in
`out/muvidb-actor-alert-subtitles.srt`, so a VO can be cut straight to it.
The film is built to work silent — every beat is carried by on-screen copy —
which is why the muted cut is a first-class deliverable rather than a
fallback.

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
  lib/ease.ts                the house easing curve and tap/caption helpers
  lib/fonts.ts               Bebas Neue, Barlow Condensed, Host Grotesk
  components/
    PhoneMockup.tsx          device shell, status bar, home indicator
    MuviDBChrome.tsx         top bar, bottom nav, logo mark
    ActorProfile.tsx         the person page
    FollowButton.tsx         Follow -> Following
    WhatsAppOptIn.tsx        the real opt-in sheet
    LockScreen.tsx           lock screen + notification banner
    WhatsAppMovieAlert.tsx   the thread and the template message
    StreamingDestination.tsx film page (captured) -> Netflix (drawn)
    BrandReveal.tsx          closing card
    Caption.tsx              on-screen copy, touch ring, preview badge
  compositions/
    ActorAlertFilm.tsx       the master timeline — all beats live in `T`
    layout.ts                per-aspect-ratio adaptation
    CoverThumbnail.tsx       the Reels/TikTok cover
scripts/
  capture-alert-ui.cjs       re-capture the MuviDB screens
  capture-film-page-full.cjs re-capture the scrollable film page
  build-audio.py             synthesise the track
  build-subtitles.py         write the SRTs
```
