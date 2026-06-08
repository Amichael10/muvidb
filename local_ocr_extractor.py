#!/usr/bin/env python3
"""
Ensembla Local OCR Cast & Crew Extractor
Extracts cast/crew from Nollywood YouTube videos using:
1. Database Discovery: Self-targets YouTube films with 0-10 existing credits.
2. Slicing & Frame Capture: yt-dlp + ffmpeg (first 5m and last 8m).
3. Frame De-duplication: Perceptual Hashing (imagehash) to drop duplicate static frames.
4. Image Preprocessing: OpenCV Grayscale, otsu-binarisation, and subtitle/logo margins cropping.
5. Local OCR Engine: PaddleOCR (primary) / Tesseract OCR (fallback).
6. String Similarity Matching: rapidfuzz matching against your Supabase DB.
7. Post-Processing Cleanup: Single text-only call to Gemini Flash to format and clean layout.
"""

import os
import sys
import base64
import subprocess
import shutil
import re
import requests
import io
import time

# Force IPv4 globally in requests/urllib3 to bypass VPS IPv6 connection hangs
try:
    import urllib3.util.connection as urllib3_cn
    urllib3_cn.HAS_IPV6 = False
except ImportError:
    pass
from urllib3.util import Retry
from requests.adapters import HTTPAdapter
from pathlib import Path
from google import genai

# Force UTF-8 for stdout/stderr to avoid encoding errors on Windows
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
if sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

# ── Dynamic Import Protection (Defensive Programming) ───────────────────────
try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False

try:
    from PIL import Image
    import imagehash
    IMAGEHASH_AVAILABLE = True
except ImportError:
    IMAGEHASH_AVAILABLE = False

try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    PADDLE_AVAILABLE = False

try:
    from rapidfuzz import process as fuzzy_process, fuzz
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

# ── Environment Prep ──────────────────────────────────────────────────────────
if sys.platform == "win32":
    USER_SCRIPTS = str(Path.home() / "AppData" / "Roaming" / "Python" / "Python313" / "Scripts")
    paths_to_add = [
        USER_SCRIPTS,
        r"C:\ffmpeg\ffmpeg-8.1.1-essentials_build\bin",
        r"C:\Program Files\nodejs",
        r"C:\Users\User\AppData\Roaming\npm"
    ]
    for p in paths_to_add:
        if p not in os.environ["PATH"]:
            os.environ["PATH"] = p + os.pathsep + os.environ["PATH"]
else:
    linux_paths = [str(Path.home() / ".local/bin"), "/usr/local/bin"]
    for p in linux_paths:
        if p not in os.environ["PATH"]:
            os.environ["PATH"] = p + os.pathsep + os.environ["PATH"]

# Ensure current Python virtualenv bin directory is in PATH (fixes yt-dlp binary search)
python_bin_dir = os.path.dirname(sys.executable)
if python_bin_dir and python_bin_dir not in os.environ["PATH"]:
    os.environ["PATH"] = python_bin_dir + os.pathsep + os.environ["PATH"]

# Load .env variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Config ────────────────────────────────────────────────────────────────────
INTRO_DURATION  = 300   # First 5 minutes
OUTRO_DURATION  = 480   # Last 8 minutes
FRAME_INTERVAL  = 2     # One frame every 2 seconds for OCR precision
HASH_THRESHOLD  = 4     # Hamming distance threshold for duplicate frame detection

BASE_TEMP_DIR   = Path.cwd() / f"temp_lumi_{os.getpid()}"
FRAMES_DIR      = BASE_TEMP_DIR / "frames"

GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "").strip() or None
GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "").strip() or None
OPENAI_API_KEY  = os.getenv("OPENAI_API_KEY", "").strip() or None

YT_BASE_FLAGS   = [
    "--no-check-certificates", 
    "--no-playlist", 
    "--quiet", 
    "--no-warnings",
    "--retries", "5", 
    "--socket-timeout", "60",
    "--extractor-args", "youtube:player_client=android,web",
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

# Configure SmartProxy if credentials exist
PROXY_USER = os.getenv("SMARTPROXY_USER", "").strip() or None
PROXY_PASS = os.getenv("SMARTPROXY_PASS", "").strip() or None
PROXY_HOST = os.getenv("SMARTPROXY_HOST", "proxy.smartproxy.net").strip()
PROXY_PORT = os.getenv("SMARTPROXY_PORT", "3120").strip()

if PROXY_USER and PROXY_PASS:
    proxy_url = f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}"
    YT_BASE_FLAGS.extend(["--proxy", proxy_url])
    # DO NOT set os.environ["HTTP_PROXY"] or os.environ["HTTPS_PROXY"] globally.
    # This ensures that ffmpeg and other network connections connect directly (which works fine),
    # while only yt-dlp's metadata/page extraction uses the proxy.

