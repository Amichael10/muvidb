import fs from 'fs';

const html = fs.readFileSync('scripts/_fh_dump.html', 'utf8');

// Loose regex that allows optional backslashes before double quotes
const regex = /\\?"id\\?":\\?"(\d+)\\?",\\?"name\\?":\\?"([^"\\]+)\\?",\\?"slug\\?":\\?"([^"\\]+)\\?"/g;

const matches = [...html.matchAll(regex)];
const locations = matches.map(m => ({
    id: m[1],
    name: m[2],
    slug: m[3]
}));

// De-duplicate by ID
const uniqueLocations = [];
const seen = new Set();
for (const loc of locations) {
    if (!seen.has(loc.id)) {
        seen.add(loc.id);
        uniqueLocations.push(loc);
    }
}

console.log("Extracted Locations:");
console.log(JSON.stringify(uniqueLocations, null, 2));

fs.writeFileSync('scripts/_extracted_locations.json', JSON.stringify(uniqueLocations, null, 2));
