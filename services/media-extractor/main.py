import os
import tempfile
import base64
from typing import Optional, Tuple
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="MuviDB Media Extractor Microservice", version="1.6.0")

AUTH_SECRET = os.getenv("EXTRACTOR_SECRET", "").strip()

class ExtractRequest(BaseModel):
    url: str
    cookies: Optional[str] = None

class ClipRequest(BaseModel):
    url: str
    start_time: float
    end_time: float
    aspect_ratio: str = "9:16"  # "9:16", "1:1", "16:9", "4:5"
    fit_mode: str = "cover"     # "cover", "contain"
    title: str = "clip"
    cookies: Optional[str] = None


def decode_if_base64(raw: str) -> str:
    """Decodes base64 string if it appears to be base64 encoded cookies."""
    trimmed = raw.strip()
    if not trimmed:
        return ""
    if "# Netscape" in trimmed or "\t" in trimmed:
        return trimmed
    try:
        decoded = base64.b64decode(trimmed).decode("utf-8")
        if "# Netscape" in decoded or "\t" in decoded or "youtube.com" in decoded or "instagram.com" in decoded:
            return decoded
    except Exception:
        pass
    return trimmed


def get_cookie_file(custom_cookies: Optional[str] = None) -> Tuple[Optional[str], bool]:
    """
    Returns (path_to_cookie_file, is_temporary_file).
    Temporary files MUST be deleted in finally blocks, while static files must NOT.
    """
    # 1. Check custom cookies provided in API request payload
    if custom_cookies:
        content = decode_if_base64(custom_cookies)
        if content:
            tmp = tempfile.NamedTemporaryFile(delete=False, mode="w", suffix=".txt", encoding="utf-8")
            tmp.write(content)
            tmp.close()
            return tmp.name, True

    # 2. Check static file paths on disk
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "cookies.txt"),
        "cookies.txt",
        "/app/cookies.txt",
        os.path.join(os.path.dirname(__file__), "..", "..", "cookies.txt"),
        os.path.join(os.path.dirname(__file__), "..", "..", "scratch", "cookies.txt"),
        os.path.join(os.path.dirname(__file__), "..", "..", "scratch", "youtube_cookies.txt"),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                if content and ("youtube.com" in content or "instagram.com" in content or "Netscape" in content or ".google.com" in content):
                    return os.path.abspath(p), False
            except Exception:
                pass

    # 3. Check environment variables
    cookies_raw = (
        os.getenv("COOKIES_TXT", "").strip() or
        os.getenv("YOUTUBE_COOKIES", "").strip() or
        os.getenv("YT_COOKIES", "").strip() or
        os.getenv("YT_COOKIES_BASE64", "").strip() or
        os.getenv("INSTAGRAM_COOKIES", "").strip() or
        os.getenv("FACEBOOK_COOKIES", "").strip() or
        os.getenv("FB_COOKIES", "").strip()
    )
    session_id = os.getenv("INSTAGRAM_SESSION_ID", "").strip()

    if cookies_raw:
        content = decode_if_base64(cookies_raw)
        if content:
            tmp = tempfile.NamedTemporaryFile(delete=False, mode="w", suffix=".txt", encoding="utf-8")
            tmp.write(content)
            tmp.close()
            return tmp.name, True

    if session_id:
        # Generate Netscape cookie file for instagram.com
        tmp = tempfile.NamedTemporaryFile(delete=False, mode="w", suffix=".txt", encoding="utf-8")
        content = f"# Netscape HTTP Cookie File\n.instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\t{session_id}\n"
        tmp.write(content)
        tmp.close()
        return tmp.name, True

    return None, False


@app.get("/")
@app.get("/health")
def health_check():
    cookie_path, is_temp = get_cookie_file()
    if is_temp and cookie_path and os.path.exists(cookie_path):
        try:
            os.remove(cookie_path)
        except Exception:
            pass

    browser = os.getenv("YT_COOKIES_FROM_BROWSER", "off").strip().lower()
    return {
        "status": "ok",
        "service": "media-extractor",
        "version": "1.6.0",
        "has_cookies": bool(cookie_path) or (browser != "off"),
        "cookie_source": "file_or_env" if cookie_path else (f"browser:{browser}" if browser != "off" else "none"),
    }