# ── Check Dependencies ────────────────────────────────────────────────────────
def check_dependencies():
    missing_bins = []
    if not shutil.which("ffmpeg"):
        missing_bins.append("ffmpeg")
    if not shutil.which("yt-dlp"):
        missing_bins.append("yt-dlp")
        
    if missing_bins:
        print(f"\n❌ Error: Missing system binaries: {', '.join(missing_bins)}")
        return False

    # Check python libraries
    missing_libs = []
    if not OPENCV_AVAILABLE: missing_libs.append("opencv-python")
    if not IMAGEHASH_AVAILABLE: missing_libs.append("imagehash")
    if not PADDLE_AVAILABLE: missing_libs.append("paddleocr")
    if not RAPIDFUZZ_AVAILABLE: missing_libs.append("rapidfuzz")
    
    if missing_libs:
        print("\n⚠️ Warning: Some local OCR Python packages are missing.")
        print(f"   Please run: pip install {' '.join(missing_libs)}")
        print("   The script will run in fallback/diagnostic mode using basic filters.\n")
        
    return True

# ── Image Preprocessing (OpenCV) ──────────────────────────────────────────────
def preprocess_frame(img_path: Path) -> Path:
    """grayscale + Otsu thresholding + crop subtitles/watermarks noise."""
    if not OPENCV_AVAILABLE:
        return img_path  # Fallback to original image if OpenCV is missing

    try:
        img = cv2.imread(str(img_path))
        if img is None:
            return img_path
            
        h, w, _ = img.shape
        
        # 1. Crop margins (Crop bottom 15% for subtitles, top 10% for channel logos)
        start_y = int(h * 0.10)
        end_y = int(h * 0.85)
        cropped = img[start_y:end_y, :]
        
        # 2. Convert to Grayscale
        gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
        
        # 3. Apply Otsu Adaptive Thresholding (turns high-contrast text pure white on pure black background)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        out_path = img_path.parent / f"processed_{img_path.name}"
        cv2.imwrite(str(out_path), thresh)
        return out_path
    except Exception as e:
        print(f"     ⚠️ OpenCV pre-processing failed: {e}")
        return img_path

# ── Frame Deduplication (Perceptual Hashing) ──────────────────────────────────
def filter_unique_frames(frames: list[Path]) -> list[Path]:
    """Uses perceptual hashing (dhash) to drop duplicate frames (Hamming distance < HASH_THRESHOLD)."""
    if not IMAGEHASH_AVAILABLE or not frames:
        return frames

    print(f"  [imagehash] Filtering {len(frames)} frames for duplicates...")
    unique_frames = []
    last_hash = None

    for frame in frames:
        try:
            with Image.open(frame) as img:
                current_hash = imagehash.dhash(img)
                
            if last_hash is None:
                unique_frames.append(frame)
                last_hash = current_hash
            else:
                # Calculate Hamming distance (difference between hashes)
                distance = current_hash - last_hash
                if distance >= HASH_THRESHOLD:
                    unique_frames.append(frame)
                    last_hash = current_hash
        except Exception as e:
            unique_frames.append(frame)  # Add on error just in case

    print(f"  [imagehash] Retained {len(unique_frames)} / {len(frames)} unique credit frames.")
    return unique_frames

