#!/usr/bin/env node
/**
 * Copies static assets into the build output directory.
 * SPA routing via _redirects (/* /index.html 200) for Cloudflare Pages static deploy.
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

// Cloudflare Pages static files: _redirects (SPA fallback) + optional _headers
const PAGES_FILES = ['_redirects', '_headers'];

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

  // 1. _redirects (required for SPA) + optional _headers
  for (const name of PAGES_FILES) {
    const src = join(ROOT, name);
    const dest = join(outPath, name);
    if (copy(src, dest)) {
      copied.push(name);
      console.log(`[copy-pages] ${name} -> ${OUTPUT_DIR}/`);
    }
    // _headers is optional; no error if missing
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
}

main();
