"""Free MuviDB desktop video clipper.

Runs on the administrator's own computer so YouTube downloads use the local
residential connection. Rendered files are handed back to the browser, which
uploads them directly to Google Drive through an authenticated resumable
session. No video bytes pass through Vercel or Supabase.
"""

from __future__ import annotations

import os
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import urllib.request
from html import unescape
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

import yt_dlp
from fastapi import FastAPI, HTTPException, Request

# These siblings are imported as top-level modules, which only resolves when
# this directory is on sys.path. uvicorn's --app-dir arranges that, but loading
# main.py by file path (as the tests do) does not, so make it explicit.
import sys as _sys
if str(Path(__file__).resolve().parent) not in _sys.path:
    _sys.path.insert(0, str(Path(__file__).resolve().parent))

import caption_quality
import moment_score
import scene_snap
import transcribe as transcribe_mod
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, HttpUrl


PORT = int(os.getenv("MUVIDB_LOCAL_CLIPPER_PORT", "4317"))
FILE_TTL_SECONDS = 2 * 60 * 60
OUTPUT_DIR = Path(tempfile.gettempdir()) / "muvidb-local-clipper"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
CLIP_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="muvidb-clip")
CLIP_JOBS: dict[str, dict] = {}

ALLOWED_ORIGINS = [
    "https://muvidb.com",
    "https://www.muvidb.com",
    "https://studio.muvidb.com",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
]

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

app = FastAPI(title="MuviDB Local Clipper", version="2.1.0")
PAIRING_TOKEN = secrets.token_urlsafe(32)


class PrivateNetworkAccessMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        if request.url.hostname not in ("localhost", "127.0.0.1", "::1"):
            return Response("Invalid local host", status_code=403)
        if not request.client or request.client.host not in ("127.0.0.1", "::1"):
            return Response("Loopback access required", status_code=403)
        if origin and origin not in ALLOWED_ORIGINS:
            return Response("Origin not allowed", status_code=403)
        if request.method == "OPTIONS":
            if not origin:
                return Response(status_code=403)
            response = Response(status_code=204)
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, HEAD"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Muvidb-Clipper-Token"
            response.headers["Access-Control-Allow-Private-Network"] = "true"
            response.headers["Access-Control-Max-Age"] = "86400"
            return response

        if request.url.path != "/health":
            token = request.headers.get("x-muvidb-clipper-token", "")
            if not secrets.compare_digest(token, PAIRING_TOKEN):
                return Response("Local clipper pairing required", status_code=401)
        response = await call_next(request)
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Private-Network"] = "true"
            response.headers["Vary"] = "Origin"
        return response


# Add CORSMiddleware first, then PrivateNetworkAccessMiddleware so PNA wraps everything (including OPTIONS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(PrivateNetworkAccessMiddleware)


class ClipRequest(BaseModel):
    url: HttpUrl
    start_time: float = Field(default=0, ge=0)
    end_time: float = Field(default=30, gt=0)
    aspect_ratio: Literal["1:1", "4:5", "9:16", "16:9"] = "9:16"
    fit_mode: Literal["cover", "contain"] = "cover"
    title: str = "clip"
    engine: Literal["auto", "filmcraft", "ffmpeg"] = "auto"
    # Nudge both ends onto the nearest real shot change before rendering.
    snap_to_scene: bool = True


def get_filmcraft_path() -> Path | None:
    repo_root = Path(__file__).resolve().parents[2]
    candidates = [
        repo_root / "tools" / "filmcraft" / "filmcraft-0.5.0-windows-x64-portable" / "filmcraft-cli.exe",
        Path.cwd() / "tools" / "filmcraft" / "filmcraft-0.5.0-windows-x64-portable" / "filmcraft-cli.exe",
        Path(r"C:\Users\User\Filmdba\lumi\tools\filmcraft\filmcraft-0.5.0-windows-x64-portable\filmcraft-cli.exe"),
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


class MetadataRequest(BaseModel):
    url: HttpUrl
    # "auto" transcribes locally only when YouTube has no usable captions.
    transcribe: Literal["auto", "off"] = "auto"


class MomentsRequest(BaseModel):
    url: HttpUrl
    clip_seconds: float = Field(default=moment_score.DEFAULT_CLIP_SECONDS, ge=10, le=120)
    shortlist: int = Field(default=moment_score.SHORTLIST_SIZE, ge=1, le=20)
    # The caller already has /metadata output; passing the caption track lets
    # music markers count against a window even when the track is unusable
    # as dialogue.
    transcript: str = ""


class SnapRequest(BaseModel):
    url: HttpUrl
    start_time: float = Field(default=0, ge=0)
    end_time: float = Field(default=30, gt=0)
    max_shift: float = Field(default=scene_snap.DEFAULT_MAX_SHIFT, ge=0, le=10)


class BatchClipRequest(BaseModel):
    """Queue a set of aspect-ratio renders for the daily video autopilot."""
    clips: list[ClipRequest] = Field(default_factory=list, max_length=12)


def cleanup_expired_files() -> None:
    cutoff = time.time() - FILE_TTL_SECONDS
    for path in OUTPUT_DIR.glob("*.mp4"):
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink(missing_ok=True)
        except OSError:
            pass


def require_dependencies() -> None:
    if not shutil.which("ffmpeg") and not get_filmcraft_path():
        raise HTTPException(503, "Neither FFmpeg nor FilmCraft is installed. Run the MuviDB clipper setup script first.")


def video_filter(aspect_ratio: str, fit_mode: str) -> str:
    dimensions = {
        "1:1": (1080, 1080),
        "4:5": (1080, 1350),
        "9:16": (1080, 1920),
        "16:9": (1920, 1080),
    }
    width, height = dimensions.get(aspect_ratio, (1920, 1080))
    if fit_mode == "contain":
        return (
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black"
        )
    return (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height}"
    )


