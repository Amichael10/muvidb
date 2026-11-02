"""
Generates the subtitle files from the same frame numbers the film animates to.

Two outputs, because platforms want different things:

  muvidb-actor-alert-subtitles.srt
      Full narration track. Matches the optional voiceover script, so it also
      works as a transcript when the VO is dubbed in later.

  muvidb-actor-alert-captions.srt
      Only the on-screen copy, for platform-native caption upload where
      duplicating text that is already burned into the frame would clutter
      the screen.

Usage: python scripts/build-subtitles.py
"""

from __future__ import annotations

import os

FPS = 30
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "out")

# Frame numbers mirror T in src/actor-alert/compositions/ActorAlertFilm.tsx.
# (start_frame, end_frame, text)
NARRATION = [
    (10, 112, "What if you never missed a new movie\nfrom your favourite actor?"),
    (126, 262, "On MuviDB, just find the actor you love\nand hit Follow."),
    (276, 384, "Add your WhatsApp number once,\nand that's it."),
    (400, 560, "When a new movie featuring them\nbecomes available, you get an alert\nstraight to WhatsApp."),
    (600, 830, "With the poster, the title,\nand where to watch it."),
    (880, 1046, "One tap takes you to the film page —\nand on to Netflix."),
    (1068, 1156, "MuviDB. Follow the stars."),
    (1158, 1246, "Never miss their stories."),
]

# The captions actually burned into the frame, from script in demoContent.ts.
ON_SCREEN = [
    (8, 58, "Your favourite actor has a new movie."),
    (64, 110, "Wouldn't you want to know?"),
    (132, 200, "Find your favourite actor."),
    (276, 316, "Follow once."),
    (330, 374, "We'll keep you updated."),
    (402, 458, "And when they're in something new…"),
    (606, 678, "Everything you need. In one message."),
    (886, 964, "One tap. You're watching."),
    (1084, 1156, "Follow the stars. Never miss their stories."),
    (1158, 1252, "Start following at muvidb.com"),
]


def stamp(frame: int) -> str:
    total_ms = round(frame / FPS * 1000)
    h, rem = divmod(total_ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build(cues: list[tuple[int, int, str]]) -> str:
    out = []
    for i, (start, end, text) in enumerate(cues, start=1):
        out.append(f"{i}\n{stamp(start)} --> {stamp(end)}\n{text}\n")
    return "\n".join(out)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    targets = {
        "muvidb-actor-alert-subtitles.srt": NARRATION,
        "muvidb-actor-alert-captions.srt": ON_SCREEN,
    }
    for name, cues in targets.items():
        path = os.path.join(OUT_DIR, name)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(build(cues))
        print(f"wrote {name} ({len(cues)} cues)")


if __name__ == "__main__":
    main()
