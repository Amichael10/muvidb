import os
import sys
import json
import logging

os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"
os.environ["GLOG_minloglevel"] = "3"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

logging.basicConfig(level=logging.CRITICAL)
for name in ["paddle", "ppocr", "paddlex", "PIL", "urllib3"]:
    logging.getLogger(name).setLevel(logging.CRITICAL)

import warnings
warnings.filterwarnings('ignore')

from paddleocr import PaddleOCR
ocr = None
try:
    ocr = PaddleOCR(lang='en', use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False)
except Exception as e:
    sys.stderr.write(f"PaddleOCR init failed: {e}\n")
    ocr = None

def scan_frame(img_path: str):
    if not ocr or not os.path.exists(img_path):
        return []
    words = []
    
    try:
        results = ocr.ocr(img_path)
        if not results:
            return []
        
        for item in results:
            if not item:
                continue
            
            # PredictResult object or dictionary format
            texts = item.get("rec_texts") if hasattr(item, "get") else getattr(item, "rec_texts", None)
            scores = item.get("rec_scores") if hasattr(item, "get") else getattr(item, "rec_scores", None)
            polys = item.get("rec_polys") if hasattr(item, "get") else getattr(item, "rec_polys", None)
            boxes = item.get("rec_boxes") if hasattr(item, "get") else getattr(item, "rec_boxes", None)
            
            if texts is not None and len(texts) > 0:
                scores = scores if scores is not None else [1.0] * len(texts)
                for idx, (t, s) in enumerate(zip(texts, scores)):
                    if t and str(t).strip() and float(s) >= 0.35:
                        poly = polys[idx] if polys is not None and idx < len(polys) else None
                        box = boxes[idx] if boxes is not None and idx < len(boxes) else None

                        if poly is not None and len(poly) > 0:
                            xs = [float(pt[0]) for pt in poly]
                            ys = [float(pt[1]) for pt in poly]
                            left, top = min(xs), min(ys)
                            width, height = max(xs) - left, max(ys) - top
                        elif box is not None and len(box) >= 4:
                            left, top = float(box[0]), float(box[1])
                            width, height = float(box[2] - box[0]), float(box[3] - box[1])
                        else:
                            left, top, width, height = 0, 0, 100, 20
                        
                        words.append({
                            "text": str(t).strip(),
                            "left": int(max(0, left)),
                            "top": int(max(0, top)),
                            "width": int(max(10, width)),
                            "height": int(max(10, height)),
                            "confidence": float(s) * 100
                        })
                continue

            # Legacy tuple list format
            if isinstance(item, list):
                for line in item:
                    try:
                        box, (text, score) = line[0], line[1]
                        if text and str(text).strip() and float(score) >= 0.35:
                            xs = [pt[0] for pt in box]
                            ys = [pt[1] for pt in box]
                            left, top = int(min(xs)), int(min(ys))
                            width, height = int(max(xs) - left), int(max(ys) - top)
                            words.append({
                                "text": str(text).strip(),
                                "left": max(0, left),
                                "top": max(0, top),
                                "width": max(10, width),
                                "height": max(10, height),
                                "confidence": float(score) * 100
                            })
                    except (IndexError, TypeError, ValueError):
                        continue
    except Exception as e:
        sys.stderr.write(f"OCR Error for {img_path}: {e}\n")
    return words

if __name__ == "__main__":
    img_paths = sys.argv[1:]
    out = {}
    for p in img_paths:
        out[p] = scan_frame(p)
    print(json.dumps(out))
    sys.stdout.flush()
