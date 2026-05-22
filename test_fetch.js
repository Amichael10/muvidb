async function fetchIt() {
  const r = await fetch('https://filmhouseng.com/', {headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}});
  const text = await r.text();
  console.log(text.substring(0, 1000));
}
fetchIt();
