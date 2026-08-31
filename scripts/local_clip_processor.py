import os
import sys
import json
import time
import tempfile
import subprocess
import yt_dlp
import requests
from dotenv import load_dotenv

# Load local environment variables (.env)
load_dotenv()

def get_google_access_token():
    """Obtain access token for Google Drive upload."""
    refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN")
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    if refresh_token and client_id and client_secret:
        res = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=30
        )
        if res.ok:
            return res.json().get("access_token")
    return None

def upload_to_google_drive(file_path, file_name, mime_type):
    """Uploads file directly to Google Drive and sets public reader permission."""
    token = get_google_access_token()
    if not token:
        raise Exception("Google Drive OAuth refresh token is not configured in .env")

    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    file_size = os.path.getsize(file_path)

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Upload-Content-Type": mime_type,
        "X-Upload-Content-Length": str(file_size),
    }

    metadata = {
        "name": file_name,
        "mimeType": mime_type,
    }
    if folder_id:
        metadata["parents"] = [folder_id]

    # Create resumable session
    init_res = requests.post(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
        headers=headers,
        json=metadata,
        timeout=30
    )
    if not init_res.ok or "Location" not in init_res.headers:
        raise Exception(f"Failed to create Google Drive session: {init_res.text}")

    upload_url = init_res.headers["Location"]

    # Stream file
    with open(file_path, "rb") as f:
        up_res = requests.put(
            upload_url,
            headers={"Content-Type": mime_type},
            data=f,
            timeout=300
        )

    if up_res.status_code not in [200, 201]:
        raise Exception(f"Google Drive upload failed: {up_res.text}")

    drive_data = up_res.json()
    file_id = drive_data.get("id")

    # Make file public reader
    try:
        requests.post(
            f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"role": "reader", "type": "anyone"},
            timeout=15
        )
    except Exception as e:
        sys.stderr.write(f"Warning setting permissions: {e}\n")

    public_url = f"https://drive.google.com/uc?export=download&id={file_id}"
    return file_id, public_url

def process_clip(payload):
    url = payload.get("url", "").strip()
    if not url:
        return {"success": False, "error": "Missing video URL"}

    start_sec = max(0.0, float(payload.get("startTime", 0)))
    end_sec = max(start_sec + 1.0, float(payload.get("endTime", start_sec + 30)))
    aspect_ratio = payload.get("aspectRatio", "9:16")
    fit_mode = payload.get("fitMode", "cover")
    title = payload.get("title", "clip")
    duration = end_sec - start_sec

    # Framing filters
    if aspect_ratio == "1:1":
        vf = "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080" if fit_mode == "cover" else "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2"
    elif aspect_ratio == "9:16":
        vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" if fit_mode == "cover" else "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"
    elif aspect_ratio == "4:5":
        vf = "scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350" if fit_mode == "cover" else "scale=1080:1350:force_original_aspect_ratio=decrease,pad=1080:1350:(ow-iw)/2:(oh-ih)/2"
    else:
        vf = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080"

    with tempfile.TemporaryDirectory() as tmpdir:
        raw_output = os.path.join(tmpdir, "raw.mp4")
        processed_output = os.path.join(tmpdir, "processed.mp4")

        cookie_file = "cookies.txt" if os.path.exists("cookies.txt") else (os.path.join("services", "media-extractor", "cookies.txt") if os.path.exists(os.path.join("services", "media-extractor", "cookies.txt")) else None)

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['web', 'mweb', 'android', 'ios'],
                }
            },
            'format': 'bestvideo[height<=1080]+bestaudio/bestvideo+bestaudio/best',
            'download_ranges': yt_dlp.utils.download_range_func(None, [(start_sec, end_sec)]),
            'force_keyframes_at_cuts': True,
            'outtmpl': raw_output,
        }
        if cookie_file:
            ydl_opts['cookiefile'] = cookie_file

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception as e:
            return {"success": False, "error": f"Download failed: {str(e)}"}

        if not os.path.exists(raw_output):
            cand = [os.path.join(tmpdir, f) for f in os.listdir(tmpdir) if f.startswith("raw")]
            if cand:
                raw_output = cand[0]
            else:
                return {"success": False, "error": "Failed to slice video segment"}

        cmd = [
            "ffmpeg", "-y", "-i", raw_output,
            "-vf", vf,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            processed_output
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0 or not os.path.exists(processed_output):
            return {"success": False, "error": f"FFmpeg error: {res.stderr[:300]}"}

        file_size = os.path.getsize(processed_output)
        safe_title = "".join(c for c in title if c.isalnum() or c in "-_").strip() or "clip"
        file_name = f"clip_{safe_title}_{int(start_sec)}_{int(end_sec)}_{aspect_ratio.replace(':', 'x')}_{int(time.time())}.mp4"

        try:
            drive_file_id, public_url = upload_to_google_drive(processed_output, file_name, "video/mp4")
            return {
                "success": True,
                "public_url": public_url,
                "drive_file_id": drive_file_id,
                "file_name": file_name,
                "duration": duration,
                "size_mb": round(file_size / (1024 * 1024), 2),
                "aspect_ratio": aspect_ratio,
                "fit_mode": fit_mode,
            }
        except Exception as e:
            return {"success": False, "error": f"Google Drive upload error: {str(e)}"}

if __name__ == "__main__":
    import base64
    payload = {}
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        try:
            # Try base64 first
            decoded = base64.b64decode(arg).decode('utf-8')
            payload = json.loads(decoded)
        except Exception:
            try:
                payload = json.loads(arg)
            except Exception:
                payload = {}
    else:
        try:
            payload = json.load(sys.stdin)
        except Exception:
            payload = {}

    result = process_clip(payload)
    print(json.dumps(result))
