#!/usr/bin/env python3
"""
Lumi Cast & Crew Extractor
Extracts cast/crew from Nollywood YouTube videos using frame capture + AI Vision
Primary:  Grok Vision  (xAI free tier)
Fallback: Gemini Flash (Google free tier)
"""

import os
import sys
import base64
import subprocess
import shutil
import re
import requests
from pathlib import Path

# ── Environment Prep ──────────────────────────────────────────────────────────
# Add common user script locations to PATH (especially for Windows)
USER_SCRIPTS = str(Path.home() / "AppData" / "Roaming" / "Python" / "Python313" / "Scripts")
if USER_SCRIPTS not in os.environ["PATH"]:
    os.environ["PATH"] = USER_SCRIPTS + os.pathsep + os.environ["PATH"]

# Load .env if possible
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Config ────────────────────────────────────────────────────────────────────
INTRO_DURATION  = 180   # first 3 minutes
OUTRO_DURATION  = 300   # last 5 minutes
FRAME_INTERVAL  = 3     # one frame every N seconds
MAX_FRAMES      = 20    # max frames per section sent to AI

# Use local workspace for temp files to avoid path issues on Windows
BASE_TEMP_DIR   = Path.cwd() / "temp_lumi"
FRAMES_DIR      = BASE_TEMP_DIR / "frames"

GROK_API_KEY    = os.getenv("GROK_API_KEY")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY")

YT_BASE_FLAGS   = ["--no-check-certificates", "--no-playlist", "--quiet"]


# ── Dependency Checks ─────────────────────────────────────────────────────────

def check_dependencies():
    """Check if required system binaries are available."""
    missing = []
    # Check for ffmpeg
    if not shutil.which("ffmpeg"):
        missing.append("ffmpeg")
    
    # Check for yt-dlp (as module or binary)
    yt_dlp_ok = False
    if shutil.which("yt-dlp"):
        yt_dlp_ok = True
    else:
        try:
            subprocess.run([sys.executable, "-m", "yt_dlp", "--version"], capture_output=True, check=True)
            yt_dlp_ok = True
        except:
            pass
            
    if not yt_dlp_ok:
        missing.append("yt-dlp")
    
    if missing:
        print(f"\n❌ Error: Missing system dependencies: {', '.join(missing)}")
        if "ffmpeg" in missing:
            print("   Please install ffmpeg (e.g., 'choco install ffmpeg' or download from ffmpeg.org)")
        if "yt-dlp" in missing:
            print("   Please install yt-dlp (e.g., 'pip install yt-dlp')")
        return False
    return True


# ── AI Orchestrator ───────────────────────────────────────────────────────────

class AIOrchestrator:
    def __init__(self):
        self.grok_client = None
        self.gemini_client = None
        self.available_providers = []
        self._init_providers()

    def _init_providers(self):
        """Initialise all available AI clients."""
        if GROK_API_KEY:
            try:
                from openai import OpenAI
                self.grok_client = OpenAI(api_key=GROK_API_KEY, base_url="https://api.x.ai/v1")
                self.available_providers.append("grok")
            except Exception as e:
                print(f"  ⚠️ Failed to init Grok: {e}")

        if GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                self.gemini_client = genai.GenerativeModel("gemini-1.5-flash")
                self.available_providers.append("gemini")
            except Exception as e:
                print(f"  ⚠️ Failed to init Gemini: {e}")

        if not self.available_providers:
            raise RuntimeError("No AI providers available. Check your API keys and dependencies.")

    def run_task(self, task_name, fn_grok, fn_gemini, *args, **kwargs):
        """Try Grok first, fallback to Gemini on any error."""
        # We'll try Grok first if it's available
        tried_grok = False
        if "grok" in self.available_providers:
            try:
                tried_grok = True
                print(f"  → Attempting '{task_name}' via Grok...")
                return fn_grok(self.grok_client, *args, **kwargs), "grok"
            except Exception as e:
                print(f"  ❌ Grok Error during '{task_name}': {e}")
                if "gemini" not in self.available_providers:
                    raise

        # Fallback to Gemini
        if "gemini" in self.available_providers:
            try:
                if tried_grok:
                    print(f"  🔄 Falling back to Gemini for '{task_name}'...")
                else:
                    print(f"  → Attempting '{task_name}' via Gemini...")
                return fn_gemini(self.gemini_client, *args, **kwargs), "gemini"
            except Exception as e:
                print(f"  ❌ Gemini Error during '{task_name}': {e}")
                raise

        raise RuntimeError(f"All providers failed for task '{task_name}'")