def is_valid_netscape_cookie_file(path_str: str) -> bool:
    if not path_str:
        return False
    try:
        p = Path(path_str)
        if not p.is_file() or p.stat().st_size < 20:
            return False
        content = p.read_text(encoding="utf-8", errors="ignore")
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        if not lines:
            return False
        # Netscape header or tab-separated cookie rows
        if any("netscape" in line.lower() or "http cookie file" in line.lower() for line in lines[:5]):
            return True
        for line in lines:
            if not line.startswith("#") and "\t" in line:
                parts = line.split("\t")
                if len(parts) >= 6:
                    return True
        return False
    except Exception:
        return False


def cookie_options() -> dict:
    cookie_file = os.getenv("YT_COOKIES_FILE", "").strip()
    if cookie_file and not is_valid_netscape_cookie_file(cookie_file):
        cookie_file = ""

    if not cookie_file:
        # Convenient local fallback: keep an exported Netscape cookie file in
        # the project root. The file is ignored by Git and never uploaded.
        candidates = [Path.cwd() / "cookies.txt", Path(__file__).resolve().parents[2] / "cookies.txt"]
        for candidate in candidates:
            if is_valid_netscape_cookie_file(str(candidate)):
                cookie_file = str(candidate)
                break

    if cookie_file and is_valid_netscape_cookie_file(cookie_file):
        return {"cookiefile": cookie_file}

    # Browser cookie extraction on modern Windows Chrome causes DPAPI decryption errors.
    # Default to 'off' unless explicitly enabled by the user in environment.
    browser = os.getenv("YT_COOKIES_FROM_BROWSER", "off").strip().lower()
    if browser and browser not in {"off", "none", "false", "0"}:
        return {"cookiesfrombrowser": (browser,)}
    return {}


@app.get("/health")
def health(request: Request):
    cleanup_expired_files()
    fc_path = get_filmcraft_path()
    return {
        "status": "ready" if shutil.which("ffmpeg") or fc_path else "missing_dependency",
        "service": "muvidb-local-clipper",
        "version": "2.2.0",
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "scene_snap": scene_snap.scenedetect_available(),
        "moment_scoring": bool(shutil.which("ffmpeg")),
        "transcription": transcribe_mod.whisper_available(),
        "filmcraft": bool(fc_path),
        "filmcraft_version": "0.5.0" if fc_path else None,
        "pairing_token": PAIRING_TOKEN if request.headers.get("origin") in ALLOWED_ORIGINS else None,
    }


def parse_vtt_with_timestamps(raw_vtt: str, max_chars: int = 15000) -> str:
    lines = raw_vtt.splitlines()
    entries = []
    current_time_tag = ""
    last_text = ""
    time_pattern = re.compile(r"(\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*-->")

    for line in lines:
        line_clean = line.strip()
        if not line_clean or line_clean.startswith("WEBVTT") or line_clean.startswith("NOTE"):
            continue

        match = time_pattern.search(line_clean)
        if match:
            raw_time = match.group(1)
            if raw_time.startswith("00:"):
                raw_time = raw_time[3:]
            current_time_tag = f"[{raw_time}]"
            continue

        text = re.sub(r"<[^>]+>", "", line_clean).strip()
        if not text or re.fullmatch(r"\d+", text):
            continue

        text = unescape(text)
        if text != last_text:
            if current_time_tag:
                entries.append(f"{current_time_tag} {text}")
                current_time_tag = ""
            else:
                entries.append(text)
            last_text = text

    result = " ".join(entries)
    if len(result) > max_chars:
        result = result[:max_chars]
    return result


