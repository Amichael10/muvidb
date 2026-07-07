import fs from 'fs';

// Read the unescaped RSC chunks from _fh_dump.html
const html = fs.readFileSync('scripts/_fh_dump.html', 'utf8');

// Try to find occurrences of city names, and see if there are numbers/ids nearby
const cities = [
    'lekki', 'asaba', 'akure', 'benin', 'ibadan', 'kano', 'surulere', 
    'port-harcourt', 'calabar', 'circle-mall', 'landmark', 'sabo'
];

cities.forEach(city => {
    const idx = html.toLowerCase().indexOf(city);
    if (idx !== -1) {
        console.log(`Found city: ${city}`);
        const snippet = html.substring(Math.max(0, idx - 200), Math.min(html.length, idx + 200));
        console.log(snippet);
        console.log('--------------------------------------------------');
    }
});
