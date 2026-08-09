import fs from 'fs';

const text = fs.readFileSync('outputs/yearbook_2025_config.js', 'utf8');

// Strip "var htmlConfig = " and parse JSON
const jsonText = text.replace(/^var\s+htmlConfig\s*=\s*/, '').replace(/;\s*$/, '');

try {
  const config = JSON.parse(jsonText);
  console.log('Successfully parsed htmlConfig JSON!');
  console.log('Config keys:', Object.keys(config));

  if (config.aliasConfig) {
    console.log('aliasConfig keys:', Object.keys(config.aliasConfig));
  }
} catch (err: any) {
  console.error('JSON parse error:', err.message);
  console.log('Sample text start:', jsonText.slice(0, 300));
}
