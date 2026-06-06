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

url = "https://www.youtube.com/watch?v=F8foEue9XFc"

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

# Run test 1: WITH Proxy
if proxy_url:
    print("--- Running yt-dlp WITH proxy ---")
    cmd = [sys.executable, "-m", "yt_dlp", "--no-check-certificates", "--quiet", "--no-warnings", "--print", "duration", "--proxy", proxy_url, url]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    print(f"Exit code: {res.returncode}")
    print(f"Stdout: {res.stdout.strip()}")
    print(f"Stderr: {res.stderr.strip()}\n")
else:
    print("Proxy credentials not found in env, skipping Test 1.\n")

# Run test 2: WITHOUT Proxy
print("--- Running yt-dlp WITHOUT proxy ---")
cmd = [sys.executable, "-m", "yt_dlp", "--no-check-certificates", "--quiet", "--no-warnings", "--print", "duration", url]
res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
print(f"Exit code: {res.returncode}")
print(f"Stdout: {res.stdout.strip()}")
print(f"Stderr: {res.stderr.strip()}\n")