@app.post("/metadata")
def metadata(payload: MetadataRequest):
    """Return cookie-authenticated metadata, chapters, heatmap peaks, and timestamped English captions."""
    opts = {"quiet": True, "no_warnings": True, "noplaylist": True, **cookie_options()}
    info = {}
    try:
        with yt_dlp.YoutubeDL(opts) as downloader:
            info = downloader.extract_info(str(payload.url), download=False)
    except Exception as e:
        print(f"[Clipper] Metadata extraction with cookie_options failed ({e}); retrying without cookies…")
        try:
            with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "noplaylist": True}) as fallback_dl:
                info = fallback_dl.extract_info(str(payload.url), download=False)
        except Exception as e2:
            print(f"[Clipper] Fallback metadata extraction failed: {e2}")
            return {
                "title": "",
                "duration": 3600,
                "description": "",
                "transcript": "",
                "chapters": [],
                "heatmap_peaks": [],
                "description_chapters": []
            }

    transcript = ""
    subtitle_map = info.get("subtitles") or info.get("automatic_captions") or {}
    track = next((subtitle_map.get(key) for key in ("en", "en-US", "en-GB") if subtitle_map.get(key)), None)
    if track:
        subtitle_url = next((entry.get("url") for entry in track if entry.get("ext") in {"vtt", "srv3"}), track[0].get("url"))
        try:
            raw = urllib.request.urlopen(subtitle_url, timeout=15).read().decode("utf-8", "ignore")
            transcript = parse_vtt_with_timestamps(raw, max_chars=16000)
        except Exception as exc:
            print(f"[Clipper] Caption fetch skipped: {exc}")

    # Extract native YouTube chapters
    chapters = []
    raw_chapters = info.get("chapters") or []
    for ch in raw_chapters:
        st = ch.get("start_time")
        et = ch.get("end_time")
        ch_title = ch.get("title") or ""
        if st is not None:
            chapters.append({
                "start_time": float(st),
                "end_time": float(et) if et is not None else float(st) + 60,
                "title": ch_title
            })

    # Extract description timestamp markers (e.g., "12:30 The fight", "1:15:00 Climax")
    desc = info.get("description") or ""
    desc_chapters = []
    for match in re.finditer(r"(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—:]?\s*([^\n\r]+)", desc):
        tc_str = match.group(1)
        tc_title = match.group(2).strip()
        if len(tc_title) > 2 and not tc_title.startswith("http"):
            desc_chapters.append({"timestamp": tc_str, "title": tc_title[:100]})

    # Extract heatmap highlights (most replayed segments on YouTube)
    heatmap_peaks = []
    raw_heatmap = info.get("heatmap") or []
    if raw_heatmap:
        sorted_heatmap = sorted(raw_heatmap, key=lambda x: x.get("value", 0), reverse=True)
        for pt in sorted_heatmap[:6]:
            st = pt.get("start_time")
            et = pt.get("end_time")
            if st is not None:
                heatmap_peaks.append({
                    "start_time": float(st),
                    "end_time": float(et) if et is not None else float(st) + 30,
                    "intensity": round(float(pt.get("value", 0)), 3)
                })

    duration_seconds = float(info.get("duration") or 0)
    transcript_source = "captions" if transcript else "none"
    transcribed_windows: list[dict] = []
    caption_report: dict | None = None

    # A caption track existing is not the same as it being usable. YouTube
    # auto-captions a Yoruba film as English and returns mostly `[music]` and
    # fragments; handing that to the clip picker is worse than handing it
    # nothing, and it also suppressed the transcription fallback.
    if transcript:
        caption_report = caption_quality.assess_captions(transcript, duration_seconds)
        if not caption_report["usable"]:
            print(f"[Clipper] Discarding caption track: {caption_report['reason']} "
                  f"({caption_report['real_words']} words, {caption_report['markers']} markers "
                  f"over {caption_report['covered_minutes']} min).")
            transcript = ""
            transcript_source = "captions_unusable"

    # No captions means the picker would otherwise be asked to guess a scene
    # from the synopsis alone. Transcribe a bounded set of windows instead.
    if not transcript and payload.transcribe == "auto" and duration_seconds > 0:
        if not transcribe_mod.whisper_available():
            print("[Clipper] No captions and faster-whisper is not installed; skipping transcription.")
        else:
            windows = transcribe_mod.plan_transcription_windows(
                duration_seconds,
                heatmap_peaks=heatmap_peaks,
                max_total_seconds=float(os.getenv("CLIPPER_WHISPER_MAX_MINUTES", "6")) * 60.0,
            )
            if windows:
                planned = sum(end - start for start, end in windows)
                print(f"[Clipper] No captions; transcribing {planned/60:.1f} min across {len(windows)} window(s)…")
                started = time.time()
                with tempfile.TemporaryDirectory(prefix="muvidb-whisper-") as scratch:
                    audio_path = download_audio_for_transcription(str(payload.url), Path(scratch))
                    if audio_path:
                        transcript = transcribe_mod.transcribe_windows(
                            audio_path, windows, workdir=Path(scratch), max_chars=16000
                        )
                if transcript:
                    transcript_source = "whisper"
                    transcribed_windows = [
                        {"start_time": round(start, 2), "end_time": round(end, 2)} for start, end in windows
                    ]
                    print(f"[Clipper] Transcribed in {time.time() - started:.0f}s ({len(transcript)} chars).")
                else:
                    print("[Clipper] Transcription produced no usable text.")

    return {
        "title": info.get("title") or "",
        "duration": info.get("duration") or 0,
        "description": desc,
        "transcript": transcript,
        "transcript_source": transcript_source,
        "caption_quality": caption_report,
        "transcribed_windows": transcribed_windows,
        "chapters": chapters,
        "heatmap_peaks": heatmap_peaks,
        "description_chapters": desc_chapters[:15]
    }


