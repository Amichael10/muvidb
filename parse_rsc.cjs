const fs = require('fs');
const data = fs.readFileSync('rsc_payload.txt', 'utf8');

const dateMatches = data.match(/2026-05-22[A-Za-z0-9: \-]+/g);
console.log('Date mentions:', dateMatches ? dateMatches.slice(0, 5) : 'None');

const timeMatches = data.match(/"time":"([^"]+)"/g) || data.match(/[0-9]{2}:[0-9]{2}/g);
console.log('Times:', timeMatches ? Array.from(new Set(timeMatches)).slice(0, 10) : 'None');

const classMatches = data.match(/class=\"[^\"]*time[^\"]*\"/gi);
console.log('Classes with time:', classMatches ? Array.from(new Set(classMatches)).slice(0,5) : 'None');