# ── Video Helpers ─────────────────────────────────────────────────────────────

def get_video_info(url: str) -> tuple[str, float]:
    """Return (title, duration_seconds)."""
    print("  → Fetching video metadata...")
    # Use python -m yt_dlp for better reliability
    result = subprocess.run(
        [sys.executable, "-m", "yt_dlp", *YT_BASE_FLAGS, "--print", "title,duration", url],
        capture_output=True, text=True
    )
    lines = result.stdout.strip().splitlines()
    title    = lines[0] if lines else "unknown_movie"
    try:
        duration = float(lines[1]) if len(lines) > 1 else 0.0
    except (ValueError, IndexError):
        duration = 0.0
        
    print(f"     Title:    {title}")
    print(f"     Duration: {int(duration//60)}m {int(duration%60)}s")
    return title, duration


def download_segment(url: str, start: float, duration: float, out_path: Path):
    """Download a specific time segment."""
    print(f"  → Segment {int(start//60)}m{int(start%60)}s "
          f"(+{int(duration//60)}m{int(duration%60)}s)...")
    
    # Ensure parent dir exists
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    subprocess.run([
        sys.executable, "-m", "yt_dlp", *YT_BASE_FLAGS,
        "--download-sections", f"*{int(start)}-{int(start+duration)}",
        "--force-keyframes-at-cuts",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "-o", str(out_path),
        url
    ], check=True)


def extract_frames(video_path: Path, out_dir: Path, label: str) -> list[Path]:
    """Extract one frame every FRAME_INTERVAL seconds."""
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-i", str(video_path),
        "-vf", f"fps=1/{FRAME_INTERVAL}",
        str(out_dir / f"{label}_%03d.jpg"),
        "-loglevel", "error"
    ], check=True)
    frames = sorted(out_dir.glob(f"{label}_*.jpg"))
    print(f"     {len(frames)} frames captured")
    return frames[:MAX_FRAMES]


def encode_image(path: Path) -> str:
    """Base64-encode a JPEG."""
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


# ── Prompts ───────────────────────────────────────────────────────────────────

CREDITS_PROMPT = """These are frames from the {section} of a Nollywood movie.
Look carefully at every frame for any visible cast or crew credit text:
actor names, character names, director, producer, cinematographer,
editor, music, costume, makeup, executive producer, etc.
Extract ALL names and roles you can see.
Ignore subtitles, dialogue text, and channel watermarks.
Return only the raw extracted text, one entry per line.
If no credits are visible in a frame, skip it silently."""

STRUCTURE_PROMPT = """You are building a Nollywood film database called Lumi.
Below is raw text extracted from the credits of a movie called '{title}'.
Some text may be garbled, duplicated, or noisy from OCR on video frames.
Clean it up using your knowledge of Nollywood naming conventions to fix obvious errors.
Deduplicate entries. Separate cast from crew.

Return ONLY a markdown document with these sections (skip any with no data):
# Cast
(Include character names if visible)

# Director
# Producers
(Including Executive Producers)

# Cinematography
# Continuity
# Editor
# Music
# Costume & Makeup
# Crew
(Any other crew roles like Sound, Gaffer, etc.)

# Notes
(Anything unclear or ambiguous)

RAW TEXT:
{raw}"""


# ── Grok Functions ────────────────────────────────────────────────────────────

def extract_credits_grok(client, frames: list[Path], section: str) -> str:
    if not frames:
        return ""
    content = [{"type": "text", "text": CREDITS_PROMPT.format(section=section)}]
    for frame in frames:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{encode_image(frame)}"}
        })
    response = client.chat.completions.create(
        model="grok-2-vision-1212",
        messages=[{"role": "user", "content": content}],
        max_tokens=2000
    )
    return response.choices[0].message.content