def download_audio_for_transcription(url: str, workdir: Path) -> Path | None:
    """Fetch audio only. A film's audio track is a small fraction of the video."""
    target = workdir / "source-audio.m4a"
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": "bestaudio/best",
        "outtmpl": str(workdir / "source-audio.%(ext)s"),
        **cookie_options(),
    }
    try:
        with yt_dlp.YoutubeDL(opts) as downloader:
            downloader.download([url])
    except Exception as exc:
        print(f"[Clipper] Audio download for transcription failed: {exc}")
        return None
    if target.exists():
        return target
    candidates = sorted(workdir.glob("source-audio.*"), key=lambda p: p.stat().st_size, reverse=True)
    return candidates[0] if candidates else None


def resolve_lowres_stream_url(url: str) -> str | None:
    """A small video-only stream URL. Scene detection needs motion, not detail."""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": "worstvideo[height>=144]/worstvideo/worst",
        **cookie_options(),
    }
    try:
        with yt_dlp.YoutubeDL(opts) as downloader:
            info = downloader.extract_info(url, download=False)
    except Exception as exc:
        print(f"[Clipper] Could not resolve a proxy stream: {exc}")
        return None
    if info.get("url"):
        return info["url"]
    for fmt in info.get("formats") or []:
        if fmt.get("url") and fmt.get("vcodec") not in (None, "none"):
            return fmt["url"]
    return None


def snap_clip_range(url: str, start: float, end: float, max_shift: float) -> tuple[float, float, dict]:
    """Move a proposed range onto nearby shot changes, or leave it untouched."""
    if not scene_snap.scenedetect_available():
        return start, end, {"snapped_start": False, "snapped_end": False, "reason": "scenedetect_not_installed"}

    padding = scene_snap.DEFAULT_PROXY_PADDING
    proxy_start = max(0.0, start - padding)
    proxy_end = end + padding
    source = url if not ("youtube.com" in url or "youtu.be" in url) else resolve_lowres_stream_url(url)
    if not source:
        return start, end, {"snapped_start": False, "snapped_end": False, "reason": "no_proxy_stream"}

    with tempfile.TemporaryDirectory(prefix="muvidb-snap-") as scratch:
        proxy = Path(scratch) / "proxy.mp4"
        if not scene_snap.build_proxy(source, proxy_start, proxy_end, proxy):
            return start, end, {"snapped_start": False, "snapped_end": False, "reason": "proxy_build_failed"}
        cuts = scene_snap.detect_cuts(proxy, offset=proxy_start)

    snapped_start, snapped_end, report = scene_snap.snap_range(start, end, cuts, max_shift=max_shift)
    report["proxy_window"] = [round(proxy_start, 2), round(proxy_end, 2)]
    return snapped_start, snapped_end, report


@app.post("/snap")
def snap(payload: SnapRequest):
    """Report where a proposed clip range would land once snapped to shot changes."""
    require_dependencies()
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")
    start, end, report = snap_clip_range(
        str(payload.url), float(payload.start_time), float(payload.end_time), float(payload.max_shift)
    )
    return {
        "start_time": round(start, 3),
        "end_time": round(end, 3),
        "original_start_time": round(float(payload.start_time), 3),
        "original_end_time": round(float(payload.end_time), 3),
        **report,
    }


