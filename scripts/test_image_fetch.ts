async function test() {
  const url = 'https://m.media-amazon.com/images/M/MV5BNWYxYjE2NGEtZWJiYi00NGI4LWI2ZTktMmE5ZGRiZjVlMmJkXkEyXkFqcGc@._V1_.jpg';
  console.log(`Fetching image ${url}...`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`Status: ${res.status}`);
    const buffer = await res.arrayBuffer();
    console.log(`Size: ${buffer.byteLength}`);
  } catch (err: any) {
    console.error(err);
  }
}

test();
