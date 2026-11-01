import os
import re
import sys
import json
import uuid
from datetime import datetime
import dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

dotenv.load_dotenv('.env.local')
dotenv.load_dotenv('.env')

url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')
sb = create_client(url, key)

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[\'\"’]', '', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

# Complete curated metadata for all 20 Lagos Fringe Stage Plays
PLAYS_METADATA = [
    {
        'slug': 'put-it-on-my-head',
        'title': 'Put It On My Head',
        'playwright': 'Inyang Edoho',
        'director': 'Inem Inyang-Ito',
        'producer': 'Joy Grant-Ekong (Jove Productions)',
        'genre': 'Drama',
        'synopsis': 'A captivating stage production about life choices, societal pressures, and relationships, starring leading Nollywood actors.',
        'cast': [
            {'name': 'Mofe Duncan', 'role': 'Actor', 'character': None, 'billing': 1},
            {'name': 'Charles Born', 'role': 'Actor', 'character': None, 'billing': 2},
            {'name': 'Temitope Tanpe Aje', 'role': 'Actor', 'character': None, 'billing': 3},
        ],
        'crew': [
            {'name': 'Inyang Edoho', 'role': 'Writer', 'billing': 1},
            {'name': 'Inem Inyang-Ito', 'role': 'Director', 'billing': 2},
            {'name': 'Joy Grant-Ekong', 'role': 'Producer', 'billing': 3},
        ]
    },
    {
        'slug': 'rite-of-passage',
        'title': 'Rite Of Passage',
        'playwright': None,
        'director': None,
        'producer': 'Ember House',
        'genre': 'Monologue / Drama',
        'synopsis': 'Ember House presents Akah Nnani live in Lagos in a deeply personal and transformative theatrical performance exploring identity and growth.',
        'cast': [
            {'name': 'Akah Nnani', 'role': 'Actor', 'character': 'Lead', 'billing': 1},
        ],
        'crew': []
    },
    {
        'slug': 'mentality-what-men-dont-say',
        'title': 'Mentality: What Men Don’t Say',
        'playwright': 'Tolulope Odebunmi',
        'director': 'Tolulope Odebunmi & Precious Okpala',
        'producer': 'Jisyo Productions',
        'genre': 'Drama',
        'synopsis': 'Four friends. One night. Every mask comes off. An unfiltered exploration of modern masculinity, vulnerability, mental health, and friendship.',
        'cast': [
            {'name': 'Seun Kentebe', 'role': 'Actor', 'character': None, 'billing': 1},
            {'name': 'Tolulope Odebunmi', 'role': 'Actor', 'character': None, 'billing': 2},
            {'name': 'Kazeem Akanji', 'role': 'Actor', 'character': None, 'billing': 3},
            {'name': 'Emeka Golden', 'role': 'Actor', 'character': None, 'billing': 4},
        ],
        'crew': [
            {'name': 'Tolulope Odebunmi', 'role': 'Writer', 'billing': 1},
            {'name': 'Tolulope Odebunmi', 'role': 'Director', 'billing': 2},
            {'name': 'Precious Okpala', 'role': 'Director', 'billing': 3},
        ]
    },
    {
        'slug': 'the-lottery-ticket',
        'title': 'The Lottery Ticket',
        'playwright': 'Ahmed Yerima',
        'director': 'Oselenonomen',
        'producer': 'Lagos Fringe & Cave Culture',
        'genre': 'Satire / Drama',
        'synopsis': 'Written by celebrated Nigerian playwright Ahmed Yerima, exploring human greed, desperation, and unexpected fortune when a winning lottery ticket appears.',
        'cast': [],
        'crew': [
            {'name': 'Prof. Ahmed Yerima', 'role': 'Writer', 'billing': 1},
            {'name': 'Oselenonomen', 'role': 'Director', 'billing': 2},
        ]
    },
    {
        'slug': 'wheres-my-groom',
        'title': 'Where’s My Groom?',
        'playwright': 'Joy Isi Bewaji',
        'director': 'Joy Isi Bewaji',
        'producer': 'Joy Isi Bewaji',
        'genre': 'Comedy / Drama',
        'synopsis': 'Written and directed by Joy Isi Bewaji, starring Nene Aliemeke in an electrifying satire on wedding culture, societal expectations, and womanhood.',
        'cast': [
            {'name': 'Nene Aliemeke', 'role': 'Actor', 'character': 'Lead', 'billing': 1},
        ],
        'crew': [
            {'name': 'Joy Isi Bewaji', 'role': 'Writer', 'billing': 1},
            {'name': 'Joy Isi Bewaji', 'role': 'Director', 'billing': 2},
        ]
    },
    {
        'slug': 'ijapa-in-eko',
        'title': 'Ìjàpá In Èkó!',
        'playwright': 'Erioluwa Popoola',
        'director': None,
        'producer': 'Itan Production',
        'genre': 'Folklore / Contemporary Theatre',
        'synopsis': 'A clever re-imagining of the classic Yoruba folkloric trickster tortoise, Ìjàpá, navigating the hustle, chaos, and ambition of modern-day Lagos.',
        'cast': [],
        'crew': [
            {'name': 'Erioluwa Popoola', 'role': 'Writer', 'billing': 1},
        ]
    },
    {
        'slug': 'ibi-the-unseen-evil',
        'title': 'Ìbi: The Unseen Evil',
        'playwright': 'Erioluwa Popoola',
        'director': None,
        'producer': 'Itan Production',
        'genre': 'Thriller / Drama',
        'synopsis': 'An intense stage drama tackling covert malice, moral decay, and the unseen consequences of hidden secrets in family life.',
        'cast': [],
        'crew': [
            {'name': 'Erioluwa Popoola', 'role': 'Writer', 'billing': 1},
        ]
    },
    {
        'slug': 'the-marriage-of-anansewa',
        'title': 'The Marriage Of Anansewa',
        'playwright': 'Efua Sutherland',
        'director': 'Dapo Bruce',
        'producer': 'Atabonso Live Productions',
        'genre': 'Comedy / Classic Theatre',
        'synopsis': 'Inspired by Ghanaian playwright Efua Sutherland’s legendary storytelling drama. Performed by students of Peaklane College.',
        'cast': [],
        'crew': [
            {'name': 'Efua Sutherland', 'role': 'Writer', 'billing': 1},
            {'name': 'Dapo Bruce', 'role': 'Director', 'billing': 2},
        ]
    },
    {
        'slug': 'terrapolis',
        'title': 'Terrapolis',
        'playwright': 'Qudus Onikeku',
        'director': 'Qudus Onikeku',
        'producer': 'The QDance Company & J. Randle Centre',
        'genre': 'Physical Theatre / Dance',
        'synopsis': 'An immersive movement, rhythm, and physical theatre experience created by internationally acclaimed choreographer Qudus Onikeku and The QDance Company.',
        'cast': [
            {'name': 'Qudus Onikeku', 'role': 'Actor', 'character': 'Lead Performer', 'billing': 1},
        ],
        'crew': [
            {'name': 'Qudus Onikeku', 'role': 'Director', 'billing': 1},
        ]
    },
    {
        'slug': 'there-is-rice-at-home',
        'title': 'There Is Rice At Home',
        'playwright': 'Inyang Edoho & Joewackle J. Kusi',
        'director': 'Oladele Samuel Olusegun',
        'producer': 'Angela Peters (Instinct Pictures)',
        'genre': 'Musical Theatre',
        'synopsis': 'A vibrant musical theatre production starring Isoken Aruede and David ‘Favoice’ Akpojisheri celebrating Nigerian home truths and humor.',
        'cast': [
            {'name': 'Isoken Aruede', 'role': 'Actor', 'character': None, 'billing': 1},
            {'name': 'David Akpojisheri', 'role': 'Actor', 'character': None, 'billing': 2},
        ],
        'crew': [
            {'name': 'Inyang Edoho', 'role': 'Writer', 'billing': 1},
            {'name': 'Joewackle J. Kusi', 'role': 'Writer', 'billing': 2},
            {'name': 'Oladele Samuel Olusegun', 'role': 'Director', 'billing': 3},
            {'name': 'Angela Peters', 'role': 'Producer', 'billing': 4},
        ]
    },
    {
        'slug': 'my-room-my-doom',
        'title': 'My Room My Doom',
        'playwright': 'Yemi Akande',
        'director': 'Hubert Ifokanbale',
        'producer': 'Zainab Yunusa (Hubert Ifokanbale Productions)',
        'genre': 'Drama',
        'synopsis': 'Written by Yemi Akande, starring Olude Omotola Molly. A suspenseful psychological examination of isolation, paranoia, and internal demons.',
        'cast': [
            {'name': 'Olude Omotola Molly', 'role': 'Actor', 'character': None, 'billing': 1},
        ],
        'crew': [
            {'name': 'Yemi Akande', 'role': 'Writer', 'billing': 1},
            {'name': 'Hubert Ifokanbale', 'role': 'Director', 'billing': 2},
            {'name': 'Zainab Yunusa', 'role': 'Producer', 'billing': 3},
        ]
    },
    {
        'slug': 'closure-is-for-wigs',
        'title': 'Closure Is For Wigs',
        'playwright': 'Mayowa Daramola',
        'director': None,
        'producer': None,
        'genre': 'Romantic Comedy / Drama',
        'synopsis': 'A witty, modern Nigerian look at post-breakup illusions, moving on, and why the closure we search for rarely looks like what we expect.',
        'cast': [],
        'crew': [
            {'name': 'Mayowa Daramola', 'role': 'Writer', 'billing': 1},
        ]
    },
    {
        'slug': 'tomorrow',
        'title': 'Tomorrow',
        'playwright': 'Usiwo Sonia Uyouyou',
        'director': 'Oteikwu Emmanuel Adah (Idomalion)',
        'producer': 'Idomalion Creations',
        'genre': 'Drama / Social Impact',
        'synopsis': 'A powerful theatrical call to action on sickle cell awareness, genotype literacy, and genetic responsibility in Nigeria.',
        'cast': [],
        'crew': [
            {'name': 'Usiwo Sonia Uyouyou', 'role': 'Writer', 'billing': 1},
            {'name': 'Oteikwu Emmanuel Adah', 'role': 'Director', 'billing': 2},
        ]
    },
    {
        'slug': 'true-colors',
        'title': 'True Colors',
        'playwright': 'Gloria Ohiri-Amosun',
        'director': 'Gloria Ohiri-Amosun',
        'producer': 'Go Creationz Production House',
        'genre': 'Inspirational Drama',
        'synopsis': 'A powerful story of self-love, identity, and the courage to embrace who you are. Co-produced by Dr. Folakemi Cole-Adeife.',
        'cast': [],
        'crew': [
            {'name': 'Gloria Ohiri-Amosun', 'role': 'Writer', 'billing': 1},
            {'name': 'Gloria Ohiri-Amosun', 'role': 'Director', 'billing': 2},
        ]
    },
    {
        'slug': 'waiting-with-the-madi-sons',
        'title': 'Waiting With The Madi-Sons',
        'playwright': 'T.T. Mattu',
        'director': 'T.T. Mattu',
        'producer': 'Ayo Alade',
        'genre': 'Drama',
        'synopsis': 'Starring Onome Akpotebu and Emmanuel Eze. An emotional story of family endurance, generational longing, and unspoken debts.',
        'cast': [
            {'name': 'Onome Akpotebu', 'role': 'Actor', 'character': None, 'billing': 1},
            {'name': 'Emmanuel Eze', 'role': 'Actor', 'character': None, 'billing': 2},
        ],
        'crew': [
            {'name': 'T.T. Mattu', 'role': 'Writer', 'billing': 1},
            {'name': 'T.T. Mattu', 'role': 'Director', 'billing': 2},
            {'name': 'Ayo Alade', 'role': 'Producer', 'billing': 3},
        ]
    },
    {
        'slug': 'kissing-love-desire-and-other-confessions',
        'title': 'Kissing: Love, Desire And Other Confessions',
        'playwright': None,
        'director': None,
        'producer': 'The Homeless Creative Inc. & Lagos Kpoetics',
        'genre': 'Poetry Theatre / Spoken Word',
        'synopsis': 'A sensual and tender evening of poetry, music, and spoken-word storytelling with Belinda Doubara Yanga and Chukky Ibe.',
        'cast': [
            {'name': 'Belinda Doubara Yanga', 'role': 'Actor', 'character': 'Performer', 'billing': 1},
            {'name': 'Chukky Ibe', 'role': 'Actor', 'character': 'Performer', 'billing': 2},
        ],
        'crew': []
    },
    {
        'slug': 'cut-beneath-the-silence',
        'title': 'Cut Beneath The Silence',
        'playwright': None,
        'director': None,
        'producer': None,
        'genre': 'One-Man Play',
        'synopsis': 'A gripping one-man solo performance delving into trauma, unspoken history, and emotional vulnerability.',
        'cast': [],
        'crew': []
    },
    {
        'slug': 'the-blacc-canvas',
        'title': 'The Blacc Canvas',
        'playwright': None,
        'director': None,
        'producer': 'BoiBlacc',
        'genre': 'Acoustic / Theatre Showcase',
        'synopsis': 'An intimate acoustic showcase and spoken-word stage performance presented by BoiBlacc at J. Randle Amphi Space.',
        'cast': [
            {'name': 'BoiBlacc', 'role': 'Actor', 'character': 'Lead Performer', 'billing': 1},
        ],
        'crew': []
    },
    {
        'slug': 'a-little-more-indie-a-lot-more-bs',
        'title': 'A Little More Indie. A Lot More B.S',
        'playwright': 'M. Rumbi',
        'director': None,
        'producer': 'M. Rumbi',
        'genre': 'Experimental / Indie Theatre',
        'synopsis': 'An experimental showcase exploring indie expression, artistic friction, and unfiltered youth subculture.',
        'cast': [],
        'crew': [
            {'name': 'M. Rumbi', 'role': 'Writer', 'billing': 1},
        ]
    },
    {
        'slug': 'baddies-and-ballers',
        'title': 'Baddies And Ballers',
        'playwright': None,
        'director': None,
        'producer': None,
        'genre': 'Immersive Theatre / Showcase',
        'synopsis': 'A high-energy, poolside immersive theatrical and lifestyle spectacle hosted at the J. Randle Centre.',
        'cast': [],
        'crew': []
    }
]

# Lookup map for scraped JSON details
with open('scratch/lagos_fringe_plays.json', 'r', encoding='utf-8') as f:
    scraped_plays = {p['slug']: p for p in json.load(f)}

# Cache for person IDs
person_cache = {}

def get_or_create_person(name: str, department: str = 'Acting') -> str:
    clean_name = name.strip()
    if clean_name in person_cache:
        return person_cache[clean_name]

    # 1. Look up existing person
    res = sb.table('people').select('id,name').ilike('name', clean_name).limit(1).execute()
    if res.data:
        pid = res.data[0]['id']
        person_cache[clean_name] = pid
        return pid

    # 2. Check if slug exists to avoid conflict
    p_slug = slugify(clean_name)
    s_res = sb.table('people').select('id').eq('slug', p_slug).limit(1).execute()
    if s_res.data:
        pid = s_res.data[0]['id']
        person_cache[clean_name] = pid
        return pid

    # 3. Create person afresh
    new_person = {
        'id': str(uuid.uuid4()),
        'name': clean_name,
        'slug': p_slug,
        'source': 'lagos_fringe',
        'status': 'active',
        'known_for_department': department,
        'is_verified': False
    }
    ins_res = sb.table('people').insert(new_person).execute()
    if ins_res.data:
        pid = ins_res.data[0]['id']
        person_cache[clean_name] = pid
        print(f"  + Created person record for: {clean_name} ({p_slug})")
        return pid
    else:
        raise Exception(f"Failed to create person: {clean_name}")

def main():
    print('=== INGESTING 20 LAGOS FRINGE STAGE PLAYS & CREDITS ===\n')

    ingested_count = 0
    credits_count = 0

    for item in PLAYS_METADATA:
        slug = item['slug']
        scraped = scraped_plays.get(slug, {})

        dates = scraped.get('dates', [])
        clean_dates = sorted([d[:10] for d in dates]) if dates else ['2026-11-06']
        start_date = clean_dates[0]
        end_date = clean_dates[-1]

        venue = scraped.get('venue') or 'J. Randle Centre for Yorùbá Culture & History'
        poster_url = scraped.get('poster_url') or ''
        ticket_url = scraped.get('ticket_url') or f"https://tickets.lagosfringe.com/events/{slug}"

        # Metrics storing pricing & sessions
        metrics = {
            'festival': 'Lagos Fringe Festival',
            'ticket_tiers': scraped.get('ticket_tiers', {}),
            'low_price': scraped.get('low_price'),
            'high_price': scraped.get('high_price'),
            'sessions': clean_dates,
            'source_domain': 'tickets.lagosfringe.com'
        }

        play_record = {
            'title': item['title'],
            'slug': slug,
            'playwright': item['playwright'],
            'director': item['director'],
            'producer': item['producer'],
            'venue': venue,
            'city': 'Lagos',
            'country': 'Nigeria',
            'poster_url': poster_url,
            'banner_url': None,
            'synopsis': item['synopsis'],
            'genre': item['genre'],
            'year': 2026,
            'run_start_date': start_date,
            'run_end_date': end_date,
            'status': 'upcoming',
            'performance_time': '7:00 PM WAT',
            'source_url': ticket_url,
            # Box office fields explicitly left null/blank per user request
            'box_office_domestic': None,
            'box_office_tickets_sold': None,
            'box_office_currency': 'NGN',
            'box_office_source': None,
            'box_office_metrics': metrics
        }

        # Check if already exists in plays
        existing_play = sb.table('plays').select('id').eq('slug', slug).limit(1).execute()
        if existing_play.data:
            play_id = existing_play.data[0]['id']
            sb.table('plays').update(play_record).eq('id', play_id).execute()
            print(f"✓ Updated play: {item['title']} (ID: {play_id})")
        else:
            play_record['id'] = str(uuid.uuid4())
            ins_play = sb.table('plays').insert(play_record).execute()
            play_id = ins_play.data[0]['id']
            print(f"✓ Inserted play: {item['title']} (ID: {play_id})")

        ingested_count += 1

        # Ingest credits (Cast & Crew)
        all_credits = []
        for c in item.get('cast', []):
            all_credits.append({
                'name': c['name'],
                'role': c['role'],
                'character': c.get('character'),
                'billing': c.get('billing', 1),
                'dept': 'Acting'
            })
        for c in item.get('crew', []):
            all_credits.append({
                'name': c['name'],
                'role': c['role'],
                'character': None,
                'billing': c.get('billing', 1),
                'dept': 'Directing' if c['role'] == 'Director' else 'Writing'
            })

        for cred in all_credits:
            person_id = get_or_create_person(cred['name'], cred['dept'])

            # Zero-duplicate credit guarantee
            existing_cred = sb.table('stage_credits').select('id')\
                .eq('play_id', play_id)\
                .eq('person_id', person_id)\
                .eq('role', cred['role'])\
                .limit(1).execute()

            if not existing_cred.data:
                sb.table('stage_credits').insert({
                    'play_id': play_id,
                    'person_id': person_id,
                    'role': cred['role'],
                    'character_name': cred['character'],
                    'billing_order': cred['billing']
                }).execute()
                credits_count += 1
                print(f"    • Added credit: {cred['name']} ({cred['role']})")

    print(f"\n🎉 INGESTION COMPLETE!")
    print(f"Total Plays Ingested/Updated: {ingested_count}")
    print(f"Total Stage Credits Linked: {credits_count}")

if __name__ == '__main__':
    main()
