#!/usr/bin/env python3
"""
Ensembla Local OCR Cast & Crew Extractor
Extracts cast/crew from Nollywood YouTube videos using:
1. Database Discovery: Self-targets YouTube films with 0-10 existing credits.
2. Outro Download: yt-dlp + ffmpeg (last 10 min only — avoids bot detection).
3. Frame Capture: FFmpeg @ 1 frame/5s.
4. Frame De-duplication: Perceptual Hashing (imagehash) to drop duplicate static frames.
5. Vision OCR: Qwen3-VL-4B via Ollama — reads frames like a human, filters non-credit frames.
6. Post-Processing Cleanup: Gemini Flash to format and clean the extracted credits.
7. Direct Supabase Sync: Writes structured credits back to the database.
"""

import os
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"

import sys
import base64
import subprocess
import shutil
import re
import requests
import io
import json
import urllib.request
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
    load_dotenv(".env.local")
    load_dotenv()
except ImportError:
    pass

# ── Config ────────────────────────────────────────────────────────────────────
OUTRO_DURATION  = 600   # Last 10 minutes — where end-credit rolls live
INTRO_DURATION  = 180   # First 3 minutes — many Nollywood films list cast here instead of an end-roll
SCAN_INTRO      = os.getenv("SCAN_INTRO", "1").strip().lower() in ("1", "true", "yes")
FRAME_INTERVAL  = 2     # Fallback sample rate (seconds) if mpdecimate yields nothing
HASH_THRESHOLD  = 4     # Hamming distance threshold for duplicate frame detection
FRAME_MAX_EDGE  = 1024  # Downscale long edge — keeps credit text legible, cuts VLM vision tokens 3-4x
PADDLE_CONF_MIN = 0.85  # PaddleOCR line confidence below this escalates the frame to the VLM
PADDLE_ESC_FLOOR = 0.45 # ...but below THIS the frame is garbage (no real text) — don't waste a VLM call
MAX_FRAMES      = 150   # Hard cap on frames read per film. Scrolling credits can yield thousands of
                        # near-unique frames; without a cap a single film can run for hours. We evenly
                        # subsample down to this many, which still covers every distinct credit card.
LOOP_SLEEP_SECS = 300   # Pause between full DB sweeps in --loop mode

# VLM rescue of low-confidence frames is OFF by default: on a CPU a single
# Qwen3-VL call is ~5 min/frame, which makes catalog-scale runs impossible. Turn
# it on (ENABLE_VLM_FALLBACK=1) only on a GPU box (Kaggle/Colab), where a frame
# is 1-3s. With it off we keep PaddleOCR's best-effort text for shaky frames.
VLM_FALLBACK_ENABLED = os.getenv("ENABLE_VLM_FALLBACK", "0").strip().lower() in ("1", "true", "yes")

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
    "--js-runtimes", "node",
    "--retries", "5", 
    "--socket-timeout", "60",
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

# YouTube bot-detection ("Sign in to confirm you're not a bot") blocks shared
# datacenter IPs like Kaggle's after a burst of requests. Authenticated cookies
# are the most reliable bypass. Export a logged-in YouTube cookies.txt, upload it
# to Kaggle, and set YT_COOKIES_FILE to its path (e.g. /kaggle/input/yt/cookies.txt).
YT_COOKIES_FILE = os.getenv("YT_COOKIES_FILE", "").strip() or None
if YT_COOKIES_FILE and os.path.exists(YT_COOKIES_FILE):
    YT_BASE_FLAGS.extend(["--cookies", YT_COOKIES_FILE])
    print(f"  🍪 Using YouTube cookies: {YT_COOKIES_FILE}")
elif YT_COOKIES_FILE:
    print(f"  ⚠️ YT_COOKIES_FILE set but not found: {YT_COOKIES_FILE}")

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
# Point OLLAMA_VISION_MODEL at a Q4_K_M tag (e.g. "qwen3-vl-4b:q4_K_M") for ~1.7x
# faster CPU prefill — with downscaled frames the legibility loss on clean credits
# is negligible. Falls back to the default Q8 tag if unset.
OLLAMA_MODEL   = os.getenv("OLLAMA_VISION_MODEL", "").strip() or "qwen3-vl-4b:latest"
OLLAMA_HOST    = os.getenv("OLLAMA_HOST", "http://localhost:11434").strip().rstrip("/")
OLLAMA_API_URL = f"{OLLAMA_HOST}/api/generate"

OLLAMA_PROMPT = """You are analysing a frame from a Nollywood movie.
Look carefully at the image. If you see ANY cast or crew credits — actor names, 
director, producer, writer, cinematographer, editor, or similar roles — list each 
one on its own line, exactly as written on screen.

If this frame does NOT contain a credits screen (e.g. it shows a scene, a logo 
card only, or a black frame), respond with exactly: NO_CREDITS

Do NOT add any explanation, preamble, or commentary. Just the credits or NO_CREDITS."""