def structure_credits_grok(client, intro_raw: str, outro_raw: str, title: str) -> str:
    combined = f"INTRO CREDITS:\n{intro_raw}\n\nOUTRO CREDITS:\n{outro_raw}"
    response = client.chat.completions.create(
        model="grok-3-fast-beta",
        messages=[{"role": "user", "content": STRUCTURE_PROMPT.format(title=title, raw=combined)}],
        max_tokens=3000
    )
    return response.choices[0].message.content


# ── Gemini Functions ──────────────────────────────────────────────────────────

def extract_credits_gemini(client, frames: list[Path], section: str) -> str:
    if not frames:
        return ""
    from PIL import Image
    images  = [Image.open(f) for f in frames]
    prompt  = CREDITS_PROMPT.format(section=section)
    response = client.generate_content([prompt, *images])
    return response.text


def structure_credits_gemini(client, intro_raw: str, outro_raw: str, title: str) -> str:
    combined = f"INTRO CREDITS:\n{intro_raw}\n\nOUTRO CREDITS:\n{outro_raw}"
    response = client.generate_content(
        STRUCTURE_PROMPT.format(title=title, raw=combined)
    )
    return response.text


# ── Supabase Integration ──────────────────────────────────────────────────────

class SupabaseSync:
    def __init__(self):
        self.url = os.getenv("VITE_SUPABASE_URL")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not self.url or not self.key:
            print("\n  ⚠️ Supabase credentials missing (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
            print("     Skipping automated database synchronization.")
            self.enabled = False
        else:
            self.enabled = True
            self.headers = {
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }

    def _extract_video_id(self, url: str) -> str:
        match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
        return match.group(1) if match else ""

    def find_film(self, youtube_url: str):
        if not self.enabled: return None
        video_id = self._extract_video_id(youtube_url)
        
        # Try finding by exact URL or Video ID
        query = f"{self.url}/rest/v1/films?or=(youtube_watch_url.eq.{youtube_url},source_video_id.eq.{video_id})"
        res = requests.get(query, headers=self.headers)
        if res.status_code == 200 and res.json():
            return res.json()[0]
        return None

    def upsert_person(self, name: str) -> str:
        # Exact match check
        query = f"{self.url}/rest/v1/people?name=ilike.{name}&select=id"
        res = requests.get(query, headers=self.headers)
        if res.status_code == 200 and res.json():
            return res.json()[0]['id']
        
        # Create new person if not found
        payload = {"name": name, "nationality": "Nigerian"}
        res = requests.post(f"{self.url}/rest/v1/people", headers=self.headers, json=payload)
        if res.status_code in [201, 200] and res.json():
            return res.json()[0]['id']
        return ""

    def link_credit(self, film_id: str, person_id: str, role: str, char_name: str = "", order: int = 0):
        # Check for existing
        q = f"{self.url}/rest/v1/credits?film_id=eq.{film_id}&person_id=eq.{person_id}&role=eq.{role}"
        if char_name: q += f"&character_name=eq.{char_name}"
        
        check = requests.get(q, headers=self.headers)
        if check.status_code == 200 and check.json():
            return # Already linked

        payload = {
            "film_id": film_id,
            "person_id": person_id,
            "role": role,
            "character_name": char_name,
            "billing_order": order
        }
        requests.post(f"{self.url}/rest/v1/credits", headers=self.headers, json=payload)

    def process(self, youtube_url: str, markdown: str):
        if not self.enabled: return
        
        print("\n[Sync] Synchronising with Supabase...")
        film = self.find_film(youtube_url)
        if not film:
            print(f"  ❌ Film not found in database for URL: {youtube_url}")
            print("     Make sure the film is already imported/synced to the dashboard.")
            return

        film_id = film['id']
        print(f"  → Found Film: {film['title']} (ID: {film_id[:8]}...)")

        # Basic Markdown Parsing
        sections = re.split(r"^#\s+", markdown, flags=re.MULTILINE)
        role_map = {
            "Cast": "actor",
            "Director": "director",
            "Producers": "producer",
            "Cinematography": "cinematographer",
            "Editor": "editor",
            "Music": "composer",
            "Costume & Makeup": "crew",
            "Crew": "crew"
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
                # Handle "Actor Name - Character Name" pattern
                name = entry
                char = ""
                if " - " in entry:
                    name, char = entry.split(" - ", 1)
                elif " as " in entry.lower():
                    parts = re.split(r" as ", entry, flags=re.IGNORECASE)
                    name = parts[0].strip()
                    char = parts[1].strip()

                name = name.strip()
                if not name: continue

                person_id = self.upsert_person(name)
                if person_id:
                    self.link_credit(film_id, person_id, role, char, idx)
                    linked_count += 1

        print(f"  ✅ Successfully linked {linked_count} credits to the database.")


# ── Main Pipeline ─────────────────────────────────────────────────────────────

def extract(youtube_url: str, output_dir: str = "./output") -> str:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    temp_files = []

    print("\n[0/6] Initialising AI Orchestrator...")
    orchestrator = AIOrchestrator()
    providers_used = set()

    try:
        print("\n[1/6] Getting video info...")
        # Ensure temp dir exists
        BASE_TEMP_DIR.mkdir(parents=True, exist_ok=True)
        
        title, duration = get_video_info(youtube_url)
        safe = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)

        print("\n[2/6] Downloading intro (first 3 min)...")
        intro_path = BASE_TEMP_DIR / f"lumi_intro_{safe[:30]}.mp4"
        temp_files.append(intro_path)
        download_segment(youtube_url, 0, INTRO_DURATION, intro_path)

        print("\n[3/6] Downloading outro (last 5 min)...")
        outro_start = max(0, duration - OUTRO_DURATION)
        outro_path  = BASE_TEMP_DIR / f"lumi_outro_{safe[:30]}.mp4"
        temp_files.append(outro_path)
        download_segment(youtube_url, outro_start, OUTRO_DURATION, outro_path)

        print("\n[4/6] Extracting frames...")
        intro_dir    = FRAMES_DIR / "intro"
        outro_dir    = FRAMES_DIR / "outro"
        temp_files  += [intro_dir, outro_dir]
        intro_frames = extract_frames(intro_path, intro_dir, "intro")
        outro_frames = extract_frames(outro_path, outro_dir, "outro")

        print("\n[5/6] Reading credits via Vision AI...")
        print(f"  → Processing {len(intro_frames)} intro frames...")
        intro_credits, p1 = orchestrator.run_task(
            "extract_intro", extract_credits_grok, extract_credits_gemini, intro_frames, "opening"
        )
        providers_used.add(p1)

        print(f"  → Processing {len(outro_frames)} outro frames...")
        outro_credits, p2 = orchestrator.run_task(
            "extract_outro", extract_credits_grok, extract_credits_gemini, outro_frames, "closing"
        )
        providers_used.add(p2)

        print("\n[6/6] Structuring cast & crew document...")
        markdown, p3 = orchestrator.run_task(
            "structure_credits", structure_credits_grok, structure_credits_gemini, 
            intro_credits, outro_credits, title
        )
        providers_used.add(p3)

        used_str = " + ".join(sorted(providers_used))

        header = (
            f"---\n"
            f"title: {title}\n"
            f"source: {youtube_url}\n"
            f"extracted_by: Lumi Cast Extractor ({used_str})\n"
            f"---\n\n"
        )

        out_file = output_dir / f"{safe[:60]}.md"
        out_file.write_text(header + markdown, encoding="utf-8")
        print(f"\n✅  File Saved! → {out_file}")

        # Sync to Database
        sync = SupabaseSync()
        sync.process(youtube_url, markdown)

        return str(out_file)

    finally:
        print("\n  → Cleaning up temp files...")
        for p in temp_files:
            p = Path(p)
            if p.exists():
                if p.is_dir():
                    shutil.rmtree(p)
                else:
                    p.unlink()
        if BASE_TEMP_DIR.exists() and not any(BASE_TEMP_DIR.iterdir()):
             shutil.rmtree(BASE_TEMP_DIR)


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:   python cast_extractor.py <youtube_url> [output_dir]")
        print("")
        print("Set API keys in .env or environment:")
        print("  GROK_API_KEY='xai-xxxxx'      ← primary (free tier)")
        print("  GEMINI_API_KEY='AIzaxxxxx'    ← fallback (free tier)")
        print("")
        print("Example:")
        print("  python cast_extractor.py 'https://youtube.com/watch?v=xxx' ./output")
        sys.exit(1)

    if not check_dependencies():
        sys.exit(1)

    url = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "./output"
    extract(url, out)
