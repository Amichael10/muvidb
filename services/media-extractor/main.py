import os
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="MuviDB Media Extractor Microservice", version="1.0.0")

AUTH_SECRET = os.getenv("EXTRACTOR_SECRET", "").strip()

class ExtractRequest(BaseModel):
    url: str

@app.get("/")
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "media-extractor", "version": "1.0.0"}

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
        'format': 'best',
    }

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
                "title": info.get("title") or info.get("description", "")[:80] or "Instagram Video",
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