class OllamaVisionOCR:
    """Vision OCR engine using Qwen3-VL-4B via Ollama REST API.
    Replaces PaddleOCR + Tesseract — the model reads frames like a human,
    understands credit screens in context, and filters non-credit frames.
    """

    def __init__(self):
        self._warmup()

    def _warmup(self):
        """Check Ollama is reachable then pre-load the model into RAM.
        Qwen3-VL-4B is 8.4 GB — first load from disk can take 60-120s.
        We do a cheap text-only call here so the batch doesn't time out on frame 1.
        """
        try:
            urllib.request.urlopen(OLLAMA_HOST, timeout=5)
        except Exception:
            print(f"  ⚠️ Ollama server not reachable at {OLLAMA_HOST}.")
            print("    Start it with:  ollama serve")
            raise RuntimeError("Ollama server not running — start it with: ollama serve")

        print(f"  ⏳ Pre-loading {OLLAMA_MODEL} into RAM (cold CPU load can take several minutes)...")
        # keep_alive=-1 pins the model in RAM so we pay the cold-load cost once per
        # process, not per frame. num_predict=1 keeps warmup cheap.
        payload = json.dumps({
            "model": OLLAMA_MODEL,
            "prompt": "Ready?",
            "stream": False,
            "keep_alive": -1,
            "options": {"num_predict": 1}
        }).encode("utf-8")
        req = urllib.request.Request(
            OLLAMA_API_URL, data=payload,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=900) as resp:
                resp.read()
            print(f"  ✓ {OLLAMA_MODEL} loaded and ready for vision OCR.")
        except Exception as e:
            raise RuntimeError(f"Failed to pre-load {OLLAMA_MODEL}: {e}")

    def read_text(self, img_path: Path) -> str:
        """Send a frame to Qwen3-VL-4B via Ollama and return extracted credit text.
        Returns empty string if the frame has no credits (NO_CREDITS response).
        """
        try:
            with open(img_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")

            payload = json.dumps({
                "model": OLLAMA_MODEL,
                "prompt": OLLAMA_PROMPT,
                "images": [img_b64],
                "stream": False,
                "keep_alive": -1,
                "options": {
                    "temperature": 0.1,   # Low temp = consistent, factual output
                    "num_predict": 512,   # Credits lists are short
                    "num_ctx": 4096,      # Modest context — one downscaled frame + short prompt
                }
            }).encode("utf-8")

            req = urllib.request.Request(
                OLLAMA_API_URL,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=300) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                text = result.get("response", "").strip()

            if not text or text.upper().startswith("NO_CREDITS"):
                return ""
            return text

        except Exception as e:
            print(f"     ⚠️ Ollama vision call failed: {e}")
            return ""


class PaddleReader:
    """Fast CPU text reader. Reads every frame in ~1-2s and returns lines with
    confidence scores. Clean credit text scores high and is trusted directly;
    low-confidence frames are escalated to the VLM by the caller.
    """

    def __init__(self):
        if not PADDLE_AVAILABLE:
            raise RuntimeError("paddleocr not installed")
        print("  ⏳ Initialising PaddleOCR (English)...")
        self.ocr = self._build()
        print("  ✓ PaddleOCR ready.")

    def _build(self):
        # Disable the document-preprocessing stages (orientation classify, page
        # unwarping, textline orientation). They target scanned paper and cost
        # ~15s/frame on CPU for zero benefit on video frames — leaving only the
        # detection + recognition models. PaddleOCR renamed kwargs across
        # 2.x → 3.x, so try the modern signature first, then fall back.
        # Force the lightweight "mobile" det+rec models. PaddleOCR 3.x otherwise
        # defaults to the medium "server" models (~14s/frame on a CPU); the mobile
        # variants are several times faster with negligible loss on clear credits.
        for kwargs in (
            {"lang": "en",
             "text_detection_model_name": "PP-OCRv5_mobile_det",
             "text_recognition_model_name": "PP-OCRv5_mobile_rec",
             "use_doc_orientation_classify": False,
             "use_doc_unwarping": False, "use_textline_orientation": False},
            {"lang": "en", "use_doc_orientation_classify": False,
             "use_doc_unwarping": False, "use_textline_orientation": False},
            {"lang": "en", "use_angle_cls": False, "show_log": False},
            {"lang": "en"},
        ):
            try:
                return PaddleOCR(**kwargs)
            except (TypeError, Exception):
                continue
        return PaddleOCR(lang="en")

    def read_lines(self, img_path: Path) -> list[tuple[str, float]]:
        """Return [(text, confidence), ...] for one frame, [] if no text found."""
        # Modern API: predict() → list of result dicts with rec_texts / rec_scores.
        try:
            results = self.ocr.predict(str(img_path))
            lines = self._parse_predict(results)
            if lines is not None:
                return lines
        except (AttributeError, TypeError):
            pass
        except Exception:
            pass

        # Legacy API: ocr() → [[ [box, (text, score)], ... ]]
        try:
            results = self.ocr.ocr(str(img_path))
            return self._parse_legacy(results)
        except Exception as e:
            print(f"     ⚠️ PaddleOCR read failed: {e}")
            return []

    @staticmethod
    def _parse_predict(results) -> list[tuple[str, float]] | None:
        if not results:
            return []
        out: list[tuple[str, float]] = []
        for page in results:
            data = page if isinstance(page, dict) else getattr(page, "res", None) or page
            texts = data.get("rec_texts") if isinstance(data, dict) else None
            scores = data.get("rec_scores") if isinstance(data, dict) else None
            if texts is None:
                return None  # Unknown shape — signal caller to try legacy parser
            scores = scores or [1.0] * len(texts)
            for t, s in zip(texts, scores):
                if t and t.strip():
                    out.append((t.strip(), float(s)))
        return out

    @staticmethod
    def _parse_legacy(results) -> list[tuple[str, float]]:
        out: list[tuple[str, float]] = []
        if not results:
            return out
        for page in results:
            if not page:
                continue
            for entry in page:
                try:
                    text, score = entry[1][0], entry[1][1]
                    if text and text.strip():
                        out.append((text.strip(), float(score)))
                except (IndexError, TypeError):
                    continue
        return out


def read_frame_hybrid(frame: Path, paddle: "PaddleReader | None",
                      vlm: OllamaVisionOCR) -> str:
    """PaddleOCR-first, VLM-fallback read of a single frame.

    PaddleOCR reads the frame. If it found text and every line is confident
    (>= PADDLE_CONF_MIN), we trust it — no VLM. If any line is shaky (stylized
    font, low contrast, motion blur), the whole frame is re-read by the VLM,
    which uses layout/context to recover the names. Frames with no text at all
    are treated as non-credit and skipped.
    """
    if paddle is not None:
        lines = paddle.read_lines(frame)
        if not lines:
            return ""  # No text — trust Paddle that this isn't a credit frame.
        weakest = min(conf for _, conf in lines)
        paddle_text = "\n".join(text for text, _ in lines)
        if weakest >= PADDLE_CONF_MIN:
            return paddle_text
        # Below the floor PaddleOCR is reading noise, not stylized credits — the VLM
        # can't rescue text that isn't there, so don't burn a call on it. Drop the frame.
        if weakest < PADDLE_ESC_FLOOR:
            return ""
        # Genuinely shaky-but-real text. Escalate to the VLM only if it's enabled
        # (GPU); otherwise keep Paddle's best-effort read rather than dropping names.
        if vlm is not None:
            print(f"     ↑ Escalating frame to VLM (low confidence {weakest:.2f}).")
            return vlm.read_text(frame)
        return paddle_text
    # No PaddleOCR available — pure VLM path (only reachable when VLM enabled).
    if vlm is not None:
        return vlm.read_text(frame)
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
                err = (result.stderr or "").strip().splitlines()
                reason = err[-1] if err else "no stderr"
                if attempt < 3:
                    time.sleep(5)
                    continue
                # Surface WHY so we can tell "video unavailable" (skip is correct)
                # from "Sign in to confirm you're not a bot" (IP rate-limited).
                print(f"     yt-dlp info failed: {reason[:200]}")
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

def download_segment(url: str, start: float, duration: float, out_path: Path) -> bool:
    """Downloads a video segment. Returns True on success, False on failure.
    Timeouts bail immediately (no retry) — throttled videos won't improve on retry.
    Stream errors (CalledProcessError) get one retry in case they're transient.
    """
    print(f"  [Download Slicer] Fetching segment {int(start//60)}m{int(start%60)}s "
          f"({int(duration)} seconds)...")
    for attempt in range(1, 3):  # Max 2 attempts
        try:
            part_file = Path(str(out_path) + ".part")
            if part_file.exists():
                part_file.unlink()
            subprocess.run([
                sys.executable, "-m", "yt_dlp", *YT_BASE_FLAGS,
                "--download-sections", f"*{int(start)}-{int(start+duration)}",
                "--no-part",
                "-f", "bestvideo[height<=360]/best[height<=360]",
                "-o", str(out_path),
                url
            ], check=True, timeout=600)
            return True
        except subprocess.CalledProcessError:
            print(f"  ⚠️ Download attempt {attempt}/2 failed (stream error). Retrying once...")
            if attempt < 2:
                time.sleep(10)
        except subprocess.TimeoutExpired:
            # Timeout = YouTube throttling — no point retrying
            print(f"  ⚠️ Download timed out (10 min). Likely throttled — skipping.")
            return False
        except Exception as e:
            print(f"  ⚠️ Download attempt {attempt}/2 error: {e}")
            if attempt < 2:
                time.sleep(5)
    print(f"  ❌ Download failed for segment {int(start//60)}m{int(start%60)}s.")
    return False

def extract_frames(video_path: Path, out_dir: Path, label: str) -> list[Path]:
    """Extract unique, downscaled credit frames.

    Uses mpdecimate to drop near-identical frames (static credit cards repeat for
    seconds; scrolls overlap heavily) and scales the long edge to FRAME_MAX_EDGE so
    each frame is cheap for both PaddleOCR and the VLM. A fixed-rate pass is the
    fallback if mpdecimate collapses everything to nothing.
    Returns [] if the file is corrupt or FFmpeg fails.
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    decimate_vf = (
        f"mpdecimate=hi=64*12:lo=64*5:frac=0.1,"
        f"scale='if(gt(iw,ih),min({FRAME_MAX_EDGE},iw),-2)':"
        f"'if(gt(iw,ih),-2,min({FRAME_MAX_EDGE},ih))',"
        f"setpts=N/FRAME_RATE/TB"
    )
    fallback_vf = (
        f"fps=1/{FRAME_INTERVAL},"
        f"scale='if(gt(iw,ih),min({FRAME_MAX_EDGE},iw),-2)':"
        f"'if(gt(iw,ih),-2,min({FRAME_MAX_EDGE},ih))'"
    )

    def _run(vf: str, vsync_vfr: bool) -> bool:
        cmd = ["ffmpeg", "-y", "-i", str(video_path), "-vf", vf]
        if vsync_vfr:
            cmd += ["-vsync", "vfr"]
        cmd += ["-qscale:v", "3", str(out_dir / f"{label}_%03d.jpg"), "-loglevel", "error"]
        try:
            subprocess.run(cmd, check=True, timeout=300)
            return True
        except subprocess.CalledProcessError as e:
            print(f"  ⚠️ FFmpeg frame extraction failed (corrupt/incomplete video): exit {e.returncode}")
            return False
        except subprocess.TimeoutExpired:
            print(f"  ⚠️ FFmpeg frame extraction timed out.")
            return False

    if not _run(decimate_vf, vsync_vfr=True):
        return []
    frames = sorted(out_dir.glob(f"{label}_*.jpg"))
    if frames:
        return frames

    # mpdecimate dropped everything (rare) — retry with a plain fixed-rate sample.
    print("  ⚠️ mpdecimate yielded no frames; retrying with fixed-rate sampling.")
    _run(fallback_vf, vsync_vfr=False)
    return sorted(out_dir.glob(f"{label}_*.jpg"))

# ── AI Formatting Prompts ─────────────────────────────────────────────────────
AI_STRUCTURE_PROMPT = """You are building a Nollywood film database called Ensembla.
Below is raw text extracted via Local OCR from the credit cards of a movie called '{title}'.
Some characters may be garbled, misspelled, duplicated, or out of order due to video background noise.
Clean it up using Nollywood industry knowledge. Deduplicate entries. Separate cast from crew.

CRITICAL RULES:
- Use ONLY real names that actually appear in the RAW OCR TEXT below. Never invent names.
- If the OCR text contains no usable names for a section, OMIT that entire section
  (header and all). An empty database is better than a wrong one.
- NEVER output the literal words "Name", "Specific Role", or any example placeholder.
  If you would write "Director Name" or "Crew Name", that means you have no real name —
  so omit the section instead.

CAST PAIRING (important): credit rolls list the CHARACTER and the ACTOR next to
each other — usually the character name on one line and the actor's real name on
the adjacent line (or separated by "/", "as", or "-"). Combine each such pair
into ONE entry as "- Actor Real Name - Character Name". The actor is the real
person's name (e.g. "Deza The Great"); the character is the role they play (e.g.
"Odogwu"). Never list a character name on its own line as if it were an actor.

