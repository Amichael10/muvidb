import sys
sys.stdout.reconfigure(encoding='utf-8')
import os
import requests
import dotenv

dotenv.load_dotenv('.env.local')
dotenv.load_dotenv('.env')

supabase_url = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

headers = {
    'apikey': supabase_key,
    'Authorization': f'Bearer {supabase_key}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation'
}

critic_payload = {
    'name': 'Dami Dawson',
    'slug': 'dami-dawson',
    'title': 'Film Critic & Editorial Founder',
    'publication': "It's A Wrap Nigeria",
    'platform': "It's A Wrap Nigeria / X",
    'handle': '@damidawson',
    'profile_url': 'https://itsawrapng.com',
    'bio': "Leading Nigerian film critic, cultural essayist, and founder of It's A Wrap Nigeria, providing incisive commentary, box office analysis, and comprehensive film reviews across Nollywood and African cinema.",
    'avatar_url': 'https://static.wixstatic.com/media/f87a6d_4dd9e45b448549e1a4b6bfb6251af0d4~mv2.png',
    'is_verified': True
}

# Check if exists by slug
res = requests.get(f"{supabase_url}/rest/v1/critics?slug=eq.dami-dawson", headers=headers)
existing = res.json() if res.status_code == 200 else []

if existing:
    critic_id = existing[0]['id']
    print(f"Updating existing critic (ID: {critic_id})...")
    up_res = requests.patch(f"{supabase_url}/rest/v1/critics?id=eq.{critic_id}", json=critic_payload, headers=headers)
    print("Update status:", up_res.status_code, up_res.text)
else:
    print("Inserting new critic...")
    ins_res = requests.post(f"{supabase_url}/rest/v1/critics", json=critic_payload, headers=headers)
    print("Insert status:", ins_res.status_code, ins_res.text)
