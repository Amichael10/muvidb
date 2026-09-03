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

app = FastAPI(title="MuviDB Local Clipper", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def private_network_access(request: Request, call_next):
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


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
        "1:1": (720, 720),
        "4:5": (720, 900),
        "9:16": (540, 960),
        "16:9": (960, 540),
    }
    width, height = dimensions.get(aspect_ratio, (720, 720))
    if fit_mode == "contain":
        return (
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black"
        )
    return (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height}"
    )


def cookie_options() -> dict:
    cookie_file = os.getenv("YT_COOKIES_FILE", "").strip()
    if not cookie_file:
        # Convenient local fallback: keep an exported Netscape cookie file in
        # the project root. The file is ignored by Git and never uploaded.
        candidate = Path.cwd() / "cookies.txt"
        if candidate.is_file():
            cookie_file = str(candidate)
    if cookie_file and Path(cookie_file).is_file():
        return {"cookiefile": cookie_file}

    # The same local-browser approach used by MuviDB's local credits harvester.
    # Set YT_COOKIES_FROM_BROWSER=off to disable it or choose edge/firefox.
    browser = os.getenv("YT_COOKIES_FROM_BROWSER", "chrome").strip().lower()
    if browser and browser not in {"off", "none", "false", "0"}:
        return {"cookiesfrombrowser": (browser,)}
    return {}


@app.get("/health")
def health():
    cleanup_expired_files()
    return {
        "status": "ready" if shutil.which("ffmpeg") else "missing_dependency",
        "service": "muvidb-local-clipper",
        "version": "2.0.0",
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "cookie_source": "file" if os.getenv("YT_COOKIES_FILE") else os.getenv("YT_COOKIES_FROM_BROWSER", "chrome"),
    }


@app.post("/metadata")
def metadata(payload: MetadataRequest):
    """Return cookie-authenticated metadata and available English captions."""
    opts = {"quiet": True, "no_warnings": True, "noplaylist": True, **cookie_options()}
    with yt_dlp.YoutubeDL(opts) as downloader:
        info = downloader.extract_info(str(payload.url), download=False)
    transcript = ""
    subtitle_map = info.get("subtitles") or info.get("automatic_captions") or {}
    track = next((subtitle_map.get(key) for key in ("en", "en-US", "en-GB") if subtitle_map.get(key)), None)
    if track:
        subtitle_url = next((entry.get("url") for entry in track if entry.get("ext") in {"vtt", "srv3"}), track[0].get("url"))
        try:
            raw = urllib.request.urlopen(subtitle_url, timeout=15).read().decode("utf-8", "ignore")
            lines = []
            for line in raw.splitlines():
                line = re.sub(r"<[^>]+>", "", line).strip()
                if not line or line.startswith("WEBVTT") or "-->" in line or re.fullmatch(r"\d+", line):
                    continue
                if not lines or lines[-1] != line:
                    lines.append(unescape(line))
            transcript = " ".join(lines)[:12000]
        except Exception as exc:
            print(f"[Clipper] Caption fetch skipped: {exc}")
    return {"title": info.get("title") or "", "duration": info.get("duration") or 0, "description": info.get("description") or "", "transcript": transcript}


def process_clip(payload: ClipRequest, token: str, final_name: str, final_path: Path) -> None:
    """Fast stream-based slicing and rendering in sub-30s."""
    start = float(payload.start_time)
    end = float(payload.end_time)
    duration = end - start
    require_dependencies()
    url = str(payload.url)
    try:
        CLIP_JOBS[token].update({"message": "Extracting fast stream info…", "progress": 15})
        
        opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "format": "18/best[ext=mp4]/best",
            "extractor_args": {
                "youtube": {
            # web_safari/web_embedded are less likely to trigger YouTube's
            # signed-in bot wall than the default web client. Keep Android as
            # a final compatible fallback for videos that expose it.
            "player_client": ["web_safari", "web_embedded", "android", "web"]
                }
            },
            "socket_timeout": 20,
            **cookie_options(),
        }

        direct_stream_url = None
        if "youtube.com" not in url and "youtu.be" not in url:
            direct_stream_url = url
        else:
            with yt_dlp.YoutubeDL(opts) as downloader:
                try:
                    info = downloader.extract_info(url, download=False)
                    direct_stream_url = info.get("url")
                except Exception as e:
                    print(f"[Clipper] Direct stream extract fallback: {e}")

        CLIP_JOBS[token].update({"message": "Slicing & rendering optimized clip with FFmpeg…", "progress": 40})
        
        if direct_stream_url:
            # Fast direct stream slicing without saving whole 3GB video
            command = [
                "ffmpeg", "-y", "-ss", str(start), "-i", direct_stream_url,
                "-t", str(duration),
                "-vf", video_filter(payload.aspect_ratio, payload.fit_mode),
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                "-pix_fmt", "yuv420p", "-r", "30",
                "-c:a", "aac", "-b:a", "64k",
                "-movflags", "+faststart", str(final_path),
            ]
            rendered = subprocess.run(command, capture_output=True, text=True, timeout=120)
            if rendered.returncode != 0 or not final_path.exists():
                print("[Clipper] Direct stream ffmpeg error, falling back to temp file:", rendered.stderr)

        # Fallback if direct streaming failed
        if not final_path.exists() or final_path.stat().st_size == 0:
            with tempfile.TemporaryDirectory(prefix="muvidb-clip-") as workdir:
                raw_template = str(Path(workdir) / "source.%(ext)s")
                fallback_opts = {
                    "quiet": True,
                    "no_warnings": True,
                    "noplaylist": True,
                    "format": "18/bv*[height<=720]+ba/b",
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
                with yt_dlp.YoutubeDL(fallback_opts) as dl:
                    dl.download([url])

                candidates = list(Path(workdir).glob("source.*"))
                if not candidates:
                    raise RuntimeError("YouTube did not return a usable video segment.")

                cmd = [
                    "ffmpeg", "-y", "-ss", str(start), "-i", str(candidates[0]),
                    "-t", str(duration),
                    "-vf", video_filter(payload.aspect_ratio, payload.fit_mode),
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                    "-pix_fmt", "yuv420p", "-r", "30",
                    "-c:a", "aac", "-b:a", "64k",
                    "-movflags", "+faststart", str(final_path),
                ]
                subprocess.run(cmd, capture_output=True, text=True, timeout=180)

        if not final_path.exists() or final_path.stat().st_size == 0:
            raise RuntimeError("FFmpeg could not produce the output video.")

        CLIP_JOBS[token].update({
            "status": "complete",
            "message": "Clip ready.",
            "progress": 100,
            "result": {
                "success": True,
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
    return {"success": False, "status": "processing", "job_id": token, "status_url": f"http://127.0.0.1:{PORT}/clip/{token}"}


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
        jobs.append({"job_id": token, "status_url": f"http://127.0.0.1:{PORT}/clip/{token}"})
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


def file_for_token(token: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,80}", token):
        raise HTTPException(404, "Clip not found")
    matches = list(OUTPUT_DIR.glob(f"*_{token}.mp4"))
    if len(matches) != 1:
        raise HTTPException(404, "Clip not found or already cleaned up")
    return matches[0]


@app.get("/files/{token}")
def download_clip(token: str):
    path = file_for_token(token)
    return FileResponse(path, media_type="video/mp4", filename=path.name)


@app.delete("/files/{token}")
def delete_clip(token: str):
    path = file_for_token(token)
    path.unlink(missing_ok=True)
    return {"success": True}
