import json
import os
import re
import sys
import urllib.request
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/lagosfringe_theatre.html', 'r', encoding='utf-8', errors='ignore') as f:
    main_html = f.read()

soup = BeautifulSoup(main_html, 'html.parser')
links = []
for a in soup.find_all('a', href=True):
    href = a['href']
    if href.startswith('/events/') and href not in links:
        links.append(href)

headers = {'User-Agent': 'Mozilla/5.0'}
all_plays = []

for rel_link in links:
    full_url = f'https://tickets.lagosfringe.com{rel_link}'
    slug = rel_link.replace('/events/', '').strip('/')
    try:
        req = urllib.request.Request(full_url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
        
        detail_soup = BeautifulSoup(html, 'html.parser')
        
        json_ld = []
        for s in detail_soup.find_all('script', type='application/ld+json'):
            try:
                parsed = json.loads(s.string)
                if isinstance(parsed, list):
                    json_ld.extend(parsed)
                elif isinstance(parsed, dict):
                    json_ld.append(parsed)
            except:
                pass
        
        first_event = json_ld[0] if json_ld else {}
        
        h1 = detail_soup.find('h1')
        title = first_event.get('name') or (h1.get_text(strip=True) if h1 else slug)
        
        tagline_elem = detail_soup.select_one('.event__tagline')
        tagline = tagline_elem.get_text(strip=True) if tagline_elem else ''
        
        about_elem = detail_soup.select_one('.event__details, .detail-block')
        about_text = about_elem.get_text(' ', strip=True) if about_elem else ''
        
        # Parse Credits
        playwright = None
        director = None
        starring = []
        producer = None
        
        # Regex extraction from about_text
        w_match = re.search(r'Written by\s+([^.]+)', about_text, re.I)
        if w_match:
            playwright = w_match.group(1).strip()
            
        d_match = re.search(r'Directed by\s+([^.]+)', about_text, re.I)
        if d_match:
            director = d_match.group(1).strip()
            
        s_match = re.search(r'Starring\s+([^.]+)', about_text, re.I)
        if s_match:
            starring = [p.strip() for p in re.split(r',|\band\b', s_match.group(1)) if p.strip()]
            
        p_match = re.search(r'(?:Presented by|Production|Produced by)\s+([^.]+)', about_text, re.I)
        if p_match:
            producer = p_match.group(1).strip()
            
        # Dates and Times
        dates = [e.get('startDate') for e in json_ld if isinstance(e, dict) and e.get('startDate')]
        
        # Sessions
        sessions = []
        for tile in detail_soup.select('.session-tile, [class*="session"]'):
            t = tile.get_text(' ', strip=True)
            if t and t not in sessions:
                sessions.append(t)
                
        # Ticket Tiers
        tiers = {}
        for row in detail_soup.select('[class*="ticket"], [class*="tier"]'):
            txt = row.get_text(' ', strip=True)
            m = re.findall(r'(Regular|VIP|VVIP|Early Bird|Table|[A-Za-z\s]+)\s*₦([\d,]+)', txt)
            for tier_name, tier_price in m:
                clean_name = tier_name.strip()
                if len(clean_name) < 25 and clean_name not in ['From', 'starts in']:
                    tiers[clean_name] = f"₦{tier_price}"
                    
        offers = first_event.get('offers', {})
        low_price = offers.get('lowPrice')
        high_price = offers.get('highPrice')
        
        venue_info = first_event.get('location', {})
        venue_name = venue_info.get('name') if isinstance(venue_info, dict) else ''
        venue_addr = venue_info.get('address') if isinstance(venue_info, dict) else ''
        
        image = first_event.get('image') or ''
        
        play_record = {
            'title': title,
            'slug': slug,
            'tagline': tagline,
            'playwright': playwright,
            'director': director,
            'starring': starring,
            'producer': producer,
            'venue': venue_name,
            'address': venue_addr,
            'dates': dates,
            'low_price': low_price,
            'high_price': high_price,
            'ticket_tiers': tiers,
            'poster_url': image,
            'ticket_url': full_url,
            'about': about_text[:400]
        }
        all_plays.append(play_record)
        print(f"✓ Scraped: {title} ({len(dates)} dates, venue: {venue_name})")
    except Exception as e:
        print(f"✗ Failed {slug}: {e}")

out_path = 'scratch/lagos_fringe_plays.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(all_plays, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully harvested {len(all_plays)} stage plays to {out_path}!")
