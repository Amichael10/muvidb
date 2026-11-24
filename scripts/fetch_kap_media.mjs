import https from 'https';

async function fetchUrl(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return await res.text();
  } catch (err) {
    console.error('Fetch error:', err.message);
    return '';
  }
}

(async () => {
  const html = await fetchUrl('https://kapfilmandtelevisionacademy.com/');
  const matches = html.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi) || [];
  const unique = [...new Set(matches)];
  console.log('Total images found on KAP:', unique.length);
  console.log(unique.slice(0, 30));
})();
