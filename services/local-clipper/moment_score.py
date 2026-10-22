"""Find the dramatic moments in a film without transcribing it or calling an API.

Transcription is not an option for much of the catalogue: Whisper cannot handle
Yoruba, and YouTube's auto-captions for those films are noise. Sending whole
films to Gemini is not an option either, on free keys with rotating quota.

What is left works on any language, costs nothing, and runs locally:

* **Loudness.** Nollywood drama peaks when people raise their voices. A single
  ffmpeg pass reports RMS per 10s block for a 70-minute film in about 20
  seconds.
* **Speech.** Silero VAD (already installed alongside Whisper) separates
  dialogue from music and effects without transcribing a word, so a loud
  soundtrack cannot masquerade as an argument.
* **Music markers.** Even a caption track rejected as unusable dialogue is still
  a free map of where music plays rather than people talking.

Scoring runs in two stages so the expensive part stays small: loudness over the
whole film, then VAD on a shortlist only.
"""

from __future__ import annotations

import re
import shutil
import statistics
import subprocess
from pathlib import Path

DEFAULT_BLOCK_SECONDS = 10.0
DEFAULT_CLIP_SECONDS = 45.0
DEFAULT_STEP_SECONDS = 10.0
SHORTLIST_SIZE = 8

_RMS_LINE = re.compile(r"pts_time:([0-9.]+)|RMS_level=(-?[0-9.]+|-?inf)")


def parse_rms_scan(output: str) -> list[tuple[float, float]]:
    """Turn ffmpeg's ametadata print into [(seconds, dB)] pairs.

    Blocks reporting -inf are silence; they are kept as a very low value so a
    silent stretch is ranked badly rather than dropped and skipped over.
    """
    series: list[tuple[float, float]] = []
    pending_time: float | None = None
    for line in output.splitlines():
        if "pts_time:" in line:
            match = re.search(r"pts_time:([0-9.]+)", line)
            if match:
                pending_time = float(match.group(1))
        elif "RMS_level=" in line and pending_time is not None:
            raw = line.split("RMS_level=", 1)[1].strip()
            value = -120.0 if raw.lstrip("-").startswith("inf") else float(raw)
            series.append((pending_time, value))
            pending_time = None
    return series


