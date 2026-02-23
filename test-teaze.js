#!/usr/bin/env node
/**
 * Teaze dataset + anti-repeat sanity checks.
 * Run: node test-teaze.js
 */
const fs = require('fs');
const path = require('path');

const BANNED_PHRASES = [
  'all is well', 'i trust', 'on your end', 'hope you\'re well', 'per my last message',
  'just checking in', 'circling back', 'touch base', 'dear', 'kindly', 'sincerely',
  'i wanted to reach out', 'i was wondering if', 'i feel like', 'i think that',
  'i just', 'maybe', 'if that makes sense', 'how are you doing today',
  'good morning', 'good evening', 'no worries at all', 'i hope this finds you well'
];

const MIN_PER_BUCKET = 35;

// Load TEAZE_MESSAGES by running teaze-messages.js with a mock global
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
if (!TEAZE_MESSAGES) {
  console.error('TEAZE_MESSAGES not found');
  process.exit(1);
}

function hasBannedPhrase(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return BANNED_PHRASES.some(p => lower.indexOf(p) !== -1);
}

let failed = 0;

// 1) Each bucket meets min count
console.log('\n1) Bucket count check (min ' + MIN_PER_BUCKET + ' per bucket):');
for (const [category, buckets] of Object.entries(TEAZE_MESSAGES)) {
  for (const [bucketKey, items] of Object.entries(buckets)) {
    const count = items.length;
    const ok = count >= MIN_PER_BUCKET;
    if (!ok) failed++;
    console.log('   ' + (ok ? '✓' : '✗') + ' ' + category + ' / ' + bucketKey + ': ' + count);
  }
}

// 2) No banned phrases
console.log('\n2) Banned phrase check:');
let bannedCount = 0;
for (const [category, buckets] of Object.entries(TEAZE_MESSAGES)) {
  for (const [bucketKey, items] of Object.entries(buckets)) {
    for (const item of items) {
      if (hasBannedPhrase(item.text)) {
        bannedCount++;
        failed++;
        console.log('   ✗ BANNED: ' + category + ' / ' + bucketKey + ' id=' + item.id + ': ' + item.text.slice(0, 50) + '...');
      }
    }
  }
}
if (bannedCount === 0) console.log('   ✓ No banned phrases found');

// 3) Anti-repeat logic (unit test of the algorithm)
console.log('\n3) Anti-repeat algorithm check:');
const TEAZE_RECENT_MAX = 18;
function getTeazeRecentIds(recent, maxCount) {
  const n = maxCount != null ? Math.min(maxCount, TEAZE_RECENT_MAX) : TEAZE_RECENT_MAX;
  return recent.slice(-n);
}
const bucket = TEAZE_MESSAGES.GENERAL['START:PLAYFUL'];
const effectiveMax = Math.min(TEAZE_RECENT_MAX, Math.max(0, bucket.length - 6));
const recent = bucket.slice(0, 20).map(m => m.id); // simulate 20 shown
const recentIds = getTeazeRecentIds(recent, effectiveMax);
const exclude = new Set(['0', '1', '2']);
const preferred = bucket.filter(m => !exclude.has(String(m.id)) && !recentIds.includes(String(m.id)));
const ok = preferred.length >= 3;
if (!ok) failed++;
console.log('   ' + (ok ? '✓' : '✗') + ' Pool has ' + preferred.length + ' items (need >= 3)');

console.log('\n' + (failed ? 'FAILED: ' + failed + ' check(s)' : 'All checks passed.'));
process.exit(failed ? 1 : 0);
