const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/dstv_next_data.json', 'utf-8'));
const items = data.props?.pageProps?.widgets[3]?.content?.items || [];

async function fetchShowPage(link) {
  const url = `https://www.dstv.com${link}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.status === 200) {
      const text = await res.text();
      const match = text.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (match) {
        return JSON.parse(match[1]);
      }
    }
  } catch (e) {
    console.error(`Error fetching ${url}:`, e.message);
  }
  return null;
}

async function run() {
  console.log(`Fetching details for ${items.length} Africa Magic shows...`);
  const results = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    console.log(`[${i + 1}/${items.length}] Fetching ${it.title} (${it.link})...`);
    
    // Base data from listing
    const poster = it.image_poster?.webp || it.image_poster?.normal || null;
    const baseShow = {
      id: it.id,
      title: it.title,
      synopsis: it.blurb,
      genres: it.genres || [],
      age_rating: it.rating,
      type: it.model === 'Show' ? 'series' : (it.model || 'series'),
      channel: it.channel_name,
      channel_number: it.channel_number,
      link: it.link,
      season: it.season,
      poster: poster,
      backdrop: null,
      runtime: null,
      episode: null,
      cast: [],
      crew: []
    };

    const showData = await fetchShowPage(it.link);
    if (showData) {
      fs.writeFileSync(`scratch/show_${it.id}_${it.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`, JSON.stringify(showData, null, 2));

      const widgets = showData.props?.pageProps?.widgets || [];

      // 1. Billboard (Backdrop)
      const bb = widgets.find(w => w.component === 'billboard')?.content;
      const bbImg = bb?.items?.[0]?.image_large;
      const backdrop = bbImg?.webp || bbImg?.normal || null;
      baseShow.backdrop = backdrop || poster; // Fallback to poster if no backdrop

      // 2. Nav-info (Genre, Rating, Time)
      const navInfo = widgets.find(w => w.component === 'nav-info')?.content;
      if (navInfo) {
        if (!baseShow.age_rating && navInfo.rating) baseShow.age_rating = navInfo.rating;
        if (navInfo.time) baseShow.air_time = navInfo.time;
        if (navInfo.genre && baseShow.genres.length === 0) baseShow.genres = [navInfo.genre];
      }

      // 3. Sub-items (About & Next Episode)
      const subItemsWidget = widgets.find(w => w.component === 'sub-items');
      if (subItemsWidget?.subItems) {
        const about = subItemsWidget.subItems.find(s => s.component === 'about')?.content;
        if (about?.body) {
          const cleanBody = about.body.replace(/<[^>]+>/g, '').trim();
          if (cleanBody && cleanBody.length > (baseShow.synopsis || '').length) {
            baseShow.synopsis = cleanBody;
          }
        }
        const ep = subItemsWidget.subItems.find(s => s.component === 'next-episode')?.content;
        if (ep) {
          baseShow.latest_episode = {
            season: ep.season,
            episode: ep.episode,
            title: ep.title,
            synopsis: ep.body,
            rating: ep.rating,
            air_date: ep.publish_date
          };
        }
      }

      // 4. Seasons Selector (Total seasons)
      const seasonsWidget = widgets.find(w => w.component === 'previous_seasons_selector')?.content;
      if (seasonsWidget?.items) {
        baseShow.available_seasons = seasonsWidget.items.map(s => s.season || s.title);
      }

      // 5. Check if there is a characters page link
      const charNav = navInfo?.navigation?.find(n => n.title === 'Characters');
      if (charNav?.link) {
        const charData = await fetchShowPage(charNav.link);
        if (charData) {
          const charWidgets = charData.props?.pageProps?.widgets || [];
          const charList = charWidgets.find(w => w.component === 'content-box-list')?.content?.items || [];
          baseShow.characters = charList.map(c => ({
            name: c.title,
            image: c.image_poster?.webp || c.image_poster?.normal || null,
            link: c.link
          }));
        }
      }
    } else {
      baseShow.backdrop = poster; // fallback
    }

    results.push(baseShow);
    await new Promise(r => setTimeout(r, 600));
  }

  fs.writeFileSync('scratch/all_dstv_shows_enriched.json', JSON.stringify(results, null, 2));
  console.log(`\n🎉 Processed all ${results.length} shows! Saved to scratch/all_dstv_shows_enriched.json`);
}

run();
