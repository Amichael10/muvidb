import { cleanTitle } from '../api/_lib/yt_service.js';

const titles = [
  "LATEST NIGERIAN MOVIE 2024 - THE WEDDING EP 1",
  "NEW NOLLYWOOD MOVIE: BROKEN VOWS EP 205",
  "THE RETURN OF THE KING EPISODE 5 Full Movie",
  "AFRICAN DRAMA: SECRET LIVES E01",
  "HOT TRENDING FILM 2024 - LOST IN LOVE SEASON 1",
  "YORUBA MOVIE - OMO GHETTO PART 2"
];

console.log("Testing cleanTitle with EP markers:");
titles.forEach(t => {
  console.log(`Original: ${t}`);
  console.log(`Cleaned:  ${cleanTitle(t)}`);
  console.log('---');
});
