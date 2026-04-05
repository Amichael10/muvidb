const https = require('https');

https.get('https://pkenrmorywmuvnzfoylp.supabase.co', (res) => {
  console.log('Status Code:', res.statusCode);
}).on('error', (e) => {
  console.error(e);
});
