import os
import sys
import glob
import json
import easyocr

# Force utf-8 stdout encoding for Windows terminal
sys.stdout.reconfigure(encoding='utf-8')

print("🚀 Initializing EasyOCR reader for English...")
reader = easyocr.Reader(['en'], gpu=False)

pages_dir = os.path.join(os.getcwd(), "outputs", "yearbook_2025_pages")
target_pages = [40, 42, 43, 81, 82, 83, 84]

extracted_results = {}

for p in target_pages:
    img_path = os.path.join(pages_dir, f"page_{p}.png")
    if os.path.exists(img_path):
        print(f"\n--- Running EasyOCR on Page #{p} ({img_path}) ---")
        results = reader.readtext(img_path, detail=0)
        print(f"Extracted {len(results)} text blocks!")
        print("Sample blocks:", results[:25])
        extracted_results[f"page_{p}"] = results

out_json = os.path.join(os.getcwd(), "outputs", "yearbook_2025_easyocr_raw.json")
with open(out_json, "w", encoding="utf-8") as f:
    json.dump(extracted_results, f, ensure_ascii=False, indent=2)

print(f"\nSaved all OCR results to {out_json}!")
