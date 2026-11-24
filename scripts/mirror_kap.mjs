import fs from 'fs';
import path from 'path';

const kapUrls = [
  { name: 'kap_campus_1.jpg', url: 'https://kapfilmandtelevisionacademy.com/wp-content/uploads/2025/02/DSC03009-scaled.jpg' },
  { name: 'kap_class_2.jpg', url: 'https://kapfilmandtelevisionacademy.com/wp-content/uploads/2025/02/2S7A1118-scaled.jpg' },
  { name: 'kap_workshop_3.jpg', url: 'https://kapfilmandtelevisionacademy.com/wp-content/uploads/2025/02/DSC00469.jpg' },
  { name: 'kap_about.png', url: 'https://kapfilmandtelevisionacademy.com/wp-content/uploads/2025/02/about1.png' },
];

(async () => {
  const dir = path.resolve('public/media/kap');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const item of kapUrls) {
    try {
      const res = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(path.join(dir, item.name), buffer);
        console.log(`Saved ${item.name} (${buffer.length} bytes)`);
      } else {
        console.log(`Failed ${item.url}: ${res.status}`);
      }
    } catch (e) {
      console.log(`Err ${item.name}: ${e.message}`);
    }
  }
})();
