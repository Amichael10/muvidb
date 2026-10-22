"""Local transcription fallback for films with no usable YouTube captions.

Without captions the clip picker had nothing to read and was asked to guess a
scene from the synopsis, which is the main source of weak clips. Whisper fills
that gap, but transcribing a whole two-hour film on CPU is far too slow to sit
inside a request.

So transcription is *targeted*: only a bounded set of windows is transcribed,
chosen from YouTube's most-replayed peaks when they exist and spread evenly
across the film when they do not. Timestamps are shifted back to absolute film
time so the output matches the caption format the prompt already expects.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

# A window needs enough room for the dialogue around a peak to make sense, but
# every extra second is CPU time the operator waits for.
DEFAULT_WINDOW_SECONDS = 90.0
DEFAULT_MAX_TOTAL_SECONDS = 12 * 60.0

# `base` rather than `small`: the clipper shares a desktop with a browser and an
# editor, and `small` failed to allocate on this machine with ~3.5 GB free
# (ctranslate2 raises `mkl_malloc: failed to allocate memory`). `base` is also
# roughly twice as fast, which matters when the operator is waiting.
DEFAULT_MODEL = "base"

# Tried in order when the preferred model will not load, so a busy machine
# degrades to a smaller model instead of losing transcription altogether.
MODEL_FALLBACKS = ("base", "tiny")
DEFAULT_CPU_THREADS = 2

# Whisper transcribes Yoruba, Igbo and Hausa badly. On a Yoruba feature it
# reported language 'yo' at 0.44-0.50 confidence and returned gibberish, and
# forcing language='en' produced fluent English dialogue that was simply
# invented. A confident-sounding fabrication is worse than no transcript at
# all, because the clip picker would choose a scene from lines nobody speaks.
# So the language is never forced, and a low-confidence result is discarded.
MIN_LANGUAGE_CONFIDENCE = 0.6


def is_transcript_trustworthy(
    detections: list[tuple[str | None, float]],
    min_confidence: float = MIN_LANGUAGE_CONFIDENCE,
) -> bool:
    """True when Whisper was confident enough about what it was listening to.

    Judged on the best window rather than the average: one clear stretch of
    dialogue is enough to trust, and quiet windows drag an average down.
    """
    confidences = [conf for _lang, conf in detections if conf is not None]
    if not confidences:
        return False
    return max(confidences) >= min_confidence


def format_timestamp(seconds: float) -> str:
    """Match the `[mm:ss]` / `[hh:mm:ss]` shape parse_vtt_with_timestamps emits."""
    total = max(0, int(round(seconds)))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def merge_windows(windows: list[tuple[float, float]], gap: float = 1.0) -> list[tuple[float, float]]:
    """Collapse overlapping or touching windows so no audio is transcribed twice."""
    if not windows:
        return []
    ordered = sorted((float(s), float(e)) for s, e in windows if e > s)
    if not ordered:
        return []
    merged = [ordered[0]]
    for start, end in ordered[1:]:
        last_start, last_end = merged[-1]
        if start - last_end <= gap:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def plan_transcription_windows(
    duration: float,
    heatmap_peaks: list[dict] | None = None,
    window_seconds: float = DEFAULT_WINDOW_SECONDS,
    max_total_seconds: float = DEFAULT_MAX_TOTAL_SECONDS,
    min_start: float | None = None,
    max_end: float | None = None,
) -> list[tuple[float, float]]:
    """Pick which stretches of audio are worth transcribing.

    Mirrors the search window the clip prompt already enforces: for a feature
    film the opening logos and the closing credits are never candidates, so
    there is no point paying to transcribe them.
    """
    duration = float(duration or 0)
    if duration <= 0:
        return []

    if min_start is None:
        min_start = max(300.0, duration * 0.15) if duration >= 1200 else 0.0
    if max_end is None:
        max_end = duration * 0.88 if duration >= 1200 else duration
    min_start = max(0.0, min(min_start, duration))
    max_end = max(min_start, min(max_end, duration))
    if max_end - min_start < 5:
        min_start, max_end = 0.0, duration

    half = window_seconds / 2.0
    windows: list[tuple[float, float]] = []

    def add(center: float) -> None:
        start = max(min_start, center - half)
        end = min(max_end, start + window_seconds)
        start = max(min_start, end - window_seconds)
        if end - start >= 5:
            windows.append((start, end))

    # Most-replayed peaks are real viewer behaviour, so they are the best
    # guesses available. Strongest first, so a tight budget keeps the best ones.
    peaks = [p for p in (heatmap_peaks or []) if p.get("start_time") is not None]
    peaks.sort(key=lambda p: float(p.get("intensity", 0) or 0), reverse=True)
    for peak in peaks:
        peak_start = float(peak["start_time"])
        peak_end = float(peak.get("end_time") or peak_start + 30)
        if peak_end < min_start or peak_start > max_end:
            continue
        add((peak_start + peak_end) / 2.0)
        if sum(e - s for s, e in merge_windows(windows)) >= max_total_seconds:
            break

    # No heatmap (common on smaller channels): sample the film evenly instead.
    if not windows:
        span = max_end - min_start
        count = max(1, int(min(max_total_seconds // window_seconds, max(1, span // window_seconds))))
        if count == 1:
            add(min_start + span / 2.0)
        else:
            for index in range(count):
                add(min_start + span * (index + 0.5) / count)

    merged = merge_windows(windows)

    # Enforce the budget after merging, so overlapping peaks do not cost twice.
    budgeted: list[tuple[float, float]] = []
    spent = 0.0
    for start, end in merged:
        if spent >= max_total_seconds:
            break
        allowance = max_total_seconds - spent
        clipped_end = min(end, start + allowance)
        if clipped_end - start >= 5:
            budgeted.append((start, clipped_end))
            spent += clipped_end - start
    return budgeted


def extract_audio_window(source: Path, start: float, end: float, destination: Path) -> bool:
    """Cut one window to 16 kHz mono WAV, which is what Whisper wants."""
    if not shutil.which("ffmpeg"):
        # Silently returning here once made transcription look like it ran and
        # found nothing, when in fact no audio was ever extracted.
        print("[Clipper] Cannot extract audio for transcription: ffmpeg is not on PATH.")
        return False
    # `-ss` before `-i` seeks cheaply; `-t` (a duration) rather than `-to`,
    # because as an input option `-to` is not honoured consistently and silently
    # produced empty files here.
    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", str(start),
        "-i", str(source),
        "-t", str(max(0.0, end - start)),
        "-vn", "-ac", "1", "-ar", "16000",
        "-c:a", "pcm_s16le", "-f", "wav",
        str(destination),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    ok = result.returncode == 0 and destination.exists() and destination.stat().st_size > 1024
    if not ok:
        detail = (result.stderr or "").strip().splitlines()
        print(f"[Clipper] Audio window {start:.0f}-{end:.0f}s could not be extracted: "
              f"{detail[-1] if detail else f'rc={result.returncode}'}")
    return ok


def whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except Exception:
        return False


_MODEL_CACHE: dict[tuple[str, str], object] = {}


def load_model(model_size: str | None = None, compute_type: str | None = None):
    """Load and cache a model, stepping down to a smaller one if memory is tight.

    Raises RuntimeError only when every candidate fails, so the caller can carry
    on without a transcript rather than failing the whole request.
    """
    from faster_whisper import WhisperModel

    preferred = model_size or os.getenv("CLIPPER_WHISPER_MODEL", DEFAULT_MODEL)
    compute = compute_type or os.getenv("CLIPPER_WHISPER_COMPUTE", "int8")
    threads = int(os.getenv("CLIPPER_WHISPER_THREADS", str(DEFAULT_CPU_THREADS)))

    candidates = [preferred] + [m for m in MODEL_FALLBACKS if m != preferred]
    errors: list[str] = []
    for size in candidates:
        key = (size, compute)
        if key in _MODEL_CACHE:
            return _MODEL_CACHE[key]
        try:
            _MODEL_CACHE[key] = WhisperModel(
                size, device="cpu", compute_type=compute, cpu_threads=threads
            )
            if size != preferred:
                print(f"[Clipper] Whisper '{preferred}' would not load; using '{size}' instead.")
            return _MODEL_CACHE[key]
        except Exception as exc:
            errors.append(f"{size}: {type(exc).__name__}: {exc}")
    raise RuntimeError("no Whisper model could be loaded -> " + " | ".join(errors))


def transcribe_windows(
    audio_path: Path,
    windows: list[tuple[float, float]],
    model_size: str | None = None,
    max_chars: int = 16000,
    workdir: Path | None = None,
) -> str:
    """Transcribe the planned windows and return one caption-formatted string.

    Each window is transcribed on its own, then every segment timestamp is
    shifted by that window's offset so the result reads as absolute film time.
    """
    if not windows or not whisper_available():
        return ""

    # Transcription is an enhancement, never a requirement: a model that will
    # not load must not take the metadata request down with it.
    try:
        model = load_model(model_size)
    except Exception as exc:
        print(f"[Clipper] Transcription unavailable: {exc}")
        return ""

    scratch = workdir or audio_path.parent
    entries: list[tuple[float, str]] = []

    detections: list[tuple[str | None, float]] = []

    for index, (start, end) in enumerate(windows):
        chunk = scratch / f"whisper-window-{index}.wav"
        try:
            if not extract_audio_window(audio_path, start, end, chunk):
                continue
            # The language is deliberately not pinned: forcing one makes Whisper
            # invent plausible dialogue instead of admitting it cannot tell.
            segments, info = model.transcribe(
                str(chunk),
                beam_size=1,
                vad_filter=True,
                condition_on_previous_text=False,
            )
            detections.append((getattr(info, "language", None),
                               float(getattr(info, "language_probability", 0.0) or 0.0)))
            for segment in segments:
                text = (segment.text or "").strip()
                if text:
                    entries.append((start + float(segment.start), text))
        except Exception as exc:  # a bad window must not sink the whole request
            print(f"[Clipper] Whisper window {start:.0f}-{end:.0f}s skipped: {exc}")
        finally:
            chunk.unlink(missing_ok=True)

    if not is_transcript_trustworthy(detections):
        summary = ", ".join(f"{lang or '?'}@{conf:.2f}" for lang, conf in detections) or "nothing detected"
        print(f"[Clipper] Discarding transcript: language confidence too low ({summary}). "
              f"Better no dialogue than invented dialogue.")
        return ""

    entries.sort(key=lambda item: item[0])
    rendered = " ".join(f"[{format_timestamp(at)}] {text}" for at, text in entries)
    return rendered[:max_chars]
