const fs = require('fs');
const https = require('https');

const url = 'https://api-ott.afrolandtv.com/getreferencedobjects?&banners=0&connection=wifi&device_type=desktop&for_user=0&image_format=widescreen&image_width=366&is_af_request=1&language=en&object_type=video&order=random&parent_id=3258&parent_type=collection&partner=internal&platform=web&version=13&video_type=feature';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('scratch/afroland_api_2.json', data);
    console.log('Saved', data.length, 'bytes');
  });
}).on('error', err => {
  console.error('Error:', err.message);
});