def scan_loudness(audio_path: Path, block_seconds: float = DEFAULT_BLOCK_SECONDS) -> list[tuple[float, float]]:
    """One ffmpeg pass over the whole file, RMS per block."""
    if not shutil.which("ffmpeg"):
        print("[Clipper] Cannot scan loudness: ffmpeg is not on PATH.")
        return []
    samples = int(16000 * block_seconds)
    command = [
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(audio_path),
        "-af", f"aresample=16000,asetnsamples={samples},astats=metadata=1:reset=1,"
               f"ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
        "-f", "null", "-",
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0 and not result.stdout:
        detail = (result.stderr or "").strip().splitlines()
        print(f"[Clipper] Loudness scan failed: {detail[-1] if detail else result.returncode}")
        return []
    return parse_rms_scan(result.stdout)


def music_seconds_from_captions(transcript: str) -> list[float]:
    """Timestamps where a caption track marks music rather than speech.

    Useful even when the track was rejected as dialogue — the markers are
    still a reliable map of the soundtrack.
    """
    seconds: list[float] = []
    for match in re.finditer(r"\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*\[(?:music|applause)\]", transcript or "", re.IGNORECASE):
        first, second, third = match.group(1), match.group(2), match.group(3)
        seconds.append(int(first) * 3600 + int(second) * 60 + int(third) if third
                       else int(first) * 60 + int(second))
    return seconds


def _z_scores(values: list[float]) -> list[float]:
    if len(values) < 2:
        return [0.0] * len(values)
    mean = statistics.fmean(values)
    spread = statistics.pstdev(values) or 1.0
    return [(v - mean) / spread for v in values]


def rank_moments(
    series: list[tuple[float, float]],
    clip_seconds: float = DEFAULT_CLIP_SECONDS,
    step_seconds: float = DEFAULT_STEP_SECONDS,
    min_start: float | None = None,
    max_end: float | None = None,
    music_seconds: list[float] | None = None,
    duration: float | None = None,
) -> list[dict]:
    """Rank candidate windows by how much they sound like a dramatic scene.

    Pure: give it a loudness series and it ranks, so the weighting is testable
    without touching ffmpeg or a video file.
    """
    if not series:
        return []

    total = duration or series[-1][0] + DEFAULT_BLOCK_SECONDS
    if min_start is None:
        min_start = max(300.0, total * 0.15) if total >= 1200 else 0.0
    if max_end is None:
        max_end = total * 0.88 if total >= 1200 else total
    if max_end - min_start < clip_seconds:
        min_start, max_end = 0.0, total

    music = sorted(music_seconds or [])

    candidates: list[dict] = []
    start = min_start
    while start + clip_seconds <= max_end:
        end = start + clip_seconds
        inside = [db for at, db in series if start <= at < end]
        if inside:
            music_hits = sum(1 for m in music if start <= m < end)
            candidates.append({
                "start_time": round(start, 2),
                "end_time": round(end, 2),
                "mean_db": round(statistics.fmean(inside), 2),
                "peak_db": round(max(inside), 2),
                # A scene that swells carries more drama than a flat loud one.
                "dynamic_range": round(max(inside) - min(inside), 2),
                "music_markers": music_hits,
            })
        start += step_seconds

    if not candidates:
        return []

    mean_z = _z_scores([c["mean_db"] for c in candidates])
    peak_z = _z_scores([c["peak_db"] for c in candidates])
    range_z = _z_scores([c["dynamic_range"] for c in candidates])

    for candidate, mz, pz, rz in zip(candidates, mean_z, peak_z, range_z):
        # Loudness leads, dynamics matter, and a window buried under the
        # soundtrack is pushed down rather than excluded outright.
        music_penalty = 0.35 * candidate["music_markers"]
        candidate["score"] = round(0.5 * mz + 0.3 * pz + 0.2 * rz - music_penalty, 4)

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates


def drop_overlaps(candidates: list[dict], min_gap: float = 60.0) -> list[dict]:
    """Keep the best window from each part of the film, not five from one scene."""
    kept: list[dict] = []
    for candidate in candidates:
        if all(abs(candidate["start_time"] - k["start_time"]) >= min_gap for k in kept):
            kept.append(candidate)
    return kept


def speech_fraction(audio_path: Path, windows: list[tuple[float, float]], workdir: Path | None = None) -> dict:
    """How much of each window is actual speech, via Silero VAD. No transcription."""
    try:
        from faster_whisper.vad import VadOptions, get_speech_timestamps
        from faster_whisper.audio import decode_audio
    except Exception as exc:
        print(f"[Clipper] Speech detection unavailable: {exc}")
        return {}

    import transcribe as transcribe_mod

    scratch = workdir or audio_path.parent
    fractions: dict[tuple[float, float], float] = {}
    for index, (start, end) in enumerate(windows):
        chunk = scratch / f"vad-window-{index}.wav"
        try:
            if not transcribe_mod.extract_audio_window(audio_path, start, end, chunk):
                continue
            audio = decode_audio(str(chunk), sampling_rate=16000)
            spans = get_speech_timestamps(audio, VadOptions())
            speech = sum(s["end"] - s["start"] for s in spans) / 16000.0
            fractions[(start, end)] = round(min(1.0, speech / max(1.0, end - start)), 3)
        except Exception as exc:
            print(f"[Clipper] VAD skipped {start:.0f}-{end:.0f}s: {exc}")
        finally:
            chunk.unlink(missing_ok=True)
    return fractions


def apply_speech_scores(candidates: list[dict], fractions: dict, weight: float = 0.9) -> list[dict]:
    """Re-rank a shortlist once speech density is known.

    A window that is loud but has little speech is usually a music sting or an
    action beat, not the confrontation we want to post.
    """
    for candidate in candidates:
        key = (candidate["start_time"], candidate["end_time"])
        fraction = fractions.get(key)
        if fraction is None:
            continue
        candidate["speech_fraction"] = fraction
        candidate["score"] = round(candidate["score"] + weight * (fraction - 0.5), 4)
    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates
