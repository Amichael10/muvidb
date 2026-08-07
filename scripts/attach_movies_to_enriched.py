import json
import urllib.request
import os

SUPABASE_URL = "https://pkenrmorywmuvnzfoylp.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_fXxu9pH8yK8s6xEvEJWNgw_T3Nbbvdo"

headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json"
}

def attach_movies_to_people():
    if not os.path.exists("google_socials_enriched_people.json"):
        print("❌ google_socials_enriched_people.json not found!")
        return

    with open("google_socials_enriched_people.json", "r", encoding="utf-8") as f:
        people = json.load(f)

    print(f"🚀 ATTACHING KNOWN MOVIES & ROLES TO ALL {len(people)} ENRICHED PROFILES...")

    # Fetch credits in batches to optimize requests
    person_ids = [p["person_id"] for p in people if p.get("person_id")]
    
    # Map person_id -> list of movie titles/roles
    credits_map = {}

    batch_size = 200
    for i in range(0, len(person_ids), batch_size):
        batch = person_ids[i:i+batch_size]
        id_filter = f"in.({','.join(batch)})"
        url = f"{SUPABASE_URL}/rest/v1/credits?select=person_id,role,character_name,films(title,release_year)&person_id={id_filter}&limit=1000"
        
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                records = json.loads(resp.read().decode())
                for rec in records:
                    pid = rec.get("person_id")
                    if not pid:
                        continue
                    film = rec.get("films") or {}
                    ftitle = film.get("title")
                    if not ftitle:
                        continue
                    
                    role_desc = rec.get("character_name") or rec.get("role") or "Cast"
                    entry = f"{ftitle} ({role_desc})"
                    
                    if pid not in credits_map:
                        credits_map[pid] = []
                    if entry not in credits_map[pid] and len(credits_map[pid]) < 3:
                        credits_map[pid].append(entry)
        except Exception as e:
            pass

        if (i + batch_size) % 1000 == 0 or (i + batch_size) >= len(person_ids):
            print(f"  Processed {min(i + batch_size, len(person_ids))} / {len(person_ids)} people credits...")

    # Attach credits_map to candidates
    attached_count = 0
    for p in people:
        pid = p.get("person_id")
        known_movies = credits_map.get(pid, [])
        if known_movies:
            p["known_movies"] = known_movies
            attached_count += 1
        else:
            p["known_movies"] = ["No credit records linked yet"]

    with open("google_socials_enriched_people.json", "w", encoding="utf-8") as f:
        json.dump(people, f, indent=2)

    print(f"✅ SUCCESS: Attached movie credits to {attached_count} people profiles!")

if __name__ == "__main__":
    attach_movies_to_people()
