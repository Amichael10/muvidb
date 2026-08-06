/**
 * Precompile the React Email template(s) to plain .js so Vercel's serverless
 * bundler (@vercel/node) ships them.
 *
 * Why: in the ESM `api/data` function, @vercel/node traces/emits `.ts` helper
 * files but does NOT pull raw `.tsx` files into the lambda. Importing
 * `./MuviDbWelcomeEmail.js` (source `.tsx`) therefore throws ERR_MODULE_NOT_FOUND
 * at runtime, breaking confirm/reset/welcome emails.
 *
 * Fix: esbuild the `.tsx` into a real sibling `.generated.js`. React and
 * @react-email stay EXTERNAL so the runtime shares a single React instance with
 * welcome_email.ts (react-email's render() must see elements from the same React).
 *
 * Runs via the `prebuild` npm hook, so `api/_lib/*.generated.js` exists on disk
 * before @vercel/node builds the functions. The generated files are gitignored.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const templates = [
  {
    in: resolve(root, 'api/_lib/MuviDbWelcomeEmail.tsx'),
    out: resolve(root, 'api/_lib/MuviDbWelcomeEmail.generated.js'),
  },
];

async function main() {
  for (const t of templates) {
    await build({
      entryPoints: [t.in],
      outfile: t.out,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node20',
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      // Keep React / react-email out of the bundle so there is exactly one
      // React instance at runtime (shared with welcome_email.ts).
      external: ['react', 'react-dom', 'react/*', 'react-dom/*', '@react-email/*'],
      logLevel: 'info',
    });
    console.log(`[email-templates] built ${t.out}`);
  }
}

main().catch((err) => {
  console.error('[email-templates] build failed:', err);
  process.exit(1);
});
