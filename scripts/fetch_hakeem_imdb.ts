import 'dotenv/config';
import dns from 'node:dns';
import { Agent, fetch as undiciFetch } from 'undici';

dns.setDefaultResultOrder('ipv4first');
const dispatcher = new Agent({ connect: { timeout: 60000, lookup: (h, o, cb) => dns.lookup(h, { ...o, family: 4 }, cb) } });

async function fetchImdb(nmId: string) {
  const url = `https://www.imdb.com/name/${nmId}/`;
  const res = await undiciFetch(url, {
    dispatcher,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  if (res.ok) {
    const text = await res.text();
    // Extract __NEXT_DATA__
    const match = text.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      return data?.props?.pageProps?.aboveTheFoldData;
    }
  }
  return null;
}

async function main() {
  console.log('Fetching IMDb data for nm8287002 (Hakeem Effect)...');
  const data = await fetchImdb('nm8287002');
  if (data) {
    console.log('Name:', data.nameText?.text);
    console.log('Bio:', data.bio?.text?.plainText);
    console.log('Image:', data.primaryImage?.url);
    console.log('Birth Date:', data.birthDate?.dateComponents);
    console.log('Known For:', data.knownFor?.edges?.map((e: any) => e.node?.title?.titleText?.text));
  } else {
    console.log('Could not extract JSON from IMDb page.');
  }
}

main().catch(console.error);
