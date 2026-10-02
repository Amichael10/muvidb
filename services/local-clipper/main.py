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


class PrivateNetworkAccessMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin") or "*"
        if request.method == "OPTIONS":
            response = Response(status_code=204)
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, HEAD"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Allow-Private-Network"] = "true"
            response.headers["Access-Control-Max-Age"] = "86400"
            return response

        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        response.headers["Access-Control-Expose-Headers"] = "*"
        return response


# Add CORSMiddleware first, then PrivateNetworkAccessMiddleware so PNA wraps everything (including OPTIONS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


class MetadataRequest(BaseModel):
    url: HttpUrl


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
    if not shutil.which("ffmpeg"):
        raise HTTPException(503, "FFmpeg is not installed. Run the MuviDB clipper setup script first.")


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
def health():
    cleanup_expired_files()
    return {
        "status": "ready" if shutil.which("ffmpeg") else "missing_dependency",
        "service": "muvidb-local-clipper",
        "version": "2.1.0",
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "cookie_source": "file" if is_valid_netscape_cookie_file(os.getenv("YT_COOKIES_FILE", "")) else os.getenv("YT_COOKIES_FROM_BROWSER", "chrome"),
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

    return {
        "title": info.get("title") or "",
        "duration": info.get("duration") or 0,
        "description": desc,
        "transcript": transcript,
        "chapters": chapters,
        "heatmap_peaks": heatmap_peaks,
        "description_chapters": desc_chapters[:15]
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


def process_clip(payload: ClipRequest, token: str, final_name: str, final_path: Path) -> None:
    """Fast stream-based slicing and rendering in sub-30s with master segment sharing."""
    start = float(payload.start_time)
    end = float(payload.end_time)
    duration = end - start
    require_dependencies()
    url = str(payload.url)
    try:
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
        
        # Prioritize 1080p H.264 over 4K AV1 to prevent CPU choking and timeouts
        opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "writesubtitles": False,
            "writeautomaticsub": False,
            "allsubtitles": False,
            "embedsubtitles": False,
            "format": "bestvideo[height<=1080][vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
            "extractor_args": {
                "youtube": {
                    "player_client": ["web_safari", "web_embedded", "android", "web"]
                }
            },
            "socket_timeout": 30,
            **cookie_options(),
        }

        direct_stream_url = None
        direct_audio_url = None
        direct_stream_headers = {}
        if "youtube.com" not in url and "youtu.be" not in url:
            direct_stream_url = url
        else:
            try:
                with yt_dlp.YoutubeDL(opts) as downloader:
                    info = downloader.extract_info(url, download=False)
                    rf = info.get("requested_formats")
                    if rf and len(rf) >= 2:
                        direct_stream_url = rf[0].get("url")
                        direct_audio_url = rf[1].get("url")
                        direct_stream_headers = rf[0].get("http_headers") or info.get("http_headers") or {}
                    else:
                        direct_stream_url = info.get("url")
                        direct_stream_headers = info.get("http_headers") or {}
            except Exception as e:
                print(f"[Clipper] Direct stream extract with cookies failed: {e}. Retrying unauthenticated…")
                try:
                    clean_opts = {k: v for k, v in opts.items() if k not in ("cookiefile", "cookiesfrombrowser")}
                    with yt_dlp.YoutubeDL(clean_opts) as clean_dl:
                        info = clean_dl.extract_info(url, download=False)
                        rf = info.get("requested_formats")
                        if rf and len(rf) >= 2:
                            direct_stream_url = rf[0].get("url")
                            direct_audio_url = rf[1].get("url")
                            direct_stream_headers = rf[0].get("http_headers") or info.get("http_headers") or {}
                        else:
                            direct_stream_url = info.get("url")
                            direct_stream_headers = info.get("http_headers") or {}
                except Exception as e2:
                    print(f"[Clipper] Direct stream clean extract failed: {e2}")

        CLIP_JOBS[token].update({"message": f"Slicing & rendering {payload.aspect_ratio} with FFmpeg…", "progress": 40})
        
        if direct_stream_url:
            # Trailing \r\n required by FFmpeg -headers option
            header_str = "".join(f"{key}: {value}\r\n" for key, value in direct_stream_headers.items()) if direct_stream_headers else ""
            command = ["ffmpeg", "-y"]
            if header_str:
                command.extend(["-headers", header_str])
            command.extend(["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"])
            command.extend(["-ss", str(start), "-i", direct_stream_url])
            if direct_audio_url:
                if header_str:
                    command.extend(["-headers", header_str])
                command.extend(["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"])
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
                stream_timeout = max(180, int(duration * 3) + 60)
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
                    "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]/best",
                    "download_ranges": yt_dlp.utils.download_range_func(None, [(start, end)]),
                    "force_keyframes_at_cuts": True,
                    "extractor_args": {
                        "youtube": {
                            "player_client": ["web_safari", "web_embedded", "android", "web"]
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