# ── Local OCR Engine Runner ───────────────────────────────────────────────────
class LocalOCR:
    def __init__(self):
        self.paddle_ocr = None
        self._init_paddle()

    def _init_paddle(self):
        if PADDLE_AVAILABLE:
            last_err = None
            for args in [
                {"use_angle_cls": True, "lang": "en", "show_log": False, "enable_mkldnn": False},
                {"lang": "en", "show_log": False, "enable_mkldnn": False},
                {"lang": "en", "enable_mkldnn": False},
            ]:
                try:
                    self.paddle_ocr = PaddleOCR(**args)
                    print("  ✓ Local PaddleOCR engine loaded successfully.")
                    return
                except Exception as e:
                    last_err = e
                    continue
            print(f"  ⚠️ Failed to initialize PaddleOCR with any arguments. Error: {last_err}")

    def read_text(self, img_path: Path) -> str:
        """Reads text from a frame using PaddleOCR, falling back to Tesseract."""
        extracted_lines = []

        # 1. Primary: PaddleOCR
        if self.paddle_ocr:
            try:
                try:
                    result = self.paddle_ocr.ocr(str(img_path))
                except TypeError:
                    result = self.paddle_ocr.ocr(str(img_path), cls=True)
                
                if result and result[0]:
                    for line in result[0]:
                        text = line[1][0]
                        confidence = line[1][1]
                        if confidence > 0.4:
                            extracted_lines.append(text)
                    return "\n".join(extracted_lines)
            except Exception as e:
                print(f"     ⚠️ PaddleOCR execution failed: {e}")

        # 2. Fallback: Tesseract OCR
        if TESSERACT_AVAILABLE:
            try:
                with Image.open(img_path) as img:
                    text = pytesseract.image_to_string(img)
                    return text
            except Exception as e:
                pass

        # 3. Final Fallback: Vision AI mock text detection notice
        return ""

# ── Video Slicing Helpers ─────────────────────────────────────────────────────
def get_video_info(url: str) -> tuple[str, float]:
    info_file = BASE_TEMP_DIR / "yt_info.txt"
    for attempt in range(1, 4):
        try:
            BASE_TEMP_DIR.mkdir(parents=True, exist_ok=True)
            with open(info_file, "w", encoding="utf-8") as f:
                result = subprocess.run(
                    [sys.executable, "-m", "yt_dlp", *YT_BASE_FLAGS, "--print", "title,duration", url],
                    stdout=f, stderr=subprocess.PIPE, text=True, timeout=120
                )
            if result.returncode != 0:
                if attempt < 3:
                    time.sleep(5)
                    continue
                return "unknown_movie", 0.0
                
            lines = info_file.read_text(encoding="utf-8").strip().splitlines()
            title = lines[0] if lines else "unknown_movie"
            try:
                duration = float(lines[1]) if len(lines) > 1 else 0.0
            except:
                duration = 0.0
            return title, duration
        except Exception:
            if attempt < 3:
                time.sleep(5)
                continue
            return "unknown_movie", 0.0
        finally:
            if info_file.exists():
                info_file.unlink()
    return "unknown_movie", 0.0

def download_segment(url: str, start: float, duration: float, out_path: Path):
    print(f"  [Download Slicer] Fetching segment {int(start//60)}m{int(start%60)}s "
          f"({int(duration)} seconds)...")
    for attempt in range(1, 4):
        try:
            subprocess.run([
                sys.executable, "-m", "yt_dlp", *YT_BASE_FLAGS,
                "--download-sections", f"*{int(start)}-{int(start+duration)}",
                "--force-keyframes-at-cuts",
                "-f", "worstvideo/worst",
                "-o", str(out_path),
                url
            ], check=True, timeout=400)
            return
        except Exception as e:
            if attempt == 3: raise e
            time.sleep(5)

def extract_frames(video_path: Path, out_dir: Path, label: str) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y", "-i", str(video_path),
        "-vf", f"fps=1/{FRAME_INTERVAL}",
        str(out_dir / f"{label}_%03d.jpg"),
        "-loglevel", "error"
    ], check=True, timeout=120)
    return sorted(out_dir.glob(f"{label}_*.jpg"))