@app.post("/moments")
def moments(payload: MomentsRequest):
    """Rank the most dramatic stretches of a film using local signals only.

    No transcription and no API calls, so this works on Yoruba films where
    captions are noise and Whisper cannot help. Loudness is scanned over the
    whole film, then speech detection refines a shortlist.
    """
    require_dependencies()
    with tempfile.TemporaryDirectory(prefix="muvidb-moments-") as scratch:
        work = Path(scratch)
        audio = download_audio_for_transcription(str(payload.url), work)
        if not audio:
            raise HTTPException(status_code=502, detail="Could not fetch audio for analysis")

        series = moment_score.scan_loudness(audio)
        if not series:
            raise HTTPException(status_code=500, detail="Loudness scan produced nothing")

        duration = series[-1][0] + moment_score.DEFAULT_BLOCK_SECONDS
        ranked = moment_score.rank_moments(
            series,
            clip_seconds=payload.clip_seconds,
            music_seconds=moment_score.music_seconds_from_captions(payload.transcript),
            duration=duration,
        )
        spread = moment_score.drop_overlaps(ranked)[: payload.shortlist]
        fractions = moment_score.speech_fraction(
            audio, [(c["start_time"], c["end_time"]) for c in spread], workdir=work
        )
        final = moment_score.apply_speech_scores(spread, fractions)

    return {
        "duration": round(duration, 1),
        "blocks_scanned": len(series),
        "candidates": final,
        "best": final[0] if final else None,
    }


def has_video_stream(path: Path) -> bool:
    """Verify that the rendered file actually contains a video stream (not just audio)."""
    try:
        res = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=codec_type",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path)
            ],
            capture_output=True, text=True, timeout=10
        )
        return "video" in res.stdout.lower()
    except Exception:
        return path.exists() and path.stat().st_size > 100_000


def render_filmcraft_clip(start: float, end: float, aspect_ratio: str, final_path: Path, source_video: Path | None = None) -> bool:
    fc_bin = get_filmcraft_path()
    if not fc_bin:
        return False

    preset = "Social Vertical 1080×1920" if aspect_ratio == "9:16" else "High Quality 1080p HD"

    cmd = [str(fc_bin)]
    if source_video and source_video.exists():
        cmd.extend(["import", str(source_video)])
        cmd.extend(["export", str(final_path), "--preset", preset, "--start", str(start), "--end", str(end)])
    else:
        cmd.extend(["--demo", "export", str(final_path), "--preset", preset, "--start", str(start), "--end", str(end)])

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return final_path.exists() and final_path.stat().st_size > 50_000 and has_video_stream(final_path)
    except Exception as exc:
        print(f"[FilmCraft] Rendering error: {exc}")
        return False


