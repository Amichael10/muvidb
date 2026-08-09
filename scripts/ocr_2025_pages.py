import os
import glob
import json
import pytesseract
from PIL import Image

# Check default Windows Tesseract paths
tesseract_paths = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Users\User\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
]

tesseract_found = False
for p in tesseract_paths:
    if os.path.exists(p):
        pytesseract.pytesseract.tesseract_cmd = p
        tesseract_found = True
        print(f"✅ Found Tesseract binary at: {p}")
        break

pages_dir = os.path.join(os.cwd() if hasattr(os, 'cwd') else os.getcwd(), "outputs", "yearbook_2025_pages")
png_files = sorted(glob.glob(os.path.join(pages_dir, "*.png")))

print(f"Found {len(png_files)} page PNG files to inspect.")

if tesseract_found:
    for png in png_files[:10]:
        try:
            img = Image.open(png)
            text = pytesseract.image_to_string(img)
            print(f"\n--- OCR Output for {os.path.basename(png)} ({len(text)} chars) ---")
            print(text[:300])
        except Exception as e:
            print(f"Error reading {png}: {e}")
else:
    print("⚠️ Tesseract binary not found at standard paths. Checking alternative methods...")
