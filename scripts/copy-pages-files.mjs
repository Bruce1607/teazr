#!/usr/bin/env node
/**
 * Copies static assets and Cloudflare Pages config (_headers, _routes.json)
 * into the build output directory. SPA fallback is handled via Pages Functions
 * (functions/[[path]].js), not _redirects.
 *
 * Usage: node scripts/copy-pages-files.mjs
 * Env:   CLOUDFLARE_PAGES_OUTPUT_DIR (default: dist/public)
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const OUTPUT_DIR = process.env.CLOUDFLARE_PAGES_OUTPUT_DIR || 'dist/public';
const outPath = join(ROOT, OUTPUT_DIR);

// Pages config files - MUST be in output root for routing
const PAGES_FILES = ['_headers', '_routes.json'];

// Static assets to copy
const STATIC_FILES = [
  'index.html',
  'teaze.html',
  'app.js',
  'styles.css',
  'teaze-messages.js',
  'deploy-ping.txt',
];

// Extra assets (may not exist)
const ASSET_PATTERNS = ['.jpg', '.png', '.ico', '.webp', '.svg'];

// Directories/files to skip
const SKIP = new Set(['functions', 'scripts', 'node_modules', '.git', 'dist']);

function copy(from, to) {
  if (!existsSync(from)) return false;
  const destDir = dirname(to);
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  copyFileSync(from, to);
  return true;
}

function main() {
  mkdirSync(outPath, { recursive: true });

  const copied = [];

  // 1. Pages config - critical for SPA routing
  for (const name of PAGES_FILES) {
    const src = join(ROOT, name);
    const dest = join(outPath, name);
    if (copy(src, dest)) {
      copied.push(name);
      console.log(`[copy-pages] ${name} -> ${OUTPUT_DIR}/`);
    } else {
      console.warn(`[copy-pages] WARN: ${name} not found at repo root`);
    }
  }

  // 2. Static files
  for (const name of STATIC_FILES) {
    const src = join(ROOT, name);
    const dest = join(outPath, name);
    if (copy(src, dest)) copied.push(name);
  }

  // 3. Assets (og.jpg, og-teaze.jpg, etc.)
  const rootFiles = readdirSync(ROOT, { withFileTypes: true });
  for (const e of rootFiles) {
    if (!e.isFile()) continue;
    const lower = e.name.toLowerCase();
    const isAsset = ASSET_PATTERNS.some(ext => lower.endsWith(ext));
    if (isAsset) {
      const src = join(ROOT, e.name);
      const dest = join(outPath, e.name);
      if (copy(src, dest)) copied.push(e.name);
    }
  }

  console.log(`[copy-pages] Done. Copied ${copied.length} files to ${OUTPUT_DIR}/`);

  // SPA routing: _routes.json + Pages Function (functions/[[path]].js), not _redirects
  const routesDest = join(outPath, '_routes.json');
  if (!existsSync(routesDest)) {
    console.error('[copy-pages] ERROR: _routes.json was NOT copied. SPA routing will fail.');
    process.exit(1);
  }
  console.log('[copy-pages] _routes.json in output:', routesDest);
}

main();