def process_clip(payload: ClipRequest, token: str, final_name: str, final_path: Path) -> None:
    """Fast stream-based slicing and rendering in sub-30s with master segment sharing."""
    start = float(payload.start_time)
    end = float(payload.end_time)
    require_dependencies()
    url = str(payload.url)

    # Land both ends on real shot changes so the clip opens and closes cleanly
    # instead of part-way through a shot. Failure here is never fatal: the
    # originally chosen range is kept.
    if payload.snap_to_scene:
        try:
            CLIP_JOBS[token].update({"message": "Finding the nearest shot changes…", "progress": 8})
            snapped_start, snapped_end, report = snap_clip_range(
                url, start, end, scene_snap.DEFAULT_MAX_SHIFT
            )
            if report.get("snapped_start") or report.get("snapped_end"):
                print(f"[Clipper] Snapped {start:.2f}-{end:.2f} to {snapped_start:.2f}-{snapped_end:.2f} ({report})")
                start, end = snapped_start, snapped_end
                CLIP_JOBS[token]["scene_snap"] = report
            else:
                print(f"[Clipper] Left range unsnapped: {report.get('reason', 'no nearby cut')}")
        except Exception as exc:
            print(f"[Clipper] Scene snapping skipped: {exc}")

    duration = end - start
    try:
        # Check if FilmCraft engine is requested or if it's the FilmCraft demo URL
        if payload.engine == "filmcraft" or "filmcraft" in url.lower():
            CLIP_JOBS[token].update({"message": f"Rendering {payload.aspect_ratio} with FilmCraft GPU Compositor…", "progress": 40})
            success = render_filmcraft_clip(start, end, payload.aspect_ratio, final_path)
            if success:
                CLIP_JOBS[token].update({
                    "status": "complete",
                    "message": "Clip ready (FilmCraft engine).",
                    "progress": 100,
                    "result": {
                        "success": True,
                        "token": token,
                        "job_id": token,
                        "download_url": f"http://127.0.0.1:{PORT}/files/{token}",
                        "cleanup_url": f"http://127.0.0.1:{PORT}/files/{token}",
                        "file_name": final_name,
                        "mime_type": "video/mp4",
                        "size_bytes": final_path.stat().st_size,
                        "size_mb": round(final_path.stat().st_size / (1024 * 1024), 2),
                        "duration": duration,
                        "aspect_ratio": payload.aspect_ratio,
                        "fit_mode": payload.fit_mode,
                        "engine": "filmcraft",
                    },
                })
                return

        # Check if another format in this batch already extracted the master segment for this time range
        import hashlib
        master_key = hashlib.sha256(f"{url}_{int(start)}_{int(end)}".encode()).hexdigest()[:16]
        master_segment = OUTPUT_DIR / f"master_{master_key}.mp4"

        if master_segment.exists() and master_segment.stat().st_size > 100_000:
            CLIP_JOBS[token].update({"message": f"Cropping {payload.aspect_ratio} from cached scene…", "progress": 70})
            cmd = [
                "ffmpeg", "-y", "-i", str(master_segment),
                "-t", str(duration),
                "-sn",
                "-vf", video_filter(payload.aspect_ratio, payload.fit_mode),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                "-pix_fmt", "yuv420p", "-r", "30",
                "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", str(final_path),
            ]
            subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if final_path.exists() and final_path.stat().st_size > 50_000 and has_video_stream(final_path):
                CLIP_JOBS[token].update({
                    "status": "complete",
                    "message": "Clip ready.",
                    "progress": 100,
                    "result": {
                        "success": True,
                        "token": token,
                        "job_id": token,
                        "download_url": f"http://127.0.0.1:{PORT}/files/{token}",
                        "cleanup_url": f"http://127.0.0.1:{PORT}/files/{token}",
                        "file_name": final_name,
                        "mime_type": "video/mp4",
                        "size_bytes": final_path.stat().st_size,
                        "size_mb": round(final_path.stat().st_size / (1024 * 1024), 2),
                        "duration": duration,
                        "aspect_ratio": payload.aspect_ratio,
                        "fit_mode": payload.fit_mode,
                    },
                })
                return

        CLIP_JOBS[token].update({"message": "Extracting fast stream info…", "progress": 15})
        
        # Prioritize 1080p/720p H.264 and HLS streams (which slice instantly by chunk) over AV1
        opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "writesubtitles": False,
            "writeautomaticsub": False,
            "allsubtitles": False,
            "embedsubtitles": False,
            "format": "270+234/232+234/231+234/230+233/bestvideo[height<=1080][vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
            "extractor_args": {
                "youtube": {
                    "player_client": ["visionos", "ios", "web_safari", "web_embedded", "android", "web"]
                }
            },
            "socket_timeout": 30,
            **cookie_options(),
        }

        is_youtube = "youtube.com" in url or "youtu.be" in url
        direct_stream_url = None
        direct_audio_url = None
        direct_stream_headers = {}
        if not is_youtube:
            direct_stream_url = url

        CLIP_JOBS[token].update({"message": f"Slicing & rendering {payload.aspect_ratio} with FFmpeg…", "progress": 40})
        
        if direct_stream_url:
            # Trailing \r\n required by FFmpeg -headers option
            header_str = "".join(f"{key}: {value}\r\n" for key, value in direct_stream_headers.items()) if direct_stream_headers else ""
            command = ["ffmpeg", "-y"]
            if header_str:
                command.extend(["-headers", header_str])
            command.extend(["-timeout", "15000000", "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"])
            command.extend(["-ss", str(start), "-i", direct_stream_url])
            if direct_audio_url:
                if header_str:
                    command.extend(["-headers", header_str])
                command.extend(["-timeout", "15000000", "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"])
                command.extend(["-ss", str(start), "-i", direct_audio_url])
                command.extend(["-map", "0:v:0", "-map", "1:a:0?"])
            command.extend([
                "-t", str(duration),
                "-sn",
                "-vf", video_filter(payload.aspect_ratio, payload.fit_mode),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                "-pix_fmt", "yuv420p", "-r", "30",
                "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", str(final_path)
            ])
            try:
                # Dynamic timeout based on clip duration (never hardcoded 35s)
                stream_timeout = max(90, int(duration * 2) + 30)
                rendered = subprocess.run(command, capture_output=True, text=True, timeout=stream_timeout)
            except subprocess.TimeoutExpired:
                rendered = None
                print("[Clipper] Direct stream timed out; falling back to range download.")
            if rendered is not None and (rendered.returncode != 0 or not final_path.exists()):
                print("[Clipper] Direct stream ffmpeg error, falling back to temp file:", rendered.stderr)

        # Fallback using yt-dlp section cutting
        if not final_path.exists() or final_path.stat().st_size == 0 or not has_video_stream(final_path):
            final_path.unlink(missing_ok=True)
            CLIP_JOBS[token].update({"message": f"Downloading section ({int(start)}s - {int(end)}s)…", "progress": 55})
            with tempfile.TemporaryDirectory(prefix="muvidb-clip-") as workdir:
                raw_template = str(Path(workdir) / "source.%(ext)s")
                fallback_opts = {
                    "quiet": True,
                    "no_warnings": True,
                    "noplaylist": True,
                    "writesubtitles": False,
                    "writeautomaticsub": False,
                    "allsubtitles": False,
                    "embedsubtitles": False,
                    "format": "270+234/232+234/231+234/230+233/bestvideo[vcodec^=avc1][height<=1080]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best",
                    "download_ranges": yt_dlp.utils.download_range_func(None, [(start, end)]),
                    "force_keyframes_at_cuts": False,
                    "extractor_args": {
                        "youtube": {
                            "player_client": ["visionos", "ios", "web_safari", "web_embedded", "android", "web"]
                        }
                    },
                    "outtmpl": raw_template,
                    "merge_output_format": "mp4",
                    "retries": 3,
                    "socket_timeout": 30,
                    **cookie_options(),
                }
                try:
                    with yt_dlp.YoutubeDL(fallback_opts) as dl:
                        dl.download([url])
                except Exception as dl_err:
                    print(f"[Clipper] Section download with cookies failed: {dl_err}. Retrying without cookies…")
                    clean_fallback_opts = {k: v for k, v in fallback_opts.items() if k not in ("cookiefile", "cookiesfrombrowser")}
                    with yt_dlp.YoutubeDL(clean_fallback_opts) as clean_dl:
                        clean_dl.download([url])

                # Strictly pick actual video files, excluding .part, .ytdl, or standalone audio
                video_candidates = [
                    c for c in Path(workdir).glob("source.*")
                    if c.suffix.lower() in (".mp4", ".mkv", ".webm", ".mov", ".ts")
                    and not c.name.endswith(".part")
                    and not c.name.endswith(".ytdl")
                ]
                if not video_candidates:
                    video_candidates = [
                        c for c in Path(workdir).glob("*")
                        if c.suffix.lower() in (".mp4", ".mkv", ".webm")
                        and not c.name.endswith(".part")
                    ]
                if not video_candidates:
                    raise RuntimeError("YouTube did not return a usable video segment.")

                source_video = sorted(video_candidates, key=lambda f: f.stat().st_size, reverse=True)[0]

                # Check if downloaded file is the full video or pre-cut
                seek_start = 0
                try:
                    probe_res = subprocess.run(
                        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(source_video)],
                        capture_output=True, text=True, timeout=10
                    )
                    src_dur = float(probe_res.stdout.strip())
                    if src_dur > duration + 15:
                        seek_start = start
                except Exception:
                    pass

                CLIP_JOBS[token].update({"message": f"Cropping to {payload.aspect_ratio}…", "progress": 80})
                cmd = ["ffmpeg", "-y"]
                if seek_start > 0:
                    cmd.extend(["-ss", str(seek_start)])
                cmd.extend([
                    "-i", str(source_video),
                    "-t", str(duration),
                    "-sn",
                    "-vf", video_filter(payload.aspect_ratio, payload.fit_mode),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                    "-pix_fmt", "yuv420p", "-r", "30",
                    "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", str(final_path),
                ])
                subprocess.run(cmd, capture_output=True, text=True, timeout=180)

        if not final_path.exists() or final_path.stat().st_size == 0 or not has_video_stream(final_path):
            final_path.unlink(missing_ok=True)
            raise RuntimeError("FFmpeg could not produce the output video with a valid video stream.")

        CLIP_JOBS[token].update({
            "status": "complete",
            "message": "Clip ready.",
            "progress": 100,
            "result": {
                "success": True,
                "token": token,
                "job_id": token,
                "download_url": f"http://127.0.0.1:{PORT}/files/{token}",
                "cleanup_url": f"http://127.0.0.1:{PORT}/files/{token}",
                "file_name": final_name,
                "mime_type": "video/mp4",
                "size_bytes": final_path.stat().st_size,
                "size_mb": round(final_path.stat().st_size / (1024 * 1024), 2),
                "duration": duration,
                "aspect_ratio": payload.aspect_ratio,
                "fit_mode": payload.fit_mode,
            },
        })
    except Exception as exc:
        final_path.unlink(missing_ok=True)
        message = str(exc)
        CLIP_JOBS[token].update({"status": "failed", "message": message[:240], "progress": 0})


