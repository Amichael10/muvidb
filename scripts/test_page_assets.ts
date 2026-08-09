import https from 'https';
import fs from 'fs';
import path from 'path';

async function testPageAsset(pageNum: number) {
  const url = `https://online.fliphtml5.com/ogfbg/abpz/files/mobile/${pageNum}.jpg`;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      console.log(`Page #${pageNum} asset status: ${res.statusCode}`);
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function checkPages() {
  console.log('Testing FlipHTML5 page image assets...');
  for (const p of [1, 40, 42, 79, 81, 82, 83, 84]) {
    await testPageAsset(p);
  }
}

checkPages();
