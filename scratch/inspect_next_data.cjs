const fs = require('fs');
const html = fs.readFileSync('scratch/mubi_nigeria.html', 'utf8');
const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if (match) {
    const data = JSON.parse(match[1]);
    console.log('pageProps keys:', Object.keys(data.props.pageProps));
    if (data.props.pageProps.films) console.log('films length:', data.props.pageProps.films.length);
    if (data.props.pageProps.initialData) console.log('initialData keys:', Object.keys(data.props.pageProps.initialData));
} else {
    console.log('__NEXT_DATA__ not found');
}
