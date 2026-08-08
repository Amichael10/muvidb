import csv
import json
import urllib.request
import urllib.parse
import ssl
import re

csv_path = r"C:\Users\User\Downloads\Download-Full-MuviDB-Nigerian-Critics-CSV.csv"
output_json_path = r"C:\Users\User\.gemini\antigravity\brain\de833698-2c8f-43e1-bd7e-32069e8ea801\agent1_fetched_reviews.json"

reviews = []

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

with open(csv_path, mode="r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for idx, row in enumerate(reader, start=1):
        critic = row.get("critic", "").strip()
        platform = row.get("platform", "").strip()
        handle = row.get("handle", "").strip()
        movie = row.get("movie", "").strip()
        year = row.get("year", "").strip()
        rating = row.get("rating", "").strip()
        verdict = row.get("verdict_summary", "").strip()
        url = row.get("review_url", "").strip()

        snippet = ""
        fetch_status = "unfetched"

        if url.startswith("http") and ("medium.com" in url or "afrocritik.com" in url or "filmefiko.com" in url or "whatkeptmeup.com" in url):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                    html = resp.read().decode("utf-8", errors="ignore")
                    text = re.sub(r'<[^>]+>', ' ', html)
                    text = ' '.join(text.split())
                    snippet = text[:1000]
                    fetch_status = "success"
            except Exception as e:
                fetch_status = f"error: {e}"

        reviews.append({
            "id": idx,
            "critic": critic,
            "platform": platform,
            "handle": handle,
            "movie": movie,
            "year": year,
            "rating": rating if rating else "Unrated",
            "verdict_summary": verdict,
            "review_url": url,
            "fetch_status": fetch_status,
            "snippet": snippet
        })

with open(output_json_path, "w", encoding="utf-8") as f:
    json.dump(reviews, f, indent=2, ensure_ascii=False)

print(f"Finished processing {len(reviews)} reviews into JSON file.")
