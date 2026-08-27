import os
import tempfile
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="MuviDB Media Extractor Microservice", version="1.0.0")

AUTH_SECRET = os.getenv("EXTRACTOR_SECRET", "").strip()

class ExtractRequest(BaseModel):
    url: str

def get_cookie_file():
    cookies_raw = os.getenv("INSTAGRAM_COOKIES", "").strip()
    session_id = os.getenv("INSTAGRAM_SESSION_ID", "").strip()

    if cookies_raw:
        tmp = tempfile.NamedTemporaryFile(delete=False, mode="w", suffix=".txt")
        tmp.write(cookies_raw)
        tmp.close()
        return tmp.name

    if session_id:
        # Generate Netscape cookie file for instagram.com
        tmp = tempfile.NamedTemporaryFile(delete=False, mode="w", suffix=".txt")
        content = f"# Netscape HTTP Cookie File\n.instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\t{session_id}\n"
        tmp.write(content)
        tmp.close()
        return tmp.name

    return None

@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "media-extractor",
        "version": "1.1.0",
        "has_cookies": bool(os.getenv("INSTAGRAM_COOKIES") or os.getenv("INSTAGRAM_SESSION_ID"))
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

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'extract_flat': False,
        # YouTube increasingly exposes separate video/audio streams and may not
        # advertise yt-dlp's legacy `best` alias. Prefer a progressive stream
        # with audio, then fall back to a browser-playable video stream.
        'format': 'best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]/bestvideo[ext=mp4]/bestvideo/best',
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    }

    cookie_path = get_cookie_file()
    if cookie_path:
        ydl_opts['cookiefile'] = cookie_path

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Find best video URL
            video_url = None
            if info.get('url'):
                video_url = info.get('url')
            elif info.get('formats'):
                formats = [f for f in info.get('formats', []) if f.get('url') and f.get('vcodec') != 'none']
                if formats:
                    video_url = formats[-1].get('url')

            return {
                "success": True,
                "title": info.get("title") or info.get("description", "")[:80] or "Video",
                "caption": info.get("description") or info.get("title") or "",
                "author": info.get("uploader") or info.get("uploader_id") or info.get("channel") or None,
                "video_url": video_url,
                "image_url": info.get("thumbnail"),
                "duration": info.get("duration"),
                "extractor": info.get("extractor"),
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        if cookie_path and os.path.exists(cookie_path):
            try:
                os.remove(cookie_path)
            except Exception:
                pass