@app.post("/extract")
def extract_media(req: ExtractRequest, authorization: str = Header(None)):
    if AUTH_SECRET:
        token = authorization.replace("Bearer ", "").strip() if authorization else ""
        if token != AUTH_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")

    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Missing URL")

    is_youtube = "youtube.com" in url or "youtu.be" in url

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'extract_flat': False,
        'extractor_args': {
            'youtube': {
                'player_client': ['web', 'mweb', 'android', 'ios', 'tv_embedded'],
            }
        },
        'format': 'best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]/bestvideo[ext=mp4]/bestvideo/best',
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    }

    cookie_path, is_temp_cookie = get_cookie_file(req.cookies)
    browser = os.getenv("YT_COOKIES_FROM_BROWSER", "off").strip().lower()

    if cookie_path:
        ydl_opts['cookiefile'] = cookie_path
    elif browser != "off":
        ydl_opts['cookiesfrombrowser'] = (browser,)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # If multiple entries (playlist or carousel), pick the first valid entry
            if info.get('entries'):
                entries = [e for e in info['entries'] if e]
                if entries:
                    info = entries[0]

            # Find best video URL
            video_url = None
            if info.get('url') and (info.get('vcodec') != 'none' or info.get('ext') == 'mp4'):
                video_url = info.get('url')
            elif info.get('formats'):
                # Prefer progressive MP4 with both audio and video, else any valid video
                prog = [f for f in info.get('formats', []) if f.get('url') and f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('ext') == 'mp4']
                if prog:
                    video_url = prog[-1].get('url')
                else:
                    formats = [f for f in info.get('formats', []) if f.get('url') and f.get('vcodec') != 'none']
                    if formats:
                        video_url = formats[-1].get('url')

            image_url = info.get('thumbnail')
            if not image_url and info.get('thumbnails'):
                image_url = info['thumbnails'][-1].get('url')

            return {
                "success": True,
                "title": info.get("title") or info.get("description", "")[:80] or "Video",
                "caption": info.get("description") or info.get("title") or "",
                "author": info.get("uploader") or info.get("uploader_id") or info.get("channel") or None,
                "video_url": video_url,
                "image_url": image_url,
                "duration": info.get("duration"),
                "extractor": info.get("extractor"),
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        # ONLY delete if it was a temporary file, never delete persistent disk cookie files!
        if is_temp_cookie and cookie_path and os.path.exists(cookie_path):
            try:
                os.remove(cookie_path)
            except Exception:
                pass


@app.post("/clip")
def process_clip(req: ClipRequest, authorization: str = Header(None)):
    import time
    import subprocess
    import requests

    if AUTH_SECRET:
        token = authorization.replace("Bearer ", "").strip() if authorization else ""
        if token != AUTH_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")

    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Missing URL")

    start_sec = max(0.0, float(req.start_time))
    end_sec = max(start_sec + 1.0, float(req.end_time))
    duration = end_sec - start_sec

    if req.aspect_ratio == "9:16":
        vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" if req.fit_mode == "cover" else "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"
    elif req.aspect_ratio == "1:1":
        vf = "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080" if req.fit_mode == "cover" else "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2"
    elif req.aspect_ratio == "4:5":
        vf = "scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350" if req.fit_mode == "cover" else "scale=1080:1350:force_original_aspect_ratio=decrease,pad=1080:1350:(ow-iw)/2:(oh-ih)/2"
    else:
        vf = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080"

    cookie_path, is_temp_cookie = get_cookie_file(req.cookies)
    browser = os.getenv("YT_COOKIES_FROM_BROWSER", "off").strip().lower()

    with tempfile.TemporaryDirectory() as tmpdir:
        raw_output = os.path.join(tmpdir, "raw.mp4")
        processed_output = os.path.join(tmpdir, "processed.mp4")

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'writesubtitles': False,
            'writeautomaticsub': False,
            'allsubtitles': False,
            'embedsubtitles': False,
            'extractor_args': {
                'youtube': {
                    'player_client': ['web', 'mweb', 'android', 'ios', 'tv_embedded'],
                }
            },
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
            'download_ranges': yt_dlp.utils.download_range_func(None, [(start_sec, end_sec)]),
            'force_keyframes_at_cuts': True,
            'outtmpl': raw_output,
        }
        if cookie_path:
            ydl_opts['cookiefile'] = cookie_path
        elif browser != "off":
            ydl_opts['cookiesfrombrowser'] = (browser,)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception as e:
            return {"success": False, "error": f"Download failed: {str(e)}"}
        finally:
            if is_temp_cookie and cookie_path and os.path.exists(cookie_path):
                try:
                    os.remove(cookie_path)
                except Exception:
                    pass

        if not os.path.exists(raw_output):
            candidates = [f for f in os.listdir(tmpdir) if f.startswith("raw")]
            if candidates:
                raw_output = os.path.join(tmpdir, candidates[0])
            else:
                return {"success": False, "error": "Failed to slice video segment"}

        cmd = [
            "ffmpeg", "-y", "-i", raw_output,
            "-sn",
            "-vf", vf,
            "-c:v", "libx264", "-preset", "veryfast", "-threads", "2", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            processed_output
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if res.returncode != 0 or not os.path.exists(processed_output):
            return {"success": False, "error": f"FFmpeg processing failed: {res.stderr[:300]}"}

        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

        file_size = os.path.getsize(processed_output)
        safe_title = "".join(c for c in req.title if c.isalnum() or c in "-_").strip() or "clip"
        file_name = f"clip_{safe_title}_{int(start_sec)}_{int(end_sec)}_{req.aspect_ratio.replace(':', 'x')}_{int(time.time())}.mp4"

        if supabase_url and supabase_key:
            upload_url = f"{supabase_url.rstrip('/')}/storage/v1/object/social-published-assets/test-scenario/{file_name}"
            headers = {
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "video/mp4",
                "x-upsert": "true"
            }
            with open(processed_output, "rb") as f:
                up_res = requests.post(upload_url, headers=headers, data=f, timeout=120)
            if up_res.status_code not in [200, 201]:
                return {"success": False, "error": f"Cloud storage upload failed ({up_res.status_code}): {up_res.text[:200]}"}

            public_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/social-published-assets/test-scenario/{file_name}"
            return {
                "success": True,
                "public_url": public_url,
                "file_name": file_name,
                "duration": duration,
                "size_mb": round(file_size / (1024 * 1024), 2),
                "aspect_ratio": req.aspect_ratio,
                "fit_mode": req.fit_mode,
            }
        else:
            return {"success": False, "error": "Supabase storage credentials not configured on extractor"}