# ── AI Formatting Prompts ─────────────────────────────────────────────────────
AI_STRUCTURE_PROMPT = """You are building a Nollywood film database called Ensembla.
Below is raw text extracted via Local OCR from the credit cards of a movie called '{title}'.
Some characters may be garbled, misspelled, duplicated, or out of order due to video background noise.
Clean it up using Nollywood industry knowledge. Deduplicate entries. Separate cast from crew.

Return ONLY a markdown document with these sections (skip empty sections):
# Cast
Format EXACTLY like this:
- Actor Name - Character Name (e.g. - Maurice Sam - Prince Caleb)
If NO character name is visible, write only:
- Actor Name

# Director
Format EXACTLY:
- Director Name - Director

# Producers
Format EXACTLY:
- Producer Name - Specific Role (e.g. - Jane Producer - Executive Producer)

# Cinematography
Format EXACTLY:
- Cinematographer Name - Cinematographer

# Editor
Format EXACTLY:
- Editor Name - Editor

# Music
Format EXACTLY:
- Composer Name - Composer

# Costume & Makeup
Format EXACTLY:
- Crew Name - Specific Role (e.g. - Mary Makeup - Makeup Artist, Wardrobe Designer - Costumier)

# Crew
(All other roles like Gaffer, Sound, PM, Continuity, etc.)
Format EXACTLY:
- Crew Name - Specific Role (e.g. - John Gaf - Gaffer)

RAW OCR TEXT:
{raw}"""

def local_regex_fallback(title: str, raw_text: str) -> str:
    """Failsafe regex-based parser when all LLM API tokens are exhausted."""
    print("  [Failsafe Fallback] Performing local regex-based structural grouping...")
    lines = raw_text.splitlines()
    cast = []
    directors = []
    producers = []
    crew = []
    
    # Simple common Nollywood roles
    director_pat = re.compile(r'(director|directed)', re.IGNORECASE)
    producer_pat = re.compile(r'(producer|produced)', re.IGNORECASE)
    actor_pat = re.compile(r'(cast|starring|actor|actress)', re.IGNORECASE)
    
    current_section = "crew"
    
    for line in lines:
        line = line.strip()
        if not line: continue
        if "---" in line: continue
        
        # Determine section indicators
        if director_pat.search(line):
            current_section = "director"
        elif producer_pat.search(line):
            current_section = "producer"
        elif actor_pat.search(line):
            current_section = "cast"
            
        # Clean clean candidate names (Title Case, 2-3 words)
        words = line.split()
        if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w.isalpha()):
            name = " ".join(words)
            if current_section == "director":
                directors.append(f"- {name} - Director")
            elif current_section == "producer":
                producers.append(f"- {name} - Producer")
            elif current_section == "cast":
                cast.append(f"- {name}")
            else:
                crew.append(f"- {name} - Crew")
                
    markdown = []
    if cast:
        markdown.append("# Cast\n" + "\n".join(cast))
    if directors:
        markdown.append("# Director\n" + "\n".join(directors))
    if producers:
        markdown.append("# Producers\n" + "\n".join(producers))
    if crew:
        markdown.append("# Crew\n" + "\n".join(crew))
        
    if not markdown:
        # Final absolute fallback: just print clean lines
        clean_lines = [f"- {l.strip()}" for l in lines if len(l.strip()) > 3]
        return "# Crew\n" + "\n".join(clean_lines)
        
    return "\n\n".join(markdown)

def run_ai_cleanup(title: str, raw_text: str) -> str:
    """Triple-redundant formatting chain: Gemini Flash -> Groq Llama -> OpenAI -> Local Failsafe."""
    prompt = AI_STRUCTURE_PROMPT.format(title=title, raw=raw_text)

    # 1. Primary: Gemini Flash
    if GEMINI_API_KEY:
        print("  [LLM Chain 1/3] Structuring raw text via Gemini Flash...")
        try:
            client = genai.Client(api_key=GEMINI_API_KEY)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            if response.text and response.text.strip():
                return response.text
        except Exception as e:
            print(f"  ⚠️ Gemini Flash formatting failed: {e}")

    # 2. Fallback: Groq Llama-3.3-70b-versatile (direct REST request)
    if GROQ_API_KEY:
        print("  [LLM Chain 2/3] Gemini failed. Falling back to Groq (Llama 70B)...")
        try:
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1
            }
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=30)
            if res.status_code == 200:
                result = res.json()["choices"][0]["message"]["content"]
                if result and result.strip():
                    return result
            else:
                print(f"  ⚠️ Groq API responded with code {res.status_code}: {res.text}")
        except Exception as e:
            print(f"  ⚠️ Groq formatting fallback failed: {e}")

    # 3. Fallback: OpenAI GPT-4o-mini (direct REST request)
    if OPENAI_API_KEY:
        print("  [LLM Chain 3/3] Groq failed. Falling back to OpenAI (GPT-4o-mini)...")
        try:
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1
            }
            res = requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=30)
            if res.status_code == 200:
                result = res.json()["choices"][0]["message"]["content"]
                if result and result.strip():
                    return result
            else:
                print(f"  ⚠️ OpenAI API responded with code {res.status_code}: {res.text}")
        except Exception as e:
            print(f"  ⚠️ OpenAI formatting fallback failed: {e}")

    # 4. Zero-AI Failsafe: Python Regex based fallback
    return local_regex_fallback(title, raw_text)

