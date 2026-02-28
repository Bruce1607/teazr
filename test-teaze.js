#!/usr/bin/env node
/**
 * Teaze dataset + anti-repeat sanity checks.
 * Run: node test-teaze.js
 */
const fs = require('fs');
const path = require('path');

const BANNED_PHRASES = [
  'all is well', 'i trust', 'on your end', 'hope you\'re well', 'per my last message',
  'circling back', 'touch base', 'dear', 'sincerely',
  'i wanted to reach out', 'i was wondering if', 'i feel like', 'i think that',
  'if that makes sense', 'how are you doing today',
  'good morning', 'good evening', 'i hope this finds you well'
];

const MIN_PER_BUCKET = 50;
const EXPECTED_BUCKETS = [
  'START:PLAYFUL', 'START:CLASSY',
  'KEEP_GOING:PLAYFUL', 'KEEP_GOING:CLASSY',
  'RECONNECT:PLAYFUL', 'RECONNECT:CLASSY',
  'FOLLOW_UP:PLAYFUL', 'FOLLOW_UP:CLASSY',
  'CLOSE_KINDLY:PLAYFUL', 'CLOSE_KINDLY:CLASSY',
  'BOUNDARY:PLAYFUL', 'BOUNDARY:CLASSY'
];

const srcPath = path.join(__dirname, 'teaze-messages.js');
let src = fs.readFileSync(srcPath, 'utf8');
src = src.replace(/\)\(\s*typeof window !== 'undefined' \? window : this\s*\)/, ')(__global__)');
const fakeGlobal = {};
try {
  new Function('__global__', src)(fakeGlobal);
} catch (e) {
  console.error('Failed to load teaze-messages.js:', e.message);
  process.exit(1);
}

const TEAZE_MESSAGES = fakeGlobal.TEAZE_MESSAGES;
if (!TEAZE_MESSAGES || !TEAZE_MESSAGES.GENERAL) {
  console.error('TEAZE_MESSAGES.GENERAL not found');
  process.exit(1);
}

const MESSAGES = TEAZE_MESSAGES.GENERAL;

function hasBannedPhrase(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return BANNED_PHRASES.some(p => lower.indexOf(p) !== -1);
}

let failed = 0;

console.log('\n1) Bucket existence and count check (min ' + MIN_PER_BUCKET + ' per bucket):');
for (const key of EXPECTED_BUCKETS) {
  const items = MESSAGES[key];
  if (!items) {
    failed++;
    console.log('   ✗ MISSING bucket: ' + key);
    continue;
  }
  const count = items.length;
  const ok = count >= MIN_PER_BUCKET;
  if (!ok) failed++;
  console.log('   ' + (ok ? '✓' : '✗') + ' ' + key + ': ' + count);
}

console.log('\n2) Banned phrase check:');
let bannedCount = 0;
for (const [bucketKey, items] of Object.entries(MESSAGES)) {
  for (const item of items) {
    if (hasBannedPhrase(item.text)) {
      bannedCount++;
      failed++;
      console.log('   ✗ BANNED: ' + bucketKey + ' id=' + item.id + ': ' + item.text.slice(0, 50) + '...');
    }
  }
}
if (bannedCount === 0) console.log('   ✓ No banned phrases found');

console.log('\n3) Anti-repeat algorithm check (last-12 window, pool of 50):');
const RECENT_MAX = 12;
const bucket = MESSAGES['START:PLAYFUL'];
const recent = bucket.slice(0, 14).map(m => m.id);
const recentIds = recent.slice(-RECENT_MAX);
const recentSet = new Set(recentIds);
const preferred = bucket.filter(m => !recentSet.has(String(m.id)));
const ok = preferred.length >= 3;
if (!ok) failed++;
console.log('   ' + (ok ? '✓' : '✗') + ' Pool has ' + preferred.length + ' items after excluding last 12 (need >= 3)');

console.log('\n4) getTeazeBucket function check:');
const gfn = fakeGlobal.getTeazeBucket;
if (typeof gfn !== 'function') {
  failed++;
  console.log('   ✗ getTeazeBucket not exported');
} else {
  const r1 = gfn('GENERAL', 'START', 'PLAYFUL');
  const r2 = gfn('GENERAL', 'BOUNDARY', 'CLASSY');
  const r3 = gfn('GENERAL', 'NONEXISTENT', 'PLAYFUL');
  const ok1 = r1.length === 50;
  const ok2 = r2.length === 50;
  const ok3 = r3.length === 0;
  if (!ok1) failed++;
  if (!ok2) failed++;
  if (!ok3) failed++;
  console.log('   ' + (ok1 ? '✓' : '✗') + ' START:PLAYFUL returns ' + r1.length);
  console.log('   ' + (ok2 ? '✓' : '✗') + ' BOUNDARY:CLASSY returns ' + r2.length);
  console.log('   ' + (ok3 ? '✓' : '✗') + ' NONEXISTENT:PLAYFUL returns ' + r3.length);
}

console.log('\n' + (failed ? 'FAILED: ' + failed + ' check(s)' : 'All checks passed.'));
process.exit(failed ? 1 : 0);
