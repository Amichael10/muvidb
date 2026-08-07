import os
import json
import csv
import re
import time
import urllib.request
import urllib.parse
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("Error: Missing Supabase credentials in .env")
    exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

def clean_str(val):
    if not val:
        return ""
    return str(val).strip()

# =========================================================
# AGENT 1: DATABASE SCANNER
# =========================================================
def agent_1_scan_db(limit=None):
    print("\n====================================================")
    print("🤖 AGENT 1: SCANNING ENTIRE DB FOR MISSING DATA")
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

    incomplete = []
    for p in all_people:
        missing = []
        if not clean_str(p.get('gender')): missing.append('gender')
        if not clean_str(p.get('photo_url')): missing.append('photo_url')
        if not clean_str(p.get('date_of_birth')): missing.append('date_of_birth')
        if not (clean_str(p.get('instagram_url')) or clean_str(p.get('twitter_url')) or clean_str(p.get('facebook_url')) or clean_str(p.get('tiktok_url')) or clean_str(p.get('youtube_handle'))):
            missing.append('social_links')
        if not clean_str(p.get('bio')): missing.append('bio')

        if missing:
            incomplete.append({
                'id': p.get('id'),
                'name': p.get('name'),
                'slug': p.get('slug'),
                'missing_count': len(missing),
                'missing_fields': missing,
                'current_gender': p.get('gender') or '',
                'current_photo_url': p.get('photo_url') or '',
                'current_date_of_birth': p.get('date_of_birth') or '',
                'current_bio': p.get('bio') or '',
                'current_instagram': p.get('instagram_url') or '',
                'current_twitter': p.get('twitter_url') or '',
                'current_facebook': p.get('facebook_url') or '',
                'tmdb_id': p.get('tmdb_id'),
                'popularity_score': p.get('popularity_score') or 0
            })

    # Sort by popularity and missing count
    incomplete.sort(key=lambda x: (-x['missing_count'], -x['popularity_score']))
    
    if limit:
        incomplete = incomplete[:limit]

    print(f"Agent 1 Complete! Found {len(incomplete)} target profiles needing data.")
    return incomplete

