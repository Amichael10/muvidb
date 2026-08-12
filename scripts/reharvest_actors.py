import os
import re
import json
import urllib.request
import urllib.parse
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")
load_dotenv(".env")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TMDB_KEY = os.getenv("VITE_TMDB_API_KEY") or "4edb739fa9f16d24f0aecf6a0dbcaab8"
YT_KEY = os.getenv("YOUTUBE_API_KEY") or os.getenv("VITE_YOUTUBE_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def clean_title(title):
    t = re.sub(r'\[.*?\]|\(.*?\)', '', title)
    t = re.sub(r'Nollywood Movie|Latest Yoruba Movie|Yoruba Movie \d+|Full Movie', '', t, flags=re.IGNORECASE)
    t = re.sub(r'season\s+\d+|part\s+\d+|ep\s+\d+', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s+', ' ', t)
    return t.strip()

def slugify(text):
    s = text.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def find_or_create_person(names, primary_name):
    for name in names:
        res = supabase.table('people').select('id, name, film_count').ilike('name', f'%{name}%').order('film_count', desc=True, nullsfirst=False).limit(1).execute()
        if res.data and len(res.data) > 0:
            print(f"Found person in DB: {res.data[0]['name']} ({res.data[0]['id']})")
            return res.data[0]['id']

    slug = slugify(primary_name)
    print(f"Creating new person: {primary_name} ({slug})")
    res = supabase.table('people').insert({'name': primary_name, 'slug': slug, 'source': 'reharvest_script'}).execute()
    return res.data[0]['id']

def find_or_create_film(title, year=None, poster_url=None, synopsis=None, tmdb_id=None):
    cleaned = clean_title(title)
    if not cleaned:
        return None

    if tmdb_id:
        res = supabase.table('films').select('id').eq('tmdb_id', tmdb_id).limit(1).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]['id']

    res = supabase.table('films').select('id').ilike('title', cleaned).limit(1).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]['id']

    slug = slugify(cleaned)
    try:
        res = supabase.table('films').insert({
            'title': cleaned,
            'year': year or 2026,
            'poster_url': poster_url,
            'synopsis': synopsis,
            'tmdb_id': tmdb_id,
            'is_published': True,
            'source': 'reharvest_script'
        }).execute()
        return res.data[0]['id']
    except Exception as e:
        fallback_slug = f"{slug}-{os.urandom(2).hex()}"
        res = supabase.table('films').insert({
            'title': cleaned,
            'year': year or 2026,
            'poster_url': poster_url,
            'synopsis': synopsis,
            'tmdb_id': tmdb_id,
            'is_published': True,
            'source': 'reharvest_script'
        }).execute()
        return res.data[0]['id']

def attach_credit(film_id, person_id, role='actor', character_name=None):
    if not film_id or not person_id:
        return
    try:
        supabase.table('credits').upsert({
            'film_id': film_id,
            'person_id': person_id,
            'role': role,
            'character_name': character_name
        }, on_conflict='film_id,person_id,role').execute()
    except Exception as e:
        pass

def harvest_tmdb(query, person_id):
    print(f"\n🔍 Harvesting TMDB for '{query}'...")
    try:
        url = f"https://api.themoviedb.org/3/search/person?api_key={TMDB_KEY}&query={urllib.parse.quote(query)}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())

        if not data.get('results'):
            return

        tmdb_person = data['results'][0]
        if tmdb_person.get('profile_path'):
            supabase.table('people').update({
                'photo_url': f"https://image.tmdb.org/t/p/w500{tmdb_person['profile_path']}",
                'tmdb_id': tmdb_person['id']
            }).eq('id', person_id).execute()

        credits_url = f"https://api.themoviedb.org/3/person/{tmdb_person['id']}/movie_credits?api_key={TMDB_KEY}"
        req = urllib.request.Request(credits_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            cdata = json.loads(resp.read().decode())

        cast = cdata.get('cast', [])
        count = 0
        for m in cast:
            if not m.get('title'):
                continue
            year = int(m['release_date'].split('-')[0]) if m.get('release_date') else None
            poster = f"https://image.tmdb.org/t/p/w500{m['poster_path']}" if m.get('poster_path') else None
            fid = find_or_create_film(m['title'], year, poster, m.get('overview'), m.get('id'))
            if fid:
                attach_credit(fid, person_id, 'actor', m.get('character'))
                count += 1
        print(f"✅ Linked {count} TMDB movies")
    except Exception as e:
        print(f"Error harvesting TMDB: {e}")

def harvest_partyjollof(query, person_id):
    print(f"\n🔍 Harvesting PartyJollofTV for '{query}'...")
    try:
        count = 0
        for page in range(1, 10):
            url = f"https://cms.partyjolloftv.com/api/movies?limit=100&page={page}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode())

            movies = data.get('docs', [])
            if not movies:
                break

            for m in movies:
                if not m.get('title'):
                    continue
                m_str = json.dumps(m).lower()
                if query.lower() in m_str:
                    year = int(m['releaseDate'].split('-')[0]) if m.get('releaseDate') else None
                    poster = f"https://1s8yfxw74q.ufs.sh/f/{m['poster']['_key']}" if m.get('poster', {}).get('_key') else None
                    fid = find_or_create_film(m['title'], year, poster, m.get('synopsis'))
                    if fid:
                        attach_credit(fid, person_id, 'actor')
                        count += 1
        print(f"✅ Linked {count} PartyJollof movies")
    except Exception as e:
        print(f"Error harvesting PartyJollof: {e}")

def update_film_count(person_id):
    res = supabase.table('credits').select('*', count='exact').eq('person_id', person_id).execute()
    c = res.count or 0
    supabase.table('people').update({'film_count': c}).eq('id', person_id).execute()
    return c

def main():
    print("====================================================")
    print("🚀 RE-HARVESTING CREDITS FOR TOYIN ABRAHAM & IBRAHIM YEKINI")
    print("====================================================\n")

    # 1. Ibrahim Yekini
    ibrahim_id = find_or_create_person(
        ['Ibrahim Yekini', 'Itele D Icon', 'Itele', 'Ibrahim Yekini Itele'],
        'Ibrahim Yekini (Itele D Icon)'
    )
    harvest_tmdb('Ibrahim Yekini', ibrahim_id)
    harvest_tmdb('Itele', ibrahim_id)
    harvest_partyjollof('Ibrahim Yekini', ibrahim_id)
    harvest_partyjollof('Itele', ibrahim_id)
    harvest_partyjollof('Koleoso', ibrahim_id)
    c1 = update_film_count(ibrahim_id)

    # 2. Toyin Abraham
    toyin_id = find_or_create_person(
        ['Toyin Abraham', 'Toyin Aimakhu', 'Toyin Abraham Ajeyemi'],
        'Toyin Abraham'
    )
    harvest_tmdb('Toyin Abraham', toyin_id)
    harvest_tmdb('Toyin Aimakhu', toyin_id)
    harvest_partyjollof('Toyin Abraham', toyin_id)
    harvest_partyjollof('Toyin Aimakhu', toyin_id)
    c2 = update_film_count(toyin_id)

    print("\n====================================================")
    print("🎉 RE-HARVEST COMPLETE!")
    print(f"👑 Ibrahim Yekini (Itele D Icon) Total Credits: {c1}")
    print(f"👑 Toyin Abraham Total Credits: {c2}")
    print("====================================================")

if __name__ == "__main__":
    main()
