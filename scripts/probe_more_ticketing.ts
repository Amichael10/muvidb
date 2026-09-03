import * as cheerio from 'cheerio';

async function probeMoreTicketing() {
  console.log('=== Probing Eventprime ===');
  try {
    const res = await fetch('https://eventprime.co/events?category=theatre-arts', {
      headers: { 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    console.log('Eventprime status:', res.status);
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const events: string[] = [];
      $('a[href*="/e/"]').each((_, el) => {
        events.push($(el).text().trim());
      });
      console.log('Eventprime items:', Array.from(new Set(events)).filter(Boolean));
    }
  } catch (e: any) {
    console.log('Eventprime failed:', e.message);
  }

  console.log('\n=== Probing Ariiyatickets ===');
  try {
    const res = await fetch('https://ariiyatickets.com/events/', {
      headers: { 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    console.log('Ariiyatickets status:', res.status);
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const events: string[] = [];
      $('h3, h2, .event-title').each((_, el) => {
        const text = $(el).text().trim();
        if (text && (text.toLowerCase().includes('theatre') || text.toLowerCase().includes('play') || text.toLowerCase().includes('musical') || text.toLowerCase().includes('stage'))) {
          events.push(text);
        }
      });
      console.log('Ariiyatickets theatre items:', events);
    }
  } catch (e: any) {
    console.log('Ariiyatickets failed:', e.message);
  }
}

probeMoreTicketing();
