import json
import urllib.request
import os

SUPABASE_URL = "https://pkenrmorywmuvnzfoylp.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_fXxu9pH8yK8s6xEvEJWNgw_T3Nbbvdo"

HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def apply_enrichments_to_supabase(json_file_path="approved_people_enrichments.json"):
    if not os.path.exists(json_file_path):
        print(f"❌ File {json_file_path} not found! Click 'Export Approved JSON' in the dashboard first.")
        return

    with open(json_file_path, "r", encoding="utf-8") as f:
        approved_items = json.load(f)

    print(f"🚀 APPLYING BATCH ENRICHMENTS TO SUPABASE FOR {len(approved_items)} PROFILES...")
    
    updated_count = 0
    failed_count = 0

    for idx, item in enumerate(approved_items):
        person_id = item.get("person_id")
        if not person_id:
            continue

        payload = {}
        
        proposed_gender = item.get("proposed_gender")
        if proposed_gender and proposed_gender != "Unknown":
            payload["gender"] = proposed_gender

        proposed_photo = item.get("proposed_photo")
        if proposed_photo:
            payload["photo_url"] = proposed_photo

        proposed_dob = item.get("proposed_dob")
        if proposed_dob and proposed_dob != "Not found":
            payload["date_of_birth"] = proposed_dob

        proposed_bio = item.get("proposed_bio")
        if proposed_bio:
            payload["bio"] = proposed_bio

        proposed_ig = item.get("proposed_ig")
        if proposed_ig:
            payload["instagram_url"] = proposed_ig

        proposed_tw = item.get("proposed_tw")
        if proposed_tw:
            payload["twitter_url"] = proposed_tw

        proposed_fb = item.get("proposed_fb")
        if proposed_fb:
            payload["facebook_url"] = proposed_fb

        if not payload:
            continue

        url = f"{SUPABASE_URL}/rest/v1/people?id=eq.{person_id}"
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data_bytes, headers=HEADERS, method="PATCH")

        try:
            with urllib.request.urlopen(req) as resp:
                if resp.status in (200, 204):
                    updated_count += 1
                else:
                    failed_count += 1
        except Exception as e:
            failed_count += 1

        if (idx + 1) % 500 == 0 or (idx + 1) == len(approved_items):
            print(f"  Processed {idx + 1} / {len(approved_items)} updates... ({updated_count} succeeded, {failed_count} failed)")

    print(f"\n✅ BATCH ENRICHMENT UPDATE COMPLETE!")
    print(f"Successfully updated {updated_count} people records in Supabase DB!")

if __name__ == "__main__":
    apply_enrichments_to_supabase()
