const t0 = Date.now();

async function test() {
  console.log('='.repeat(70));
  console.log('⚡ TESTING AUTOMATED FAST CLIPPER END-TO-END');
  console.log('='.repeat(70));

  const res = await fetch('http://127.0.0.1:4317/clip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://www.youtube.com/watch?v=8lDFSeFwSd0',
      start_time: 100,
      end_time: 120,
      aspect_ratio: '9:16',
      fit_mode: 'cover',
      title: 'automated_fast_test'
    })
  });

  const data = await res.json();
  console.log('Job Started:', data);

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const s = await fetch(data.status_url).then(r => r.json());
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[${elapsed}s] Progress: ${s.progress || 0}% - ${s.message || s.status}`);

    if (s.success || s.status === 'complete' || s.download_url) {
      console.log('\n' + '='.repeat(70));
      console.log(`🎉 CLIP GENERATED SUCCESSFULLY IN ${elapsed} SECONDS!`);
      console.log('File Size :', s.size_mb, 'MB');
      console.log('Duration  :', s.duration, 's');
      console.log('Download  :', s.download_url);
      console.log('='.repeat(70));
      return;
    }
  }
}

test().catch(console.error);
