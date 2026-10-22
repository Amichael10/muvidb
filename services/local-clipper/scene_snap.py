"""Snap a proposed clip range onto real shot changes.

The picker returns a start time to the second, which lands wherever it lands —
often part-way through a shot or a spoken word. Nudging each end onto the
nearest actual cut is what makes a clip feel deliberately edited rather than
sliced at random.

Detection runs on a tiny low-resolution proxy of the surrounding seconds, so it
costs a short download rather than the whole film.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

# How far a boundary may travel to reach a cut. Beyond a few seconds the clip is
# no longer the moment that was chosen, so it is better to leave it alone.
DEFAULT_MAX_SHIFT = 2.5
DEFAULT_PROXY_PADDING = 6.0
MIN_CLIP_SECONDS = 5.0


def nearest_cut(proposed: float, cuts: list[float], max_shift: float = DEFAULT_MAX_SHIFT) -> float | None:
    """The cut closest to `proposed`, or None when none is close enough."""
    candidates = [float(c) for c in cuts if abs(float(c) - proposed) <= max_shift]
    if not candidates:
        return None
    return min(candidates, key=lambda c: abs(c - proposed))


def snap_range(
    start: float,
    end: float,
    cuts: list[float],
    max_shift: float = DEFAULT_MAX_SHIFT,
    min_duration: float = MIN_CLIP_SECONDS,
) -> tuple[float, float, dict]:
    """Move each boundary onto a nearby cut where one exists.

    Returns the range plus a report of what moved, so the decision is visible
    in the job log instead of silently changing the operator's selection.
    """
    start = float(start)
    end = float(end)
    report: dict = {"snapped_start": False, "snapped_end": False, "cuts_found": len(cuts)}
    if end - start < min_duration or not cuts:
        report["reason"] = "no_cuts_in_range" if not cuts else "range_too_short"
        return start, end, report

    new_start = start
    candidate_start = nearest_cut(start, cuts, max_shift)
    # A cut marks the first frame of a new shot, so starting exactly on one
    # opens cleanly instead of showing the tail of the previous shot.
    if candidate_start is not None and end - candidate_start >= min_duration:
        new_start = candidate_start
        report["snapped_start"] = True
        report["start_shift"] = round(candidate_start - start, 3)

    new_end = end
    candidate_end = nearest_cut(end, cuts, max_shift)
    # Ending on a cut means the clip stops as the shot does, never a few frames
    # into the next one.
    if candidate_end is not None and candidate_end - new_start >= min_duration:
        new_end = candidate_end
        report["snapped_end"] = True
        report["end_shift"] = round(candidate_end - end, 3)

    return new_start, new_end, report


def scenedetect_available() -> bool:
    try:
        import scenedetect  # noqa: F401
        return True
    except Exception:
        return False


def detect_cuts(video_path: Path, offset: float = 0.0, threshold: float = 27.0) -> list[float]:
    """Absolute cut times in the given proxy, offset back to film time."""
    if not scenedetect_available():
        return []
    try:
        from scenedetect import ContentDetector, SceneManager, open_video

        video = open_video(str(video_path))
        manager = SceneManager()
        manager.add_detector(ContentDetector(threshold=threshold))
        manager.detect_scenes(video, show_progress=False)
        scenes = manager.get_scene_list()
    except Exception as exc:
        print(f"[Clipper] Scene detection skipped: {exc}")
        return []

    cuts: list[float] = []
    for scene_start, _scene_end in scenes:
        cuts.append(offset + scene_start.get_seconds())
    # The first boundary is the start of the proxy, not a real cut.
    return sorted({round(c, 3) for c in cuts if c > offset + 0.05})


def build_proxy(
    source: Path | str,
    start: float,
    end: float,
    destination: Path,
    height: int = 180,
) -> bool:
    """Shrink the surrounding seconds to a small proxy; detection needs no detail."""
    if not shutil.which("ffmpeg"):
        return False
    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", str(max(0.0, start)), "-to", str(end),
        "-i", str(source),
        "-an",
        "-vf", f"scale=-2:{height}",
        "-r", "15",
        str(destination),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    return result.returncode == 0 and destination.exists() and destination.stat().st_size > 0
