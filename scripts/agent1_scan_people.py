import os
import json
import csv
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("Error: Missing Supabase credentials in .env")
    exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

def run_agent1_scan():
    print("====================================================")
    print("🤖 AGENT 1: SCANNING ENTIRE PEOPLE DATABASE")
    print("====================================================")

    all_people = []
    page = 0
    page_size = 1000
    has_more = True

    while has_more:
        res = supabase.table('people').select(
            'id, name, slug, gender, photo_url, date_of_birth, bio, instagram_url, twitter_url, facebook_url, tiktok_url, youtube_handle, tmdb_id, mubi_id, popularity_score'
        ).range(page * page_size, (page + 1) * page_size - 1).execute()

        data = res.data or []
        if data:
            all_people.extend(data)
            print(f"  Fetched {len(all_people)} people so far...")
            page += 1
            if len(data) < page_size:
                has_more = False
        else:
            has_more = False

    print(f"\nTotal people in DB: {len(all_people)}")

    incomplete_people = []
    count_gender = 0
    count_photo = 0
    count_dob = 0
    count_socials = 0
    count_bio = 0
    count_missing_all = 0

    for person in all_people:
        has_gender = bool(person.get('gender') and str(person.get('gender')).strip())
        has_photo = bool(person.get('photo_url') and str(person.get('photo_url')).strip())
        has_dob = bool(person.get('date_of_birth') and str(person.get('date_of_birth')).strip())
        has_socials = bool(
            (person.get('instagram_url') and str(person.get('instagram_url')).strip()) or
            (person.get('twitter_url') and str(person.get('twitter_url')).strip()) or
            (person.get('facebook_url') and str(person.get('facebook_url')).strip()) or
            (person.get('tiktok_url') and str(person.get('tiktok_url')).strip()) or
            (person.get('youtube_handle') and str(person.get('youtube_handle')).strip())
        )
        has_bio = bool(person.get('bio') and str(person.get('bio')).strip())

        missing_fields = []
        if not has_gender:
            missing_fields.append('gender')
            count_gender += 1
        if not has_photo:
            missing_fields.append('photo_url')
            count_photo += 1
        if not has_dob:
            missing_fields.append('date_of_birth')
            count_dob += 1
        if not has_socials:
            missing_fields.append('social_links')
            count_socials += 1
        if not has_bio:
            missing_fields.append('bio')
            count_bio += 1

        if len(missing_fields) == 5:
            count_missing_all += 1

        if missing_fields:
            incomplete_people.append({
                'id': person.get('id'),
                'name': person.get('name') or '',
                'slug': person.get('slug') or '',
                'missing_count': len(missing_fields),
                'missing_fields': ', '.join(missing_fields),
                'gender': person.get('gender') or '',
                'photo_url': person.get('photo_url') or '',
                'date_of_birth': person.get('date_of_birth') or '',
                'bio': (person.get('bio') or '')[:100].replace('\n', ' '),
                'instagram_url': person.get('instagram_url') or '',
                'twitter_url': person.get('twitter_url') or '',
                'facebook_url': person.get('facebook_url') or '',
                'tmdb_id': person.get('tmdb_id') or '',
                'mubi_id': person.get('mubi_id') or '',
                'popularity_score': person.get('popularity_score') or 0
            })

    # Sort by missing count and popularity
    incomplete_people.sort(key=lambda x: (-x['missing_count'], -x['popularity_score']))

    print("\n====================================================")
    print("📊 AGENT 1 SCAN RESULTS SUMMARY")
    print("====================================================")
    print(f"Total DB Records Scanned    : {len(all_people)}")
    print(f"Total Needing Enrichment   : {len(incomplete_people)} ({round(len(incomplete_people)/len(all_people)*100 if all_people else 0)}%)")
    print(f"Missing Gender             : {count_gender}")
    print(f"Missing Profile Photo      : {count_photo}")
    print(f"Missing Date of Birth      : {count_dob}")
    print(f"Missing Social Links       : {count_socials}")
    print(f"Missing Bio                : {count_bio}")
    print(f"Missing ALL 5 Fields       : {count_missing_all}")
    print("====================================================\n")

    # Output JSON & CSV
    json_path = os.path.join(os.getcwd(), 'people_missing_data_scan.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(incomplete_people, f, indent=2, ensure_ascii=False)
    print(f"Saved JSON scan results to: {json_path}")

    csv_path = os.path.join(os.getcwd(), 'people_missing_data_scan.csv')
    fieldnames = ['id', 'name', 'slug', 'missing_count', 'missing_fields', 'gender', 'photo_url', 'date_of_birth', 'instagram_url', 'twitter_url', 'facebook_url', 'popularity_score']
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(incomplete_people)
    print(f"Saved CSV scan results to : {csv_path}")

if __name__ == '__main__':
    run_agent1_scan()
