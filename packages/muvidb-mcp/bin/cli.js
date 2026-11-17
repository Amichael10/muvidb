#!/usr/bin/env node

import { startServer } from '../src/index.js';

startServer().catch((err) => {
  console.error('Fatal error starting MuviDB MCP server:', err);
  process.exit(1);
});