# ── Supabase Integration ──────────────────────────────────────────────────────
class SupabaseSync:
    def __init__(self):
        self.url = os.getenv("VITE_SUPABASE_URL", "").strip() or None
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None
        if not self.url or not self.key:
            self.enabled = False
        else:
            self.enabled = True
            self.headers = {
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            # Configure persistent session with automatic retries for robust proxy tunneling
            self.session = requests.Session()
            self.session.trust_env = False
            retries = Retry(
                total=5,
                connect=5,
                read=5,
                backoff_factor=1.5,
                status_forcelist=[500, 502, 503, 504, 612],
                raise_on_status=False
            )
            adapter = HTTPAdapter(max_retries=retries)
            self.session.mount("http://", adapter)
            self.session.mount("https://", adapter)

    def _request(self, method: str, url: str, **kwargs) -> requests.Response:
        """Robust request wrapper with explicit retry loop to handle SSL and Proxy flakes."""
        max_attempts = 4
        backoff = 2.0
        for attempt in range(1, max_attempts + 1):
            try:
                if 'timeout' not in kwargs:
                    kwargs['timeout'] = 30
                
                if attempt > 1:
                    print(f"    🔄 Retrying Supabase {method} request (attempt {attempt}/{max_attempts})...")
                
                res = self.session.request(method, url, **kwargs)
                
                # Check for proxy custom error code 612 or other server issues
                if res.status_code in [500, 502, 503, 504, 612]:
                    raise requests.exceptions.RequestException(f"Bad status code: {res.status_code} - {res.text}")
                
                # Tiny pacing delay to prevent proxy/DB gateway exhaustion
                time.sleep(0.15)
                return res
            except (requests.exceptions.RequestException, Exception) as e:
                if attempt == max_attempts:
                    print(f"  ❌ Supabase request failed after {max_attempts} attempts: {e}")
                    raise e
                time.sleep(backoff * attempt)

    def fetch_incomplete_youtube_films(self) -> list[dict]:
        """Phase 0: Query films table for youtube source and nested credit IDs to find incomplete pages (0-10 credits)."""
        if not self.enabled:
            return []
        
        print("\n[Phase 0] Querying Supabase for films with 0 to 10 credits...")
        # Rest query to grab films and credits relation
        query_url = f"{self.url}/rest/v1/films?source=eq.youtube&select=id,title,youtube_watch_url,credits(id)"
        try:
            res = self._request("GET", query_url, headers=self.headers)
            if res.status_code != 200:
                print(f"  ❌ Supabase query failed: {res.status_code} {res.text}")
                return []
            
            all_films = res.json()
            incomplete = []
            for f in all_films:
                credits_count = len(f.get("credits", []))
                if 0 <= credits_count <= 10 and f.get("youtube_watch_url"):
                    f["credits_count"] = credits_count
                    incomplete.append(f)
            
            print(f"  ✓ Found {len(incomplete)} incomplete films in the database.")
            return incomplete
        except Exception as e:
            print(f"  ❌ Error fetching incomplete films: {e}")
            return []

    def find_film(self, youtube_url: str):
        if not self.enabled: return None
        video_id = youtube_url.split("v=")[-1].split("&")[0] if "v=" in youtube_url else ""
        query = f"{self.url}/rest/v1/films?or=(youtube_watch_url.eq.{youtube_url},source_video_id.eq.{video_id})&select=id,title,youtube_watch_url,credits(id)"
        res = self._request("GET", query, headers=self.headers)
        if res.status_code == 200 and res.json():
            return res.json()[0]
        return None

    def upsert_person(self, name: str) -> str:
        # Rapidfuzz lookup fallback inside database can be done by standard lookup
        query = f"{self.url}/rest/v1/people?name=ilike.{name}&select=id"
        res = self._request("GET", query, headers=self.headers)
        if res.status_code == 200 and res.json():
            return res.json()[0]['id']
            
        payload = {"name": name, "nationality": "Nigerian"}
        res = self._request("POST", f"{self.url}/rest/v1/people", headers=self.headers, json=payload)
        if res.status_code in [201, 200] and res.json():
            return res.json()[0]['id']
        return ""

    def link_credit(self, film_id: str, person_id: str, role: str, char_name: str = "", order: int = 0):
        q = f"{self.url}/rest/v1/credits?film_id=eq.{film_id}&person_id=eq.{person_id}&role=eq.{role}"
        if char_name: q += f"&character_name=eq.{char_name}"
        check = self._request("GET", q, headers=self.headers)
        if check.status_code == 200 and check.json():
            return

        payload = {
            "film_id": film_id,
            "person_id": person_id,
            "role": role,
            "character_name": char_name,
            "billing_order": order
        }
        self._request("POST", f"{self.url}/rest/v1/credits", headers=self.headers, json=payload)

    def process(self, youtube_url: str, markdown: str):
        if not self.enabled: return
        film = self.find_film(youtube_url)
        if not film: return
        film_id = film['id']
        
        sections = re.split(r"^#\s+", markdown, flags=re.MULTILINE)
        role_map = {
            "Cast": "actor", "Director": "director", "Producers": "producer",
            "Cinematography": "cinematographer", "Editor": "editor", "Music": "composer",
            "Costume & Makeup": "crew", "Crew": "crew"
        }

        linked_count = 0
        for section in sections:
            lines = section.strip().split('\n')
            if not lines: continue
            header = lines[0].strip()
            role = role_map.get(header)
            if not role: continue
            entries = [l.strip('- ').strip() for l in lines[1:] if l.strip() and not l.startswith('(')]
            
            for idx, entry in enumerate(entries):
                try:
                    name, char, specific_role = entry, "", role
                    parts = []
                    if " - " in entry: parts = entry.split(" - ", 1)
                    elif " – " in entry: parts = entry.split(" – ", 1)
                    elif " as " in entry.lower(): parts = re.split(r"\s+as\s+", entry, flags=re.IGNORECASE)
                    elif " : " in entry: parts = entry.split(" : ", 1)
                    
                    if parts:
                        name = parts[0].strip()
                        extra = parts[1].strip()
                        if role == "actor": char = extra
                        else: specific_role = extra
                    else:
                        if role == "producer": specific_role = "Producer"
                        elif role == "cinematographer": specific_role = "Cinematographer"
                        elif role == "editor": specific_role = "Editor"
                        elif role == "composer": specific_role = "Composer"
                        elif role == "crew": specific_role = "Crew"
                        elif role == "director": specific_role = "Director"
                    
                    name = name.strip()
                    if not name: continue
                    person_id = self.upsert_person(name)
                    if person_id:
                        self.link_credit(film_id, person_id, specific_role, char, idx)
                        linked_count += 1
                except Exception as entry_err:
                    print(f"    ⚠️ Failed to sync credit entry '{entry}': {entry_err}")
        print(f"  ✓ Linked {linked_count} credits to the film in database.")

# ── Main Batch Runner ─────────────────────────────────────────────────────────
def main():
    if not check_dependencies():
        sys.exit(1)

    sync = SupabaseSync()
    if not sync.enabled:
        print("❌ Supabase keys missing. Run setup-youtube.sql and populate .env files.")
        sys.exit(1)

    # 1. Fetch incomplete films (0-10 credits) or use command line argument
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
        print(f"\n🎬 Target YouTube URL provided: {target_url}")
        
        film = sync.find_film(target_url)
        if not film:
            print(f"❌ Film not found in database for URL: {target_url}")
            sys.exit(1)
            
        credits_count = len(film.get("credits", []))
        print(f"🔍 Film: '{film['title']}' has {credits_count} existing credits.")
        
        if not (0 <= credits_count <= 10):
            print(f"⚠️ Skipped: Film has {credits_count} credits, which is outside the 0-10 cast and crew limit.")
            sys.exit(0)
            
        film["credits_count"] = credits_count
        incomplete_queue = [film]
    else:
        incomplete_queue = sync.fetch_incomplete_youtube_films()
        if not incomplete_queue:
            print("✅ No incomplete YouTube films with 0 to 10 credits found. Nothing to parse!")
            sys.exit(0)

    print(f"\n🚀 Starting batch OCR extraction for {len(incomplete_queue)} films...")
    
    ocr = LocalOCR()
    output_dir = Path("./output")
    output_dir.mkdir(parents=True, exist_ok=True)

    for idx, film in enumerate(incomplete_queue):
        title = film["title"]
        url = film["youtube_watch_url"]
        credits_count = film["credits_count"]
        print(f"\n==============================================================================")
        print(f"🎬 [{idx+1}/{len(incomplete_queue)}] Movie: '{title}'")
        print(f"   Credits Count: {credits_count} | YouTube URL: {url}")
        print(f"==============================================================================")

        temp_files = []
        try:
            # Create video temp directories
            BASE_TEMP_DIR.mkdir(parents=True, exist_ok=True)
            safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)

            # Get video duration dynamically
            _, duration = get_video_info(url)
            if duration <= 0:
                print("  ❌ Failed to get video duration. Skipping.")
                continue

            # Download Slices
            print("  -> Downloading credit sections...")
            intro_path = BASE_TEMP_DIR / f"lumi_intro_{safe_title[:20].strip()}.mkv"
            outro_path = BASE_TEMP_DIR / f"lumi_outro_{safe_title[:20].strip()}.mkv"
            temp_files.extend([intro_path, outro_path])

            download_segment(url, 0, INTRO_DURATION, intro_path)
            outro_start = max(0, duration - OUTRO_DURATION)
            download_segment(url, outro_start, OUTRO_DURATION, outro_path)

            # Frame Capture
            print("  -> Capturing credit frames...")
            intro_dir = FRAMES_DIR / "intro"
            outro_dir = FRAMES_DIR / "outro"
            temp_files.extend([intro_dir, outro_dir])
            
            raw_intro_frames = extract_frames(intro_path, intro_dir, "intro")
            raw_outro_frames = extract_frames(outro_path, outro_dir, "outro")

            # Deduplication via Perceptual Hashing
            unique_intro = filter_unique_frames(raw_intro_frames)
            unique_outro = filter_unique_frames(raw_outro_frames)

            # OpenCV Preprocessing and OCR Execution
            print("  -> Processing images & extracting characters locally...")
            ocr_text_blocks = []

            for section_label, unique_frames in [("Intro", unique_intro), ("Outro", unique_outro)]:
                ocr_text_blocks.append(f"\n--- {section_label} Credits ---\n")
                for frame in unique_frames:
                    processed_frame = preprocess_frame(frame)
                    text = ocr.read_text(processed_frame)
                    if text.strip():
                        ocr_text_blocks.append(text)

            combined_ocr_text = "\n".join(ocr_text_blocks)

            if not combined_ocr_text.strip():
                print("  ⚠️ Local OCR detected no credit text on the screens. Skipping AI formatting.")
                continue

            # Semantic Post-Processing
            structured_markdown = run_ai_cleanup(title, combined_ocr_text)

            if not structured_markdown.strip():
                print("  ❌ Formatting failed. Credits were not compiled.")
                continue

            # Save Backup Text File
            header = (
                f"---\n"
                f"title: {title}\n"
                f"source: {url}\n"
                f"extracted_by: Local OCR Extraction Engine (PaddleOCR + imagehash)\n"
                f"---\n\n"
            )
            out_file = output_dir / f"ocr_{safe_title[:40]}.md"
            out_file.write_text(header + structured_markdown, encoding="utf-8")
            print(f"  ✓ Saved backup Markdown: {out_file}")

            # Direct Supabase Update (Apply to live Movie)
            sync.process(url, structured_markdown)

        except Exception as e:
            print(f"  ❌ Execution error on '{title}': {e}")
            if len(sys.argv) > 1:
                sys.exit(1)
        finally:
            # Clean up frames
            for path in temp_files:
                if path.exists():
                    if path.is_dir(): shutil.rmtree(path)
                    else: path.unlink()
            if BASE_TEMP_DIR.exists() and not any(BASE_TEMP_DIR.iterdir()):
                 shutil.rmtree(BASE_TEMP_DIR)

    print("\n==============================================================================")
    print("✅ Batch Local OCR processing completed!")
    print("==============================================================================")

if __name__ == "__main__":
    main()
