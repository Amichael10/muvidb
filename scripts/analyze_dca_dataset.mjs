import fs from 'fs';

const dataFile = 'scripts/data/dca_alumni.json';
if (!fs.existsSync(dataFile)) {
  console.log(`[analyze_dca_dataset] ${dataFile} not found. Run fetch_dca_alumni.js first.`);
  process.exit(0);
}
const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
console.log('Total raw records:', raw.length);

let withAvatar = 0;
let withCourse = 0;
let withPort = 0;
let withExp = 0;
let withProf = 0;
let withSocial = 0;
let eligibleCount = 0;

const creativeProfessions = new Set();

for (const item of raw) {
  const hasAv = !!(item.avatar?.image || item.avatar?.thumb);
  const hasCo = !!(item.course?.title || (item.courses && item.courses.length > 0) || (item.education && item.education.some(e => (e.name || '').toUpperCase().includes('DEL'))));
  const hasPo = !!(item.portfolios && item.portfolios.length > 0);
  const hasEx = !!(item.experience && item.experience.length > 0);
  const hasPr = !!(item.profession?.title);
  const hasSo = !!(item.instagram_link || item.twitter_link || item.linkedin_link);

  if (hasAv) withAvatar++;
  if (hasCo) withCourse++;
  if (hasPo) withPort++;
  if (hasEx) withExp++;
  if (hasPr) {
    withProf++;
    creativeProfessions.add(item.profession.title.toLowerCase().trim());
  }
  if (hasSo) withSocial++;

  if (hasAv || hasCo || hasPo || hasEx || hasSo) {
    eligibleCount++;
  }
}

console.log('--- STATS ---');
console.log('With Avatar:', withAvatar);
console.log('With Course / DCA Training:', withCourse);
console.log('With Portfolios:', withPort);
console.log('With Experience:', withExp);
console.log('With Profession:', withProf);
console.log('With Social Links:', withSocial);
console.log('Total Eligible (has at least 1 rich attribute):', eligibleCount);
console.log('Sample creative professions:', Array.from(creativeProfessions).slice(0, 30));
