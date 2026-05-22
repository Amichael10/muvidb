import fs from 'fs';
const t = fs.readFileSync('playwright_stealth_dump.html', 'utf8');

// Find the location select or dropdown
const dropdownMatches = t.match(/.{0,50}Lekki.{0,50}/gi);
console.log('Lekki matches in stealth HTML:');
if(dropdownMatches) dropdownMatches.slice(0, 15).forEach(m => console.log(m.trim()));

// Also let's find the current location of the dropdown toggle
const selectMatches = t.match(/<select[^>]*>/gi);
console.log('\nSelect tags:');
if(selectMatches) selectMatches.slice(0, 10).forEach(m => console.log(m.trim()));

const buttonMatches = t.match(/<button[^>]*class=\"[^\"]*dropdown[^\"]*\"[^>]*>/gi);
console.log('\nDropdown buttons:');
if(buttonMatches) buttonMatches.slice(0, 10).forEach(m => console.log(m.trim()));