Return ONLY a markdown document, using whichever of these sections you have REAL names for:
# Cast  -> "- Actor Name - Character Name", or just "- Actor Name" if no character shown
# Director  -> "- <name> - Director"
# Producers  -> "- <name> - <their producer role>"
# Cinematography  -> "- <name> - Cinematographer"
# Editor  -> "- <name> - Editor"
# Music  -> "- <name> - Composer"
# Costume & Makeup  -> "- <name> - <their role>"
# Crew  -> "- <name> - <their role>"  (Gaffer, Sound, PM, Continuity, etc.)

Example of the FORMAT only (do not copy these names): "- Maurice Sam - Prince Caleb"

RAW OCR TEXT:
{raw}"""

# Tokens that only appear in the prompt's format examples, never in real credits.
# A weak model with thin OCR input tends to echo these placeholders verbatim; we
# strip any line containing one so garbage never reaches the DB.
_PLACEHOLDER_TOKENS = (
    "actor name", "character name", "director name", "producer name",
    "cinematographer name", "editor name", "composer name", "crew name",
    "specific role", "e.g.",
)

# Phrases that mark a "name" as model commentary/notes rather than a real person.
_JUNK_NAME_TOKENS = (
    "omitted", "not listed", "not a person", "note:", "appreciation",
    "n/a", "unknown", "no character", "misreading", "error", "see ocr",
)

# Job titles / departments lifted straight off the credit roll. These are ROLES,
# not people — unfiltered they created thousands of fake "people" rows
# (GAFFER, CAMERA ASSISTANT, POST PRODUCTION, CASTING DIRECTOR...).
_CREW_ROLE_WORDS = {
    "camera", "cameraman", "cam", "asst", "assistant", "assistance", "assist", "ass",
    "editor", "editing", "edit", "production", "productions", "producer", "executive",
    "exec", "director", "direction", "dir", "makeup", "make", "up", "costume",
    "costumier", "wardrobe", "location", "manager", "mgr", "unit", "props", "prop",
    "set", "design", "designer", "gaffer", "boom", "sound", "audio", "light",
    "lighting", "script", "continuity", "driver", "security", "catering", "welfare",
    "medic", "still", "stills", "photography", "photographer", "colorist", "color",
    "colour", "grade", "dop", "cinematography", "cinematographer", "art", "graphics",
    "vfx", "sfx", "effects", "music", "soundtrack", "score", "dance", "choreographer",
    "stunt", "stunts", "transport", "logistics", "accountant", "publicity", "marketing",
    "poster", "subtitle", "subtitles", "translator", "voice", "crew", "cast", "thanks",
    "special", "end", "copyright", "rights", "reserved", "presents", "produced",
    "written", "story", "screenplay", "coordinator", "supervisor", "operator",
    "hairstylist", "hair", "stylist", "second", "first", "third", "by", "the", "of",
    "and", "a", "an", "in", "on", "for", "with", "to",
    "post", "casting", "co", "line", "associate", "chief", "head", "senior", "junior",
    "1st", "2nd", "3rd", "4th", "st", "nd", "rd", "th", "best", "boy", "key", "grip",
    "clapper", "loader", "focus", "puller", "scenic", "runner", "intern", "trainee",
}
_TITLE_CARD_RE = re.compile(r"^\s*\d+\s*(months?|years?|days?|weeks?|hours?|minutes?)\s*(later)?\s*$", re.I)
_PART_CARD_RE = re.compile(r"^\s*(part|episode|ep|chapter|scene|act)\s*\d+\s*$", re.I)
_COPYRIGHT_RE = re.compile(r"^\s*\(?\s*[c©e1]\s*\)?\s*\d{4}", re.I)


def _looks_like_junk_name(name: str) -> bool:
    """True if this 'name' is really prose/commentary/a job title, not a person."""
    low = name.lower()
    if any(tok in low for tok in _JUNK_NAME_TOKENS):
        return True
    # Real credit names are short; a 7+ word 'name' is a sentence, not a person.
    if len(name.split()) > 6:
        return True

    stripped = name.strip()
    # OCR noise: a person needs at least 3 letters ("Cj", "M E", "d", "K").
    if len(re.sub(r"[^A-Za-z]", "", stripped)) < 3:
        return True
    # Mostly punctuation/symbols — OCR garbage like "» 'ee", "J, & 4", "-SY -".
    if len(re.sub(r"[A-Za-z0-9\s]", "", stripped)) / max(len(stripped), 1) > 0.4:
        return True
    # Credit-roll furniture rather than a person.
    if _COPYRIGHT_RE.match(stripped) or _TITLE_CARD_RE.match(stripped) or _PART_CARD_RE.match(stripped):
        return True
    # Every token is a crew-role/filler word => it's a job title, not a person.
    toks = [t for t in re.sub(r"[^A-Za-z0-9\s]", " ", stripped.lower()).split() if t]
    if toks and all(t in _CREW_ROLE_WORDS or t.isdigit() for t in toks):
        return True
    return False

def strip_template_placeholders(markdown: str) -> str:
    """Drop lines that echo the prompt's example placeholders, then drop any
    section header left with no real entries under it."""
    kept = []
    for line in markdown.splitlines():
        low = line.lower()
        if line.lstrip().startswith("-") and any(tok in low for tok in _PLACEHOLDER_TOKENS):
            continue
        kept.append(line)
    # Remove headers that now have no bullet lines before the next header/EOF.
    out = []
    for i, line in enumerate(kept):
        if line.startswith("#"):
            has_entry = any(
                kept[j].lstrip().startswith("-")
                for j in range(i + 1, len(kept))
                if not (j > i + 1 and kept[j].startswith("#"))
            )
            # look ahead only until the next header
            has_entry = False
            for j in range(i + 1, len(kept)):
                if kept[j].startswith("#"):
                    break
                if kept[j].lstrip().startswith("-"):
                    has_entry = True
                    break
            if not has_entry:
                continue
        out.append(line)
    return "\n".join(out).strip()

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
    """Multi-stage formatting chain: Ollama -> Gemini Flash -> Groq Llama -> OpenAI -> Local Failsafe."""
    prompt = AI_STRUCTURE_PROMPT.format(title=title, raw=raw_text)

    # 0. Ollama (if OLLAMA_MODEL is configured)
    ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434").strip()
    ollama_model = os.getenv("OLLAMA_MODEL", "").strip() or OLLAMA_MODEL
    if ollama_model:
        print(f"  [Ollama] Structuring raw text via {ollama_model}...")
        try:
            payload = {
                "model": ollama_model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {
                    "temperature": 0.1
                }
            }
            res = requests.post(f"{ollama_host}/api/chat", json=payload, timeout=60)
            if res.status_code == 200:
                result = res.json()["message"]["content"]
                if result and result.strip():
                    return result
            else:
                print(f"  ⚠️ Log: Ollama API responded with code {res.status_code}: {res.text}")
        except Exception as e:
            print(f"  ⚠️ Ollama formatting failed: {e}")

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
def _looks_like_jwt(key: str) -> bool:
    return key.count(".") == 2


def supabase_headers(key: str) -> dict:
    """Support both legacy JWT service-role keys and new sb_secret_* API keys."""
    headers = {
        "apikey": key,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
        "User-Agent": "lumi-cast-enricher/1.0",
    }
    if _looks_like_jwt(key):
        headers["Authorization"] = f"Bearer {key}"
    return headers


class SupabaseSync:
    def __init__(self):
        self.url = os.getenv("VITE_SUPABASE_URL", "").strip() or None
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None
        if not self.url or not self.key:
            self.enabled = False
        else:
            self.enabled = True
            self.headers = supabase_headers(self.key)
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
        # Rest query to grab films and credits relation. Newest-first (page 1 →
        # backward) so the 24/7 loop starts where the catalog UI starts.
        query_url = (
            f"{self.url}/rest/v1/films?source=eq.youtube"
            f"&select=id,title,youtube_watch_url,credits(id)&order=created_at.desc"
        )
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
                    if _looks_like_junk_name(name):
                        continue
                    person_id = self.upsert_person(name)
                    if person_id:
                        self.link_credit(film_id, person_id, specific_role, char, idx)
                        linked_count += 1
                except Exception as entry_err:
                    print(f"    ⚠️ Failed to sync credit entry '{entry}': {entry_err}")
        print(f"  ✓ Linked {linked_count} credits to the film in database.")

# ── Batch Processing ──────────────────────────────────────────────────────────
def process_sweep(incomplete_queue, sync, ocr, paddle, output_dir, single_mode):
    """Process one queue of films. Returns the count successfully enriched."""
    print(f"\n🚀 Starting batch OCR extraction for {len(incomplete_queue)} films...")
    seg_desc = (f"intro (first {INTRO_DURATION//60} min) + outro (last {OUTRO_DURATION//60} min)"
                if SCAN_INTRO else f"outro-only (last {OUTRO_DURATION//60} min)")
    print(f"   Strategy: scanning {seg_desc}.")

    # Report tracking
    skipped_log: list[str] = []
    success_count = 0

    for idx, film in enumerate(incomplete_queue):
        title = film["title"]
        url = film["youtube_watch_url"]
        credits_count = film["credits_count"]
        print(f"\n==============================================================================")
        print(f"🎬 [{idx+1}/{len(incomplete_queue)}] Movie: '{title}'")
        print(f"   Credits Count: {credits_count} | YouTube URL: {url}")
        print(f"==============================================================================")

        temp_files = []
        skip_reason = None
        try:
            BASE_TEMP_DIR.mkdir(parents=True, exist_ok=True)
            safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)

            # ── Step 1: Get video duration ────────────────────────────────────
            _, duration = get_video_info(url)
            if duration <= 0:
                skip_reason = "Could not retrieve video duration"
                print(f"  ❌ {skip_reason}. Skipping.")
                skipped_log.append(f"| {title} | {url} | {skip_reason} |")
                continue

            # ── Step 2-4: Download + extract frames from each segment ─────────
            # Credits vary: some films roll them at the end, others list cast in
            # the intro. Scan both (intro optional via SCAN_INTRO) and pool frames.
            segments = []
            if SCAN_INTRO:
                segments.append(("intro", 0.0, min(INTRO_DURATION, duration)))
            segments.append(("outro", max(0, duration - OUTRO_DURATION), min(OUTRO_DURATION, duration)))

            raw_frames = []
            for seg_label, seg_start, seg_dur in segments:
                seg_path = BASE_TEMP_DIR / f"lumi_{seg_label}_{safe_title[:20].strip()}.mkv"
                temp_files.append(seg_path)
                print(f"  -> Downloading {seg_label} ({int(seg_dur//60)} min from {int(seg_start//60)}m)...")
                if not download_segment(url, seg_start, seg_dur, seg_path) or not seg_path.exists():
                    print(f"  ⚠️ {seg_label} download failed — skipping this segment.")
                    continue
                if seg_path.stat().st_size // 1024 < 200:
                    print(f"  ⚠️ {seg_label} file too small — likely corrupt, skipping segment.")
                    continue
                print(f"  -> Capturing frames from {seg_label}...")
                seg_dir = FRAMES_DIR / seg_label
                temp_files.append(seg_dir)
                raw_frames.extend(extract_frames(seg_path, seg_dir, seg_label))

            if not raw_frames:
                skip_reason = "No frames extracted from intro or outro"
                print(f"  ❌ {skip_reason}. Skipping.")
                skipped_log.append(f"| {title} | {url} | {skip_reason} |")
                continue

            # ── Deduplication ─────────────────────────────────────────────────
            # mpdecimate already dropped near-identical frames at extraction time;
            # imagehash is a cheap second pass to catch any residual repeats.
            unique_frames = filter_unique_frames(raw_frames)

            # Hard cap: even on a GPU, thousands of scrolling-credit frames take hours.
            # Evenly subsample so we still span the whole outro but bound the runtime.
            if len(unique_frames) > MAX_FRAMES:
                step = len(unique_frames) / MAX_FRAMES
                unique_frames = [unique_frames[int(i * step)] for i in range(MAX_FRAMES)]
                print(f"  [cap] Subsampled to {len(unique_frames)} frames (MAX_FRAMES={MAX_FRAMES}).")

            # ── Step 5: Hybrid OCR (PaddleOCR-first, Qwen3-VL fallback) ───────
            engine = "PaddleOCR + Qwen3-VL fallback" if paddle else "Qwen3-VL only"
            print(f"  -> Reading {len(unique_frames)} frames ({engine})...")
            ocr_text_blocks = []
            total = len(unique_frames)
            for i, frame in enumerate(unique_frames, 1):
                text = read_frame_hybrid(frame, paddle, ocr)
                if text.strip():
                    ocr_text_blocks.append(text)
                if i % 10 == 0 or i == total:
                    print(f"     ...read {i}/{total} frames")

            combined_ocr_text = "\n".join(ocr_text_blocks)

            if not combined_ocr_text.strip():
                skip_reason = "OCR found no credit text in outro (credits may be in intro or missing)"
                print(f"  ⚠️ {skip_reason}. Skipping.")
                skipped_log.append(f"| {title} | {url} | {skip_reason} |")
                continue

            # ── Step 6: AI Cleanup ────────────────────────────────────────────
            structured_markdown = run_ai_cleanup(title, combined_ocr_text)
            # Drop any placeholder lines the model echoed from the prompt examples
            # (and now-empty sections) so fake "Director Name" credits never save.
            structured_markdown = strip_template_placeholders(structured_markdown)

            if not structured_markdown.strip():
                skip_reason = "AI formatting returned empty result"
                print(f"  ❌ {skip_reason}.")
                skipped_log.append(f"| {title} | {url} | {skip_reason} |")
                continue

            # ── Step 7: Save output ───────────────────────────────────────────
            header = (
                f"---\n"
                f"title: {title}\n"
                f"source: {url}\n"
                f"extracted_by: Local OCR (PaddleOCR-first + Qwen3-VL fallback, outro-only)\n"
                f"---\n\n"
            )
            out_file = output_dir / f"ocr_{safe_title[:40]}.md"
            out_file.write_text(header + structured_markdown, encoding="utf-8")
            print(f"  ✓ Saved: {out_file.name}")

            # Sidecar with the raw OCR text — lets us see what the readers actually
            # captured when the structured names look thin.
            raw_file = output_dir / f"ocr_{safe_title[:40]}.raw.txt"
            raw_file.write_text(combined_ocr_text, encoding="utf-8")
            print(f"  ✓ Raw OCR text: {raw_file.name} ({len(combined_ocr_text)} chars)")

            sync.process(url, structured_markdown)
            success_count += 1

        except Exception as e:
            skip_reason = f"Unhandled exception: {e}"
            print(f"  ❌ Execution error on '{title}': {e}")
            skipped_log.append(f"| {title} | {url} | {skip_reason} |")
            if single_mode:
                sys.exit(1)
        finally:
            # Kill any lingering ffmpeg/yt-dlp processes that may still hold
            # the .mkv file open (happens when download_segment() times out)
            try:
                if sys.platform == "win32":
                    subprocess.run(["taskkill", "/F", "/IM", "ffmpeg.exe"],
                                   capture_output=True, timeout=5)
                else:
                    subprocess.run(["pkill", "-9", "-f", "ffmpeg"],
                                   capture_output=True, timeout=5)
            except Exception:
                pass
            time.sleep(1)   # Give Windows a moment to release file handles

            # Clean up temp files — retry once on PermissionError (file still held)
            for path in temp_files:
                for attempt in range(3):
                    try:
                        if not path.exists():
                            break
                        if path.is_dir():
                            shutil.rmtree(path, ignore_errors=True)
                        else:
                            path.unlink()
                        break
                    except PermissionError:
                        time.sleep(2)
                    except Exception:
                        break
            try:
                if BASE_TEMP_DIR.exists() and not any(BASE_TEMP_DIR.iterdir()):
                    shutil.rmtree(BASE_TEMP_DIR, ignore_errors=True)
            except Exception:
                pass

    # ── Final Summary ─────────────────────────────────────────────────────────
    total = len(incomplete_queue)
    skipped = len(skipped_log)
    print("\n==============================================================================")
    print(f"✅ Batch complete: {success_count}/{total} films enriched | {skipped} skipped")
    print("==============================================================================")

    # Write skipped films report
    if skipped_log:
        report_path = output_dir / "skipped_films.md"
        existing = report_path.read_text(encoding="utf-8") if report_path.exists() else \
            "# Skipped Films Report\n\nFilms where outro OCR found no credits. Review manually or retry later.\n\n| Title | URL | Reason |\n|---|---|---|\n"
        with open(report_path, "a", encoding="utf-8") as f:
            if not report_path.exists() or "| Title |" not in existing:
                f.write("# Skipped Films Report\n\nFilms where outro OCR found no credits. Review manually.\n\n| Title | URL | Reason |\n|---|---|---|\n")
            for line in skipped_log:
                f.write(line + "\n")
        print(f"📋 Skipped films logged to: {report_path}")

    return success_count


# ── Main Runner ───────────────────────────────────────────────────────────────
def main():
    if not check_dependencies():
        sys.exit(1)

    args = [a for a in sys.argv[1:]]
    loop_mode = "--loop" in args
    args = [a for a in args if a != "--loop"]
    target_url = args[0] if args else None

    sync = SupabaseSync()
    if not sync.enabled:
        print("❌ Supabase keys missing. Run setup-youtube.sql and populate .env files.")
        sys.exit(1)

    output_dir = Path("./output")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Initialise OCR engines once and reuse across every film / sweep.
    paddle = None
    if PADDLE_AVAILABLE:
        try:
            paddle = PaddleReader()
        except Exception as e:
            print(f"  ⚠️ PaddleOCR init failed ({e}).")
    else:
        print("  ⚠️ paddleocr not installed. pip install paddleocr paddlepaddle")

    # The VLM is only loaded when fallback is explicitly enabled (GPU runs).
    ocr = None
    if VLM_FALLBACK_ENABLED:
        print("  ℹ️ VLM fallback ENABLED — low-confidence frames will escalate to Qwen3-VL.")
        ocr = OllamaVisionOCR()
    else:
        print("  ℹ️ VLM fallback DISABLED (CPU mode) — PaddleOCR only. "
              "Set ENABLE_VLM_FALLBACK=1 on a GPU box to enable rescue.")

    if paddle is None and ocr is None:
        print("❌ No OCR engine available (PaddleOCR failed and VLM fallback is off).")
        sys.exit(1)

    # Single explicit URL — process once and exit.
    if target_url:
        print(f"\n🎬 Target YouTube URL provided: {target_url}")
        film = sync.find_film(target_url)
        if not film:
            print(f"❌ Film not found in database for URL: {target_url}")
            sys.exit(1)
        credits_count = len(film.get("credits", []))
        print(f"🔍 Film: '{film['title']}' has {credits_count} existing credits.")
        if not (0 <= credits_count <= 10):
            print(f"⚠️ Skipped: Film has {credits_count} credits, outside the 0-10 limit.")
            sys.exit(0)
        film["credits_count"] = credits_count
        process_sweep([film], sync, ocr, paddle, output_dir, single_mode=True)
        return

    # DB-driven mode: sweep the incomplete-films queue (page 1 → backward).
    # `attempted` remembers every URL we've already tried THIS session so a film
    # that yields no credits (creditless title) isn't re-downloaded every sweep —
    # otherwise the loop would spin forever on the same unextractable films.
    # (On a fresh session/restart this resets, giving each film one more attempt.)
    attempted: set[str] = set()
    sweep = 0
    while True:
        sweep += 1
        if loop_mode:
            print(f"\n🔁 Sweep #{sweep} — scanning DB for incomplete films...")
        incomplete_queue = sync.fetch_incomplete_youtube_films()
        if loop_mode:
            incomplete_queue = [f for f in incomplete_queue
                                if f.get("youtube_watch_url") not in attempted]

        if not incomplete_queue:
            print("✅ No further incomplete films to attempt this session.")
            if not loop_mode:
                return
            print(f"   Sleeping {LOOP_SLEEP_SECS}s before next sweep...")
            time.sleep(LOOP_SLEEP_SECS)
            continue

        process_sweep(incomplete_queue, sync, ocr, paddle, output_dir, single_mode=False)
        for f in incomplete_queue:
            if f.get("youtube_watch_url"):
                attempted.add(f["youtube_watch_url"])

        if not loop_mode:
            return
        print(f"\n😴 Sweep #{sweep} done ({len(attempted)} films attempted this session). "
              f"Sleeping {LOOP_SLEEP_SECS}s before re-scanning...")
        time.sleep(LOOP_SLEEP_SECS)


if __name__ == "__main__":
    main()
