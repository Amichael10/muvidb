import subprocess
import sys
import os
from pathlib import Path

# Load env
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env.local")
except:
    pass

url = "https://www.youtube.com/watch?v=uskJArLeMfM" # Alapadupe

# Configure SmartProxy if credentials exist
PROXY_USER = os.getenv("SMARTPROXY_USER", "").strip() or None
PROXY_PASS = os.getenv("SMARTPROXY_PASS", "").strip() or None
PROXY_HOST = os.getenv("SMARTPROXY_HOST", "proxy.smartproxy.net").strip()
PROXY_PORT = os.getenv("SMARTPROXY_PORT", "3120").strip()

proxy_url = None
if PROXY_USER and PROXY_PASS:
    proxy_url = f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}"

print(f"Proxy URL from env: {proxy_url}")
print(f"Target video URL: {url}\n")

# Run yt-dlp section download WITH VERBOSE output
cmd = [
    sys.executable, "-m", "yt_dlp",
    "--no-check-certificates",
    "--no-playlist",
    "--verbose",
    "--retries", "5",
    "--socket-timeout", "60",
    "--extractor-args", "youtube:player_client=android,web",
    "--download-sections", "*0-300",
    "--force-keyframes-at-cuts",
    "-f", "worstvideo/worst",
    "-o", "test_intro_alapadupe.mkv",
    url
]
if proxy_url:
    cmd.extend(["--proxy", proxy_url])

print("--- Running yt-dlp verbose section download ---")
res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
print(f"Exit code: {res.returncode}")
print(f"Stdout:\n{res.stdout}")
print(f"Stderr:\n{res.stderr}")
