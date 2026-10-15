import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['docs/security/2026-10-15-reproductions.test.ts']}});
