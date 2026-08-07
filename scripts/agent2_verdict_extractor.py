import json

input_file = r"C:\Users\User\.gemini\antigravity\brain\de833698-2c8f-43e1-bd7e-32069e8ea801\agent1_fetched_reviews.json"
output_file = r"C:\Users\User\.gemini\antigravity\brain\de833698-2c8f-43e1-bd7e-32069e8ea801\agent2_extracted_verdicts.json"

with open(input_file, "r", encoding="utf-8") as f:
    reviews = json.load(f)

extracted = []

for item in reviews:
    verdict = item.get("verdict_summary", "")
    rating = item.get("rating", "Unrated")

    # Determine sentiment badge
    if any(k in verdict.lower() for k in ["superb", "masterful", "praised", "solid", "heartfelt", "robust"]):
        sentiment = "POSITIVE"
    elif any(k in verdict.lower() for k in ["wastes", "embarrassment", "nonsensical", "meaningless", "unimaginative", "forgettable"]):
        sentiment = "NEGATIVE"
    else:
        sentiment = "MIXED / CRITICAL"

    extracted.append({
        "id": item["id"],
        "critic": item["critic"],
        "platform": item["platform"],
        "handle": item["handle"],
        "movie": item["movie"],
        "year": item["year"],
        "rating": rating,
        "sentiment": sentiment,
        "verdict_statement": verdict,
        "review_url": item["review_url"]
    })

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(extracted, f, indent=2, ensure_ascii=False)

print(f"Agent 2 Extracted {len(extracted)} verdicts into JSON.")