@app.post("/clip", status_code=202)
def create_clip(payload: ClipRequest):
    require_dependencies()
    cleanup_expired_files()
    start = float(payload.start_time)
    end = float(payload.end_time)
    duration = end - start
    if duration < 1 or duration > 600:
        raise HTTPException(400, "Choose a clip between 1 second and 10 minutes.")
    url = str(payload.url)
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(400, "Use a YouTube link or a direct HTTP(S) video URL.")
    token = secrets.token_urlsafe(18)
    safe_title = re.sub(r"[^a-zA-Z0-9_-]+", "_", payload.title).strip("_")[:60] or "clip"
    final_name = f"{safe_title}_{int(start)}-{int(end)}_{payload.aspect_ratio.replace(':', 'x')}_{token}.mp4"
    final_path = OUTPUT_DIR / final_name
    CLIP_JOBS[token] = {"status": "processing", "message": "Starting the clipper…", "progress": 5}
    CLIP_EXECUTOR.submit(process_clip, payload, token, final_name, final_path)
    return {"success": False, "status": "processing", "job_id": token, "token": token, "status_url": f"http://127.0.0.1:{PORT}/clip/{token}"}


@app.get("/filmcraft/presets")
def filmcraft_presets():
    """List native FilmCraft export presets (e.g. Social Vertical 1080x1920, YouTube 1080p)."""
    fc_bin = get_filmcraft_path()
    if not fc_bin:
        raise HTTPException(503, "FilmCraft is not installed")
    try:
        res = subprocess.run([str(fc_bin), "export", "--list-presets"], capture_output=True, text=True, timeout=10)
        import json
        return json.loads(res.stdout)
    except Exception as exc:
        raise HTTPException(500, f"Failed to list FilmCraft presets: {exc}")


