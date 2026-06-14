import fetch from 'node-fetch';

async function testGQL() {
  const url = 'https://kavaapi.muvi.com/content';
  const query = `
    {
      contentList(app_token:":app_token", product_key:":product_key", content_permalink:"living-in-bondage", language_code:"en") {
        content_list {
          content_name
          content_uuid
          video_details { duration }
          categories { category_name }
          cast_details { cast_name cast_type_details { cast_type_name } }
        }
      }
    }
  `;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.text();
    console.log("Response:", data);
  } catch (err) {
    console.error(err);
  }
}

testGQL();