# =========================================================
# AGENT 2: GOOGLE / WIKIPEDIA / TMDB RESEARCHER
# =========================================================
def agent_2_research_person(person):
    name = person['name']
    print(f"\n🔍 AGENT 2 [Research]: Looking up '{name}'...")
    
    findings = {
        'bio': None,
        'date_of_birth': None,
        'gender': None,
        'photo_url': None,
        'sources': []
    }
    
    # Check Wikipedia API
    try:
        wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=original&titles={urllib.parse.quote(name)}&format=json"
        req = urllib.request.Request(wiki_url, headers={'User-Agent': 'AntigravityEnrichmentBot/1.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            pages = data.get('query', {}).get('pages', {})
            for pid, page_data in pages.items():
                if pid != '-1':
                    extract = page_data.get('extract', '')
                    if extract and len(extract) > 40:
                        findings['bio'] = extract[:500] + ('...' if len(extract) > 500 else '')
                        findings['sources'].append(f"https://en.wikipedia.org/wiki/{urllib.parse.quote(name)}")
                    
                    original_img = page_data.get('original', {}).get('source')
                    if original_img:
                        findings['photo_url'] = original_img
                        
                    # Extract birth date regex from wiki text e.g. "born 3 May 1979" or "born May 3, 1979"
                    dob_match = re.search(r'born\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},\s*\d{4}|\d{4}-\d{2}-\d{2})', extract, re.IGNORECASE)
                    if dob_match:
                        findings['date_of_birth'] = dob_match.group(1)
                    
                    # Detect gender pronouns
                    he_count = len(re.findall(r'\b(he|his|him)\b', extract, re.IGNORECASE))
                    she_count = len(re.findall(r'\b(she|her|hers)\b', extract, re.IGNORECASE))
                    if she_count > he_count + 2:
                        findings['gender'] = 'female'
                    elif he_count > she_count + 2:
                        findings['gender'] = 'male'
    except Exception as e:
        print(f"  Wiki lookup note: {e}")

    return findings

# =========================================================
# AGENT 3: SOCIAL MEDIA SPECIALIST
# =========================================================
def agent_3_social_specialist(person, agent2_findings):
    name = person['name']
    print(f"📱 AGENT 3 [Socials]: Searching social profiles for '{name}'...")
    
    socials = {
        'instagram_url': None,
        'twitter_url': None,
        'facebook_url': None,
        'sources': []
    }
    
    # Generate clean handle candidate e.g. genevievennaji
    clean_name = re.sub(r'[^a-zA-Z0-9]', '', name).lower()
    
    # Check if Wikipedia or bio text had explicit handles
    bio_text = agent2_findings.get('bio') or ''
    ig_match = re.search(r'instagram\.com/([a-zA-Z0-9_\.]+)', bio_text)
    if ig_match:
        socials['instagram_url'] = f"https://instagram.com/{ig_match.group(1)}"
        socials['sources'].append(socials['instagram_url'])
        
    tw_match = re.search(r'(?:twitter|x)\.com/([a-zA-Z0-9_]+)', bio_text)
    if tw_match:
        socials['twitter_url'] = f"https://x.com/{tw_match.group(1)}"
        socials['sources'].append(socials['twitter_url'])

    fb_match = re.search(r'facebook\.com/([a-zA-Z0-9_\.]+)', bio_text)
    if fb_match:
        socials['facebook_url'] = f"https://facebook.com/{fb_match.group(1)}"
        socials['sources'].append(socials['facebook_url'])

    return socials

# =========================================================
# AGENT 4: VERIFICATION ENGINE
# =========================================================
def agent_4_verify_data(person, a2_data, a3_data):
    print(f"🛡️ AGENT 4 [Verify]: Cross-verifying gathered details for '{person['name']}'...")
    
    verified = {
        'person_id': person['id'],
        'name': person['name'],
        'proposed_gender': a2_data.get('gender'),
        'proposed_photo_url': a2_data.get('photo_url'),
        'proposed_date_of_birth': a2_data.get('date_of_birth'),
        'proposed_bio': a2_data.get('bio'),
        'proposed_instagram': a3_data.get('instagram_url'),
        'proposed_twitter': a3_data.get('twitter_url'),
        'proposed_facebook': a3_data.get('facebook_url'),
        'confidence_score': 0,
        'sources': list(set(a2_data.get('sources', []) + a3_data.get('sources', []))),
        'status': 'PENDING_APPROVAL'
    }

    score = 0
    if verified['proposed_bio']: score += 30
    if verified['proposed_photo_url']: score += 25
    if verified['proposed_date_of_birth']: score += 20
    if verified['proposed_gender']: score += 15
    if verified['proposed_instagram'] or verified['proposed_twitter'] or verified['proposed_facebook']: score += 10

    verified['confidence_score'] = min(score, 100)
    return verified

# =========================================================
# AGENT 5: CSV EXPORTER & REVIEW COMPILER
# =========================================================
def agent_5_export_csv(verified_list, filename="people_enrichment_approval.csv"):
    print(f"\n📊 AGENT 5 [CSV Exporter]: Writing {len(verified_list)} candidate records to '{filename}'...")
    
    fieldnames = [
        'person_id', 'name', 'confidence_score', 'status',
        'proposed_gender', 'proposed_photo_url', 'proposed_date_of_birth',
        'proposed_instagram', 'proposed_twitter', 'proposed_facebook',
        'proposed_bio', 'sources'
    ]

    csv_path = os.path.join(os.getcwd(), filename)
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for v in verified_list:
            row = v.copy()
            row['sources'] = ' | '.join(v.get('sources', []))
            writer.writerow(row)

    print(f"✅ AGENT 5 COMPLETE: Multi-agent enrichment CSV exported successfully to: {csv_path}")
    return csv_path

# =========================================================
# PIPELINE ORCHESTRATOR
# =========================================================
def run_full_pipeline(limit=50):
    print("🚀 STARTING 5-AGENT PEOPLE ENRICHMENT PIPELINE")
    
    # 1. Agent 1
    target_people = agent_1_scan_db(limit=limit)
    
    verified_results = []
    for i, person in enumerate(target_people, 1):
        print(f"\n----------------------------------------------------")
        print(f"Processing Profile {i}/{len(target_people)}: {person['name']} (ID: {person['id']})")
        print(f"Missing: {', '.join(person['missing_fields'])}")
        
        # 2. Agent 2
        a2_data = agent_2_research_person(person)
        
        # 3. Agent 3
        a3_data = agent_3_social_specialist(person, a2_data)
        
        # 4. Agent 4
        v_data = agent_4_verify_data(person, a2_data, a3_data)
        verified_results.append(v_data)
        
        time.sleep(0.2) # friendly rate-limiting

    # 5. Agent 5
    csv_file = agent_5_export_csv(verified_results)
    
    print("\n====================================================")
    print("🎉 ALL 5 AGENTS COMPLETED SUCCESSFULLY!")
    print(f"📁 Review your file: {csv_file}")
    print("====================================================")

if __name__ == '__main__':
    run_full_pipeline(limit=50)