@app.post("/filmcraft/render", status_code=202)
def filmcraft_direct_render(payload: ClipRequest):
    """Directly render a social video clip using the FilmCraft GPU linear-light engine."""
    fc_bin = get_filmcraft_path()
    if not fc_bin:
        raise HTTPException(503, "FilmCraft is not installed")
    payload.engine = "filmcraft"
    return create_clip(payload)


@app.post("/batch", status_code=202)
def create_batch(payload: BatchClipRequest):
    """Queue multiple local renders without blocking the browser on each one."""
    require_dependencies()
    if not payload.clips:
        raise HTTPException(400, "At least one clip is required")
    jobs = []
    for clip in payload.clips:
        url = str(clip.url)
        if not (url.startswith("http://") or url.startswith("https://")):
            raise HTTPException(400, "Each clip must use an HTTP(S) URL")
        duration = float(clip.end_time) - float(clip.start_time)
        if duration < 1 or duration > 600:
            raise HTTPException(400, "Each clip must be between 1 second and 10 minutes")
        token = secrets.token_urlsafe(18)
        safe_title = re.sub(r"[^a-zA-Z0-9_-]+", "_", clip.title).strip("_")[:60] or "clip"
        final_name = f"{safe_title}_{int(clip.start_time)}-{int(clip.end_time)}_{clip.aspect_ratio.replace(':', 'x')}_{token}.mp4"
        final_path = OUTPUT_DIR / final_name
        CLIP_JOBS[token] = {"status": "processing", "message": "Queued by daily autopilot…", "progress": 5}
        CLIP_EXECUTOR.submit(process_clip, clip, token, final_name, final_path)
        jobs.append({"job_id": token, "token": token, "status_url": f"http://127.0.0.1:{PORT}/clip/{token}"})
    return {"success": True, "status": "processing", "jobs": jobs}


@app.get("/clip/{token}")
def clip_status(token: str):
    job = CLIP_JOBS.get(token)
    if not job:
        raise HTTPException(404, "Clip job not found")
    if job["status"] == "complete":
        return job["result"]
    if job["status"] == "failed":
        raise HTTPException(422, job["message"])
    return {"success": False, "status": job["status"], "message": job["message"], "progress": job.get("progress", 5)}


class UploadRequest(BaseModel):
    token: str
    upload_url: str
    content_type: str = "video/mp4"


@app.post("/upload")
def upload_clip_to_r2(payload: UploadRequest):
    """Directly stream upload the rendered MP4 file from the desktop clipper process to R2.
    This bypasses browser mixed-content / Private Network Access restrictions and saves browser memory."""
    path = file_for_token(payload.token)
    try:
        data = path.read_bytes()
        req = urllib.request.Request(
            payload.upload_url,
            data=data,
            headers={
                "Content-Type": payload.content_type,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
            method="PUT",
        )
        with urllib.request.urlopen(req, timeout=180) as resp:
            if resp.status not in (200, 201, 204):
                raise HTTPException(502, f"R2 upload failed with status {resp.status}")
        return {"success": True, "size_bytes": len(data), "file_name": path.name}
    except Exception as exc:
        raise HTTPException(500, f"Direct upload from desktop clipper failed: {exc}")


def file_for_token(token: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]{10,80}", token):
        raise HTTPException(404, "Clip not found")
    matches = list(OUTPUT_DIR.glob(f"*_{token}.mp4"))
    if not matches:
        raise HTTPException(404, "Clip not found or already cleaned up")
    return matches[0]


@app.get("/files/{token}")
def download_clip(token: str, request: Request):
    path = file_for_token(token)
    origin = request.headers.get("origin") or "*"
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=path.name,
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Private-Network": "true",
            "Access-Control-Expose-Headers": "*",
        },
    )


@app.delete("/files/{token}")
def delete_clip(token: str):
    path = file_for_token(token)
    path.unlink(missing_ok=True)
    return {"success": True}
