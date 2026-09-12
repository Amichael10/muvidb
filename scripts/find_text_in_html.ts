import { execSync } from 'child_process';
import fs from 'fs';

const url = "https://www.itsawrapng.com/post/aba-blues-a-beautiful-idea-lost-in-execution";
const html = execSync(`curl.exe -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" "${url}"`, { maxBuffer: 15 * 1024 * 1024 }).toString('utf8');

// Let's find "Aba Blues" or "Jack'enneth" or sentences from the post in the raw HTML
console.log('HTML total length:', html.length);
const matches = html.match(/Jack[’']?enneth[^\n<"]{10,200}/g);
console.log('Matches for Jack’enneth in HTML:', matches);

// Let's find where article paragraphs or sentences are stored in HTML
const pMatches = html.match(/<p[^>]*>(.*?)<\/p>/gi);
console.log('Count of <p> tags:', pMatches?.length || 0);
if (pMatches) {
  console.log('Sample <p> tags:', pMatches.slice(0, 10));
}

// Let's search for JSON data containing post text
const jsonPosts = html.match(/\{"[^"]*content[^}]*\}/gi);
console.log('Content JSON matches count:', jsonPosts?.length || 0);
