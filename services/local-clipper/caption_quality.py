"""Decide whether a YouTube caption track is actually usable dialogue.

YouTube will happily auto-caption a Yoruba film as English. The result passes
every existence check — a track is present, it has thousands of characters, and
`transcript_source` reads "captions" — while containing almost no real speech.
Measured on *Omije* (Yoruba, 70 min):

    [music] Hey. [music] >> ... Very pushy ball. [music] >> Metro.

That is 7.1 real words a minute against 128 `[music]` markers. *Hollow Vows*
(English, 144 min) runs 12.9 words a minute with 46 markers — and the gap is far
wider on the marker-to-word ratio: 0.26 versus 0.025, a factor of ten.

Catching this matters twice over: the clip picker stops being handed noise, and
the local transcription fallback finally gets a chance to run on the films that
need it, since it only triggers when no usable captions exist.
"""

from __future__ import annotations

import re

# The marker ratio does the real work: measured 0.26 on Omije against 0.025 on
# Hollow Vows, a factor of ten. Words-per-minute is only a floor for a near
# silent track — it does NOT separate these two films (11.2 against 18.0), so
# leaning on it would reject quiet but perfectly good dialogue.
MIN_WORDS_PER_MINUTE = 6.0
MAX_MARKER_RATIO = 0.12

_TIMESTAMP = re.compile(r"\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]")
_MARKER = re.compile(r"\[[a-z _-]{2,20}\]", re.IGNORECASE)
_SPEAKER_CHANGE = re.compile(r">>")
_REAL_WORD = re.compile(r"^[A-Za-z][A-Za-z']{1,}$")


def _timestamp_seconds(match: re.Match) -> float:
    first, second, third = match.group(1), match.group(2), match.group(3)
    if third is not None:
        return int(first) * 3600 + int(second) * 60 + int(third)
    return int(first) * 60 + int(second)


def assess_captions(transcript: str, duration_seconds: float = 0.0) -> dict:
    """Report how much real speech a caption track carries, and whether to trust it.

    The rate is measured across the span the timestamps actually cover, not the
    film's full length, so a transcript truncated at the character cap is not
    unfairly penalised.
    """
    text = transcript or ""
    if not text.strip():
        return {
            "usable": False,
            "reason": "empty",
            "real_words": 0,
            "markers": 0,
            "words_per_minute": 0.0,
            "marker_ratio": 0.0,
            "covered_minutes": 0.0,
        }

    stamps = [_timestamp_seconds(m) for m in _TIMESTAMP.finditer(text)]
    if len(stamps) >= 2:
        covered = max(stamps) - min(stamps)
    else:
        covered = float(duration_seconds or 0)
    covered_minutes = max(1.0, covered / 60.0)

    # Only sound markers count as noise. `>>` is a speaker-change tag that
    # appears just as often in good tracks — counting it rejected a perfectly
    # usable English film at 0.16 markers per word.
    markers = len(_MARKER.findall(text))
    speaker_changes = len(_SPEAKER_CHANGE.findall(text))
    # Strip timestamps, bracketed markers and speaker tags before counting
    # words, so `[music]` never inflates the speech count.
    stripped = _SPEAKER_CHANGE.sub(" ", _MARKER.sub(" ", _TIMESTAMP.sub(" ", text)))
    real_words = sum(1 for token in stripped.split() if _REAL_WORD.match(token.strip(".,!?;:\"'")))

    words_per_minute = real_words / covered_minutes
    marker_ratio = markers / max(1, real_words)

    reasons = []
    if words_per_minute < MIN_WORDS_PER_MINUTE:
        reasons.append(f"only {words_per_minute:.1f} words/min")
    if marker_ratio > MAX_MARKER_RATIO:
        reasons.append(f"{marker_ratio:.2f} markers per word")

    return {
        "usable": not reasons,
        "reason": "; ".join(reasons) if reasons else "ok",
        "real_words": real_words,
        "markers": markers,
        "speaker_changes": speaker_changes,
        "words_per_minute": round(words_per_minute, 2),
        "marker_ratio": round(marker_ratio, 4),
        "covered_minutes": round(covered_minutes, 1),
    }
