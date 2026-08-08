import json
import os
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=".env.local")
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or "https://pkenrmorywmuvnzfoylp.supabase.co"
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SERVICE_KEY:
    print("❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

print("🚀 APPLYING APPROVED MOVIES TO SUPABASE WITH SERVICE ROLE KEY...")
with open("movies_enrichment_candidates.json", "r", encoding="utf-8") as f:
    movies = json.load(f)

applied_movies = 0
for m in movies:
    film_id = m.get("film_id")
    if not film_id:
        continue
    
    payload = {}
    if m.get("proposed_synopsis"):
        payload["synopsis"] = m["proposed_synopsis"]
    if m.get("proposed_genres"):
        payload["genres"] = m["proposed_genres"]
    if m.get("proposed_age_rating"):
        payload["nfvcb_rating"] = m["proposed_age_rating"]

    try:
        res = supabase.table("films").update(payload).eq("id", film_id).execute()
        if res.data:
            applied_movies += 1
    except Exception as e:
        print(f"  Error applying film {m.get('title')}: {e}")

print(f"🎉 Successfully applied {applied_movies} / {len(movies)} movies to Supabase!")

print("\n🚀 APPLYING APPROVED PEOPLE TO SUPABASE WITH SERVICE ROLE KEY...")
with open("google_socials_enriched_people.json", "r", encoding="utf-8") as f:
    people = json.load(f)

applied_people = 0
for p in people:
    person_id = p.get("person_id")
    if not person_id:
        continue

    payload = {}
    if p.get("proposed_bio") or p.get("bio"):
        payload["bio"] = p.get("proposed_bio") or p.get("bio")
    if p.get("proposed_photo") or p.get("photo_url"):
        payload["photo_url"] = p.get("proposed_photo") or p.get("photo_url")
    if p.get("proposed_dob") or p.get("date_of_birth"):
        payload["date_of_birth"] = p.get("proposed_dob") or p.get("date_of_birth")
    if p.get("proposed_gender") or p.get("gender"):
        payload["gender"] = p.get("proposed_gender") or p.get("gender")

    try:
        res = supabase.table("people").update(payload).eq("id", person_id).execute()
        if res.data:
            applied_people += 1
    except Exception as e:
        print(f"  Error applying person {p.get('name')}: {e}")

print(f"🎉 Successfully applied {applied_people} / {len(people)} people to Supabase!")
