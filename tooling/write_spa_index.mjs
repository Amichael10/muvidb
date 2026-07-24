/**
 * After `react-router build` with ssr:true, build/client has no index.html
 * (HTML is meant to come from the server). Production currently serves the
 * static client shell, so we synthesize index.html pointing at the hashed
 * entry.client + root CSS chunks.
 *
 * Lives under tooling/ (not scripts/) because .vercelignore excludes scripts/.
 */
import fs from 'node:fs';
import path from 'node:path';

const clientDir = path.resolve('build/client');
const assetsDir = path.join(clientDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('write_spa_index: build/client/assets missing — run react-router build first');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const entry = files.find((f) => /^entry\.client-.*\.js$/.test(f));
const css = files.find((f) => /^root-.*\.css$/.test(f));

if (!entry) {
  console.error('write_spa_index: no entry.client-*.js in build/client/assets');
  process.exit(1);
}

const cssLink = css ? `    <link rel="stylesheet" href="/assets/${css}" />\n` : '';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#FF5C00" />
    <link rel="preconnect" href="https://pkenrmorywmuvnzfoylp.supabase.co" crossorigin />
    <link rel="dns-prefetch" href="https://pkenrmorywmuvnzfoylp.supabase.co" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="manifest" href="/site.webmanifest" />
    <title>MuviDB | The Ultimate African Film & Entertainment Database</title>
    <meta name="description" content="Every film. Every credit. Explore African cinema, discover talent, track releases, and connect with the people behind the stories." />
${cssLink}  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${entry}"></script>
  </body>
</html>
`;

const out = path.join(clientDir, 'index.html');
fs.writeFileSync(out, html);
console.log(`write_spa_index: wrote ${out} (entry=${entry}${css ? `, css=${css}` : ''})`);
