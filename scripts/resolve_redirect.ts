import fetch from 'node-fetch';

async function run() {
  const url = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFfRO8OFNhhxhXwLcE1nuNp3gPeETfsHwY5Big5Z4JIM_rmhwM0Z3CvNIqo5yXJEkTW6GaJq6ZqLJPJUd_vtyQLK8Vs6T8WvFDk6hvq-MLzRLEUQV7gtUW--afK_3sYZm2gB2_3NSRq3jQ0kT-2JQfdtsw=';
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      redirect: 'manual'
    });
    console.log('Status:', res.status);
    console.log('Location:', res.headers.get('location'));
  } catch (e) {
    console.error(e);
  }
}

run();
